// ============================================
// EmailSender.gs - Xử lý logic gửi email cá nhân hóa
// ============================================

/**
 * Gửi một email đến một người nhận cụ thể
 * @param {Object} recipient - {row, email, data: {Tên, ...}, status}
 * @param {Object} emailContent - {subject, htmlBody, attachments, inlineImages}
 * @param {Object} config - Bảng cấu hình từ getConfig()
 * @param {Number|String} batchNum - Mã đợt gửi hiện tại
 * @returns {Boolean} true nếu gửi thành công
 */
function sendSingleEmail(recipient, emailContent, config, batchNum) {
  try {
    if (!isValidEmail(recipient.email)) {
      markAsError(recipient.row, "Địa chỉ email không hợp lệ");
      addLogEntry(recipient.email, "", "Lỗi", "Địa chỉ email không hợp lệ", batchNum);
      return false;
    }
    
    if (!hasQuotaRemaining()) {
      logError("Đã vượt quá hạn mức gửi email trong ngày.");
      return false;
    }
    
    var personalSubject = replaceTemplateVars(
      config["Tiêu đề email"] || emailContent.subject,
      recipient.data
    );
    
    if (config["Chế độ nội dung"] !== "manual" && emailContent.subject) {
      personalSubject = replaceTemplateVars(emailContent.subject, recipient.data);
    }
    
    var personalBody = replaceTemplateVars(emailContent.htmlBody, recipient.data);
    
    var options = {
      htmlBody: personalBody
    };
    
    if (config["CC"]) options.cc = config["CC"];
    if (config["BCC"]) options.bcc = config["BCC"];
    
    if (emailContent.attachments && emailContent.attachments.length > 0) {
      options.attachments = emailContent.attachments;
    }
    
    if (emailContent.inlineImages && Object.keys(emailContent.inlineImages).length > 0) {
      options.inlineImages = emailContent.inlineImages;
    }
    
    GmailApp.sendEmail(
      recipient.email,
      personalSubject,
      "",
      options
    );
    
    markAsDone(recipient.row);
    incrementQuota();
    addLogEntry(recipient.email, personalSubject, "Thành công", "", batchNum);
    
    logInfo("Đã gửi thành công: " + recipient.email);
    return true;
    
  } catch (e) {
    var errorMsg = e.message || String(e);
    markAsError(recipient.row, errorMsg);
    addLogEntry(recipient.email, "", "Lỗi", errorMsg, batchNum);
    
    logError("Lỗi khi gửi đến " + recipient.email + ": " + errorMsg);
    return false;
  }
}

/**
 * Gửi email kiểm tra thử nghiệm đến địa chỉ được thiết lập trong Cấu hình
 */
function sendTestEmail() {
  var config = getConfig();
  var testEmail = config["Email test"];
  
  if (!testEmail || !isValidEmail(testEmail)) {
    showAlert("Thông báo", "Vui lòng nhập địa chỉ 'Email test' hợp lệ trong bảng Cấu hình.");
    return;
  }
  
  var emailContent = getEmailContent(config);
  if (!emailContent) {
    showAlert("Lỗi nội dung", "Không thể lấy nội dung email. Vui lòng kiểm tra lại thiết lập chế độ nội dung.");
    return;
  }
  
  var testRecipient = {
    row: -1,
    email: testEmail,
    data: {
      "Email": testEmail,
      "Tên": "[Tên Mẫu]",
      "Ghi chú": "[Ghi Chú Mẫu]"
    },
    status: ""
  };
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dataSheet = findSheet(ss, SHEET_DATA, SHEET_DATA_LEGACY);
  if (dataSheet && dataSheet.getLastColumn() > 0) {
    var headers = dataSheet.getRange(1, 1, 1, dataSheet.getLastColumn()).getDisplayValues()[0];
    for (var i = 0; i < headers.length; i++) {
      var h = String(headers[i]).trim();
      if (h && h !== "Trạng thái" && !testRecipient.data[h]) {
        testRecipient.data[h] = "[" + h + " Mẫu]";
      }
    }
  }
  
  try {
    var subject = replaceTemplateVars(
      config["Tiêu đề email"] || emailContent.subject,
      testRecipient.data
    );
    
    if (config["Chế độ nội dung"] !== "manual" && emailContent.subject) {
      subject = replaceTemplateVars(emailContent.subject, testRecipient.data);
    }
    
    var body = replaceTemplateVars(emailContent.htmlBody, testRecipient.data);
    
    var testBanner = '<div style="background: #f8fafc; color: #334155; border-left: 4px solid #2563eb; padding: 12px 16px; margin-bottom: 20px; font-family: sans-serif; font-size: 13px; line-height: 1.5;">' +
      '<strong>[Bản xem trước thử nghiệm]</strong> Email này được gửi thử nghiệm để kiểm tra nội dung, hình ảnh và trường trộn dữ liệu trước khi gửi chính thức.' +
      '</div>';
    body = testBanner + body;
    
    var options = { htmlBody: body };
    if (emailContent.attachments && emailContent.attachments.length > 0) {
      options.attachments = emailContent.attachments;
    }
    if (emailContent.inlineImages && Object.keys(emailContent.inlineImages).length > 0) {
      options.inlineImages = emailContent.inlineImages;
    }
    
    GmailApp.sendEmail(testEmail, "[Thử nghiệm] " + subject, "", options);
    
    showToast("Đã gửi thư thử nghiệm đến " + testEmail, "Thử nghiệm thành công");
    logInfo("Đã gửi thư thử nghiệm đến: " + testEmail);
    
  } catch (e) {
    showAlert("Lỗi gửi thử nghiệm", e.message || String(e));
    logError("Lỗi gửi thử nghiệm: " + e.message);
  }
}
