// ============================================
// BatchController.gs - Điều phối tiến trình gửi email theo đợt
// Xử lý giới hạn thời gian thực thi (timeout) và tự động tiếp tục
// ============================================

var PROPS_KEY_PAUSED = "EMAIL_PAUSED";
var MAX_RUNTIME_MS = 5 * 60 * 1000; // 5 phút (dự phòng 1 phút trước giới hạn 6 phút của Apps Script)

/**
 * Lấy danh sách các trigger tiếp tục gửi (continuation triggers)
 */
function _getContinuationTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  var list = [];
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "continueSending") {
      list.push(triggers[i]);
    }
  }
  return list;
}

/**
 * Bắt đầu gửi email hàng loạt
 * Được gọi từ menu người dùng hoặc trigger hẹn giờ
 */
function startSending() {
  var config = getConfig();
  
  // Chỉ chặn nếu thực sự đang có trigger đợt gửi tiếp tục hoạt động
  var continuationTriggers = _getContinuationTriggers();
  if (config["Trạng thái hệ thống"] === "Đang gửi..." && continuationTriggers.length > 0) {
    showToast("Hệ thống đang trong quá trình gửi. Vui lòng đợi hoàn tất hoặc chọn Tạm dừng.", "Thông báo");
    return;
  }
  
  PropertiesService.getScriptProperties().deleteProperty(PROPS_KEY_PAUSED);
  
  if (!hasQuotaRemaining()) {
    showAlert("Hết hạn mức gửi", "Bạn đã sử dụng hết hạn mức gửi email trong ngày (tối đa 100 email/ngày đối với tài khoản Gmail cá nhân).\nVui lòng thử lại vào ngày mai.");
    logError("Đã hết hạn mức gửi email trong ngày.");
    return;
  }
  
  var emailContent = getEmailContent(config);
  if (!emailContent) {
    showAlert("Lỗi nội dung", "Không thể lấy nội dung email.\n\nVui lòng kiểm tra lại:\n- Chế độ 'draft_first': Đã có thư nháp trong Gmail chưa?\n- Chế độ 'draft_by_subject': Tiêu đề thư nháp đã khớp chưa?\n- Chế độ 'manual': Đã nhập nội dung HTML trong bảng Cấu hình chưa?");
    logError("Không thể lấy nội dung email để gửi. Chế độ hiện tại: " + (config["Chế độ nội dung"] || "draft_first"));
    setConfig("Trạng thái hệ thống", "Lỗi: Không tìm thấy nội dung email");
    return;
  }
  
  var newRecipients = getNewRecipients();
  if (newRecipients.length === 0) {
    showToast("Không có người nhận mới cần gửi. Toàn bộ danh sách đã hoàn tất.", "Hoàn tất");
    setConfig("Trạng thái hệ thống", "Hoàn tất");
    return;
  }
  
  var dupes = detectDuplicates();
  if (dupes.length > 0) {
    logInfo("Phát hiện " + dupes.length + " email trùng lặp, hệ thống sẽ tự động bỏ qua.");
  }
  
  setConfig("Trạng thái hệ thống", "Đang gửi...");
  showToast("Bắt đầu gửi " + newRecipients.length + " email...", "Tiến trình gửi", 3);
  
  _processBatch(emailContent, config);
}

/**
 * Xử lý một đợt gửi email (chạy trong khung an toàn 5 phút)
 */
function _processBatch(emailContent, config) {
  var startTime = Date.now();
  var delay = (parseInt(config["Delay giữa email (giây)"]) || 5) * 1000;
  var batchSize = parseInt(config["Batch size"]) || 50;
  
  var newRecipients = getNewRecipients();
  var sentInBatch = 0;
  var seenEmails = {};
  
  for (var i = 0; i < newRecipients.length && sentInBatch < batchSize; i++) {
    if ((Date.now() - startTime) > (MAX_RUNTIME_MS - 30000)) {
      logInfo("Tiệm cận giới hạn thời gian thực thi, chuẩn bị tạm nghỉ để tiếp tục đợt sau...");
      break;
    }
    
    if (PropertiesService.getScriptProperties().getProperty(PROPS_KEY_PAUSED) === "true") {
      logInfo("Đã tạm dừng tiến trình theo yêu cầu.");
      setConfig("Trạng thái hệ thống", "Tạm dừng");
      updateDashboard();
      return;
    }
    
    if (!hasQuotaRemaining()) {
      logInfo("Hết hạn mức gửi trong ngày, dừng tiến trình.");
      setConfig("Trạng thái hệ thống", "Tạm dừng (hết hạn mức)");
      updateDashboard();
      return;
    }
    
    var recipient = newRecipients[i];
    
    var emailLower = recipient.email.toLowerCase();
    if (seenEmails[emailLower]) {
      markAsError(recipient.row, "Email trùng lặp với dòng trước");
      continue;
    }
    seenEmails[emailLower] = true;
    
    var success = sendSingleEmail(recipient, emailContent, config, "");
    
    if (success) {
      sentInBatch++;
      showToast("Đã gửi (" + sentInBatch + "/" + newRecipients.length + "): " + recipient.email, "Đang gửi", 3);
    }
    
    if (i < newRecipients.length - 1 && sentInBatch < batchSize) {
      Utilities.sleep(delay);
    }
  }
  
  logInfo("Đợt gửi hoàn tất: " + sentInBatch + " email đã được gửi.");
  updateDashboard();
  
  var remaining = getNewRecipients();
  if (remaining.length === 0) {
    setConfig("Trạng thái hệ thống", "Hoàn tất - " + formatDateVN(new Date()));
    _cleanupContinuationTriggers();
    
    showToast("Đã gửi thành công toàn bộ email.", "Hoàn tất");
    _sendCompletionNotification(config);
    return;
  }
  
  var cooldown = parseInt(config["Cooldown giữa batch (phút)"]) || 5;
  _scheduleContinuation(cooldown);
  
  setConfig("Trạng thái hệ thống", "Đang gửi (tạm nghỉ " + cooldown + " phút, còn " + remaining.length + " email)");
  showToast("Tạm nghỉ " + cooldown + " phút trước đợt tiếp theo. Còn lại: " + remaining.length + " email.", "Chuyển đợt", 5);
}

/**
 * Hàm tiếp tục gửi, được gọi từ continuation trigger
 */
function continueSending() {
  _cleanupContinuationTriggers();
  
  if (PropertiesService.getScriptProperties().getProperty(PROPS_KEY_PAUSED) === "true") {
    setConfig("Trạng thái hệ thống", "Tạm dừng");
    return;
  }
  
  var config = getConfig();
  var emailContent = getEmailContent(config);
  
  if (!emailContent) {
    logError("Không thể lấy nội dung email khi tiếp tục đợt gửi.");
    setConfig("Trạng thái hệ thống", "Lỗi: Không lấy được nội dung email");
    return;
  }
  
  _processBatch(emailContent, config);
}

/**
 * Tạo trigger tiếp tục sau số phút quy định
 */
function _scheduleContinuation(minutes) {
  _cleanupContinuationTriggers();
  
  ScriptApp.newTrigger("continueSending")
    .timeBased()
    .after(minutes * 60 * 1000)
    .create();
  
  logInfo("Đã lên lịch tiếp tục gửi sau " + minutes + " phút.");
}

/**
 * Xóa các trigger tiếp tục gửi tự động
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
 * Tạm dừng tiến trình gửi
 */
function pauseSending() {
  PropertiesService.getScriptProperties().setProperty(PROPS_KEY_PAUSED, "true");
  _cleanupContinuationTriggers();
  setConfig("Trạng thái hệ thống", "Tạm dừng");
  showToast("Đã tạm dừng. Chọn 'Tiếp tục gửi' để chạy tiếp.", "Tạm dừng");
  updateDashboard();
}

/**
 * Tiếp tục tiến trình gửi sau khi tạm dừng
 */
function resumeSending() {
  PropertiesService.getScriptProperties().deleteProperty(PROPS_KEY_PAUSED);
  showToast("Đang tiếp tục gửi email...", "Tiếp tục", 3);
  startSending();
}

/**
 * Gửi email thông báo khi hoàn tất toàn bộ danh sách
 */
function _sendCompletionNotification(config) {
  var testEmail = config["Email test"];
  if (!testEmail) return;
  
  try {
    var all = getAllRecipients();
    var done = all.filter(function(r) { return r.status && (r.status.startsWith("Done") || r.status.startsWith("Đã gửi") || r.status.startsWith("Thành công") || r.status.startsWith("✅")); }).length;
    var errors = all.filter(function(r) { return r.status && (r.status.startsWith("Lỗi") || r.status.startsWith("❌")); }).length;
    
    GmailApp.sendEmail(testEmail,
      "Báo cáo hoàn tất gửi email tự động - " + formatDateVN(new Date()),
      "",
      {
        htmlBody: '<div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 6px;">' +
          '<h3 style="color: #2c3e50; margin-top: 0;">Thông báo hoàn tất gửi email</h3>' +
          '<p style="color: #555; font-size: 14px;">Hệ thống đã hoàn tất gửi toàn bộ danh sách email theo cấu hình.</p>' +
          '<table style="border-collapse: collapse; width: 100%; font-size: 14px; margin-top: 15px;">' +
          '<tr style="background-color: #f8f9fa;"><td style="padding: 10px; border: 1px solid #e9ecef; font-weight: bold;">Thành công</td>' +
          '<td style="padding: 10px; border: 1px solid #e9ecef; color: #28a745; font-weight: bold;">' + done + '</td></tr>' +
          '<tr><td style="padding: 10px; border: 1px solid #e9ecef; font-weight: bold;">Lỗi phát sinh</td>' +
          '<td style="padding: 10px; border: 1px solid #e9ecef; color: #dc3545;">' + errors + '</td></tr>' +
          '<tr style="background-color: #f8f9fa;"><td style="padding: 10px; border: 1px solid #e9ecef; font-weight: bold;">Tổng số lượng</td>' +
          '<td style="padding: 10px; border: 1px solid #e9ecef;">' + all.length + '</td></tr>' +
          '<tr><td style="padding: 10px; border: 1px solid #e9ecef; font-weight: bold;">Thời điểm hoàn tất</td>' +
          '<td style="padding: 10px; border: 1px solid #e9ecef;">' + formatDateVN(new Date()) + '</td></tr>' +
          '</table></div>'
      }
    );
  } catch(e) {
    logError("Lỗi khi gửi email thông báo: " + e.message);
  }
}
