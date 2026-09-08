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
  "Chế độ nội dung":         "draft_first",    // manual | draft_first | draft_by_subject
  "Tiêu đề email":           "Thông báo quan trọng",
  "Nội dung HTML":           "",
  "Tiêu đề bản nháp":        "",
  "Delay giữa email (giây)": "5",
  "Batch size":              "50",
  "Cooldown giữa batch (phút)": "5",
  "Giờ gửi tự động":         "",
  "CC":                      "",
  "BCC":                     "",
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
      if (kLower.indexOf("nháp") !== -1 || kLower.indexOf("draft") !== -1) {
        config["Tiêu đề bản nháp"] = config["Tiêu đề bản nháp"] || value;
      }
      if (kLower.indexOf("tiêu đề email") !== -1 || kLower.indexOf("tiêu đề thư") !== -1) {
        config["Tiêu đề email"] = config["Tiêu đề email"] || value;
      }
      if (kLower.indexOf("chế độ") !== -1 || kLower.indexOf("mode") !== -1) {
        config["Chế độ nội dung"] = config["Chế độ nội dung"] || value;
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
 * Khởi tạo cấu trúc bảng Cấu hình mặc định
 */
function _initConfigSheet(ss) {
  var sheet = ss.insertSheet(SHEET_CONFIG);
  
  sheet.getRange("A1:C1").setValues([["Tham số", "Giá trị thiết lập", "Giải thích"]]);
  sheet.getRange("A1:C1").setFontWeight("bold")
    .setBackground("#1a365d").setFontColor("#ffffff");
  
  var descriptions = {
    "Chế độ nội dung":         "Chế độ lấy nội dung: manual (nhập HTML bên dưới), draft_first (thư nháp mới nhất), draft_by_subject (tìm theo tiêu đề)",
    "Tiêu đề email":           "Hỗ trợ biến thay thế như {{Tên}}, {{Email}}",
    "Nội dung HTML":           "Nội dung email định dạng HTML (chỉ áp dụng khi chọn chế độ manual)",
    "Tiêu đề bản nháp":        "Tiêu đề thư nháp trong Gmail (chỉ áp dụng khi chọn chế độ draft_by_subject)",
    "Delay giữa email (giây)": "Thời gian giãn cách giữa mỗi email (khuyến nghị từ 5 đến 10 giây)",
    "Batch size":              "Số lượng email tối đa trong mỗi đợt gửi (khuyến nghị 50)",
    "Cooldown giữa batch (phút)": "Thời gian tạm nghỉ giữa các đợt gửi",
    "Giờ gửi tự động":         "Thời gian gửi tự động (hoặc để trống nếu chỉ chạy định kỳ 15 phút)",
    "CC":                      "Danh sách địa chỉ nhận CC (phân cách bằng dấu phẩy)",
    "BCC":                     "Danh sách địa chỉ nhận BCC (phân cách bằng dấu phẩy)",
    "Email test":              "Địa chỉ email nhận thư kiểm tra trước khi gửi hàng loạt",
    "Quota đã dùng hôm nay":   "Hệ thống tự động cập nhật, không sửa thủ công",
    "Ngày quota":              "Hệ thống tự động cập nhật, không sửa thủ công",
    "Trạng thái hệ thống":     "Hệ thống tự động cập nhật: Sẵn sàng / Đang gửi... / Tạm dừng / Hoàn tất"
  };
  
  var row = 2;
  for (var key in CONFIG_DEFAULTS) {
    sheet.getRange(row, 1).setValue(key);
    sheet.getRange(row, 2).setValue(CONFIG_DEFAULTS[key]);
    sheet.getRange(row, 3).setValue(descriptions[key] || "");
    row++;
  }
  
  sheet.setColumnWidth(1, 250);
  sheet.setColumnWidth(2, 350);
  sheet.setColumnWidth(3, 520);
  sheet.getRange("A2:A" + (row - 1)).setFontWeight("bold");
  
  var modeCell = sheet.getRange("B2");
  var modeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["manual", "draft_first", "draft_by_subject"])
    .setAllowInvalid(false).build();
  modeCell.setDataValidation(modeRule);
  
  return sheet;
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
