// ============================================
// SheetManager.gs - Đọc và ghi dữ liệu bảng tính Google Sheet
// Tương thích với các công thức QUERY / IMPORTRANGE
// ============================================

/**
 * Lấy toàn bộ danh sách người nhận từ bảng Danh sách
 * @returns {Array<Object>} Mảng người nhận: [{row, email, data, status}]
 */
function getAllRecipients() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = findSheet(ss, SHEET_DATA, SHEET_DATA_LEGACY);
  if (!sheet) {
    logError("Không tìm thấy bảng dữ liệu Danh sách.");
    return [];
  }
  
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  
  var lastCol = sheet.getLastColumn();
  var range = sheet.getRange(1, 1, lastRow, lastCol);
  var displayValues = range.getDisplayValues();
  
  var headers = displayValues[0];
  var emailColIndex = 0;
  var statusColIndex = -1;
  
  for (var j = 0; j < headers.length; j++) {
    var h = String(headers[j]).trim().toLowerCase();
    if (h === "email" || h === "địa chỉ email" || h === "mail") {
      emailColIndex = j;
    }
    if (h === "trạng thái" || h === "status") {
      statusColIndex = j;
    }
  }
  if (statusColIndex === -1) {
    statusColIndex = lastCol - 1;
  }
  
  var recipients = [];
  for (var i = 1; i < displayValues.length; i++) {
    var row = displayValues[i];
    var email = String(row[emailColIndex]).trim();
    
    if (!email) continue;
    
    var data = {};
    for (var j = 0; j < headers.length; j++) {
      var headerName = String(headers[j]).trim();
      if (headerName && j !== statusColIndex) {
        data[headerName] = String(row[j]).trim();
      }
    }
    
    recipients.push({
      row: i + 1,
      email: email,
      data: data,
      status: String(row[statusColIndex]).trim()
    });
  }
  
  return recipients;
}

/**
 * Lọc lấy danh sách những người nhận mới (chưa có trạng thái gửi thành công)
 */
function getNewRecipients() {
  var all = getAllRecipients();
  return all.filter(function(r) {
    if (!r.status) return true;
    var s = r.status.toLowerCase();
    return !(s.startsWith("done") || s.startsWith("đã gửi") || s.startsWith("thành công") || s.startsWith("✅"));
  });
}

/**
 * Cập nhật cột trạng thái của một dòng trong bảng Danh sách
 */
function updateRecipientStatus(rowNumber, status) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = findSheet(ss, SHEET_DATA, SHEET_DATA_LEGACY);
  if (!sheet) return;
  
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  var targetCol = lastCol;
  for (var j = 0; j < headers.length; j++) {
    var h = String(headers[j]).trim().toLowerCase();
    if (h === "trạng thái" || h === "status") {
      targetCol = j + 1;
      break;
    }
  }
  sheet.getRange(rowNumber, targetCol).setValue(status);
}

/**
 * Đánh dấu gửi thành công cho một dòng
 */
function markAsDone(rowNumber) {
  var timestamp = formatDateVN(new Date());
  updateRecipientStatus(rowNumber, "Đã gửi - " + timestamp);
}

/**
 * Đánh dấu lỗi cho một dòng
 */
function markAsError(rowNumber, errorMsg) {
  updateRecipientStatus(rowNumber, "Lỗi: " + (errorMsg || "Lỗi không xác định"));
}

/**
 * Ghi một dòng nhật ký vào bảng Lịch sử
 */
function addLogEntry(email, subject, status, error, batchNum) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = findSheet(ss, SHEET_LOG, SHEET_LOG_LEGACY);
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
 * Cập nhật giao diện và số liệu thống kê trên bảng Dashboard
 * Thiết kế giao diện Operations Dashboard chuyên nghiệp, tối giản hiện đại
 */
function updateDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dashSheet = findSheet(ss, SHEET_DASH, SHEET_DASH_LEGACY);
  if (!dashSheet) {
    dashSheet = ss.insertSheet(SHEET_DASH);
  }
  
  var all = getAllRecipients();
  var total = all.length;
  var done = all.filter(function(r) {
    if (!r.status) return false;
    var s = r.status.toLowerCase();
    return s.startsWith("done") || s.startsWith("đã gửi") || s.startsWith("thành công") || s.startsWith("✅");
  }).length;
  var errors = all.filter(function(r) {
    if (!r.status) return false;
    var s = r.status.toLowerCase();
    return s.startsWith("lỗi") || s.startsWith("❌");
  }).length;
  var pending = Math.max(0, total - done - errors);
  
  var config = getConfig();
  var quotaUsed = parseInt(config["Quota đã dùng hôm nay"]) || 0;
  var quotaLimit = 100;
  var quotaRemaining = Math.max(0, quotaLimit - quotaUsed);
  var statusText = config["Trạng thái hệ thống"] || "Sẵn sàng";
  var updatedTime = formatDateVN(new Date());
  
  var pctDone = total > 0 ? ((done / total) * 100).toFixed(1) : "0.0";
  var pctPending = total > 0 ? ((pending / total) * 100).toFixed(1) : "0.0";
  var pctErrors = total > 0 ? ((errors / total) * 100).toFixed(1) : "0.0";
  var totalProcessed = done + errors;
  var successRate = totalProcessed > 0 ? ((done / totalProcessed) * 100).toFixed(1) : "100.0";
  var errorRate = totalProcessed > 0 ? ((errors / totalProcessed) * 100).toFixed(1) : "0.0";
  
  var delaySec = parseInt(config["Delay giữa email (giây)"]) || 5;
  var estMinutes = total > 0 ? Math.ceil((pending * delaySec) / 60) : 0;
  var estTimeText = pending > 0 ? ("~" + estMinutes + " phút") : "0 phút";
  
  // 1. Độ rộng 5 cột căn đối
  dashSheet.setColumnWidth(1, 175);
  dashSheet.setColumnWidth(2, 175);
  dashSheet.setColumnWidth(3, 175);
  dashSheet.setColumnWidth(4, 175);
  dashSheet.setColumnWidth(5, 185);
  
  // 2. Dòng 1: Header chính
  var headerRange = dashSheet.getRange("A1:E1");
  headerRange.merge();
  headerRange.setValue("  HỆ THỐNG EMAIL TỰ ĐỘNG - BẢNG THEO DÕI TIẾN TRÌNH");
  headerRange.setBackground("#0f172a")
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setFontSize(12)
    .setVerticalAlignment("middle");
  dashSheet.setRowHeight(1, 38);
  
  // 3. Dòng 2: Header phụ (Thời gian & Trạng thái)
  var subLeft = dashSheet.getRange("A2:C2");
  subLeft.merge();
  subLeft.setValue("Thời điểm cập nhật: " + updatedTime);
  subLeft.setBackground("#f8fafc")
    .setFontColor("#64748b")
    .setFontSize(10)
    .setVerticalAlignment("middle")
    .setFontWeight("normal");
    
  var subRight = dashSheet.getRange("D2:E2");
  subRight.merge();
  subRight.setValue("Trạng thái: " + statusText);
  subRight.setBackground("#f8fafc")
    .setFontColor("#0f172a")
    .setFontSize(10)
    .setFontWeight("bold")
    .setHorizontalAlignment("right")
    .setVerticalAlignment("middle");
  dashSheet.setRowHeight(2, 26);
  
  // Dòng 3: Khoảng đệm
  dashSheet.getRange("A3:E3").setBackground("#ffffff").clearContent();
  dashSheet.setRowHeight(3, 10);
  
  // 4. Khối thẻ chỉ số (KPI Cards) - Dòng 4, 5, 6
  dashSheet.setRowHeight(4, 24);
  dashSheet.setRowHeight(5, 44);
  dashSheet.setRowHeight(6, 22);
  
  var kpiLabels = [["TỔNG LIÊN HỆ", "ĐÃ GỬI THÀNH CÔNG", "ĐANG CHỜ GỬI", "LỖI PHÁT SINH", "HẠN MỨC NGÀY"]];
  dashSheet.getRange("A4:E4").setValues(kpiLabels)
    .setFontSize(9)
    .setFontWeight("bold")
    .setFontColor("#64748b")
    .setBackground("#f1f5f9")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
    
  dashSheet.getRange("A5").setValue(total).setFontColor("#0f172a").setBackground("#f8fafc");
  dashSheet.getRange("B5").setValue(done).setFontColor("#16a34a").setBackground("#f0fdf4");
  dashSheet.getRange("C5").setValue(pending).setFontColor("#2563eb").setBackground("#eff6ff");
  dashSheet.getRange("D5").setValue(errors).setFontColor("#dc2626").setBackground("#fef2f2");
  dashSheet.getRange("E5").setValue(quotaRemaining + " / " + quotaLimit).setFontColor("#334155").setBackground("#f8fafc");
  
  var valRange = dashSheet.getRange("A5:E5");
  valRange.setFontSize(22)
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  dashSheet.getRange("E5").setFontSize(18);
  
  var kpiSubs = [[
    "100% dữ liệu",
    pctDone + "% tổng danh sách",
    pctPending + "% còn lại",
    pctErrors + "% tỷ lệ lỗi",
    "Đã dùng " + quotaUsed + " lượt"
  ]];
  dashSheet.getRange("A6:E6").setValues(kpiSubs)
    .setFontSize(9)
    .setFontColor("#64748b")
    .setBackground("#f8fafc")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  dashSheet.getRange("B6").setBackground("#f0fdf4").setFontColor("#15803d");
  dashSheet.getRange("C6").setBackground("#eff6ff").setFontColor("#1d4ed8");
  dashSheet.getRange("D6").setBackground("#fef2f2").setFontColor("#b91c1c");
  
  dashSheet.getRange("A4:E6").setBorder(true, true, true, true, true, true, "#e2e8f0", SpreadsheetApp.BorderStyle.SOLID);
  
  // Dòng 7: Khoảng đệm
  dashSheet.getRange("A7:E7").setBackground("#ffffff").clearContent();
  dashSheet.setRowHeight(7, 12);
  
  // 5. Thanh tiến độ Sparkline (Dòng 8, 9)
  dashSheet.setRowHeight(8, 22);
  dashSheet.setRowHeight(9, 26);
  
  var progressHeader = dashSheet.getRange("A8:E8");
  progressHeader.merge();
  progressHeader.setValue("TIẾN ĐỘ HOÀN THÀNH: " + pctDone + "% (" + done + " / " + total + " liên hệ)");
  progressHeader.setFontSize(10)
    .setFontWeight("bold")
    .setFontColor("#1e293b")
    .setBackground("#ffffff")
    .setVerticalAlignment("middle");
    
  var progressBar = dashSheet.getRange("A9:E9");
  progressBar.merge();
  if (total > 0) {
    var maxVal = Math.max(1, total);
    var sparklineFormula = '=SPARKLINE({' + done + ', ' + pending + ', ' + errors + '}, {"charttype", "bar"; "color1", "#16a34a"; "color2", "#cbd5e1"; "color3", "#dc2626"; "max", ' + maxVal + '})';
    progressBar.setFormula(sparklineFormula);
  } else {
    progressBar.setValue("");
  }
  progressBar.setBackground("#f8fafc")
    .setBorder(true, true, true, true, false, false, "#e2e8f0", SpreadsheetApp.BorderStyle.SOLID);
    
  // Dòng 10: Khoảng đệm
  dashSheet.getRange("A10:E10").setBackground("#ffffff").clearContent();
  dashSheet.setRowHeight(10, 14);
  
  // 6. Bảng chi tiết: Box 1 (A11:B15), Box 2 (C11:D15), Box 3 (E11:E15)
  dashSheet.setRowHeight(11, 26);
  dashSheet.setRowHeight(12, 24);
  dashSheet.setRowHeight(13, 24);
  dashSheet.setRowHeight(14, 24);
  dashSheet.setRowHeight(15, 24);
  
  // Box 1: Hiệu suất vận hành
  var h1 = dashSheet.getRange("A11:B11");
  h1.merge();
  h1.setValue("HIỆU SUẤT VẬN HÀNH");
  h1.setFontSize(10).setFontWeight("bold").setFontColor("#ffffff").setBackground("#334155").setVerticalAlignment("middle");
  
  var m1 = [
    ["Tỷ lệ gửi thành công", successRate + "%"],
    ["Tỷ lệ phát sinh lỗi", errorRate + "%"],
    ["Thời gian gửi ước tính", estTimeText],
    ["Số lượng cần xử lý tiếp", pending + " liên hệ"]
  ];
  dashSheet.getRange("A12:B15").setValues(m1)
    .setFontSize(10)
    .setVerticalAlignment("middle")
    .setBackground("#ffffff");
  dashSheet.getRange("A12:A15").setFontColor("#475569");
  dashSheet.getRange("B12:B15").setFontWeight("bold").setHorizontalAlignment("right");
  dashSheet.getRange("B12").setFontColor("#16a34a");
  dashSheet.getRange("B13").setFontColor(errors > 0 ? "#dc2626" : "#475569");
  dashSheet.getRange("B14").setFontColor("#0f172a");
  dashSheet.getRange("B15").setFontColor("#2563eb");
  dashSheet.getRange("A11:B15").setBorder(true, true, true, true, true, true, "#e2e8f0", SpreadsheetApp.BorderStyle.SOLID);
  
  // Box 2: Thiết lập chiến dịch
  var h2 = dashSheet.getRange("C11:D11");
  h2.merge();
  h2.setValue("THIẾT LẬP CHIẾN DỊCH");
  h2.setFontSize(10).setFontWeight("bold").setFontColor("#ffffff").setBackground("#334155").setVerticalAlignment("middle");
  
  var m2 = [
    ["Chế độ lấy nội dung", config["Chế độ nội dung"] || "draft_first"],
    ["Khoảng cách giãn cách", (config["Delay giữa email (giây)"] || "5") + "s / thư"],
    ["Kích thước mỗi đợt gửi", (config["Batch size"] || "50") + " email"],
    ["Thời gian nghỉ giữa đợt", (config["Cooldown giữa batch (phút)"] || "5") + " phút"]
  ];
  dashSheet.getRange("C12:D15").setValues(m2)
    .setFontSize(10)
    .setVerticalAlignment("middle")
    .setBackground("#ffffff");
  dashSheet.getRange("C12:C15").setFontColor("#475569");
  dashSheet.getRange("D12:D15").setFontWeight("bold").setHorizontalAlignment("right").setFontColor("#0f172a");
  dashSheet.getRange("C11:D15").setBorder(true, true, true, true, true, true, "#e2e8f0", SpreadsheetApp.BorderStyle.SOLID);
  
  // Box 3: Tự động hóa hệ thống
  var h3 = dashSheet.getRange("E11");
  h3.setValue("TỰ ĐỘNG HÓA HỆ THỐNG");
  h3.setFontSize(10).setFontWeight("bold").setFontColor("#ffffff").setBackground("#334155").setVerticalAlignment("middle").setHorizontalAlignment("center");
  
  var m3 = [
    ["Lịch: " + (config["Giờ gửi tự động"] || "Đã tắt")],
    ["Test: " + (config["Email test"] ? "Đã cấu hình" : "Chưa có")],
    ["Đã gửi hôm nay: " + quotaUsed + " thư"],
    ["Hạn mức còn lại: " + quotaRemaining]
  ];
  dashSheet.getRange("E12:E15").setValues(m3)
    .setFontSize(10)
    .setVerticalAlignment("middle")
    .setBackground("#ffffff")
    .setHorizontalAlignment("center")
    .setFontColor("#334155");
  dashSheet.getRange("E11:E15").setBorder(true, true, true, true, true, true, "#e2e8f0", SpreadsheetApp.BorderStyle.SOLID);
  
  // Dọn dẹp dòng bên dưới (từ hàng 16 trở đi)
  var maxRows = dashSheet.getMaxRows();
  if (maxRows > 16) {
    dashSheet.getRange("A16:E" + maxRows).clearContent().clearFormat().setBackground("#ffffff");
  }
}

/**
 * Phát hiện các địa chỉ email bị trùng lặp trong bảng Danh sách
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
 * Xóa toàn bộ trạng thái trong bảng Danh sách để chuẩn bị gửi lại
 */
function resetAllStatus() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = findSheet(ss, SHEET_DATA, SHEET_DATA_LEGACY);
  if (!sheet) return;
  
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (lastRow < 2) return;
  
  sheet.getRange(2, lastCol, lastRow - 1, 1).clearContent();
  showToast("Đã xóa toàn bộ trạng thái trong danh sách. Sẵn sàng gửi lại.", "Đặt lại trạng thái");
}

/**
 * Định dạng thẩm mỹ chuyên nghiệp cho bảng Cấu hình
 */
function formatConfigSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = findSheet(ss, SHEET_CONFIG, SHEET_CONFIG_LEGACY);
  if (!sheet) return;
  
  sheet.setColumnWidth(1, 260);
  sheet.setColumnWidth(2, 360);
  sheet.setColumnWidth(3, 520);
  
  sheet.getRange("A1:C1").setFontWeight("bold")
    .setFontSize(11)
    .setBackground("#0f172a")
    .setFontColor("#ffffff")
    .setVerticalAlignment("middle");
  sheet.setRowHeight(1, 36);
  sheet.setFrozenRows(1);
  
  var lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    for (var r = 2; r <= lastRow; r++) {
      sheet.setRowHeight(r, 28);
      var bg = (r % 2 === 0) ? "#ffffff" : "#f8fafc";
      sheet.getRange(r, 1).setBackground(bg).setFontColor("#0f172a").setFontWeight("bold").setFontSize(10).setVerticalAlignment("middle");
      sheet.getRange(r, 2).setBackground("#f1f5f9").setFontColor("#0f172a").setFontSize(10).setVerticalAlignment("middle");
      sheet.getRange(r, 3).setBackground(bg).setFontColor("#64748b").setFontSize(9.5).setVerticalAlignment("middle");
    }
    sheet.getRange(2, 1, lastRow - 1, 3).setBorder(true, true, true, true, true, true, "#e2e8f0", SpreadsheetApp.BorderStyle.SOLID);
  }
}

/**
 * Định dạng thẩm mỹ chuyên nghiệp cho bảng Danh sách kèm Conditional Formatting
 */
function formatDataSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = findSheet(ss, SHEET_DATA, SHEET_DATA_LEGACY);
  if (!sheet) return;
  
  var lastCol = Math.max(sheet.getLastColumn(), 4);
  var lastRow = Math.max(sheet.getLastRow(), 2);
  
  sheet.getRange(1, 1, 1, lastCol)
    .setFontWeight("bold")
    .setFontSize(11)
    .setBackground("#0f172a")
    .setFontColor("#ffffff")
    .setVerticalAlignment("middle");
  sheet.setRowHeight(1, 36);
  sheet.setFrozenRows(1);
  
  sheet.setColumnWidth(1, 260);
  sheet.setColumnWidth(2, 200);
  sheet.setColumnWidth(3, 240);
  sheet.setColumnWidth(lastCol, 260);
  
  if (lastRow >= 2) {
    for (var r = 2; r <= lastRow; r++) {
      sheet.setRowHeight(r, 28);
    }
    var dataRange = sheet.getRange(2, 1, lastRow - 1, lastCol);
    dataRange.setFontSize(10).setVerticalAlignment("middle");
    dataRange.setBorder(true, true, true, true, true, true, "#e2e8f0", SpreadsheetApp.BorderStyle.SOLID);
    
    var statusRange = sheet.getRange(2, lastCol, lastRow - 1, 1);
    var ruleSuccess = SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains("Đã gửi")
      .setBackground("#dcfce7")
      .setFontColor("#15803d")
      .setRanges([statusRange])
      .build();
    var ruleDoneLegacy = SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains("Done")
      .setBackground("#dcfce7")
      .setFontColor("#15803d")
      .setRanges([statusRange])
      .build();
    var ruleError = SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains("Lỗi")
      .setBackground("#fee2e2")
      .setFontColor("#b91c1c")
      .setRanges([statusRange])
      .build();
      
    sheet.setConditionalFormatRules([ruleSuccess, ruleDoneLegacy, ruleError]);
  }
}

/**
 * Định dạng thẩm mỹ chuyên nghiệp cho bảng Lịch sử
 */
function formatLogSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = findSheet(ss, SHEET_LOG, SHEET_LOG_LEGACY);
  if (!sheet) return;
  
  var lastCol = Math.max(sheet.getLastColumn(), 6);
  var lastRow = Math.max(sheet.getLastRow(), 2);
  
  sheet.getRange(1, 1, 1, lastCol)
    .setFontWeight("bold")
    .setFontSize(10.5)
    .setBackground("#0f172a")
    .setFontColor("#ffffff")
    .setVerticalAlignment("middle");
  sheet.setRowHeight(1, 34);
  sheet.setFrozenRows(1);
  
  sheet.setColumnWidth(1, 170);
  sheet.setColumnWidth(2, 260);
  sheet.setColumnWidth(3, 280);
  sheet.setColumnWidth(4, 130);
  sheet.setColumnWidth(5, 260);
  sheet.setColumnWidth(6, 80);
  
  if (lastRow >= 2) {
    for (var r = 2; r <= lastRow; r++) {
      sheet.setRowHeight(r, 26);
      var bg = (r % 2 === 0) ? "#ffffff" : "#f8fafc";
      sheet.getRange(r, 1, 1, lastCol).setBackground(bg);
    }
    var logRange = sheet.getRange(2, 1, lastRow - 1, lastCol);
    logRange.setFontSize(9.5).setVerticalAlignment("middle");
    logRange.setBorder(true, true, true, true, true, true, "#e2e8f0", SpreadsheetApp.BorderStyle.SOLID);
    
    var statusLogRange = sheet.getRange(2, 4, lastRow - 1, 1);
    var ruleLogSuccess = SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains("Thành công")
      .setBackground("#dcfce7")
      .setFontColor("#15803d")
      .setRanges([statusLogRange])
      .build();
    var ruleLogError = SpreadsheetApp.newConditionalFormatRule()
      .whenTextContains("Lỗi")
      .setBackground("#fee2e2")
      .setFontColor("#b91c1c")
      .setRanges([statusLogRange])
      .build();
    sheet.setConditionalFormatRules([ruleLogSuccess, ruleLogError]);
  }
}

/**
 * Định dạng thẩm mỹ đồng bộ cho toàn bộ các bảng trong hệ thống
 */
function formatAllSheets() {
  updateDashboard();
  formatConfigSheet();
  formatDataSheet();
  formatLogSheet();
}
