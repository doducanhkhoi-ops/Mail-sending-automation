// ============================================
// BatchController.gs - Điều phối gửi email theo batch
// Xử lý giới hạn 6 phút + auto-resume
// ============================================

var PROPS_KEY_PAUSED = "EMAIL_PAUSED";
var MAX_RUNTIME_MS = 5 * 60 * 1000; // 5 phút (dự phòng 1 phút trước khi timeout)

/**
 * BẮT ĐẦU gửi email hàng loạt
 * Gọi từ menu hoặc trigger hẹn giờ
 */
function startSending() {
  var config = getConfig();
  
  // Kiểm tra đang gửi dở?
  if (config["Trạng thái hệ thống"] === "Đang gửi...") {
    showToast("⚠️ Hệ thống đang gửi dở. Chờ hoàn thành hoặc bấm Tạm dừng.", "Cảnh báo");
    return;
  }
  
  // Reset trạng thái pause
  PropertiesService.getScriptProperties().deleteProperty(PROPS_KEY_PAUSED);
  
  // Kiểm tra quota
  if (!hasQuotaRemaining()) {
    showAlert("⚠️ Hết quota", "Bạn đã dùng hết quota gửi email hôm nay (100/ngày cho Gmail miễn phí).\nThử lại vào ngày mai.");
    return;
  }
  
  // Lấy nội dung email
  var emailContent = getEmailContent(config);
  if (!emailContent) {
    showAlert("⚠️ Lỗi nội dung", "Không thể lấy nội dung email.\n\nKiểm tra:\n- Nếu mode 'draft_first': Có bản nháp trong Gmail không?\n- Nếu mode 'draft_by_subject': Tiêu đề bản nháp đã đúng chưa?\n- Nếu mode 'manual': Đã nhập nội dung HTML chưa?");
    return;
  }
  
  // Kiểm tra danh sách
  var newRecipients = getNewRecipients();
  if (newRecipients.length === 0) {
    showToast("✅ Không có người nhận mới nào. Tất cả đã gửi xong!", "Hoàn thành");
    setConfig("Trạng thái hệ thống", "Hoàn thành");
    return;
  }
  
  // Kiểm tra trùng lặp
  var dupes = detectDuplicates();
  if (dupes.length > 0) {
    logInfo("⚠️ Phát hiện " + dupes.length + " email trùng lặp, sẽ bỏ qua.");
  }
  
  setConfig("Trạng thái hệ thống", "Đang gửi...");
  showToast("🚀 Bắt đầu gửi " + newRecipients.length + " email...", "Đang gửi", 3);
  
  // Gọi hàm xử lý batch
  _processBatch(emailContent, config);
}

/**
 * Xử lý 1 batch email (chạy trong giới hạn 5 phút)
 */
function _processBatch(emailContent, config) {
  var startTime = Date.now();
  var delay = (parseInt(config["Delay giữa email (giây)"]) || 5) * 1000;
  var batchSize = parseInt(config["Batch size"]) || 50;
  
  var newRecipients = getNewRecipients();
  var sentInBatch = 0;
  var seenEmails = {}; // Phát hiện trùng lặp trong batch
  
  for (var i = 0; i < newRecipients.length && sentInBatch < batchSize; i++) {
    // Kiểm tra timeout (dự phòng 30s)
    if ((Date.now() - startTime) > (MAX_RUNTIME_MS - 30000)) {
      logInfo("⏰ Gần timeout, sẽ tiếp tục sau...");
      break;
    }
    
    // Kiểm tra pause
    if (PropertiesService.getScriptProperties().getProperty(PROPS_KEY_PAUSED) === "true") {
      logInfo("⏸️ Đã tạm dừng theo yêu cầu.");
      setConfig("Trạng thái hệ thống", "Tạm dừng");
      updateDashboard();
      return; // Không tạo trigger tiếp
    }
    
    // Kiểm tra quota
    if (!hasQuotaRemaining()) {
      logInfo("⚠️ Hết quota hôm nay, dừng gửi.");
      setConfig("Trạng thái hệ thống", "Tạm dừng (hết quota)");
      updateDashboard();
      return;
    }
    
    var recipient = newRecipients[i];
    
    // Skip trùng lặp
    var emailLower = recipient.email.toLowerCase();
    if (seenEmails[emailLower]) {
      markAsError(recipient.row, "Email trùng lặp (đã gửi ở dòng trước)");
      continue;
    }
    seenEmails[emailLower] = true;
    
    // Gửi email
    var success = sendSingleEmail(recipient, emailContent, config, "");
    
    if (success) {
      sentInBatch++;
      showToast("📤 Đã gửi " + sentInBatch + "/" + newRecipients.length + ": " + recipient.email, "Đang gửi...", 3);
    }
    
    // Delay giữa các email (trừ email cuối)
    if (i < newRecipients.length - 1 && sentInBatch < batchSize) {
      Utilities.sleep(delay);
    }
  }
  
  logInfo("Batch xong: " + sentInBatch + " email đã gửi.");
  updateDashboard();
  
  // Kiểm tra còn email chưa gửi không
  var remaining = getNewRecipients();
  if (remaining.length === 0) {
    // HOÀN THÀNH!
    setConfig("Trạng thái hệ thống", "Hoàn thành ✅ " + formatDateVN(new Date()));
    _cleanupContinuationTriggers();
    
    showToast("🎉 Đã gửi xong tất cả email!", "Hoàn thành");
    
    // Gửi email thông báo
    _sendCompletionNotification(config);
    return;
  }
  
  // Còn email → tạo trigger tiếp tục sau cooldown
  var cooldown = parseInt(config["Cooldown giữa batch (phút)"]) || 5;
  _scheduleContinuation(cooldown);
  
  setConfig("Trạng thái hệ thống", "Đang gửi... (nghỉ " + cooldown + " phút, còn " + remaining.length + " email)");
  showToast("⏳ Nghỉ " + cooldown + " phút rồi tiếp tục. Còn " + remaining.length + " email.", "Batch xong", 5);
}

/**
 * Hàm được gọi bởi continuation trigger
 */
function continueSending() {
  _cleanupContinuationTriggers();
  
  // Kiểm tra pause
  if (PropertiesService.getScriptProperties().getProperty(PROPS_KEY_PAUSED) === "true") {
    setConfig("Trạng thái hệ thống", "Tạm dừng");
    return;
  }
  
  var config = getConfig();
  var emailContent = getEmailContent(config);
  
  if (!emailContent) {
    logError("Không thể lấy nội dung email khi tiếp tục batch.");
    setConfig("Trạng thái hệ thống", "Lỗi: Không lấy được nội dung email");
    return;
  }
  
  _processBatch(emailContent, config);
}

/**
 * Tạo trigger tiếp tục sau N phút
 */
function _scheduleContinuation(minutes) {
  _cleanupContinuationTriggers();
  
  ScriptApp.newTrigger("continueSending")
    .timeBased()
    .after(minutes * 60 * 1000)
    .create();
  
  logInfo("Đã lên lịch tiếp tục sau " + minutes + " phút");
}

/**
 * Xóa tất cả continuation triggers
 */
function _cleanupContinuationTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "continueSending") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

/**
 * TẠM DỪNG gửi
 */
function pauseSending() {
  PropertiesService.getScriptProperties().setProperty(PROPS_KEY_PAUSED, "true");
  _cleanupContinuationTriggers();
  setConfig("Trạng thái hệ thống", "Tạm dừng");
  showToast("⏸️ Đã tạm dừng. Bấm 'Tiếp tục gửi' để tiếp.", "Tạm dừng");
  updateDashboard();
}

/**
 * TIẾP TỤC gửi (sau khi pause)
 */
function resumeSending() {
  PropertiesService.getScriptProperties().deleteProperty(PROPS_KEY_PAUSED);
  showToast("▶️ Tiếp tục gửi email...", "Đang tiếp tục", 3);
  startSending();
}

/**
 * Gửi email thông báo hoàn thành
 */
function _sendCompletionNotification(config) {
  var testEmail = config["Email test"];
  if (!testEmail) return;
  
  try {
    var all = getAllRecipients();
    var done = all.filter(function(r) { return r.status && r.status.startsWith("Done"); }).length;
    var errors = all.filter(function(r) { return r.status && r.status.startsWith("Lỗi"); }).length;
    
    GmailApp.sendEmail(testEmail,
      "✅ Hoàn thành gửi email tự động - " + formatDateVN(new Date()),
      "",
      {
        htmlBody: '<div style="font-family:Arial,sans-serif;max-width:500px;margin:auto;padding:20px;">' +
          '<h2 style="color:#27ae60;">🎉 Đã gửi xong tất cả email!</h2>' +
          '<table style="border-collapse:collapse;width:100%;">' +
          '<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Thành công</td>' +
          '<td style="padding:8px;border:1px solid #ddd;color:#27ae60;">' + done + '</td></tr>' +
          '<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Lỗi</td>' +
          '<td style="padding:8px;border:1px solid #ddd;color:#e74c3c;">' + errors + '</td></tr>' +
          '<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Tổng</td>' +
          '<td style="padding:8px;border:1px solid #ddd;">' + all.length + '</td></tr>' +
          '<tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold;">Hoàn thành lúc</td>' +
          '<td style="padding:8px;border:1px solid #ddd;">' + formatDateVN(new Date()) + '</td></tr>' +
          '</table></div>'
      }
    );
  } catch(e) {
    logError("Lỗi gửi notification: " + e.message);
  }
}
