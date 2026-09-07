// ============================================
// EmailSender.gs - Logic gửi email chính
// ============================================

/**
 * Gửi 1 email cho 1 người nhận
 * @param {Object} recipient - {row, email, data: {Tên, ...}, status}
 * @param {Object} emailContent - {subject, htmlBody, attachments, inlineImages}
 * @param {Object} config - Cấu hình từ getConfig()
 * @param {Number} batchNum - Số batch hiện tại
 * @returns {Boolean} true nếu gửi thành công
 */
function sendSingleEmail(recipient, emailContent, config, batchNum) {
  try {
    // Validate email
    if (!isValidEmail(recipient.email)) {
      markAsError(recipient.row, "Email không hợp lệ");
      addLogEntry(recipient.email, "", "Lỗi", "Email không hợp lệ", batchNum);
      return false;
    }
    
    // Kiểm tra quota
    if (!hasQuotaRemaining()) {
      logError("Hết quota gửi email hôm nay!");
      return false;
    }
    
    // Cá nhân hóa tiêu đề
    var personalSubject = replaceTemplateVars(
      config["Tiêu đề email"] || emailContent.subject,
      recipient.data
    );
    
    // Nếu dùng mode manual, lấy tiêu đề từ config
    // Nếu dùng draft, lấy tiêu đề từ draft (nhưng vẫn cho phép template vars)
    if (config["Chế độ nội dung"] !== "manual" && emailContent.subject) {
      personalSubject = replaceTemplateVars(emailContent.subject, recipient.data);
    }
    
    // Cá nhân hóa nội dung
    var personalBody = replaceTemplateVars(emailContent.htmlBody, recipient.data);
    
    // Chuẩn bị options
    var options = {
      htmlBody: personalBody
    };
    
    // CC & BCC
    if (config["CC"]) options.cc = config["CC"];
    if (config["BCC"]) options.bcc = config["BCC"];
    
    // Đính kèm (từ draft)
    if (emailContent.attachments && emailContent.attachments.length > 0) {
      options.attachments = emailContent.attachments;
    }
    
    // Inline images (từ draft)
    if (emailContent.inlineImages && Object.keys(emailContent.inlineImages).length > 0) {
      options.inlineImages = emailContent.inlineImages;
    }
    
    // GỬI EMAIL - mỗi người 1 email riêng biệt
    GmailApp.sendEmail(
      recipient.email,
      personalSubject,
      "", // plain text fallback (để trống vì đã có htmlBody)
      options
    );
    
    // Ghi trạng thái thành công
    markAsDone(recipient.row);
    incrementQuota();
    addLogEntry(recipient.email, personalSubject, "✅ Thành công", "", batchNum);
    
    logInfo("✅ Đã gửi: " + recipient.email);
    return true;
    
  } catch (e) {
    // Ghi trạng thái lỗi
    var errorMsg = e.message || String(e);
    markAsError(recipient.row, errorMsg);
    addLogEntry(recipient.email, "", "❌ Lỗi", errorMsg, batchNum);
    
    logError("❌ Lỗi gửi " + recipient.email + ": " + errorMsg);
    return false;
  }
}

/**
 * Gửi email test đến email test trong cấu hình
 */
function sendTestEmail() {
  var config = getConfig();
  var testEmail = config["Email test"];
  
  if (!testEmail || !isValidEmail(testEmail)) {
    showAlert("⚠️ Lỗi", "Vui lòng cấu hình 'Email test' hợp lệ trong sheet ⚙️ Cấu hình");
    return;
  }
  
  // Lấy nội dung email
  var emailContent = getEmailContent(config);
  if (!emailContent) {
    showAlert("⚠️ Lỗi", "Không thể lấy nội dung email. Kiểm tra cấu hình chế độ nội dung.");
    return;
  }
  
  // Tạo dữ liệu test
  var testRecipient = {
    row: -1, // Không ghi vào sheet
    email: testEmail,
    data: {
      "Email": testEmail,
      "Tên": "[TÊN TEST]",
      "Ghi chú": "[GHI CHÚ TEST]"
    },
    status: ""
  };
  
  // Lấy headers thực từ sheet để tạo dữ liệu test đầy đủ
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dataSheet = ss.getSheetByName(SHEET_DATA);
  if (dataSheet && dataSheet.getLastColumn() > 0) {
    var headers = dataSheet.getRange(1, 1, 1, dataSheet.getLastColumn()).getDisplayValues()[0];
    for (var i = 0; i < headers.length; i++) {
      var h = String(headers[i]).trim();
      if (h && h !== "Trạng thái" && !testRecipient.data[h]) {
        testRecipient.data[h] = "[" + h.toUpperCase() + " TEST]";
      }
    }
  }
  
  try {
    // Cá nhân hóa
    var subject = replaceTemplateVars(
      config["Tiêu đề email"] || emailContent.subject,
      testRecipient.data
    );
    
    if (config["Chế độ nội dung"] !== "manual" && emailContent.subject) {
      subject = replaceTemplateVars(emailContent.subject, testRecipient.data);
    }
    
    var body = replaceTemplateVars(emailContent.htmlBody, testRecipient.data);
    
    // Thêm banner TEST
    var testBanner = '<div style="background:#ff9800;color:#fff;padding:10px;text-align:center;font-weight:bold;font-size:16px;border-radius:5px;margin-bottom:15px;">🧪 ĐÂY LÀ EMAIL TEST - KHÔNG PHẢI EMAIL THẬT</div>';
    body = testBanner + body;
    
    var options = { htmlBody: body };
    if (emailContent.attachments && emailContent.attachments.length > 0) {
      options.attachments = emailContent.attachments;
    }
    if (emailContent.inlineImages && Object.keys(emailContent.inlineImages).length > 0) {
      options.inlineImages = emailContent.inlineImages;
    }
    
    GmailApp.sendEmail(testEmail, "🧪 [TEST] " + subject, "", options);
    
    showToast("✅ Đã gửi email test đến " + testEmail, "Test thành công");
    logInfo("Test email sent to: " + testEmail);
    
  } catch (e) {
    showAlert("❌ Lỗi gửi test", e.message || String(e));
    logError("Test email error: " + e.message);
  }
}
