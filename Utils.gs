// ============================================
// Utils.gs - Hàm tiện ích hỗ trợ toàn bộ hệ thống
// ============================================

/**
 * Tạm dừng luồng thực thi trong số giây quy định
 * @param {Number} seconds - Số giây tạm dừng (mặc định 5s)
 */
function sleepSeconds(seconds) {
  Utilities.sleep((seconds || 5) * 1000);
}

/**
 * Định dạng thời gian theo múi giờ Việt Nam (dd/MM/yyyy HH:mm)
 * @param {Date} date - Đối tượng thời gian
 * @returns {String} Chuỗi ngày giờ định dạng
 */
function formatDateVN(date) {
  return Utilities.formatDate(date || new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm");
}

/**
 * Kiểm tra tính hợp lệ của địa chỉ email
 * @param {String} email
 * @returns {Boolean}
 */
function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  var cleaned = email.replace(/^mailto:/i, "").trim();
  var re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(cleaned);
}

/**
 * Thay thế các biến mẫu định dạng {{TênTrường}} bằng dữ liệu thực tế
 * @param {String} template - Chuỗi mẫu chứa các biến {{...}}
 * @param {Object} data - Đối tượng dữ liệu chứa các cặp key/value
 * @returns {String} Chuỗi sau khi đã thay thế dữ liệu
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
 * Thoát các ký tự đặc biệt phục vụ cho biểu thức chính quy (Regex)
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Kiểm tra xem thời điểm hiện tại có nằm trong khung giờ cho phép gửi tự động không
 * @param {String} startTimeStr - Định dạng "HH:mm" (ví dụ "08:00")
 * @param {String} endTimeStr - Định dạng "HH:mm" (ví dụ "21:30")
 * @returns {Boolean} true nếu được phép gửi
 */
function isWithinAllowedTimeWindow(startTimeStr, endTimeStr) {
  if (!startTimeStr && !endTimeStr) return true; // Không cấu hình nghĩa là gửi 24/24
  
  var nowStr = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "HH:mm");
  var start = startTimeStr ? String(startTimeStr).trim() : "00:00";
  var end = endTimeStr ? String(endTimeStr).trim() : "23:59";
  
  if (start <= end) {
    return nowStr >= start && nowStr <= end;
  } else {
    // Trường hợp khung giờ xuyên đêm (ví dụ: 22:00 đến 06:00)
    return nowStr >= start || nowStr <= end;
  }
}

/**
 * Lấy địa chỉ email của người dùng hiện tại một cách tin cậy
 * Hỗ trợ cả Session.getActiveUser() và Session.getEffectiveUser()
 * @returns {String} Email người dùng hoặc "Tài khoản hiện tại"
 */
function getCurrentUserEmail() {
  var email = "";
  try {
    email = Session.getActiveUser().getEmail();
  } catch(e) {}
  if (!email) {
    try {
      email = Session.getEffectiveUser().getEmail();
    } catch(e) {}
  }
  return email ? String(email).trim() : "Tài khoản hiện tại";
}

/**
 * Hiển thị thông báo nhanh (Toast) ở góc dưới bên phải Google Sheet
 * An toàn tuyệt đối khi chạy ngầm trong trigger
 */
function showToast(message, title, timeoutSeconds) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    if (ss) {
      ss.toast(message, title || "Hệ thống Email", timeoutSeconds || 5);
    }
  } catch(e) {
    // Chạy ngầm trong trigger không có giao diện hiển thị
  }
}

/**
 * Hiển thị hộp thoại thông báo đơn giản (Alert)
 * An toàn khi gọi từ trigger nền (không gây crash script)
 */
function showAlert(title, message) {
  try {
    var ui = SpreadsheetApp.getUi();
    if (ui) {
      ui.alert(title, message, ui.ButtonSet.OK);
      return;
    }
  } catch(e) {
    // Không có UI khi chạy trong background trigger
  }
  logInfo("[THÔNG BÁO] " + title + ": " + message);
}

/**
 * Hiển thị hộp thoại xác nhận lựa chọn (Yes/No)
 * An toàn khi gọi từ trigger nền
 * @returns {Boolean} true nếu người dùng chọn Đồng ý (Yes)
 */
function showConfirm(title, message) {
  try {
    var ui = SpreadsheetApp.getUi();
    if (ui) {
      var response = ui.alert(title, message, ui.ButtonSet.YES_NO);
      return response === ui.Button.YES;
    }
  } catch(e) {
    // Không có UI khi chạy trong background trigger
  }
  return false;
}

/**
 * Ghi nhật ký thông tin tiến trình
 */
function logInfo(message) {
  Logger.log("[INFO] " + message);
}

/**
 * Ghi nhật ký lỗi
 */
function logError(message) {
  Logger.log("[ERROR] " + message);
}
