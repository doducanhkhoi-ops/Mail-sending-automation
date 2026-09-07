// ============================================
// SheetManager.gs - Đọc/ghi dữ liệu Google Sheet
// Dùng getDisplayValues() để tương thích QUERY/IMPORTRANGE
// ============================================

/**
 * Lấy tất cả người nhận từ sheet Danh sách
 * Trả về mảng objects: [{row: 2, email: "...", data: {Tên: "...", ...}, status: ""}]
 */
function getAllRecipients() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_DATA);
  if (!sheet) {
    logError("Không tìm thấy sheet: " + SHEET_DATA);
    return [];
  }
  
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return []; // Chỉ có header
  
  var lastCol = sheet.getLastColumn();
  var range = sheet.getRange(1, 1, lastRow, lastCol);
  
  // getDisplayValues() để đọc kết quả của QUERY/IMPORTRANGE
  var displayValues = range.getDisplayValues();
  
  var headers = displayValues[0];
  var statusColIndex = lastCol - 1; // Cột cuối = Trạng thái
  
  var recipients = [];
  for (var i = 1; i < displayValues.length; i++) {
    var row = displayValues[i];
    var email = String(row[0]).trim();
    
    // Skip dòng trống
    if (!email) continue;
    
    // Tạo object data với headers làm key
    var data = {};
    for (var j = 0; j < headers.length; j++) {
      var headerName = String(headers[j]).trim();
      if (headerName && headerName !== "Trạng thái") {
        data[headerName] = String(row[j]).trim();
      }
    }
    
    recipients.push({
      row: i + 1,              // Dòng thực trên sheet (1-indexed)
      email: email,
      data: data,              // {Tên: "An", Email: "an@...", ...}
      status: String(row[statusColIndex]).trim()
    });
  }
  
  return recipients;
}

/**
 * Lấy chỉ người nhận MỚI (chưa có trạng thái Done)
 */
function getNewRecipients() {
  var all = getAllRecipients();
  return all.filter(function(r) {
    return !r.status || (!r.status.startsWith("Done") && !r.status.startsWith("✅"));
  });
}

/**
 * Ghi trạng thái vào cột cuối cùng của 1 dòng
 */
function updateRecipientStatus(rowNumber, status) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_DATA);
  if (!sheet) return;
  
  var lastCol = sheet.getLastColumn();
  sheet.getRange(rowNumber, lastCol).setValue(status);
}

/**
 * Đánh dấu Done cho 1 dòng
 */
function markAsDone(rowNumber) {
  var timestamp = formatDateVN(new Date());
  updateRecipientStatus(rowNumber, "Done ✅ " + timestamp);
}

/**
 * Đánh dấu lỗi cho 1 dòng
 */
function markAsError(rowNumber, errorMsg) {
  updateRecipientStatus(rowNumber, "Lỗi ❌ " + (errorMsg || "Unknown error"));
}

/**
 * Ghi 1 dòng log vào sheet Lịch sử
 */
function addLogEntry(email, subject, status, error, batchNum) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_LOG);
  if (!sheet) return;
  
  sheet.appendRow([
    formatDateVN(new Date()),
    email,
    subject,
    status,
    error || "",
    batchNum || ""
  ]);
}

/**
 * Cập nhật Dashboard với thống kê mới nhất
 */
function updateDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dashSheet = ss.getSheetByName(SHEET_DASH);
  if (!dashSheet) return;
  
  var all = getAllRecipients();
  var total = all.length;
  var done = all.filter(function(r) { return r.status && r.status.startsWith("Done"); }).length;
  var errors = all.filter(function(r) { return r.status && r.status.startsWith("Lỗi"); }).length;
  var pending = total - done - errors;
  
  var config = getConfig();
  var quotaUsed = parseInt(config["Quota đã dùng hôm nay"]) || 0;
  var quotaRemaining = Math.max(0, 100 - quotaUsed);
  
  var values = [
    ["Tổng người nhận", total],
    ["Đã gửi thành công ✅", done],
    ["Chưa gửi", pending],
    ["Gửi lỗi ❌", errors],
    ["Quota còn lại hôm nay", quotaRemaining],
    ["Trạng thái", config["Trạng thái hệ thống"] || "Idle"],
    ["Cập nhật lúc", formatDateVN(new Date())]
  ];
  
  dashSheet.getRange(2, 1, values.length, 2).setValues(values);
  
  // Thêm thanh tiến độ đơn giản
  var progressRow = values.length + 3;
  var pct = total > 0 ? Math.round((done / total) * 100) : 0;
  dashSheet.getRange(progressRow, 1).setValue("Tiến độ");
  dashSheet.getRange(progressRow, 2).setValue(pct + "% (" + done + "/" + total + ")");
  dashSheet.getRange(progressRow, 1).setFontWeight("bold");
}

/**
 * Phát hiện email trùng lặp trong danh sách
 */
function detectDuplicates() {
  var all = getAllRecipients();
  var seen = {};
  var duplicates = [];
  
  for (var i = 0; i < all.length; i++) {
    var email = all[i].email.toLowerCase();
    if (seen[email]) {
      duplicates.push({
        email: email,
        row: all[i].row,
        firstRow: seen[email]
      });
    } else {
      seen[email] = all[i].row;
    }
  }
  
  return duplicates;
}

/**
 * Reset tất cả trạng thái (xóa cột Trạng thái)
 */
function resetAllStatus() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_DATA);
  if (!sheet) return;
  
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return;
  
  sheet.getRange(2, lastCol, lastRow - 1, 1).clearContent();
  showToast("Đã xóa tất cả trạng thái. Sẵn sàng gửi lại.", "🔄 Reset");
}
