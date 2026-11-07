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
  
  var activeUser = getCurrentUserEmail();
  
  var startTime = normalizeTimeString(config["Khung giờ tự động bắt đầu"]);
  var endTime = normalizeTimeString(config["Khung giờ tự động kết thúc"]);
  var timeWindowText = (startTime || endTime) ? " (" + (startTime || "00:00") + " - " + (endTime || "23:59") + ")" : " (24/7)";
  
  setConfig("Email đang gửi hiện tại", activeUser);
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
      _scheduleWakeupAtStartTime(startTime);
      showToast("Đã bật tự động: Hiện ngoài khung giờ. Đã hẹn giờ đúng " + (startTime || "00:00") + " để tự động gửi ngay các mail chờ!", "Lịch tự động", 6);
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
  
  var activeUser = getCurrentUserEmail();
  
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
  setConfig("Email đang gửi hiện tại", activeUser);
  
  // Đồng bộ ô 'Giờ gửi tự động' hiển thị rõ chế độ và khung giờ cho phép
  var config = getConfig();
  var startTime = normalizeTimeString(config["Khung giờ tự động bắt đầu"]);
  var endTime = normalizeTimeString(config["Khung giờ tự động kết thúc"]);
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
      _scheduleWakeupAtStartTime(startTime);
      showToast("Đã BẬT: Đang ngoài khung giờ. Đã hẹn giờ đúng " + (startTime || "00:00") + " để tự động gửi ngay " + newRecipients.length + " email chờ!", "Tự động gửi", 7);
      logInfo("Đã bật tự động nhưng ngoài khung giờ cho phép (" + startTime + " - " + endTime + "). Đã hẹn giờ đúng " + startTime + " để gửi ngay hàng chờ.");
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
  _cleanupScheduledStartTriggers();
  setConfig("Email đang gửi hiện tại", "Đã tắt");
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
  var currentOwner = config["Email đang gửi hiện tại"] || config["Người phụ trách gửi tự động"] || "";
  var activeUser = getCurrentUserEmail();

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
    var startTime = normalizeTimeString(config["Khung giờ tự động bắt đầu"]);
    var endTime = normalizeTimeString(config["Khung giờ tự động kết thúc"]);
    if (!isWithinAllowedTimeWindow(startTime, endTime)) {
      logInfo("Hiện tại ngoài khung giờ gửi tự động (" + startTime + " - " + endTime + "). Tạm hoãn gửi và hẹn giờ mở khung.");
      _scheduleWakeupAtStartTime(startTime);
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
    var startTime = normalizeTimeString(config["Khung giờ tự động bắt đầu"]);
    var endTime = normalizeTimeString(config["Khung giờ tự động kết thúc"]);
    if (!isWithinAllowedTimeWindow(startTime, endTime)) {
      logInfo("Trigger 15 phút: Hiện tại ngoài khung giờ (" + startTime + " - " + endTime + "). Tạm hoãn gửi và tự động hẹn giờ mở khung.");
      _scheduleWakeupAtStartTime(startTime);
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
    setConfig("Email đang gửi hiện tại", "Đã tắt");
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
  _cleanupScheduledStartTriggers();
  setConfig("Email đang gửi hiện tại", "Đã tắt");
  setConfig("Giờ gửi tự động", "Đã tắt");
  showToast("Đã xóa toàn bộ " + triggers.length + " trigger.", "Lịch tự động");
}

/**
 * Liệt kê danh sách các trigger hiện có kèm thông tin tài khoản sở hữu
 */
function listTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  var myEmail = getCurrentUserEmail();
  var config = getConfig();
  var currentSender = config["Email đang gửi hiện tại"] || config["Người phụ trách gửi tự động"] || "Đã tắt";
  
  var info = "Tài khoản của bạn: " + myEmail + "\n";
  info += "Email ghi nhận gửi tự động: " + currentSender + "\n\n";
  
  if (triggers.length > 0) {
    info += "Tài khoản của bạn ĐANG CÓ " + triggers.length + " trigger hoạt động:\n";
    for (var i = 0; i < triggers.length; i++) {
      info += "- " + triggers[i].getHandlerFunction() + " (" + triggers[i].getEventType() + ")\n";
    }
  } else {
    info += "Tài khoản của bạn HIỆN KHÔNG CÓ trigger nào bật trực tiếp.\n";
    if (currentSender && currentSender !== "Đã tắt") {
      info += "(Lưu ý: Hệ thống đang chạy gửi tự động dưới tài khoản: " + currentSender + ")";
    }
  }
  showAlert("Danh sách Trigger", info);
}

/**
 * Tự động hẹn giờ đánh thức chính xác vào phút bắt đầu của khung giờ
 * Tránh việc phải đợi chu kỳ quét định kỳ 15 phút
 * Có cơ chế tự động làm mới nếu người dùng thay đổi khung giờ trong bảng Cấu hình
 */
function _scheduleWakeupAtStartTime(startTimeStr) {
  var cleanStart = normalizeTimeString(startTimeStr);
  if (!cleanStart) return;
  
  var parts = cleanStart.split(":");
  if (parts.length < 2) return;
  var targetHour = parseInt(parts[0], 10);
  var targetMinute = parseInt(parts[1], 10);
  if (isNaN(targetHour) || isNaN(targetMinute)) return;
  
  var now = new Date();
  var targetDate = new Date(now.getFullYear(), now.getMonth(), now.getDate(), targetHour, targetMinute, 0);
  
  // Nếu giờ này hôm nay đã qua thì tính cho ngày hôm sau
  if (targetDate <= now) {
    targetDate.setDate(targetDate.getDate() + 1);
  }
  
  var props = PropertiesService.getScriptProperties();
  var savedSchedule = props.getProperty("SCHEDULED_START_TIME");
  
  // Kiểm tra xem đã có trigger hẹn giờ mở khung và giờ có bị thay đổi không
  var triggers = ScriptApp.getProjectTriggers();
  var hasTrigger = false;
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "onScheduledStartTrigger") {
      hasTrigger = true;
      break;
    }
  }
  
  // Nếu đã có trigger và giờ hẹn trùng khớp thì giữ nguyên không tạo lặp
  if (hasTrigger && savedSchedule === startTimeStr) {
    return;
  }
  
  // Nếu giờ hẹn đã thay đổi hoặc chưa có trigger, dọn sạch trigger cũ và đặt trigger mới
  _cleanupScheduledStartTriggers();
  
  try {
    ScriptApp.newTrigger("onScheduledStartTrigger")
      .timeBased()
      .at(targetDate)
      .create();
    props.setProperty("SCHEDULED_START_TIME", startTimeStr);
    logInfo("Đã tự động hẹn giờ đúng " + startTimeStr + " (" + formatDateVN(targetDate) + ") để đánh thức gửi ngay các email chờ!");
  } catch(e) {
    logError("Không thể tạo trigger hẹn giờ mở khung: " + e.message);
  }
}

/**
 * Xóa các trigger hẹn giờ mở khung
 */
function _cleanupScheduledStartTriggers() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === "onScheduledStartTrigger") {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  PropertiesService.getScriptProperties().deleteProperty("SCHEDULED_START_TIME");
}

/**
 * Hàm kích hoạt khi đồng hồ điểm đúng giờ bắt đầu của khung giờ
 * Có cơ chế tự động bù độ lệch sớm (Jitter Protection) của Google Cloud
 */
function onScheduledStartTrigger() {
  _cleanupScheduledStartTriggers();
  logInfo("Đồng hồ đã điểm đúng khung giờ gửi tự động. Bắt đầu quét hàng chờ...");
  
  var config = getConfig();
  var startTime = normalizeTimeString(config["Khung giờ tự động bắt đầu"]);
  var endTime = normalizeTimeString(config["Khung giờ tự động kết thúc"]);
  
  // Xử lý bù độ lệch sớm (Jitter Protection):
  // Nếu Google Apps Script kích hoạt sớm vài chục giây trước giờ mở khung:
  if (startTime) {
    var parts = startTime.split(":");
    if (parts.length >= 2) {
      var targetH = parseInt(parts[0], 10);
      var targetM = parseInt(parts[1], 10);
      var now = new Date();
      var targetToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), targetH, targetM, 0);
      var diffMs = targetToday.getTime() - now.getTime();
      
      // Nếu kích hoạt sớm dưới 3 phút: Tạm nghỉ chính xác số mili-giây còn lại để chạm đúng 09:00:01
      if (diffMs > 0 && diffMs <= 180000) {
        logInfo("Trigger thức dậy sớm " + Math.round(diffMs / 1000) + "s so với giờ bắt đầu. Chờ đến đúng " + startTime + "...");
        Utilities.sleep(diffMs + 1000);
      }
    }
  }
  
  if (!isWithinAllowedTimeWindow(startTime, endTime)) {
    logInfo("Chưa đúng khung giờ hoặc khung giờ đã thay đổi, bỏ qua.");
    return;
  }
  
  var newRecipients = getNewRecipients();
  if (newRecipients.length > 0) {
    showToast("Đúng " + (startTime || "giờ bắt đầu") + ": Đang tự động gửi ngay " + newRecipients.length + " email chờ...", "Khung giờ bắt đầu", 6);
    logInfo("Đến khung giờ bắt đầu: Tìm thấy " + newRecipients.length + " email chờ. Bắt đầu gửi ngay lập tức...");
    startSending();
  } else {
    logInfo("Đến khung giờ bắt đầu nhưng chưa có email nào chờ trong danh sách.");
  }
}
