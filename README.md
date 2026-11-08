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
* **Bảo vệ tài khoản gửi & Chống xung đột (Sender Ownership Guard):** Nhận diện chính xác tài khoản Google đang phụ trách gửi. Khi có tài khoản khác cố gắng thao tác gửi hoặc bật trigger, hệ thống sẽ cảnh báo rõ tài khoản nào đang gửi và yêu cầu tài khoản đó tắt trước, hoặc cho phép tiếp quản an toàn. Toàn bộ trigger cũ của tài khoản trước sẽ tự động bị vô hiệu hóa, loại bỏ hoàn toàn nguy cơ gửi nhầm từ hộp thư không mong muốn.
* **Đo hạn mức thông minh (Live Quota & Single Source of Truth):** Gọi trực tiếp API máy chủ Google để xác định đúng loại tài khoản (Gmail cá nhân 100 mail/ngày, Google Workspace Giáo dục 100 mail/ngày, hoặc Workspace Doanh nghiệp 1500 mail/ngày). Số lượng email đã gửi hôm nay được đếm trực tiếp từ bảng `Danh sách` thực tế theo ngày, đảm bảo số liệu chính xác tuyệt đối và không bị mất khi làm mới bảng.

---

## 2. Hướng dẫn sử dụng Menu `Hệ thống Email`

Sau khi mở bảng tính, thanh công cụ sẽ hiển thị menu **`Hệ thống Email`** với các chức năng:

* **Bắt đầu gửi email:** Gửi trực tiếp toàn bộ người nhận mới có trong bảng `Danh sách`.
* **Gửi thư thử nghiệm (Test):** Gửi một bản xem trước hoàn chỉnh (đã trộn dữ liệu mẫu) tới địa chỉ `Email test` để bạn kiểm tra giao diện, hình ảnh và tệp đính kèm trước khi gửi hàng loạt.
* **Kiểm tra Hạn mức Quota & Chênh lệch:** Xem chi tiết tài khoản Google đang gửi, loại tài khoản (Gmail cá nhân / Giáo dục / Doanh nghiệp), hạn mức tối đa, số lượng đã gửi trong ngày và số lượt gửi an toàn còn lại từ Google.
* **Tạm dừng / Tiếp tục gửi:** Dừng tạm thời hoặc tiếp tục tiến trình gửi đợt bất kỳ lúc nào.
* **Menu `Lịch tự động`:**
  * **Bật / Tắt gửi tức thì khi có Form Submit:** Tự động gửi email ngay khi có người gửi Google Form hoặc nhập thêm dòng mới vào bảng tính. Hệ thống gửi ngay cho liên hệ mới, đồng thời xử lý các mail chưa gửi còn tồn đọng trong danh sách.
  * **Bật / Tắt kiểm tra định kỳ (15 phút):** Kích hoạt chế độ kiểm tra quét danh sách mỗi 15 phút. Hệ thống sẽ **gửi ngay lập tức** các email đang có sẵn, sau đó tiếp tục duy trì lịch quét dữ liệu mới mỗi 15 phút.
  * **Danh sách trigger đang hoạt động:** Kiểm tra các tiến trình hẹn giờ ngầm đang bật.
  * **Xóa toàn bộ trigger:** Hủy bỏ toàn bộ lịch hẹn giờ ngầm.
* **Menu `Tiện ích`:**
  * **Cập nhật Dashboard:** Tự động thiết lập hệ thống công thức trực tiếp (Live Formulas) cho toàn bộ Dashboard.
  * **Kiểm tra email trùng lặp:** Quét và cảnh báo các địa chỉ email xuất hiện nhiều lần (hệ thống mặc định vẫn gửi cho toàn bộ các dòng để bảo đảm đầy đủ dữ liệu từng người).
  * **Danh sách thư nháp Gmail:** Liệt kê chính xác danh sách tên các thư nháp hiện có trong Gmail của bạn.
  * **Đặt lại trạng thái gửi:** Xóa toàn bộ trạng thái `Đã gửi` / `Lỗi` để cho phép gửi lại từ đầu.
  * **Làm mới định dạng các bảng:** Đồng bộ và chuẩn hóa thẩm mỹ giao diện cho toàn bộ các bảng tính.

---

## 3. Hướng dẫn triển khai (Qua Thư viện Apps Script)

Hệ thống được quản lý mã nguồn tập trung qua Thư viện (Library). Bạn có thể áp dụng cho bất kỳ file Google Sheet mới nào chỉ với các bước đơn giản sau:

* **Script ID thư viện:**
  `1venlK-fsZCmeXPcFPVcMHhcANascMjJdwFC_DROoKtxDqazk0SUdN0yz`

### Các bước cài đặt:
1. Tại Google Sheet của bạn, vào menu **Tiện ích mở rộng** > **Apps Script**.
2. Tại khung **Thư viện (Libraries)** ở cột bên trái, nhấn biểu tượng dấu **+**.
3. Dán mã Script ID ở trên vào ô tìm kiếm và nhấn **Tra cứu**.
4. Cấu hình 2 thông số:
   * **Mã định danh (Identifier):** Đổi tên thành chính xác chữ **`EmailSystem`** (viết liền, đúng chữ hoa/thường).
   * **Phiên bản (Version):** Chọn phiên bản mới nhất: **`38`**.
   * Nhấn nút **Thêm (Add)**.
   *(Lưu ý: Nếu bạn đã từng thêm thư viện từ trước, chỉ cần nhấp chuột vào chữ `EmailSystem` ở cột bên trái, chuyển sang phiên bản **38** và bấm **Lưu**).*
5. Xóa toàn bộ nội dung cũ trong trình soạn thảo, sau đó dán đoạn mã cầu nối sau vào:

```javascript
function onOpen() { EmailSystem.onOpen(); }

function menuInit() { EmailSystem.menuInit(); }
function menuStartSending() { EmailSystem.menuStartSending(); }
function menuSendTest() { EmailSystem.menuSendTest(); }
function menuCheckQuota() { EmailSystem.menuCheckQuota(); }
function menuPause() { EmailSystem.menuPause(); }
function menuResume() { EmailSystem.menuResume(); }
function menuToggleTrigger() { EmailSystem.menuToggleTrigger(); }
function menuToggleFormSubmit() { EmailSystem.menuToggleFormSubmit(); }
function menuListTriggers() { EmailSystem.menuListTriggers(); }
function menuRemoveAllTriggers() { EmailSystem.menuRemoveAllTriggers(); }
function menuUpdateDashboard() { EmailSystem.menuUpdateDashboard(); }
function menuFormatAllSheets() { EmailSystem.menuFormatAllSheets(); }
function menuSyncConfig() { EmailSystem.menuFormatAllSheets(); }
function menuCheckDuplicates() { EmailSystem.menuCheckDuplicates(); }
function menuListDrafts() { EmailSystem.menuListDrafts(); }
function menuResetStatus() { EmailSystem.menuResetStatus(); }

function onIntervalTrigger() { EmailSystem.onIntervalTrigger(); }
function continueSending() { EmailSystem.continueSending(); }
function onFormSubmitTrigger(e) { EmailSystem.onFormSubmitTrigger(e); }
function onScheduledStartTrigger() { EmailSystem.onScheduledStartTrigger(); }
```

6. Nhấn **Lưu dự án** (Ctrl + S), quay lại bảng tính và tải lại trang (F5).
7. Chọn menu **`Hệ thống Email`** > **`Khởi tạo bảng tính (chạy lần đầu)`** để hệ thống tự động thiết lập đầy đủ các bảng dữ liệu chuẩn.

---

## 4. Cấu trúc các bảng tính

* **Cấu hình:** Nơi thiết lập các tham số hệ thống tinh gọn:
  * `Tiêu đề thư nháp Gmail`: Tiêu đề thư nháp trong Gmail để làm mẫu (ĐỂ TRỐNG = Tự động lấy thư nháp mới nhất).
  * `Tên người gửi (Sender Name)`: Tên đại diện hiển thị trong hộp thư người nhận (ĐỂ TRỐNG = Tên tài khoản Google mặc định).
  * `Delay giữa email (giây)`: Thời gian giãn cách giữa mỗi email (khuyến nghị 2 - 5s).
  * `Batch size`: Số lượng email tối đa trong mỗi đợt gửi (khuyến nghị 50).
  * `Cooldown giữa batch (phút)`: Thời gian tạm nghỉ giữa các đợt gửi khi gửi hàng loạt.
  * `Khung giờ tự động bắt đầu` / `Khung giờ tự động kết thúc`: Khung giờ cho phép gửi (định dạng HH:mm, ĐỂ TRỐNG = Gửi mọi lúc 24/7).
  * `Email đang gửi hiện tại`: Email tài khoản hiện đang bật gửi tự động (Hệ thống tự cập nhật).
  * `Giờ gửi tự động`: Chế độ tự động hiện tại (Tức thì / Mỗi 15 phút / Đã tắt) (Hệ thống tự cập nhật).
  * `Hạn mức tối đa (Max Quota)`: Hạn mức gửi thư trong ngày do Google cấp (100 đối với Gmail cá nhân/Edu, 1500 đối với Workspace).
  * `Hạn mức Google còn lại`: Số lượt gửi máy chủ Google còn cấp cho tài khoản này hôm nay (Hệ thống đo sống trực tiếp).
  * `Đã gửi ngoài Sheet (Chênh lệch)`: Số email đã gửi ngoài Sheet hôm nay (qua web Gmail, điện thoại hoặc script khác).
  * `Tình trạng hạn mức`: Đánh giá mức độ an toàn (🟢 An toàn / 🟡 Cảnh báo / 🔴 Đã cạn).
  * `Quota đã dùng hôm nay`: Số email đã gửi thành công qua Sheet hôm nay (Đếm từ cột Trạng thái bảng Danh sách).
  * `Email test`: Địa chỉ email nhận bản thử nghiệm và nhận thông báo khi hoàn tất.
* **Danh sách:** Dữ liệu người nhận. Cột đầu tiên là `Email`, có một cột tiêu đề là `Trạng thái`. Các cột còn lại (ví dụ: `Tên`, `Công ty`...) được dùng làm biến trộn dữ liệu `{{...}}`. Cột Trạng thái tự động đổi màu xanh khi gửi thành công và màu đỏ khi có lỗi.
* **Dashboard:** Bảng điều khiển tiến trình gồm 5 thẻ chỉ số KPI (Tổng liên hệ, Đã gửi, Chờ gửi, Lỗi, Hạn mức ngày), thanh tiến độ trực quan Sparkline và bảng thông số vận hành.
* **Lịch sử:** Nhật ký chi tiết của từng lượt gửi gồm 7 cột chuẩn: `Thời gian` (A), `Tài khoản gửi` (B), `Email người nhận` (C), `Tiêu đề` (D), `Trạng thái` (E), `Chi tiết lỗi` (F) và `Đợt #` (G). Hệ thống tự động nhận diện tài khoản gửi thực tế của từng email và tự động tô màu trực quan.
