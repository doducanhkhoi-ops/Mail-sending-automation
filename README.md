# Mail Sending Automation

Hệ thống gửi email tự động hàng loạt từ Google Sheet, sử dụng trực tiếp tài nguyên của Google Apps Script thay vì phụ thuộc vào các tiện ích bên ngoài. 

## Tính năng nổi bật
* **Cá nhân hóa nội dung:** Tự động đối chiếu và thay thế các biến (ví dụ: `{{Tên}}`, `{{Công ty}}`) bằng dữ liệu từ bất kỳ cột nào bạn thiết lập trên Sheet.
* **Gửi đúng định dạng gốc:** Lấy trực tiếp bản nháp (Draft) trên Gmail để gửi đi. Hỗ trợ hiển thị đầy đủ HTML, hình ảnh chèn trực tiếp trong bài (inline images) và file đính kèm.
* **Nhiều chiến dịch song song:** Hỗ trợ nhập "Tiêu đề bản nháp" ở cấu hình để Sheet tự động tìm đúng bản nháp tương ứng.
* **Chống Spam & Quản lý Quota:** Gửi lần lượt từng người cách nhau 5 giây. Hệ thống tự động chia đợt (batch) và ghi nhớ trạng thái để lách qua giới hạn thời gian chạy 6 phút của Google.
* **Hoạt động ngầm 24/7:** Chế độ hẹn giờ kiểm tra dữ liệu mới mỗi 15 phút, tự động gửi ngay cả khi bạn tắt máy tính hay không mở trình duyệt.

## Cách sử dụng tốt nhất (Khuyên dùng)
Cách nhanh nhất và ổn định nhất để quản lý các chiến dịch gửi mail mới là **Nhân bản (Make a copy)**:
1. Cài đặt hệ thống hoàn chỉnh vào một file Sheet.
2. Đặt tên file đó là `[TEMPLATE] Hệ Thống Gửi Mail`.
3. Mỗi khi cần gửi một đợt mail mới, bạn chỉ cần vào Google Drive, chuột phải vào file Template và chọn **Tạo bản sao (Make a copy)**. Bản sao mới sẽ mang theo toàn bộ code và cấu hình, sẵn sàng chạy ngay.

## Cài đặt nâng cao: Sử dụng qua Thư viện (Library)
Nếu bạn rành kỹ thuật và muốn quản lý mã nguồn tập trung (sửa code ở 1 nơi, tất cả các file Sheet tự động cập nhật theo), hãy dùng tính năng Thư viện.

**Script ID Thư viện gốc:**
`1venlK-fsZCmeXPcFPVcMHhcANascMjJdwFC_DROoKtxDqazk0SUdN0yz`

**Cách gắn Thư viện vào file Sheet mới:**
1. Tại Sheet mới, chọn `Tiện ích mở rộng` > `Apps Script`.
2. Bấm dấu `+` ở phần **Thư viện (Libraries)** bên trái, dán Script ID ở trên vào.
3. Bấm tra cứu. Hãy đổi tên ở ô **Mã định danh (Identifier)** thành chữ: `EmailSystem` rồi bấm Thêm.
4. Xóa trắng trình soạn thảo của file mới, sau đó copy và dán toàn bộ đoạn mã kết nối dưới đây vào:

```javascript
// ====== ĐOẠN CODE KẾT NỐI VỚI THƯ VIỆN ======

function onOpen() { EmailSystem.onOpen(); }

function menuInit() { EmailSystem.menuInit(); }
function menuStartSending() { EmailSystem.menuStartSending(); }
function menuSendTest() { EmailSystem.menuSendTest(); }
function menuPause() { EmailSystem.menuPause(); }
function menuResume() { EmailSystem.menuResume(); }
function menuToggleTrigger() { EmailSystem.menuToggleTrigger(); }
function menuListTriggers() { EmailSystem.menuListTriggers(); }
function menuRemoveAllTriggers() { EmailSystem.menuRemoveAllTriggers(); }
function menuUpdateDashboard() { EmailSystem.menuUpdateDashboard(); }
function menuCheckDuplicates() { EmailSystem.menuCheckDuplicates(); }
function menuListDrafts() { EmailSystem.menuListDrafts(); }
function menuResetStatus() { EmailSystem.menuResetStatus(); }

function onIntervalTrigger() { EmailSystem.onIntervalTrigger(); }
function continueSending() { EmailSystem.continueSending(); }
```
5. Bấm Lưu lại (Ctrl+S), quay về giao diện Sheet nhấn F5 là hệ thống sẽ kết nối thành công.
