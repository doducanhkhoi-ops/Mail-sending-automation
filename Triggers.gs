// ============================================
// Triggers.gs - Quản lý trigger hẹn giờ
// ============================================

/**
 * Thiết lập trigger kiểm tra mỗi 15 phút
 */
function setupIntervalTrigger() {
  // Xóa trigger cũ trước để tránh trùng lặp
  removeDailyTrigger();
  
  // Tạo trigger mới chạy mỗi 15 phút
  ScriptApp.newTrigger("onIntervalTrigger")
    .timeBased()
    .everyMinutes(15)
    .create();
  
  showToast("✅ Đã bật tự động: Hệ thống sẽ kiểm tra người mới mỗi 15 phút", "⏰ Hẹn giờ", 5);
  setConfig("Giờ gửi tự động", "Mỗi 15 phút");
  logInfo("15-min interval trigger set");
}

/**
 * Xóa trigger kiểm tra tự động
 */
function removeDailyTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    var func = triggers[i].getHandlerFunction();
    if (func === "onIntervalTrigger" || func === "onDailyTrigger") {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  if (removed > 0) {
    logInfo("Removed " + removed + " interval trigger(s)");
  }
}

/**
 * Hàm được gọi bởi trigger mỗi 15 phút
 */
function onIntervalTrigger() {
  logInfo("⏰ 15-min trigger fired at " + formatDateVN(new Date()));
  
  var config = getConfig();
  
  // NẾU HỆ THỐNG ĐANG BẬN GỬI BATCH TRƯỚC ĐÓ -> BỎ QUA ĐỂ TRÁNH TRÙNG LẶP
  if (config["Trạng thái hệ thống"] === "Đang gửi...") {
    logInfo("Hệ thống đang gửi dở mẻ trước, bỏ qua lượt check này.");
    return;
  }
  
  // Kiểm tra xem có người nhận mới không
  var newRecipients = getNewRecipients();
  if (newRecipients.length === 0) {
    logInfo("Không có người nhận mới, đi ngủ tiếp.");
    return;
  }
  
  logInfo("Phát hiện " + newRecipients.length + " người nhận mới. Tự động kích hoạt gửi...");
  startSending();
}

/**
 * Toggle bật/tắt gửi tự động
 */
function toggleDailyTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var hasTrigger = false;
  
  for (var i = 0; i < triggers.length; i++) {
    var func = triggers[i].getHandlerFunction();
    if (func === "onIntervalTrigger" || func === "onDailyTrigger") {
      hasTrigger = true;
      break;
    }
  }
  
  if (hasTrigger) {
    removeDailyTrigger();
    setConfig("Giờ gửi tự động", "Đã tắt");
    showToast("⏰ Đã TẮT tự động kiểm tra mỗi 15 phút", "Tắt hẹn giờ");
  } else {
    setupIntervalTrigger();
  }
}

/**
 * Xóa TẤT CẢ triggers của project
 */
function removeAllTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
  setConfig("Trạng thái hệ thống", "Idle");
  showToast("🗑️ Đã xóa tất cả " + triggers.length + " trigger(s)", "Cleanup");
}

/**
 * Liệt kê triggers hiện tại (debug)
 */
function listTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  var info = "Có " + triggers.length + " trigger(s):\n\n";
  for (var i = 0; i < triggers.length; i++) {
    info += (i + 1) + ". " + triggers[i].getHandlerFunction() + " (" + triggers[i].getEventType() + ")\n";
  }
  if (triggers.length === 0) {
    info = "Không có trigger nào đang chạy.";
  }
  showAlert("⏰ Danh sách Triggers", info);
}
