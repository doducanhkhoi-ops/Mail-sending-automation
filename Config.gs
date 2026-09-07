// ============================================
// Config.gs - Quản lý cấu hình từ sheet
// ============================================

// Tên các sheet
var SHEET_CONFIG   = "⚙️ Cấu hình";
var SHEET_DATA     = "📋 Danh sách";
var SHEET_LOG      = "📊 Lịch sử";
var SHEET_DASH     = "📈 Dashboard";

// Config keys (cột A) và giá trị mặc định
var CONFIG_DEFAULTS = {
  "Chế độ nội dung":         "draft_first",    // manual | draft_first | draft_by_subject
  "Tiêu đề email":           "Thông báo quan trọng",
  "Nội dung HTML":           "",
  "Tiêu đề bản nháp":       "",
  "Delay giữa email (giây)": "5",
  "Batch size":              "50",
  "Cooldown giữa batch (phút)": "5",
  "Giờ gửi tự động":        "",               // VD: "08:00" hoặc để trống
  "CC":                      "",
  "BCC":                     "",
  "Email test":              "",
  "Quota đã dùng hôm nay":  "0",
  "Ngày quota":              "",               // Ngày cuối cùng reset quota
  "Trạng thái hệ thống":    "Idle"            // Idle | Đang gửi... | Tạm dừng | Hoàn thành
};

/**
 * Lấy (hoặc tạo) sheet cấu hình, trả về object chứa tất cả config
 */
function getConfig() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_CONFIG);
  
  if (!sheet) {
    sheet = _initConfigSheet(ss);
  }
  
  var data = sheet.getDataRange().getValues();
  var config = {};
  
  for (var i = 1; i < data.length; i++) { // skip header row
    var key = String(data[i][0]).trim();
    var value = String(data[i][1]).trim();
    if (key) {
      config[key] = value;
    }
  }
  
  // Reset quota nếu ngày đã đổi
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
 * Ghi 1 giá trị cấu hình
 */
function setConfig(key, value) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_CONFIG);
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
 * Tăng quota đếm
 */
function incrementQuota() {
  var config = getConfig();
  var current = parseInt(config["Quota đã dùng hôm nay"]) || 0;
  setConfig("Quota đã dùng hôm nay", String(current + 1));
  return current + 1;
}

/**
 * Kiểm tra còn quota không (Gmail free = 100/ngày)
 */
function hasQuotaRemaining() {
  var config = getConfig();
  var used = parseInt(config["Quota đã dùng hôm nay"]) || 0;
  var DAILY_LIMIT = 100; // Gmail free. Workspace = 1500
  return used < DAILY_LIMIT;
}

/**
 * Khởi tạo sheet cấu hình với giá trị mặc định
 */
function _initConfigSheet(ss) {
  var sheet = ss.insertSheet(SHEET_CONFIG);
  
  // Header
  sheet.getRange("A1:C1").setValues([["Cấu hình", "Giá trị", "Mô tả"]]);
  sheet.getRange("A1:C1").setFontWeight("bold")
    .setBackground("#0f3460").setFontColor("#ffffff");
  
  var descriptions = {
    "Chế độ nội dung":         "manual = nhập tay | draft_first = bản nháp đầu tiên | draft_by_subject = bản nháp theo tiêu đề",
    "Tiêu đề email":           "Hỗ trợ {{Tên}}, {{Email}}, v.v.",
    "Nội dung HTML":           "Nội dung email (chỉ dùng khi mode = manual)",
    "Tiêu đề bản nháp":       "Tiêu đề bản nháp Gmail để tìm (chỉ dùng khi mode = draft_by_subject)",
    "Delay giữa email (giây)": "Thời gian chờ giữa mỗi email (khuyến nghị 5-10s)",
    "Batch size":              "Số email tối đa mỗi đợt (khuyến nghị 50, tối đa 65)",
    "Cooldown giữa batch (phút)": "Thời gian nghỉ giữa các đợt",
    "Giờ gửi tự động":        "VD: 08:00 — Để trống nếu chỉ gửi thủ công",
    "CC":                      "Danh sách CC (phân cách bằng dấu phẩy)",
    "BCC":                     "Danh sách BCC (phân cách bằng dấu phẩy)",
    "Email test":              "Email nhận bản test trước khi gửi hàng loạt",
    "Quota đã dùng hôm nay":  "Tự động đếm — KHÔNG chỉnh tay",
    "Ngày quota":              "Tự động — KHÔNG chỉnh tay",
    "Trạng thái hệ thống":    "Tự động — Idle / Đang gửi... / Tạm dừng / Hoàn thành"
  };
  
  var row = 2;
  for (var key in CONFIG_DEFAULTS) {
    sheet.getRange(row, 1).setValue(key);
    sheet.getRange(row, 2).setValue(CONFIG_DEFAULTS[key]);
    sheet.getRange(row, 3).setValue(descriptions[key] || "");
    row++;
  }
  
  // Format
  sheet.setColumnWidth(1, 250);
  sheet.setColumnWidth(2, 350);
  sheet.setColumnWidth(3, 500);
  sheet.getRange("A2:A" + (row - 1)).setFontWeight("bold");
  
  // Dropdown cho chế độ nội dung
  var modeCell = sheet.getRange("B2");
  var modeRule = SpreadsheetApp.newDataValidation()
    .requireValueInList(["manual", "draft_first", "draft_by_subject"])
    .setAllowInvalid(false).build();
  modeCell.setDataValidation(modeRule);
  
  return sheet;
}

/**
 * Khởi tạo toàn bộ các sheet cần thiết (gọi 1 lần)
 */
function initAllSheets() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // Sheet Cấu hình
  if (!ss.getSheetByName(SHEET_CONFIG)) {
    _initConfigSheet(ss);
  }
  
  // Sheet Danh sách (mẫu)
  if (!ss.getSheetByName(SHEET_DATA)) {
    var dataSheet = ss.insertSheet(SHEET_DATA);
    dataSheet.getRange("A1:D1").setValues([["Email", "Tên", "Ghi chú", "Trạng thái"]]);
    dataSheet.getRange("A1:D1").setFontWeight("bold")
      .setBackground("#0f3460").setFontColor("#ffffff");
    dataSheet.setColumnWidth(1, 250);
    dataSheet.setColumnWidth(2, 200);
    dataSheet.setColumnWidth(3, 250);
    dataSheet.setColumnWidth(4, 250);
    // Thêm dữ liệu mẫu
    dataSheet.getRange("A2:C2").setValues([["example@gmail.com", "Nguyễn Văn A", "Khách hàng mới"]]);
  }
  
  // Sheet Lịch sử
  if (!ss.getSheetByName(SHEET_LOG)) {
    var logSheet = ss.insertSheet(SHEET_LOG);
    logSheet.getRange("A1:F1").setValues([["Thời gian", "Email", "Tiêu đề", "Trạng thái", "Lỗi", "Batch #"]]);
    logSheet.getRange("A1:F1").setFontWeight("bold")
      .setBackground("#0f3460").setFontColor("#ffffff");
    logSheet.setColumnWidth(1, 180);
    logSheet.setColumnWidth(2, 250);
    logSheet.setColumnWidth(3, 300);
    logSheet.setColumnWidth(4, 100);
    logSheet.setColumnWidth(5, 250);
    logSheet.setColumnWidth(6, 80);
  }
  
  // Sheet Dashboard
  if (!ss.getSheetByName(SHEET_DASH)) {
    var dashSheet = ss.insertSheet(SHEET_DASH);
    dashSheet.getRange("A1").setValue("📈 DASHBOARD - THỐNG KÊ GỬI EMAIL");
    dashSheet.getRange("A1").setFontWeight("bold").setFontSize(14)
      .setBackground("#0f3460").setFontColor("#ffffff");
    dashSheet.getRange("A1:D1").merge();
    
    var labels = [
      ["Tổng người nhận", "0"],
      ["Đã gửi thành công ✅", "0"],
      ["Chưa gửi", "0"],
      ["Gửi lỗi ❌", "0"],
      ["Quota còn lại hôm nay", "100"],
      ["Trạng thái", "Idle"],
      ["Cập nhật lúc", formatDateVN(new Date())]
    ];
    dashSheet.getRange(2, 1, labels.length, 2).setValues(labels);
    dashSheet.getRange("A2:A" + (labels.length + 1)).setFontWeight("bold");
    dashSheet.setColumnWidth(1, 250);
    dashSheet.setColumnWidth(2, 200);
  }
  
  showToast("Đã khởi tạo xong tất cả các sheet!", "✅ Setup hoàn thành");
}
