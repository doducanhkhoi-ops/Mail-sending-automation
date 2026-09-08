# Hệ Thống Gửi Email Tự Động Từ Google Sheets

Giải pháp gửi email cá nhân hóa hàng loạt chạy trực tiếp trên nền tảng Google Apps Script, vận hành độc lập trên đám mây Google Cloud mà không phụ thuộc vào add-on bên ngoài hay duy trì máy tính bật liên tục.

---

## 1. Cơ chế hoạt động chính

* **Hoạt động ngầm 24/7 trên Google Cloud:** Toàn bộ tiến trình gửi email, chia đợt (batch) và lịch kiểm tra định kỳ 15 phút chạy hoàn toàn trên máy chủ của Google. Bạn có thể đóng bảng tính, tắt trình duyệt hoặc tắt máy tính sau khi kích hoạt; hệ thống vẫn tự động chạy cho đến khi hoàn tất.
* **Trộn dữ liệu cá nhân hóa:** Tự động đối chiếu các tiêu đề cột trong bảng tính để thay thế vào biến mẫu tương ứng trong tiêu đề và nội dung thư (ví dụ: `{{Tên}}`, `{{Công ty}}`, `{{Email}}`).
* **Đồng bộ trực tiếp với thư nháp Gmail:** Sử dụng trực tiếp thư nháp (Gmail Draft) làm mẫu gửi. Giữ nguyên định dạng văn bản HTML, hình ảnh nhúng trực tiếp trong nội dung (inline images) và toàn bộ tệp đính kèm. Hỗ trợ chuẩn hóa tiếng Việt Unicode (NFC) và tìm kiếm thông minh.
* **Xử lý theo đợt (Batch Processing):** Tự động chia danh sách gửi thành từng đợt (mặc định 50 mail/đợt), tạm nghỉ (cooldown) giữa các đợt và tự động nối tiếp để vượt qua giới hạn 6 phút/lần thực thi của Google Apps Script.
* **Giãn cách an toàn:** Thiết lập thời gian chờ giữa mỗi lần gửi (mặc định 5 giây) nhằm giảm thiểu nguy cơ rơi vào bộ lọc spam của các máy chủ nhận mail.
* **Email báo cáo hoàn tất:** Tự động gửi một email tổng kết số lượng thành công/lỗi về địa chỉ cấu hình trong ô `Email test` ngay khi hoàn thành toàn bộ danh sách.

---

## 2. Hướng dẫn sử dụng Menu `Hệ thống Email`

Sau khi mở bảng tính, thanh công cụ sẽ hiển thị menu **`Hệ thống Email`** với các chức năng:

* **Bắt đầu gửi email:** Gửi trực tiếp toàn bộ người nhận mới có trong bảng `Danh sách`.
* **Gửi thư thử nghiệm (Test):** Gửi một bản xem trước hoàn chỉnh (đã trộn dữ liệu mẫu) tới địa chỉ `Email test` để bạn kiểm tra giao diện, hình ảnh và tệp đính kèm trước khi gửi hàng loạt.
* **Tạm dừng / Tiếp tục gửi:** Dừng tạm thời hoặc tiếp tục tiến trình gửi đợt bất kỳ lúc nào.
* **Menu `Lịch tự động`:**
  * **Bật / Tắt kiểm tra định kỳ (15 phút):** Kích hoạt chế độ gửi tự động. Hệ thống sẽ **gửi ngay lập tức** các email đang có sẵn, sau đó tiếp tục duy trì lịch quét dữ liệu mới mỗi 15 phút.
  * **Danh sách trigger đang hoạt động:** Kiểm tra các tiến trình hẹn giờ ngầm đang bật.
  * **Xóa toàn bộ trigger:** Hủy bỏ toàn bộ lịch hẹn giờ ngầm.
* **Menu `Tiện ích`:**
  * **Cập nhật Dashboard:** Làm mới các thẻ chỉ số KPI, thanh tiến độ Sparkline và bảng hiệu suất.
  * **Làm đẹp toàn bộ bảng tính:** 1-Click đồng bộ font chữ, màu sắc, viền ô và định dạng có điều kiện chuyên nghiệp (Non-AI) cho cả 4 bảng tính.
  * **Kiểm tra email trùng lặp:** Quét và cảnh báo các địa chỉ email xuất hiện nhiều lần.
  * **Danh sách thư nháp Gmail:** Liệt kê chính xác danh sách tên các thư nháp hiện có trong Gmail của bạn.
  * **Đặt lại trạng thái gửi:** Xóa toàn bộ trạng thái `Đã gửi` / `Lỗi` để cho phép gửi lại từ đầu.

---

## 3. Hướng dẫn triển khai

### Cách 1: Nhân bản bảng tính mẫu (Khuyến nghị cho vận hành độc lập)

1. Thiết lập hoàn chỉnh mã nguồn và các bảng dữ liệu trên một file Google Sheet gốc.
2. Đổi tên file bảng tính thành `[Mẫu] Hệ Thống Gửi Email`.
3. Mỗi khi cần tạo chiến dịch mới, nhấp chuột phải vào file trên Google Drive và chọn **Tạo bản sao (Make a copy)**. Toàn bộ mã nguồn, cấu hình và bảng mẫu sẽ được sao chép nguyên vẹn, sẵn sàng sử dụng ngay.

---

### Cách 2: Sử dụng qua Thư viện Apps Script (Quản lý mã nguồn tập trung)

Áp dụng khi cần quản lý nhiều bảng tính khác nhau nhưng chỉ duy trì một bản mã nguồn duy nhất:

* **Script ID thư viện:**
  `1venlK-fsZCmeXPcFPVcMHhcANascMjJdwFC_DROoKtxDqazk0SUdN0yz`

**Các bước liên kết:**
1. Tại Google Sheet mới, vào menu **Tiện ích mở rộng** > **Apps Script**.
2. Tại khung **Thư viện (Libraries)** ở cột bên trái, nhấn biểu tượng dấu **+**.
3. Dán mã Script ID ở trên vào ô tìm kiếm và nhấn **Tra cứu**.
4. Cấu hình 2 thông số bắt buộc:
   * **Mã định danh (Identifier):** Đổi tên thành chính xác chữ **`EmailSystem`** (viết liền, đúng chữ hoa/thường).
   * **Phiên bản (Version):** Chọn phiên bản mới nhất: **`6`** (phiên bản tối ưu tìm kiếm thư nháp, gửi ngầm và giao diện toàn diện).
   * Nhấn nút **Thêm (Add)**.
   *(Lưu ý: Nếu bạn đã thêm thư viện từ trước, chỉ cần nhấp chuột vào chữ `EmailSystem` ở cột bên trái và chuyển sang phiên bản **6**, sau đó bấm **Lưu**).*
5. Thay thế toàn bộ nội dung trong trình soạn thảo bằng đoạn mã cầu nối sau:

```javascript
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
function menuFormatAllSheets() { EmailSystem.menuFormatAllSheets(); }
function menuCheckDuplicates() { EmailSystem.menuCheckDuplicates(); }
function menuListDrafts() { EmailSystem.menuListDrafts(); }
function menuResetStatus() { EmailSystem.menuResetStatus(); }

function onIntervalTrigger() { EmailSystem.onIntervalTrigger(); }
function continueSending() { EmailSystem.continueSending(); }
```

6. Nhấn **Lưu dự án** (Ctrl + S), quay lại bảng tính và tải lại trang (F5). Menu `Hệ thống Email` sẽ xuất hiện trên thanh công cụ.

---

## 4. Cấu trúc các bảng tính

* **Cấu hình:** Nơi thiết lập các tham số hệ thống:
  * `Chế độ nội dung`: `draft_first` (thư nháp mới nhất), `draft_by_subject` (tìm theo tiêu đề), hoặc `manual` (nội dung HTML trực tiếp).
  * `Tiêu đề bản nháp`: Tiêu đề thư nháp trong Gmail (hỗ trợ tìm kiếm thông minh và Unicode tiếng Việt).
  * `Delay giữa email (giây)`: Thời gian giãn cách giữa mỗi email (khuyến nghị 5 - 10s).
  * `Batch size`: Số lượng email tối đa trong mỗi đợt gửi (khuyến nghị 50).
  * `Cooldown giữa batch (phút)`: Thời gian tạm nghỉ giữa các đợt gửi.
  * `Email test`: Địa chỉ email nhận bản thử nghiệm và nhận thông báo khi hoàn tất.
* **Danh sách:** Dữ liệu người nhận. Cột đầu tiên là `Email`, có một cột tiêu đề là `Trạng thái`. Các cột còn lại (ví dụ: `Tên`, `Công ty`...) được dùng làm biến trộn dữ liệu `{{...}}`. Cột Trạng thái tự động đổi màu xanh khi gửi thành công và màu đỏ khi có lỗi.
* **Dashboard:** Bảng điều khiển tiến trình gồm 5 thẻ chỉ số KPI (Tổng liên hệ, Đã gửi, Chờ gửi, Lỗi, Hạn mức ngày), thanh tiến độ trực quan Sparkline và bảng thông số vận hành.
* **Lịch sử:** Nhật ký chi tiết của từng lượt gửi kèm thời gian chính xác, tiêu đề, mã đợt và chi tiết lỗi nếu có.
