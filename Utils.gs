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
 * Chuẩn hóa giá trị thời gian thành chuỗi HH:mm (ví dụ "09:00")
 * Xử lý hoàn hảo mọi kiểu dữ liệu từ Google Sheets: Date object, chuỗi ngày dài (Sat Dec 30 1899...), chuỗi text
 */
function normalizeTimeString(val) {
  if (!val) return "";
  if (val instanceof Date) {
    return Utilities.formatDate(val, "Asia/Ho_Chi_Minh", "HH:mm");
  }
  var str = String(val).trim();
  if (!str) return "";
  
  // Nếu là chuỗi ngày dài dạng: "Sat Dec 30 1899 09:00:00 GMT+0706..." hoặc ISO
  var match = str.match(/(?:^|\s|T)(\d{1,2}):(\d{2})(?::\d{2})?(?:\s|$|\+)/);
  if (match) {
    var h = parseInt(match[1], 10);
    var m = match[2];
    var hStr = (h < 10 ? "0" : "") + h;
    return hStr + ":" + m;
  }
  
  // Nếu dạng "9:00" hoặc "09:00"
  var simpleParts = str.split(":");
  if (simpleParts.length >= 2) {
    var sh = parseInt(simpleParts[0], 10);
    var sm = parseInt(simpleParts[1], 10);
    if (!isNaN(sh) && !isNaN(sm)) {
      return (sh < 10 ? "0" : "") + sh + ":" + (sm < 10 ? "0" : "") + sm;
    }
  }
  
  return str;
}

/**
 * Kiểm tra xem thời điểm hiện tại có nằm trong khung giờ cho phép gửi tự động không
 * @param {String|Date} startTimeStr - Định dạng "HH:mm" hoặc Date object
 * @param {String|Date} endTimeStr - Định dạng "HH:mm" hoặc Date object
 * @returns {Boolean} true nếu được phép gửi
 */
function isWithinAllowedTimeWindow(startTimeStr, endTimeStr) {
  var start = normalizeTimeString(startTimeStr);
  var end = normalizeTimeString(endTimeStr);
  
  if (!start && !end) return true; // Không cấu hình nghĩa là gửi 24/24
  
  var nowStr = Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "HH:mm");
  start = start || "00:00";
  end = end || "23:59";
  
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
