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
 * Chuyển đổi chỉ số cột số (1-based) thành chữ cái cột (A, B, C... Z, AA...)
 */
function _colIndexToLetter(col) {
  var temp, letter = '';
  while (col > 0) {
    temp = (col - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    col = Math.floor((col - temp - 1) / 26);
  }
  return letter;
}

/**
 * Xác định ký tự phân cách công thức dựa theo vùng ngôn ngữ (Locale) của bảng tính
 * Tiếng Việt và các nước Châu Âu dùng dấu chấm phẩy ';' làm phân cách đối số
 */
function _getFormulaSep(ss) {
  var locale = "vi_VN";
  try {
    locale = ss.getSpreadsheetLocale() || "vi_VN";
  } catch(e) {}
  
  var semiColonLocales = ["vi", "fr", "de", "es", "it", "nl", "pt", "ru", "id"];
  var isSemi = false;
  for (var i = 0; i < semiColonLocales.length; i++) {
    if (locale.toLowerCase().indexOf(semiColonLocales[i]) === 0) {
      isSemi = true;
      break;
    }
  }
  
  if (isSemi) {
    return { sep: ";", arrayCol: "\\", arrayRow: ";" };
  } else {
    return { sep: ",", arrayCol: ",", arrayRow: ";" };
  }
}

/**
 * Cập nhật Dashboard thời gian thực bằng CÔNG THỨC TRỰC TIẾP (Live Formulas)
 * Tự động cập nhật 100% trong thời gian thực khi có dữ liệu mới hoặc đổi trạng thái, KHÔNG CẦN BẤM NÚT
 */
function updateDashboard() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var dashSheet = findSheet(ss, SHEET_DASH, SHEET_DASH_LEGACY);
  if (!dashSheet) {
    dashSheet = ss.insertSheet(SHEET_DASH);
  }
  
  var f = _getFormulaSep(ss);
  var S = f.sep;           // Dấu phân cách đối số: ';' cho tiếng Việt
  var cCol = f.arrayCol;   // Phân cách cột mảng: '\' cho tiếng Việt
  var cRow = f.arrayRow;   // Phân cách dòng mảng: ';'
  
  // Xác định tên chuẩn của các sheet để tham chiếu công thức
  var dataSheetObj = findSheet(ss, SHEET_DATA, SHEET_DATA_LEGACY);
  var configSheetObj = findSheet(ss, SHEET_CONFIG, SHEET_CONFIG_LEGACY);
  var dataSheetName = dataSheetObj ? dataSheetObj.getName() : SHEET_DATA;
  var configSheetName = configSheetObj ? configSheetObj.getName() : SHEET_CONFIG;
  
  // Nhận diện động cột Email và Trạng thái trong bảng Danh sách
  var emailColLetter = "A";
  var statusColLetter = "D";
  if (dataSheetObj && dataSheetObj.getLastColumn() > 0) {
    var headers = dataSheetObj.getRange(1, 1, 1, dataSheetObj.getLastColumn()).getDisplayValues()[0];
    for (var j = 0; j < headers.length; j++) {
      var h = String(headers[j]).trim().toLowerCase();
      if (h === "email" || h === "địa chỉ email" || h === "mail") {
        emailColLetter = _colIndexToLetter(j + 1);
      }
      if (h === "trạng thái" || h === "status") {
        statusColLetter = _colIndexToLetter(j + 1);
      }
    }
  }
  
  var emailRange = "'" + dataSheetName + "'!" + emailColLetter + "2:" + emailColLetter;
  var statusRange = "'" + dataSheetName + "'!" + statusColLetter + "2:" + statusColLetter;
  var configLookup = "'" + configSheetName + "'!A:B";
  
  // 1. Độ rộng 5 cột cân đối
  dashSheet.setColumnWidth(1, 175);
  dashSheet.setColumnWidth(2, 175);
  dashSheet.setColumnWidth(3, 175);
  dashSheet.setColumnWidth(4, 175);
  dashSheet.setColumnWidth(5, 185);
  
  // Cập nhật hạn mức sống từ máy chủ Google vào Cấu hình
  try {
    var lq = MailApp.getRemainingDailyQuota();
    if (lq !== null && lq !== undefined) {
      setConfig("Hạn mức Google còn lại", String(lq));
    }
  } catch(e) {}
  
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
  
  // 3. Dòng 2: Header phụ (Thời gian thực & Trạng thái động)
  var subLeft = dashSheet.getRange("A2:C2");
  subLeft.merge();
  dashSheet.getRange("A2").setValue("Thời điểm: Tự động cập nhật trực tiếp (Realtime)");
  subLeft.setBackground("#f8fafc")
    .setFontColor("#64748b")
    .setFontSize(10)
    .setVerticalAlignment("middle")
    .setFontWeight("normal");
    
  var subRight = dashSheet.getRange("D2:E2");
  subRight.merge();
  dashSheet.getRange("D2").setFormula('="Trạng thái: " & IFERROR(VLOOKUP("Trạng thái hệ thống"' + S + ' ' + configLookup + S + ' 2' + S + ' 0)' + S + ' "Sẵn sàng")');
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
  
  // 4. Khối thẻ chỉ số (KPI Cards) - Dòng 4, 5, 6 hoàn toàn bằng CÔNG THỨC TỰ ĐỘNG
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
    
  // Công thức động dòng 5
  dashSheet.getRange("A5").setFormula('=COUNTA(' + emailRange + ')').setFontColor("#0f172a").setBackground("#f8fafc");
  dashSheet.getRange("B5").setFormula('=COUNTIF(' + statusRange + S + ' "Đã gửi*") + COUNTIF(' + statusRange + S + ' "Done*") + COUNTIF(' + statusRange + S + ' "Thành công*") + COUNTIF(' + statusRange + S + ' "✅*")').setFontColor("#16a34a").setBackground("#f0fdf4");
  dashSheet.getRange("D5").setFormula('=COUNTIF(' + statusRange + S + ' "Lỗi*") + COUNTIF(' + statusRange + S + ' "❌*") + COUNTIF(' + statusRange + S + ' "Error*")').setFontColor("#dc2626").setBackground("#fef2f2");
  dashSheet.getRange("C5").setFormula('=MAX(0' + S + ' A5 - B5 - D5)').setFontColor("#2563eb").setBackground("#eff6ff");
  dashSheet.getRange("E5").setFormula('=IFERROR(VLOOKUP("Hạn mức Google còn lại"' + S + ' ' + configLookup + S + ' 2' + S + ' 0)' + S + ' 100) & " lượt"').setFontColor("#334155").setBackground("#f8fafc");
  
  var valRange = dashSheet.getRange("A5:E5");
  valRange.setFontSize(22)
    .setFontWeight("bold")
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  dashSheet.getRange("E5").setFontSize(18);
  
  // Công thức động dòng 6
  dashSheet.getRange("A6").setValue("100% dữ liệu").setFontColor("#64748b").setBackground("#f8fafc");
  dashSheet.getRange("B6").setFormula('=IF(A5=0' + S + ' "0.0% tổng danh sách"' + S + ' ROUND(B5/A5*100' + S + ' 1) & "% tổng danh sách")').setBackground("#f0fdf4").setFontColor("#15803d");
  dashSheet.getRange("C6").setFormula('=IF(A5=0' + S + ' "0.0% còn lại"' + S + ' ROUND(C5/A5*100' + S + ' 1) & "% còn lại")').setBackground("#eff6ff").setFontColor("#1d4ed8");
  dashSheet.getRange("D6").setFormula('=IF(A5=0' + S + ' "0.0% tỷ lệ lỗi"' + S + ' ROUND(D5/A5*100' + S + ' 1) & "% tỷ lệ lỗi")').setBackground("#fef2f2").setFontColor("#b91c1c");
  dashSheet.getRange("E6").setFormula('="Đã gửi qua Sheet: " & IFERROR(VLOOKUP("Quota đã dùng hôm nay"' + S + ' ' + configLookup + S + ' 2' + S + ' 0)' + S + ' 0) & " thư"').setFontColor("#64748b").setBackground("#f8fafc");
  
  dashSheet.getRange("A6:E6").setFontSize(9)
    .setHorizontalAlignment("center")
    .setVerticalAlignment("middle");
  dashSheet.getRange("A4:E6").setBorder(true, true, true, true, true, true, "#e2e8f0", SpreadsheetApp.BorderStyle.SOLID);
  
  // Dòng 7: Khoảng đệm
  dashSheet.getRange("A7:E7").setBackground("#ffffff").clearContent();
  dashSheet.setRowHeight(7, 12);
  
  // 5. Thanh tiến độ Sparkline tự động cập nhật theo ô B5 và A5 (Dòng 8, 9)
  dashSheet.setRowHeight(8, 22);
  dashSheet.setRowHeight(9, 26);
  
  var progressHeader = dashSheet.getRange("A8:E8");
  progressHeader.merge();
  dashSheet.getRange("A8").setFormula('="TIẾN ĐỘ HOÀN THÀNH: " & IF(A5=0' + S + ' "0%"' + S + ' ROUND(B5/A5*100' + S + ' 1) & "%") & " (" & B5 & " / " & A5 & " liên hệ)"');
  progressHeader.setFontSize(10)
    .setFontWeight("bold")
    .setFontColor("#1e293b")
    .setBackground("#ffffff")
    .setVerticalAlignment("middle");
    
  var progressBar = dashSheet.getRange("A9:E9");
  progressBar.merge();
  dashSheet.getRange("A9").setFormula('=IF(A5=0' + S + ' ""' + S + ' SPARKLINE(B5:D5' + S + ' {"charttype"' + cCol + ' "bar"' + cRow + ' "color1"' + cCol + ' "#16a34a"' + cRow + ' "color2"' + cCol + ' "#cbd5e1"' + cRow + ' "color3"' + cCol + ' "#dc2626"' + cRow + ' "max"' + cCol + ' MAX(1' + S + ' A5)}))');
  progressBar.setBackground("#f8fafc")
    .setBorder(true, true, true, true, false, false, "#e2e8f0", SpreadsheetApp.BorderStyle.SOLID);
    
  // Dòng 10: Khoảng đệm
  dashSheet.getRange("A10:E10").setBackground("#ffffff").clearContent();
  dashSheet.setRowHeight(10, 14);
  
  // 6. Bảng chi tiết: Box 1 (A11:B15), Box 2 (C11:D15), Box 3 (E11:E15) hoàn toàn bằng CÔNG THỨC
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
  
  dashSheet.getRange("A12").setValue("Tỷ lệ gửi thành công");
  dashSheet.getRange("B12").setFormula('=IF((B5+D5)=0' + S + ' "100%"' + S + ' ROUND(B5/(B5+D5)*100' + S + ' 1) & "%")');
  
  dashSheet.getRange("A13").setValue("Tỷ lệ phát sinh lỗi");
  dashSheet.getRange("B13").setFormula('=IF((B5+D5)=0' + S + ' "0%"' + S + ' ROUND(D5/(B5+D5)*100' + S + ' 1) & "%")');
  
  dashSheet.getRange("A14").setValue("Thời gian gửi ước tính");
  dashSheet.getRange("B14").setFormula('=IF(C5=0' + S + ' "0 phút"' + S + ' "~" & ROUNDUP(C5 * IFERROR(VALUE(VLOOKUP("Delay giữa email (giây)"' + S + ' ' + configLookup + S + ' 2' + S + ' 0))' + S + ' 3) / 60' + S + ' 0) & " phút")');
  
  dashSheet.getRange("A15").setValue("Số lượng cần xử lý tiếp");
  dashSheet.getRange("B15").setFormula('=C5 & " liên hệ"');
  
  dashSheet.getRange("A12:B15").setFontSize(10).setVerticalAlignment("middle").setBackground("#ffffff");
  dashSheet.getRange("A12:A15").setFontColor("#475569");
  dashSheet.getRange("B12:B15").setFontWeight("bold").setHorizontalAlignment("right");
  dashSheet.getRange("B12").setFontColor("#16a34a");
  dashSheet.getRange("B13").setFontColor("#dc2626");
  dashSheet.getRange("B14").setFontColor("#0f172a");
  dashSheet.getRange("B15").setFontColor("#2563eb");
  dashSheet.getRange("A11:B15").setBorder(true, true, true, true, true, true, "#e2e8f0", SpreadsheetApp.BorderStyle.SOLID);
  
  // Box 2: Thiết lập chiến dịch
  var h2 = dashSheet.getRange("C11:D11");
  h2.merge();
  h2.setValue("THIẾT LẬP CHIẾN DỊCH");
  h2.setFontSize(10).setFontWeight("bold").setFontColor("#ffffff").setBackground("#334155").setVerticalAlignment("middle");
  
  dashSheet.getRange("C12").setValue("Mẫu thư nháp Gmail");
  dashSheet.getRange("D12").setFormula('=IF(IFERROR(VLOOKUP("Tiêu đề thư nháp Gmail"' + S + ' ' + configLookup + S + ' 2' + S + ' 0)' + S + ' "")=""' + S + ' "(Thư nháp mới nhất)"' + S + ' VLOOKUP("Tiêu đề thư nháp Gmail"' + S + ' ' + configLookup + S + ' 2' + S + ' 0))');
  
  dashSheet.getRange("C13").setValue("Khoảng cách giãn cách");
  dashSheet.getRange("D13").setFormula('=IFERROR(VLOOKUP("Delay giữa email (giây)"' + S + ' ' + configLookup + S + ' 2' + S + ' 0)' + S + ' 3) & "s / thư"');
  
  dashSheet.getRange("C14").setValue("Kích thước mỗi đợt gửi");
  dashSheet.getRange("D14").setFormula('=IFERROR(VLOOKUP("Batch size"' + S + ' ' + configLookup + S + ' 2' + S + ' 0)' + S + ' 50) & " email"');
  
  dashSheet.getRange("C15").setValue("Thời gian nghỉ giữa đợt");
  dashSheet.getRange("D15").setFormula('=IFERROR(VLOOKUP("Cooldown giữa batch (phút)"' + S + ' ' + configLookup + S + ' 2' + S + ' 0)' + S + ' 5) & " phút"');
  
  dashSheet.getRange("C12:D15").setFontSize(10).setVerticalAlignment("middle").setBackground("#ffffff");
  dashSheet.getRange("C12:C15").setFontColor("#475569");
  dashSheet.getRange("D12:D15").setFontWeight("bold").setHorizontalAlignment("right").setFontColor("#0f172a");
  dashSheet.getRange("C11:D15").setBorder(true, true, true, true, true, true, "#e2e8f0", SpreadsheetApp.BorderStyle.SOLID);
  
  // Box 3: Tự động hóa hệ thống
  var h3 = dashSheet.getRange("E11");
  h3.setValue("TỰ ĐỘNG HÓA HỆ THỐNG");
  h3.setFontSize(10).setFontWeight("bold").setFontColor("#ffffff").setBackground("#334155").setVerticalAlignment("middle").setHorizontalAlignment("center");
  
  dashSheet.getRange("E12").setFormula('="Lịch: " & IFERROR(VLOOKUP("Giờ gửi tự động"' + S + ' ' + configLookup + S + ' 2' + S + ' 0)' + S + ' "Đã tắt")');
  dashSheet.getRange("E13").setFormula('="Người gửi: " & IF(IFERROR(VLOOKUP("Email đang gửi hiện tại"' + S + ' ' + configLookup + S + ' 2' + S + ' 0)' + S + ' "Đã tắt")="Đã tắt"' + S + ' "Chưa có"' + S + ' IFERROR(REGEXEXTRACT(VLOOKUP("Email đang gửi hiện tại"' + S + ' ' + configLookup + S + ' 2' + S + ' 0)' + S + ' "^[^@]+")' + S + ' "") & "@...")');
  dashSheet.getRange("E14").setFormula('="Hạn mức máy chủ: " & IFERROR(VLOOKUP("Hạn mức Google còn lại"' + S + ' ' + configLookup + S + ' 2' + S + ' 0)' + S + ' 100) & " thư"');
  dashSheet.getRange("E15").setFormula('="Đã gửi qua Sheet: " & IFERROR(VLOOKUP("Quota đã dùng hôm nay"' + S + ' ' + configLookup + S + ' 2' + S + ' 0)' + S + ' 0) & " thư"');
  
  dashSheet.getRange("E12:E15").setFontSize(10).setVerticalAlignment("middle").setBackground("#ffffff").setHorizontalAlignment("center").setFontColor("#334155");
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
 * Định dạng thẩm mỹ chuyên nghiệp và đồng bộ chuẩn MECE cho bảng Cấu hình
 */
function formatConfigSheet() {
  syncConfigSheet();
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
  formatConfigSheet();
  updateDashboard();
  formatDataSheet();
  formatLogSheet();
}
