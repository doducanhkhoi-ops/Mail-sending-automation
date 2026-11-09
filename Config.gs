// ============================================
// Config.gs - Quản lý cấu hình hệ thống từ bảng tính
// ============================================

// Tên các bảng tính (hỗ trợ cả tên chuẩn và tên cũ có icon)
var SHEET_CONFIG   = "Cấu hình";
var SHEET_CONFIG_LEGACY = "⚙️ Cấu hình";
var SHEET_DATA     = "Danh sách";
var SHEET_DATA_LEGACY = "📋 Danh sách";
var SHEET_LOG      = "Lịch sử";
var SHEET_LOG_LEGACY = "📊 Lịch sử";
var SHEET_DASH     = "Dashboard";
var SHEET_DASH_LEGACY = "📈 Dashboard";

// Giá trị cấu hình mặc định (Cột A)
var CONFIG_DEFAULTS = {
  "Tiêu đề thư nháp Gmail":   "",
  "Tên người gửi (Sender Name)": "",
  "Delay giữa email (giây)": "3",
  "Batch size":              "50",
  "Cooldown giữa batch (phút)": "5",
  "Khung giờ tự động bắt đầu": "",
  "Khung giờ tự động kết thúc": "",
  "Email đang gửi hiện tại": "Đã tắt",
  "Giờ gửi tự động":         "Đã tắt",
  "Hạn mức tối đa (Max Quota)": "100",
  "Hạn mức Google còn lại":  "100",
  "Đã gửi ngoài Sheet (Chênh lệch)": "0",
  "Tình trạng hạn mức":      "An toàn",
  "Email test":              "",
  "Quota đã dùng hôm nay":   "0",
  "Ngày quota":              "",
  "Trạng thái hệ thống":     "Sẵn sàng"
};

/**
 * Tìm sheet theo tên chuẩn hoặc tên cũ tương thích
 */
function findSheet(ss, primaryName, legacyName) {
  return ss.getSheetByName(primaryName) || (legacyName ? ss.getSheetByName(legacyName) : null);
}

/**
 * Lấy cấu hình hệ thống từ sheet Cấu hình
 */
function getConfig() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) {
    try { SpreadsheetApp.flush(); } catch(e) {}
  }
  var sheet = findSheet(ss, SHEET_CONFIG, SHEET_CONFIG_LEGACY);
  
  if (!sheet) {
    sheet = _initConfigSheet(ss);
  }
  
  var data = sheet.getDataRange().getValues();
  var config = {};
  
  for (var i = 1; i < data.length; i++) {
    var key = String(data[i][0]).trim();
    var rawVal = data[i][1];
    var value = (key === "Khung giờ tự động bắt đầu" || key === "Khung giờ tự động kết thúc") ? 
                normalizeTimeString(rawVal) : String(rawVal).trim();
    if (key) {
      config[key] = value;
      var kLower = key.toLowerCase();
      if (!config["Tiêu đề thư nháp Gmail"] && (kLower.indexOf("nháp") !== -1 || kLower.indexOf("draft") !== -1 || kLower.indexOf("tiêu đề email") !== -1)) {
        config["Tiêu đề thư nháp Gmail"] = value;
      }
    }
  }
  
  // Tự động làm mới hạn mức nếu đã sang ngày mới
  var today = formatDateVN(new Date()).split(" ")[0]; // dd/MM/yyyy
  if (config["Ngày quota"] !== today) {
    setConfig("Quota đã dùng hôm nay", "0");
    setConfig("Ngày quota", today);
    config["Quota đã dùng hôm nay"] = "0";
    config["Ngày quota"] = today;
  }
  
  return config;
}

/**
 * Cập nhật một giá trị trong sheet Cấu hình
 */
function setConfig(key, value) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = findSheet(ss, SHEET_CONFIG, SHEET_CONFIG_LEGACY);
  if (!sheet) return;
  
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][0]).trim() === key) {
      sheet.getRange(i + 1, 2).setValue(value);
      return;
    }
  }
  
  // Nếu chưa có khóa này trong bảng Cấu hình, tự động thêm dòng mới vào cuối bảng
  var lastRow = sheet.getLastRow();
  sheet.getRange(lastRow + 1, 1).setValue(key).setFontWeight("bold");
  sheet.getRange(lastRow + 1, 2).setValue(value);
}

/**
 * Đếm chính xác số email đã gửi thành công trong ngày hôm nay từ bảng Lịch sử (theo từng tài khoản hoặc toàn bảng)
 * @param {String} [targetSenderEmail] - Email tài khoản cần lọc (nếu để trống sẽ đếm toàn bộ)
 * @returns {Number} Số lượng email đã gửi hôm nay
 */
function countTodaySentFromLog(targetSenderEmail) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = findSheet(ss, SHEET_LOG, SHEET_LOG_LEGACY);
    if (!sheet) return 0;
    
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return 0;
    
    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
    
    var timeColIndex = 0;
    var senderColIndex = -1;
    var statusColIndex = -1;
    
    for (var j = 0; j < headers.length; j++) {
      var h = String(headers[j]).trim().toLowerCase();
      if (h.indexOf("thời gian") !== -1 || h === "time" || h === "date") {
        timeColIndex = j;
      }
      if ((h.indexOf("tài khoản") !== -1 && h.indexOf("gửi") !== -1) || h === "sender" || h.indexOf("người gửi") !== -1) {
        senderColIndex = j;
      }
      if (h.indexOf("trạng thái") !== -1 || h === "status") {
        statusColIndex = j;
      }
    }
    
    if (statusColIndex === -1) return 0;
    
    var data = sheet.getRange(2, 1, lastRow - 1, lastCol).getDisplayValues();
    var today = formatDateVN(new Date()).split(" ")[0]; // "dd/MM/yyyy"
    var count = 0;
    var targetEmailLower = targetSenderEmail ? String(targetSenderEmail).trim().toLowerCase() : "";
    
    for (var i = 0; i < data.length; i++) {
      var row = data[i];
      var timeStr = String(row[timeColIndex]).trim();
      var statusStr = String(row[statusColIndex]).trim();
      var senderStr = (senderColIndex !== -1) ? String(row[senderColIndex]).trim().toLowerCase() : "";
      
      // Kiểm tra gửi hôm nay và thành công
      var isToday = (timeStr.indexOf(today) !== -1);
      var isSuccess = (statusStr.indexOf("Thành công") !== -1 || statusStr.indexOf("Đã gửi") !== -1 || statusStr.indexOf("Done") !== -1);
      
      if (isToday && isSuccess) {
        if (!targetEmailLower || senderStr === targetEmailLower) {
          count++;
        }
      }
    }
    return count;
  } catch(e) {
    logError("Lỗi countTodaySentFromLog: " + e.message);
    return 0;
  }
}

/**
 * Đếm chính xác số email đã gửi thành công trong ngày hôm nay
 * Ưu tiên đối chiếu từ bảng Lịch sử (có phân loại theo người gửi), dự phòng bảng Danh sách
 * @param {String} [senderEmail] - Email của người gửi cần đếm
 * @returns {Number} Số lượng email đã gửi hôm nay
 */
function countTodaySentFromSheet(senderEmail) {
  var logCount = countTodaySentFromLog(senderEmail);
  if (logCount > 0 || senderEmail) {
    return logCount;
  }
  
  // Dự phòng: Đếm từ bảng Danh sách nếu bảng Lịch sử chưa có dữ liệu
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = findSheet(ss, SHEET_DATA, SHEET_DATA_LEGACY);
    if (!sheet) return 0;
    
    var lastRow = sheet.getLastRow();
    if (lastRow < 2) return 0;
    
    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
    var statusCol = -1;
    for (var j = 0; j < headers.length; j++) {
      var h = String(headers[j]).trim().toLowerCase();
      if (h === "trạng thái" || h === "status") {
        statusCol = j + 1;
        break;
      }
    }
    if (statusCol === -1) return 0;
    
    var statuses = sheet.getRange(2, statusCol, lastRow - 1, 1).getDisplayValues();
    var today = formatDateVN(new Date()).split(" ")[0]; // "dd/MM/yyyy"
    var count = 0;
    for (var i = 0; i < statuses.length; i++) {
      var s = String(statuses[i][0]).trim();
      if ((s.indexOf("Đã gửi") !== -1 || s.indexOf("Thành công") !== -1) && s.indexOf(today) !== -1) {
        count++;
      }
    }
    return count;
  } catch(e) {
    logError("Lỗi countTodaySentFromSheet: " + e.message);
    return 0;
  }
}

/**
 * Đo và tính toán toàn bộ chi tiết hạn mức Quota của tài khoản hiện tại kèm sự chênh lệch
 * @returns {Object} { userEmail, accountType, maxQuota, remainingQuota, sentViaSheet, usedOutside, statusText, isSafe }
 */
function refreshAndGetQuotaDetails() {
  var userEmail = getCurrentUserEmail();
  var config = getConfig();
  
  // Lấy số thư đã gửi hôm nay của chính tài khoản này (tính từ bảng Lịch sử)
  var realSentToday = countTodaySentFromSheet(userEmail);
  var todayDateStr = formatDateVN(new Date()).split(" ")[0]; // "dd/MM/yyyy"
  var lastQuotaDate = config["Ngày quota"] || "";
  
  // Tự động làm mới bộ đếm khi sang ngày mới
  var recordedSent = 0;
  if (lastQuotaDate === todayDateStr) {
    recordedSent = parseInt(config["Quota đã dùng hôm nay"]) || 0;
  } else {
    setConfig("Ngày quota", todayDateStr);
    config["Ngày quota"] = todayDateStr;
  }
  
  var sentViaSheet = Math.max(realSentToday, recordedSent);
  
  // Đồng bộ lại vào config nếu có sự chênh lệch
  if (sentViaSheet !== recordedSent) {
    setConfig("Quota đã dùng hôm nay", String(sentViaSheet));
    config["Quota đã dùng hôm nay"] = String(sentViaSheet);
  }
  
  // Xác định hạn mức tối đa do Google cấp (100 đối với Gmail cá nhân / Edu, 1500 đối với Workspace)
  var isPersonal = (userEmail.toLowerCase().indexOf("@gmail.com") !== -1 || userEmail.toLowerCase().indexOf("@googlemail.com") !== -1);
  var maxQuota = isPersonal ? 100 : 1500;
  var accountType = isPersonal ? "Gmail cá nhân (@gmail.com)" : "Google Workspace doanh nghiệp";
  
  var googleReportedRemaining = maxQuota;
  try {
    var live = MailApp.getRemainingDailyQuota();
    if (live !== null && live !== undefined) {
      googleReportedRemaining = live;
      // Nếu số còn lại > 100 thì chắc chắn là tài khoản Workspace
      if (googleReportedRemaining > 100) {
        maxQuota = 1500;
        accountType = "Google Workspace doanh nghiệp";
      } else {
        maxQuota = 100;
        if (!isPersonal) {
          accountType = "Google Workspace giáo dục (@ftu.edu.vn)";
        }
      }
    }
  } catch (e) {
    logError("Không thể đo MailApp.getRemainingDailyQuota: " + e.message);
  }
  
  // Google API có độ trễ cập nhật (cache) khi vừa gửi email.
  // Đồng bộ số còn lại thực tế: Không bao giờ được vượt quá (maxQuota - sentViaSheet).
  var remainingQuota = Math.max(0, Math.min(googleReportedRemaining, maxQuota - sentViaSheet));
  
  // Tổng số thư đã tiêu hao hôm nay từ cả trong và ngoài Sheet
  var totalUsedReal = Math.max(sentViaSheet, maxQuota - googleReportedRemaining);
  var usedOutside = Math.max(0, totalUsedReal - sentViaSheet);
  
  var statusText = "An toàn (Còn " + remainingQuota + " lượt)";
  var isSafe = true;
  if (remainingQuota <= 1) {
    statusText = "Đã hết hạn mức (Dừng gửi an toàn)";
    isSafe = false;
  } else if (remainingQuota <= 20) {
    statusText = "Cảnh báo: Sắp hết (Còn " + remainingQuota + " lượt)";
  }
  
  // Lưu vào sheet Cấu hình
  setConfig("Hạn mức tối đa (Max Quota)", String(maxQuota));
  setConfig("Hạn mức Google còn lại", String(remainingQuota));
  setConfig("Đã gửi ngoài Sheet (Chênh lệch)", String(usedOutside));
  setConfig("Tình trạng hạn mức", statusText);
  
  return {
    userEmail: userEmail,
    accountType: accountType,
    maxQuota: maxQuota,
    remainingQuota: remainingQuota,
    sentViaSheet: sentViaSheet,
    usedOutside: usedOutside,
    statusText: statusText,
    isSafe: isSafe
  };
}

/**
 * Ghi nhận số lượng email đã gửi vào hạn mức ngày và cập nhật quota sống từ Google
 */
function incrementQuota() {
  var config = getConfig();
  var current = parseInt(config["Quota đã dùng hôm nay"]) || 0;
  var newCount = current + 1;
  setConfig("Quota đã dùng hôm nay", String(newCount));
  
  try {
    refreshAndGetQuotaDetails();
  } catch(e) {}
  
  return newCount;
}

/**
 * Kiểm tra hạn mức gửi email còn lại thực tế từ máy chủ Google (Live Quota)
 * Bảo vệ tuyệt đối: Dừng an toàn khi quota còn <= 1 để tránh lỗi 'Service invoked too many times'
 * @returns {Boolean} true nếu còn hạn mức gửi an toàn
 */
function hasQuotaRemaining() {
  try {
    var details = refreshAndGetQuotaDetails();
    if (!details.isSafe) {
      logInfo("Hạn mức máy chủ Google chỉ còn: " + details.remainingQuota + ". Tự động dừng gửi để bảo vệ an toàn.");
      return false;
    }
    return true;
  } catch (e) {
    logError("Lỗi kiểm tra hasQuotaRemaining: " + e.message);
  }
  
  // Dự phòng kiểm tra theo bộ đếm trong sheet nếu không gọi được API
  var config = getConfig();
  var used = parseInt(config["Quota đã dùng hôm nay"]) || 0;
  return used < 100;
}

/**
 * Đồng bộ bảng Cấu hình
 * Tự động chuẩn hóa các tham số và giữ nguyên dữ liệu đã nhập của người dùng
 */
function syncConfigSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = findSheet(ss, SHEET_CONFIG, SHEET_CONFIG_LEGACY);
  if (!sheet) {
    sheet = _initConfigSheet(ss);
    return sheet;
  }
  
  // 1. Đọc toàn bộ giá trị hiện tại của người dùng
  var data = sheet.getDataRange().getValues();
  var currentValues = {};
  for (var i = 1; i < data.length; i++) {
    var k = String(data[i][0]).trim();
    var rawV = data[i][1];
    var v = (k === "Khung giờ tự động bắt đầu" || k === "Khung giờ tự động kết thúc") ?
            normalizeTimeString(rawV) : String(rawV).trim();
    if (k) {
      currentValues[k] = v;
    }
  }
  
  // 2. Chuyển tiếp giá trị từ các khóa cũ sang khóa mới nếu có
  var unifiedDraft = currentValues["Tiêu đề thư nháp Gmail"] || 
                     currentValues["Tiêu đề bản nháp"] || 
                     (currentValues["Chế độ nội dung"] === "draft_by_subject" ? currentValues["Tiêu đề email"] : "") || 
                     CONFIG_DEFAULTS["Tiêu đề thư nháp Gmail"];
                     
  var unifiedSenderName = currentValues["Tên người gửi (Sender Name)"] || 
                          currentValues["Tên người gửi"] || 
                          currentValues["Sender Name"] || 
                          CONFIG_DEFAULTS["Tên người gửi (Sender Name)"];
                     
  var unifiedSender = currentValues["Email đang gửi hiện tại"] ||
                      currentValues["Người phụ trách gửi tự động"] ||
                      CONFIG_DEFAULTS["Email đang gửi hiện tại"];
                      
  var liveQuotaVal = "100";
  try {
    var lq = MailApp.getRemainingDailyQuota();
    if (lq !== null && lq !== undefined) {
      liveQuotaVal = String(lq);
    }
  } catch(e) {}
  
  var descriptions = {
    "Tiêu đề thư nháp Gmail":   "Tên thư nháp trong Gmail để làm mẫu (ĐỂ TRỐNG = Tự động lấy thư nháp mới nhất)",
    "Tên người gửi (Sender Name)": "Tên đại diện hiển thị trong hộp thư người nhận (ĐỂ TRỐNG = Tên tài khoản Google mặc định)",
    "Delay giữa email (giây)": "Thời gian giãn cách giữa mỗi email (khuyến nghị từ 2 đến 5 giây)",
    "Batch size":              "Số lượng email tối đa trong mỗi đợt gửi (khuyến nghị 50)",
    "Cooldown giữa batch (phút)": "Thời gian tạm nghỉ giữa các đợt gửi khi gửi hàng loạt",
    "Khung giờ tự động bắt đầu": "Giờ bắt đầu gửi tự động (định dạng HH:mm, ví dụ 08:00, ĐỂ TRỐNG = Gửi mọi lúc 24/7)",
    "Khung giờ tự động kết thúc": "Giờ kết thúc gửi tự động (định dạng HH:mm, ví dụ 21:30, ĐỂ TRỐNG = Gửi mọi lúc 24/7)",
    "Email đang gửi hiện tại": "Tài khoản Google đang gửi thư tự động (Hệ thống tự cập nhật)",
    "Giờ gửi tự động":         "Chế độ chạy tự động: Tức thì (Realtime) / Mỗi 15 phút / Đã tắt (Hệ thống tự cập nhật)",
    "Hạn mức tối đa (Max Quota)": "Hạn mức tối đa do Google cấp (100 mail/ngày cho Gmail thường, 1500 cho Workspace)",
    "Hạn mức Google còn lại":  "Số lượt gửi máy chủ Google còn cấp cho tài khoản này hôm nay (Hệ thống đo sống trực tiếp)",
    "Đã gửi ngoài Sheet (Chênh lệch)": "Số email đã bị trừ ở ngoài Sheet hôm nay (do gửi bằng web Gmail, điện thoại hoặc script khác)",
    "Tình trạng hạn mức":      "Đánh giá an toàn tự động: An toàn / Cảnh báo / Đã hết",
    "Email test":              "Địa chỉ email nhận thư kiểm tra trước khi gửi hàng loạt",
    "Quota đã dùng hôm nay":   "Số email đã gửi qua Google Sheet này hôm nay (Hệ thống tự cập nhật)",
    "Ngày quota":              "Hệ thống tự động cập nhật, không sửa thủ công",
    "Trạng thái hệ thống":     "Hệ thống tự động cập nhật: Sẵn sàng / Đang gửi... / Tạm dừng / Hoàn tất"
  };
  
  // 3. Xóa validation cũ và xóa sạch nội dung cũ để ghi lại danh sách cấu hình
  sheet.getRange("B2:B30").clearDataValidations();
  sheet.clearContents();
  sheet.clearFormats();
  
  // 4. Ghi tiêu đề cột
  sheet.getRange("A1:C1").setValues([["Tham số", "Giá trị thiết lập", "Giải thích"]]);
  sheet.getRange("A1:C1").setFontWeight("bold")
    .setBackground("#0f172a").setFontColor("#ffffff")
    .setFontSize(11).setVerticalAlignment("middle");
  sheet.setRowHeight(1, 36);
  sheet.setFrozenRows(1);
  
  // 5. Ghi từng dòng tham số
  var row = 2;
  for (var key in CONFIG_DEFAULTS) {
    var val = (currentValues[key] !== undefined && currentValues[key] !== "") ? currentValues[key] : CONFIG_DEFAULTS[key];
    if (key === "Tiêu đề thư nháp Gmail") {
      val = unifiedDraft;
    }
    if (key === "Tên người gửi (Sender Name)") {
      val = unifiedSenderName;
    }
    if (key === "Email đang gửi hiện tại") {
      val = unifiedSender;
    }
    if (key === "Hạn mức Google còn lại") {
      val = liveQuotaVal;
    }
    if (key === "Hạn mức tối đa (Max Quota)") {
      var lqNum = parseInt(liveQuotaVal) || 100;
      val = (lqNum > 100) ? "1500" : "100";
    }
    if (key === "Tình trạng hạn mức") {
      var safeRem = parseInt(liveQuotaVal) || 100;
      if (safeRem <= 1) {
        val = "Đã hết hạn mức (Dừng gửi an toàn)";
      } else if (safeRem <= 20) {
        val = "Cảnh báo: Sắp hết (Còn " + safeRem + " lượt)";
      } else {
        val = "An toàn (Còn " + safeRem + " lượt)";
      }
    }
    if (key === "Quota đã dùng hôm nay") {
      var realSent = countTodaySentFromSheet();
      var curValNum = parseInt(val) || 0;
      val = String(Math.max(realSent, curValNum));
    }
    
    if (key === "Khung giờ tự động bắt đầu" || key === "Khung giờ tự động kết thúc") {
      val = normalizeTimeString(val);
      sheet.getRange(row, 2).setNumberFormat("@");
    }
    
    sheet.getRange(row, 1).setValue(key);
    sheet.getRange(row, 2).setValue(val);
    sheet.getRange(row, 3).setValue(descriptions[key] || "");
    
    var bg = (row % 2 === 0) ? "#ffffff" : "#f8fafc";
    sheet.getRange(row, 1).setBackground(bg).setFontColor("#0f172a").setFontWeight("bold").setFontSize(10).setVerticalAlignment("middle");
    sheet.getRange(row, 2).setBackground("#f1f5f9").setFontColor("#0f172a").setFontSize(10).setVerticalAlignment("middle");
    sheet.getRange(row, 3).setBackground(bg).setFontColor("#64748b").setFontSize(9.5).setVerticalAlignment("middle");
    sheet.setRowHeight(row, 28);
    row++;
  }
  
  var totalRows = row - 1;
  sheet.getRange(2, 1, totalRows - 1, 3).setBorder(true, true, true, true, true, true, "#e2e8f0", SpreadsheetApp.BorderStyle.SOLID);
  sheet.setColumnWidth(1, 260);
  sheet.setColumnWidth(2, 360);
  sheet.setColumnWidth(3, 520);
  
  // Dọn sạch các dòng thừa phía dưới nếu có
  var maxRows = sheet.getMaxRows();
  if (maxRows > totalRows) {
    sheet.getRange(totalRows + 1, 1, maxRows - totalRows, sheet.getMaxColumns()).clearContent().clearFormat();
  }
  
  // Đồng bộ lịch hẹn giờ đánh thức chính xác nếu có cấu hình khung giờ
  try {
    var sTime = currentValues["Khung giờ tự động bắt đầu"] ? String(currentValues["Khung giờ tự động bắt đầu"]).trim() : "";
    var eTime = currentValues["Khung giờ tự động kết thúc"] ? String(currentValues["Khung giờ tự động kết thúc"]).trim() : "";
    var autoMode = currentValues["Giờ gửi tự động"] || "";
    if (sTime && autoMode !== "Đã tắt" && !isWithinAllowedTimeWindow(sTime, eTime)) {
      _scheduleWakeupAtStartTime(sTime);
    }
  } catch(e) {}
  
  return sheet;
}

/**
 * Khởi tạo cấu trúc bảng Cấu hình mặc định
 */
function _initConfigSheet(ss) {
  var sheet = ss.insertSheet(SHEET_CONFIG);
  return syncConfigSheet();
}

/**
 * Khởi tạo đầy đủ các bảng dữ liệu cần thiết cho dự án
 */
function initAllSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  if (!findSheet(ss, SHEET_CONFIG, SHEET_CONFIG_LEGACY)) {
    _initConfigSheet(ss);
  }
  
  if (!findSheet(ss, SHEET_DATA, SHEET_DATA_LEGACY)) {
    var dataSheet = ss.insertSheet(SHEET_DATA);
    dataSheet.getRange("A1:D1").setValues([["Email", "Tên", "Ghi chú", "Trạng thái"]]);
    dataSheet.getRange("A1:D1").setFontWeight("bold")
      .setBackground("#1a365d").setFontColor("#ffffff");
    dataSheet.setColumnWidth(1, 260);
    dataSheet.setColumnWidth(2, 200);
    dataSheet.setColumnWidth(3, 250);
    dataSheet.setColumnWidth(4, 250);
    dataSheet.getRange("A2:C2").setValues([["nguoinhan@example.com", "Nguyễn Văn A", "Khách hàng mẫu"]]);
  }
  
  if (!findSheet(ss, SHEET_LOG, SHEET_LOG_LEGACY)) {
    var logSheet = ss.insertSheet(SHEET_LOG);
    logSheet.getRange("A1:G1").setValues([["Thời gian", "Tài khoản gửi", "Email người nhận", "Tiêu đề", "Trạng thái", "Chi tiết lỗi", "Đợt #"]]);
    logSheet.getRange("A1:G1").setFontWeight("bold")
      .setBackground("#0f172a").setFontColor("#ffffff");
    logSheet.setColumnWidth(1, 170);
    logSheet.setColumnWidth(2, 240);
    logSheet.setColumnWidth(3, 240);
    logSheet.setColumnWidth(4, 260);
    logSheet.setColumnWidth(5, 120);
    logSheet.setColumnWidth(6, 220);
    logSheet.setColumnWidth(7, 80);
  }
  
  if (!findSheet(ss, SHEET_DASH, SHEET_DASH_LEGACY)) {
    updateDashboard();
  }
  
  showToast("Đã khởi tạo đầy đủ các bảng dữ liệu.", "Khởi tạo thành công");
}
