// ============================================
// Menu.gs - Tùy biến menu điều khiển trên Google Sheet
// ============================================

/**
 * Khởi tạo menu trên thanh công cụ khi mở bảng tính
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  
  ui.createMenu("Hệ thống Email")
    .addItem("Khởi tạo bảng tính (chạy lần đầu)", "menuInit")
    .addSeparator()
    .addItem("Bắt đầu gửi email", "menuStartSending")
    .addItem("Gửi thư thử nghiệm (Test)", "menuSendTest")
    .addSeparator()
    .addItem("Tạm dừng", "menuPause")
    .addItem("Tiếp tục gửi", "menuResume")
    .addSeparator()
    .addSubMenu(ui.createMenu("Lịch tự động")
      .addItem("Bật / Tắt kiểm tra định kỳ (15 phút)", "menuToggleTrigger")
      .addItem("Danh sách trigger đang hoạt động", "menuListTriggers")
      .addItem("Xóa toàn bộ trigger", "menuRemoveAllTriggers")
    )
    .addSubMenu(ui.createMenu("Tiện ích")
      .addItem("Cập nhật Dashboard", "menuUpdateDashboard")
      .addItem("Làm đẹp toàn bộ bảng tính", "menuFormatAllSheets")
      .addItem("Kiểm tra email trùng lặp", "menuCheckDuplicates")
      .addItem("Danh sách thư nháp Gmail", "menuListDrafts")
      .addItem("Đặt lại trạng thái gửi", "menuResetStatus")
    )
    .addToUi();
}

// ====== XỬ LÝ SỰ KIỆN MENU ======

function menuInit() {
  initAllSheets();
  formatAllSheets();
}

function menuStartSending() {
  var ui = SpreadsheetApp.getUi();
  var newRecipients = getNewRecipients();
  
  if (newRecipients.length === 0) {
    showAlert("Thông báo", "Không có người nhận mới nào cần gửi.");
    return;
  }
  
  var response = ui.alert(
    "Xác nhận gửi email",
    "Hệ thống sẽ gửi email đến " + newRecipients.length + " người nhận mới.\n\n" +
    "Thời gian giãn cách giữa các email: " + (getConfig()["Delay giữa email (giây)"] || "5") + " giây.\n\n" +
    "Bạn có muốn bắt đầu gửi không?",
    ui.ButtonSet.YES_NO
  );
  
  if (response === ui.Button.YES) {
    startSending();
  }
}

function menuSendTest() {
  sendTestEmail();
}

function menuPause() {
  pauseSending();
}

function menuResume() {
  resumeSending();
}

function menuToggleTrigger() {
  toggleDailyTrigger();
}

function menuListTriggers() {
  listTriggers();
}

function menuRemoveAllTriggers() {
  if (showConfirm("Xác nhận xóa trigger", "Bạn có chắc muốn xóa toàn bộ trigger hẹn giờ?\nSau khi xóa, hệ thống sẽ ngừng tự động kiểm tra và gửi email.")) {
    removeAllTriggers();
  }
}

function menuUpdateDashboard() {
  updateDashboard();
  showToast("Đã cập nhật số liệu Dashboard.", "Dashboard");
}

function menuFormatAllSheets() {
  formatAllSheets();
  showToast("Đã định dạng và làm đẹp toàn bộ các bảng tính.", "Hoàn tất");
}

function menuCheckDuplicates() {
  var dupes = detectDuplicates();
  if (dupes.length === 0) {
    showAlert("Kiểm tra trùng lặp", "Không phát hiện email trùng lặp nào trong danh sách.");
  } else {
    var msg = "Phát hiện " + dupes.length + " dòng chứa email trùng lặp:\n\n";
    for (var i = 0; i < Math.min(dupes.length, 20); i++) {
      msg += "- " + dupes[i].email + " (dòng " + dupes[i].row + " trùng với dòng " + dupes[i].firstRow + ")\n";
    }
    if (dupes.length > 20) {
      msg += "\n... và " + (dupes.length - 20) + " email trùng khác.";
    }
    msg += "\n\nCác email trùng lặp sẽ tự động được bỏ qua trong quá trình gửi.";
    showAlert("Email trùng lặp", msg);
  }
}

function menuListDrafts() {
  var drafts = listDrafts();
  if (drafts.length === 0) {
    showAlert("Thư nháp Gmail", "Không tìm thấy thư nháp nào trong Gmail.");
    return;
  }
  var msg = "Tìm thấy " + drafts.length + " thư nháp trong hòm thư:\n\n";
  for (var i = 0; i < Math.min(drafts.length, 15); i++) {
    msg += (i + 1) + ". " + drafts[i].subject + "\n";
  }
  if (drafts.length > 15) {
    msg += "\n... và " + (drafts.length - 15) + " thư nháp khác.";
  }
  showAlert("Thư nháp Gmail", msg);
}

function menuResetStatus() {
  if (showConfirm("Xác nhận đặt lại trạng thái",
    "Hành động này sẽ xóa toàn bộ trạng thái đã gửi và lỗi trong danh sách, cho phép hệ thống gửi lại cho tất cả mọi người.\n\n" +
    "Bạn có muốn tiếp tục không?")) {
    resetAllStatus();
    updateDashboard();
  }
}
