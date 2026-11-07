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

// Giá trị cấu hình mặc định tinh gọn chuẩn MECE (Cột A)
var CONFIG_DEFAULTS = {
  "Tiêu đề thư nháp Gmail":   "",
  "Delay giữa email (giây)": "3",
  "Batch size":              "50",
  "Cooldown giữa batch (phút)": "5",
  "Khung giờ tự động bắt đầu": "",
  "Khung giờ tự động kết thúc": "",
  "Email đang gửi hiện tại": "Đã tắt",
  "Giờ gửi tự động":         "Đã tắt",
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
  var sheet = findSheet(ss, SHEET_CONFIG, SHEET_CONFIG_LEGACY);
  
  if (!sheet) {
    sheet = _initConfigSheet(ss);
  }
  
  var data = sheet.getDataRange().getValues();
  var config = {};
  
  for (var i = 1; i < data.length; i++) {
    var key = String(data[i][0]).trim();
    var value = String(data[i][1]).trim();
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
 * Ghi nhận số lượng email đã gửi vào hạn mức ngày
 */
function incrementQuota() {
  var config = getConfig();
  var current = parseInt(config["Quota đã dùng hôm nay"]) || 0;
  setConfig("Quota đã dùng hôm nay", String(current + 1));
  return current + 1;
}

/**
 * Kiểm tra hạn mức gửi email còn lại trong ngày (Gmail miễn phí: 100/ngày, Google Workspace: 1500/ngày)
 */
function hasQuotaRemaining() {
  var config = getConfig();
  var used = parseInt(config["Quota đã dùng hôm nay"]) || 0;
  var DAILY_LIMIT = 100;
  return used < DAILY_LIMIT;
}

/**
 * Đồng bộ và nâng cấp bảng Cấu hình sang chuẩn MECE
 * Tự động loại bỏ các tham số cũ dư thừa (Tiêu đề email, Chế độ nội dung, Nội dung HTML)
 * Bảo lưu toàn bộ dữ liệu cấu hình thực tế của người dùng
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
    var v = String(data[i][1]).trim();
    if (k) {
      currentValues[k] = v;
    }
  }
  
  // 2. Kế thừa thông minh từ các khóa cũ sang khóa MECE mới
  var unifiedDraft = currentValues["Tiêu đề thư nháp Gmail"] || 
                     currentValues["Tiêu đề bản nháp"] || 
                     (currentValues["Chế độ nội dung"] === "draft_by_subject" ? currentValues["Tiêu đề email"] : "") || 
                     CONFIG_DEFAULTS["Tiêu đề thư nháp Gmail"];
                     
  var unifiedSender = currentValues["Email đang gửi hiện tại"] ||
                      currentValues["Người phụ trách gửi tự động"] ||
                      CONFIG_DEFAULTS["Email đang gửi hiện tại"];
  
  var descriptions = {
    "Tiêu đề thư nháp Gmail":   "Tên thư nháp trong Gmail để làm mẫu (ĐỂ TRỐNG = Tự động lấy thư nháp mới nhất)",
    "Delay giữa email (giây)": "Thời gian giãn cách giữa mỗi email (khuyến nghị từ 2 đến 5 giây)",
    "Batch size":              "Số lượng email tối đa trong mỗi đợt gửi (khuyến nghị 50)",
    "Cooldown giữa batch (phút)": "Thời gian tạm nghỉ giữa các đợt gửi khi gửi hàng loạt",
    "Khung giờ tự động bắt đầu": "Giờ bắt đầu gửi tự động (định dạng HH:mm, ví dụ 08:00, ĐỂ TRỐNG = Gửi mọi lúc 24/7)",
    "Khung giờ tự động kết thúc": "Giờ kết thúc gửi tự động (định dạng HH:mm, ví dụ 21:30, ĐỂ TRỐNG = Gửi mọi lúc 24/7)",
    "Email đang gửi hiện tại": "Tài khoản Google đang gửi thư tự động (Hệ thống tự cập nhật)",
    "Giờ gửi tự động":         "Chế độ chạy tự động: Tức thì (Realtime) / Mỗi 15 phút / Đã tắt (Hệ thống tự cập nhật)",
    "Email test":              "Địa chỉ email nhận thư kiểm tra trước khi gửi hàng loạt",
    "Quota đã dùng hôm nay":   "Hệ thống tự động cập nhật, không sửa thủ công",
    "Ngày quota":              "Hệ thống tự động cập nhật, không sửa thủ công",
    "Trạng thái hệ thống":     "Hệ thống tự động cập nhật: Sẵn sàng / Đang gửi... / Tạm dừng / Hoàn tất"
  };
  
  // 3. Xóa validation cũ và xóa sạch nội dung cũ để ghi lại chuẩn MECE
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
  
  // 5. Ghi từng dòng tham số chuẩn MECE
  var row = 2;
  for (var key in CONFIG_DEFAULTS) {
    var val = (currentValues[key] !== undefined && currentValues[key] !== "") ? currentValues[key] : CONFIG_DEFAULTS[key];
    if (key === "Tiêu đề thư nháp Gmail") {
      val = unifiedDraft;
    }
    if (key === "Email đang gửi hiện tại") {
      val = unifiedSender;
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
    logSheet.getRange("A1:F1").setValues([["Thời gian", "Email", "Tiêu đề", "Trạng thái", "Chi tiết lỗi", "Đợt #"]]);
    logSheet.getRange("A1:F1").setFontWeight("bold")
      .setBackground("#1a365d").setFontColor("#ffffff");
    logSheet.setColumnWidth(1, 180);
    logSheet.setColumnWidth(2, 260);
    logSheet.setColumnWidth(3, 300);
    logSheet.setColumnWidth(4, 120);
    logSheet.setColumnWidth(5, 250);
    logSheet.setColumnWidth(6, 80);
  }
  
  if (!findSheet(ss, SHEET_DASH, SHEET_DASH_LEGACY)) {
    updateDashboard();
  }
  
  showToast("Đã khởi tạo đầy đủ các bảng dữ liệu.", "Khởi tạo thành công");
}
