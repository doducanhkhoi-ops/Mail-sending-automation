// ============================================
// Utils.gs - Tiện ích chung
// ============================================

/**
 * Delay n giây (mặc định 5s)
 */
function sleepSeconds(seconds) {
  Utilities.sleep((seconds || 5) * 1000);
}

/**
 * Format ngày giờ theo múi giờ Việt Nam
 */
function formatDateVN(date) {
  return Utilities.formatDate(date || new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm");
}

/**
 * Kiểm tra email hợp lệ
 */
function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  var re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email.trim());
}

/**
 * Thay thế template variables {{key}} bằng giá trị từ object data
 * VD: replaceTemplateVars("Chào {{Tên}}", {"Tên": "An"}) → "Chào An"
 */
function replaceTemplateVars(template, data) {
  if (!template) return "";
  var result = template;
  for (var key in data) {
    if (data.hasOwnProperty(key)) {
      var regex = new RegExp("\\{\\{" + escapeRegex(key) + "\\}\\}", "g");
      result = result.replace(regex, data[key] || "");
    }
  }
  return result;
}

/**
 * Escape ký tự đặc biệt cho regex
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Hiển thị toast notification trên Google Sheet
 */
function showToast(message, title, timeoutSeconds) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (ss) {
    ss.toast(message, title || "📧 Email System", timeoutSeconds || 5);
  }
}

/**
 * Hiển thị alert dialog
 */
function showAlert(title, message) {
  var ui = SpreadsheetApp.getUi();
  ui.alert(title, message, ui.ButtonSet.OK);
}

/**
 * Hiển thị dialog xác nhận (Yes/No)
 */
function showConfirm(title, message) {
  var ui = SpreadsheetApp.getUi();
  var response = ui.alert(title, message, ui.ButtonSet.YES_NO);
  return response === ui.Button.YES;
}

/**
 * Log message vào console và sheet log
 */
function logInfo(message) {
  Logger.log("[INFO] " + message);
}

function logError(message) {
  Logger.log("[ERROR] " + message);
}
