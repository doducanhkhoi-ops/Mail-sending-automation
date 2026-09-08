// ============================================
// Triggers.gs - Quản lý trigger tự động hóa theo thời gian
// ============================================

/**
 * Thiết lập trigger tự động kiểm tra danh sách mỗi 15 phút
 * Đồng thời kiểm tra và kích hoạt gửi ngay lập tức nếu đang có sẵn email mới
 */
function setupIntervalTrigger() {
  removeDailyTrigger();
  
  // Xóa cờ tạm dừng và giải tỏa trạng thái kẹt nếu có
  PropertiesService.getScriptProperties().deleteProperty(PROPS_KEY_PAUSED);
  var config = getConfig();
  if (config["Trạng thái hệ thống"] === "Tạm dừng" || config["Trạng thái hệ thống"] === "Đang gửi...") {
    setConfig("Trạng thái hệ thống", "Sẵn sàng");
  }
  
  // Tạo trigger chạy ngầm mỗi 15 phút
  ScriptApp.newTrigger("onIntervalTrigger")
    .timeBased()
    .everyMinutes(15)
    .create();
  
  setConfig("Giờ gửi tự động", "Mỗi 15 phút");
  logInfo("Đã thiết lập trigger kiểm tra định kỳ 15 phút.");
  
  // KIỂM TRA VÀ BẮT ĐẦU GỬI NGAY NẾU CÓ EMAIL CHỜ
  var newRecipients = getNewRecipients();
  if (newRecipients.length > 0) {
    showToast("Đã bật tự động: Phát hiện " + newRecipients.length + " email mới, đang bắt đầu gửi...", "Lịch tự động", 5);
    logInfo("Bật lịch tự động: Tìm thấy " + newRecipients.length + " người nhận mới. Khởi động gửi ngay...");
    startSending();
  } else {
    showToast("Đã bật tự động: Hiện chưa có email mới. Hệ thống sẽ tự động kiểm tra mỗi 15 phút.", "Lịch tự động", 5);
    logInfo("Bật lịch tự động: Chưa có người nhận mới. Hệ thống sẽ đợi chu kỳ 15 phút tiếp theo.");
  }
}

/**
 * Xóa trigger kiểm tra tự động định kỳ
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
    logInfo("Đã xóa " + removed + " trigger định kỳ.");
  }
}

/**
 * Hàm thực thi khi trigger định kỳ 15 phút kích hoạt
 */
function onIntervalTrigger() {
  logInfo("Kích hoạt kiểm tra định kỳ vào lúc " + formatDateVN(new Date()));
  
  try {
    var config = getConfig();
    
    // Nếu có trigger đợt (continuation trigger) đang chạy thì nhường lượt
    var continuationTriggers = _getContinuationTriggers();
    if (continuationTriggers.length > 0) {
      logInfo("Đợt gửi trước vẫn đang trong thời gian nghỉ (cooldown), bỏ qua lần kiểm tra này.");
      return;
    }
    
    // Kiểm tra có người nhận mới không
    var newRecipients = getNewRecipients();
    if (newRecipients.length === 0) {
      logInfo("Không có người nhận mới, hoàn tất kiểm tra định kỳ.");
      if (config["Trạng thái hệ thống"] && config["Trạng thái hệ thống"].indexOf("Đang gửi") !== -1) {
        setConfig("Trạng thái hệ thống", "Hoàn tất - " + formatDateVN(new Date()));
        updateDashboard();
      }
      return;
    }
    
    logInfo("Tìm thấy " + newRecipients.length + " địa chỉ mới. Bắt đầu tiến trình gửi...");
    startSending();
    
  } catch (e) {
    logError("Lỗi trong quá trình thực thi trigger 15 phút: " + e.message);
  }
}

/**
 * Bật / Tắt chế độ tự động kiểm tra định kỳ
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
    showToast("Đã tắt tính năng tự động kiểm tra định kỳ.", "Lịch tự động");
  } else {
    setupIntervalTrigger();
  }
}

/**
 * Xóa toàn bộ triggers của dự án
 */
function removeAllTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    ScriptApp.deleteTrigger(triggers[i]);
  }
  PropertiesService.getScriptProperties().deleteProperty(PROPS_KEY_PAUSED);
  setConfig("Trạng thái hệ thống", "Sẵn sàng");
  setConfig("Giờ gửi tự động", "Đã tắt");
  showToast("Đã xóa toàn bộ " + triggers.length + " trigger.", "Lịch tự động");
}

/**
 * Liệt kê danh sách các trigger hiện có
 */
function listTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  var info = "Hiện có " + triggers.length + " trigger đang hoạt động:\n\n";
  for (var i = 0; i < triggers.length; i++) {
    info += (i + 1) + ". " + triggers[i].getHandlerFunction() + " (" + triggers[i].getEventType() + ")\n";
  }
  if (triggers.length === 0) {
    info = "Không có trigger nào đang hoạt động.";
  }
  showAlert("Danh sách Trigger", info);
}
