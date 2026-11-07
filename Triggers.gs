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
  
  var activeUser = "";
  try {
    activeUser = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail();
  } catch (e) {
    activeUser = "Không xác định";
  }
  
  var startTime = config["Khung giờ tự động bắt đầu"] ? String(config["Khung giờ tự động bắt đầu"]).trim() : "";
  var endTime = config["Khung giờ tự động kết thúc"] ? String(config["Khung giờ tự động kết thúc"]).trim() : "";
  var timeWindowText = (startTime || endTime) ? " (" + (startTime || "00:00") + " - " + (endTime || "23:59") + ")" : " (24/7)";
  
  setConfig("Người phụ trách gửi tự động", activeUser);
  setConfig("Giờ gửi tự động", "Mỗi 15 phút" + timeWindowText);
  logInfo("Đã thiết lập trigger kiểm tra định kỳ 15 phút bởi: " + activeUser);
  
  // KIỂM TRA VÀ BẮT ĐẦU GỬI NGAY NẾU CÓ EMAIL CHỜ
  var inWindow = isWithinAllowedTimeWindow(startTime, endTime);
  var newRecipients = getNewRecipients();
  if (newRecipients.length > 0) {
    if (inWindow) {
      showToast("Đã bật tự động: Phát hiện " + newRecipients.length + " email mới, đang bắt đầu gửi...", "Lịch tự động", 5);
      logInfo("Bật lịch tự động: Tìm thấy " + newRecipients.length + " người nhận mới. Khởi động gửi ngay...");
      startSending();
    } else {
      showToast("Đã bật tự động: Hiện ngoài khung giờ (" + (startTime || "00:00") + " - " + (endTime || "23:59") + "). Sẽ tự gửi khi đến giờ!", "Lịch tự động", 5);
    }
  } else {
    showToast("Đã bật tự động: Hiện chưa có email mới. Hệ thống sẽ tự động kiểm tra mỗi 15 phút.", "Lịch tự động", 5);
    logInfo("Bật lịch tự động: Chưa có người nhận mới. Hệ thống sẽ đợi chu kỳ 15 phút tiếp theo.");
  }
}

/**
 * Thiết lập trigger gửi tức thì khi có dữ liệu mới (Hỗ trợ cả Google Form, Nhập tay và IMPORTRANGE)
 */
function setupFormSubmitTrigger() {
  removeFormSubmitTrigger();
  
  var activeUser = "";
  try {
    activeUser = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail();
  } catch (e) {
    activeUser = "Không xác định";
  }
  
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Trigger khi có Google Form submit
  ScriptApp.newTrigger("onFormSubmitTrigger")
    .forSpreadsheet(ss)
    .onFormSubmit()
    .create();

  // 2. Trigger khi có thay đổi nội dung (Nhập tay hoặc IMPORTRANGE kéo dòng mới về)
  ScriptApp.newTrigger("onFormSubmitTrigger")
    .forSpreadsheet(ss)
    .onChange()
    .create();
  
  // Lưu thông tin người sở hữu trigger vào cấu hình
  setConfig("Người phụ trách gửi tự động", activeUser);
  
  // Đồng bộ ô 'Giờ gửi tự động' hiển thị rõ chế độ và khung giờ cho phép
  var config = getConfig();
  var startTime = config["Khung giờ tự động bắt đầu"] ? String(config["Khung giờ tự động bắt đầu"]).trim() : "";
  var endTime = config["Khung giờ tự động kết thúc"] ? String(config["Khung giờ tự động kết thúc"]).trim() : "";
  var timeWindowText = (startTime || endTime) ? " (" + (startTime || "00:00") + " - " + (endTime || "23:59") + ")" : " (24/7)";
  setConfig("Giờ gửi tự động", "Tức thì (Realtime)" + timeWindowText);
  
  logInfo("Đã kích hoạt trigger gửi tức thì (Form + Change) bởi: " + activeUser);
  
  // KIỂM TRA VÀ GỬI NGAY CÁC EMAIL ĐANG CÓ SẴN CHƯA GỬI TRONG DANH SÁCH (POOL)
  var inWindow = isWithinAllowedTimeWindow(startTime, endTime);
  
  var newRecipients = getNewRecipients();
  if (newRecipients.length > 0) {
    if (inWindow) {
      showToast("Đã BẬT: Phát hiện " + newRecipients.length + " email chưa gửi sẵn có, đang gửi ngay...", "Tự động gửi", 6);
      logInfo("Kích hoạt tự động: Tìm thấy " + newRecipients.length + " email đang chờ trong pool. Khởi động gửi ngay...");
      startSending();
    } else {
      showToast("Đã BẬT tự động gửi: Phát hiện " + newRecipients.length + " email chờ, nhưng hiện tại ngoài khung giờ (" + startTime + " - " + endTime + "). Sẽ tự gửi khi đến giờ!", "Tự động gửi", 7);
      logInfo("Đã bật tự động nhưng ngoài khung giờ cho phép (" + startTime + " - " + endTime + "). Hàng chờ sẽ được gửi khi đến giờ.");
    }
  } else {
    showToast("Đã BẬT gửi tức thì: Cứ có dòng mới (Form, Nhập tay, IMPORTRANGE) là gửi ngay!", "Tự động gửi", 6);
  }
}

/**
 * Xóa trigger gửi email tức thì (cả Form Submit và Change)
 */
function removeFormSubmitTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var removed = 0;
  for (var i = 0; i < triggers.length; i++) {
    var func = triggers[i].getHandlerFunction();
    if (func === "onFormSubmitTrigger" || func === "onChangeTrigger") {
      ScriptApp.deleteTrigger(triggers[i]);
      removed++;
    }
  }
  setConfig("Người phụ trách gửi tự động", "Đã tắt");
  setConfig("Giờ gửi tự động", "Đã tắt");
  if (removed > 0) {
    logInfo("Đã xóa " + removed + " trigger tự động gửi tức thì.");
  }
}

/**
 * Bật / Tắt chế độ tự động gửi tức thì (Form Submit + Change)
 * Bảo vệ: Nếu tài khoản khác đã bật, cảnh báo để tránh trùng lặp
 */
function toggleFormSubmitTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  var hasTrigger = false;
  
  for (var i = 0; i < triggers.length; i++) {
    var func = triggers[i].getHandlerFunction();
    if (func === "onFormSubmitTrigger" || func === "onChangeTrigger") {
      hasTrigger = true;
      break;
    }
  }
  
  var config = getConfig();
  var currentOwner = config["Người phụ trách gửi tự động"] || "";
  var activeUser = "";
  try {
    activeUser = Session.getActiveUser().getEmail() || Session.getEffectiveUser().getEmail();
  } catch (e) {}

  if (hasTrigger) {
    removeFormSubmitTrigger();
    showToast("Đã TẮT chế độ tự động gửi email khi có Form Submit.", "Form Submit");
  } else {
    // Nếu trong Cấu hình ghi nhận người khác đang bật mà bản thân tài khoản này chưa có trigger
    if (currentOwner && currentOwner !== "Đã tắt" && activeUser && currentOwner !== activeUser) {
      var confirmTakeover = showConfirm(
        "Chuyển giao quyền gửi tự động",
        "Hệ thống hiện đang gửi tự động bằng email: " + currentOwner + ".\n\n" +
        "Bạn có muốn chuyển giao sang gửi bằng email của bạn (" + activeUser + ") không?\n\n" +
        "(Bấm YES để Chuyển giao ngay, bấm NO để Hủy bỏ giữ nguyên tài khoản cũ)."
      );
      if (!confirmTakeover) {
        showToast("Đã hủy chuyển giao. Hệ thống tiếp tục gửi bằng email: " + currentOwner, "Thông báo");
        return;
      }
    }
    setupFormSubmitTrigger();
  }
}

/**
 * Hàm nhận sự kiện Form Submit và gửi email ngay lập tức cho người vừa điền
 * Có tích hợp LockService chống trùng lặp tuyệt đối
 * @param {Object} e - Event object từ sự kiện onFormSubmit của Google Sheets
 */
function onFormSubmitTrigger(e) {
  logInfo("Phát hiện dữ liệu Form / Bảng tính mới vào lúc " + formatDateVN(new Date()) + ". Bắt đầu xử lý...");
  
  // Dùng LockService với thời gian chờ 15s để nếu có luồng trước vừa kết thúc thì luồng sau vào gửi ngay lập tức
  var lock = LockService.getScriptLock();
  try {
    var hasLock = lock.tryLock(15000);
    if (!hasLock) {
      logInfo("Hệ thống đang bận gửi một lượt khác, tự rút lui an toàn.");
      return;
    }
    
    var config = getConfig();
    
    // KIỂM TRA RÀNG BUỘC KHUNG GIỜ GỬI TỰ ĐỘNG
    var startTime = config["Khung giờ tự động bắt đầu"] ? String(config["Khung giờ tự động bắt đầu"]).trim() : "";
    var endTime = config["Khung giờ tự động kết thúc"] ? String(config["Khung giờ tự động kết thúc"]).trim() : "";
    if (!isWithinAllowedTimeWindow(startTime, endTime)) {
      logInfo("Hiện tại ngoài khung giờ gửi tự động (" + startTime + " - " + endTime + "). Tạm hoãn gửi.");
      return;
    }
    
    if (PropertiesService.getScriptProperties().getProperty(PROPS_KEY_PAUSED) === "true") {
      logInfo("Hệ thống đang ở trạng thái Tạm dừng, bỏ qua lượt gửi form mới.");
      return;
    }
    
    if (!hasQuotaRemaining()) {
      logError("Đã hết hạn mức gửi email trong ngày khi nhận form submit.");
      return;
    }
    
    var emailContent = getEmailContent(config);
    if (!emailContent) {
      logError("Không thể lấy nội dung/thư nháp email khi nhận form submit mới.");
      return;
    }
    
    // Quét ngay lập tức toàn bộ người nhận mới
    var newRecipients = getNewRecipients();
    
    // Nếu chưa thấy dòng mới ngay, thử kiểm tra lại 1 lần sau 500ms
    if (newRecipients.length === 0) {
      Utilities.sleep(500);
      newRecipients = getNewRecipients();
    }
    
    if (newRecipients.length > 0) {
      logInfo("Tìm thấy " + newRecipients.length + " người nhận chưa gửi trong danh sách. Bắt đầu gửi lần lượt...");
      showToast("Đang gửi mail cho " + newRecipients.length + " liên hệ mới...", "Tiến trình gửi", 4);
      
      var delay = (parseInt(config["Delay giữa email (giây)"]) || 1) * 1000;
      var sentCount = 0;
      for (var k = 0; k < newRecipients.length; k++) {
        if (!hasQuotaRemaining()) {
          logInfo("Đã hết hạn mức gửi trong ngày khi đang xử lý hàng chờ.");
          showToast("Đã dừng gửi do hết hạn mức trong ngày.", "Thông báo", 5);
          break;
        }
        var currentEmail = newRecipients[k].email;
        showToast("Đang gửi (" + (k + 1) + "/" + newRecipients.length + "): " + currentEmail, "Đang gửi", 3);
        
        var success = sendSingleEmail(newRecipients[k], emailContent, config, "AUTO_TRIGGER");
        if (success) {
          sentCount++;
        }
        
        if (k < newRecipients.length - 1) {
          Utilities.sleep(delay);
        }
      }
      showToast("Đã gửi xong " + sentCount + "/" + newRecipients.length + " email mới.", "Hoàn tất", 4);
      // Cập nhật số liệu Dashboard sau khi hoàn tất lượt gửi
      updateDashboard();
    } else {
      logInfo("Không có người nhận mới nào cần gửi.");
    }
    
  } catch (err) {
    logError("Lỗi khi xử lý gửi Form Submit: " + err.message);
  } finally {
    // Luôn giải phóng khóa an toàn
    lock.releaseLock();
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
    
    // KIỂM TRA RÀNG BUỘC KHUNG GIỜ CHO CẢ TRIGGER 15 PHÚT
    var startTime = config["Khung giờ tự động bắt đầu"] ? String(config["Khung giờ tự động bắt đầu"]).trim() : "";
    var endTime = config["Khung giờ tự động kết thúc"] ? String(config["Khung giờ tự động kết thúc"]).trim() : "";
    if (!isWithinAllowedTimeWindow(startTime, endTime)) {
      logInfo("Trigger 15 phút: Hiện tại ngoài khung giờ (" + startTime + " - " + endTime + "). Tạm hoãn gửi.");
      return;
    }
    
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
