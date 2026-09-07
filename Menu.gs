// ============================================
// Menu.gs - Menu tùy chỉnh trên Google Sheet
// ============================================

/**
 * Tự động chạy khi mở Google Sheet — tạo menu
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  
  ui.createMenu("📧 Email System")
    .addItem("🚀 Khởi tạo hệ thống (chạy lần đầu)", "menuInit")
    .addSeparator()
    .addItem("📤 Gửi email ngay", "menuStartSending")
    .addItem("🧪 Gửi email test", "menuSendTest")
    .addSeparator()
    .addItem("⏸️ Tạm dừng", "menuPause")
    .addItem("▶️ Tiếp tục gửi", "menuResume")
    .addSeparator()
    .addSubMenu(ui.createMenu("⏰ Hẹn giờ tự động")
      .addItem("Bật/Tắt gửi tự động (Mỗi 15 phút)", "menuToggleTrigger")
      .addItem("Xem danh sách triggers", "menuListTriggers")
      .addItem("Xóa tất cả triggers", "menuRemoveAllTriggers")
    )
    .addSubMenu(ui.createMenu("🔧 Công cụ")
      .addItem("📊 Cập nhật Dashboard", "menuUpdateDashboard")
      .addItem("🔍 Kiểm tra email trùng lặp", "menuCheckDuplicates")
      .addItem("📝 Liệt kê bản nháp Gmail", "menuListDrafts")
      .addItem("🔄 Reset trạng thái (gửi lại tất cả)", "menuResetStatus")
    )
    .addToUi();
}

// ====== MENU HANDLERS ======

function menuInit() {
  initAllSheets();
}

function menuStartSending() {
  var ui = SpreadsheetApp.getUi();
  var newRecipients = getNewRecipients();
  
  if (newRecipients.length === 0) {
    showAlert("ℹ️ Thông báo", "Không có người nhận mới nào để gửi.");
    return;
  }
  
  var response = ui.alert(
    "📤 Xác nhận gửi email",
    "Sẽ gửi email đến " + newRecipients.length + " người nhận mới.\n\n" +
    "Email gửi từng người một, cách nhau " + (getConfig()["Delay giữa email (giây)"] || "5") + " giây.\n\n" +
    "Bạn có muốn tiếp tục?",
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
  if (showConfirm("⚠️ Xác nhận", "Bạn có chắc muốn xóa TẤT CẢ triggers?\nHệ thống sẽ ngừng gửi tự động.")) {
    removeAllTriggers();
  }
}

function menuUpdateDashboard() {
  updateDashboard();
  showToast("📊 Dashboard đã cập nhật!", "Dashboard");
}

function menuCheckDuplicates() {
  var dupes = detectDuplicates();
  if (dupes.length === 0) {
    showAlert("✅ Không trùng lặp", "Không phát hiện email trùng lặp nào trong danh sách.");
  } else {
    var msg = "Phát hiện " + dupes.length + " email trùng lặp:\n\n";
    for (var i = 0; i < Math.min(dupes.length, 20); i++) {
      msg += "• " + dupes[i].email + " (dòng " + dupes[i].row + " trùng với dòng " + dupes[i].firstRow + ")\n";
    }
    if (dupes.length > 20) {
      msg += "\n... và " + (dupes.length - 20) + " email trùng khác.";
    }
    msg += "\n\nHệ thống sẽ tự động bỏ qua các email trùng khi gửi.";
    showAlert("⚠️ Email trùng lặp", msg);
  }
}

function menuListDrafts() {
  var drafts = listDrafts();
  if (drafts.length === 0) {
    showAlert("📝 Bản nháp Gmail", "Không tìm thấy bản nháp nào trong Gmail.");
    return;
  }
  var msg = "Tìm thấy " + drafts.length + " bản nháp:\n\n";
  for (var i = 0; i < Math.min(drafts.length, 15); i++) {
    msg += (i + 1) + ". " + drafts[i].subject + "\n";
  }
  if (drafts.length > 15) {
    msg += "\n... và " + (drafts.length - 15) + " bản nháp khác.";
  }
  showAlert("📝 Bản nháp Gmail", msg);
}

function menuResetStatus() {
  if (showConfirm("⚠️ Xác nhận Reset",
    "Bạn có chắc muốn XÓA tất cả trạng thái 'Done' và 'Lỗi'?\n\n" +
    "Điều này sẽ cho phép gửi lại email cho TẤT CẢ người trong danh sách.\n\n" +
    "Hành động này KHÔNG thể hoàn tác!")) {
    resetAllStatus();
    updateDashboard();
  }
}
