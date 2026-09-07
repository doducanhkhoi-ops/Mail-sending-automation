# Mail Sending Automation

Hệ thống gửi email tự động hàng loạt từ Google Sheet, sử dụng trực tiếp tài nguyên của Google Apps Script thay vì phụ thuộc vào các tiện ích bên ngoài. 

## Tính năng nổi bật
* **Cá nhân hóa nội dung:** Tự động đối chiếu và thay thế các biến (ví dụ: `{{Tên}}`, `{{Công ty}}`) bằng dữ liệu từ bất kỳ cột nào bạn thiết lập trên Sheet.
* **Gửi đúng định dạng gốc:** Lấy trực tiếp bản nháp (Draft) trên Gmail để gửi đi. Hỗ trợ hiển thị đầy đủ HTML, hình ảnh chèn trực tiếp trong bài (inline images) và file đính kèm.
* **Chống Spam & Quản lý Quota:** Gửi lần lượt từng người cách nhau 5 giây. Hệ thống tự động chia đợt (batch) và ghi nhớ trạng thái để lách qua giới hạn thời gian chạy 6 phút mặc định của Google.
* **Hoạt động ngầm 24/7:** Chế độ hẹn giờ kiểm tra dữ liệu mới mỗi 15 phút, tự động gửi ngay cả khi bạn tắt máy tính hay không mở trình duyệt.
* **Kiểm soát trực quan:** Tự động đánh dấu trạng thái (Thành công/Lỗi) cho từng người và cung cấp báo cáo thống kê qua Dashboard.

## Hướng dẫn cài đặt
1. Tạo một file Google Sheet mới hoặc mở file danh sách có sẵn.
2. Tại thanh menu, chọn `Tiện ích mở rộng` > `Apps Script`.
3. Copy tất cả các file mã nguồn (`.gs` và `.json`) trong thư mục này dán vào trình soạn thảo Apps Script.
4. Tải lại trang Google Sheet (nhấn F5) để hiển thị menu tùy chỉnh `📧 Email System`.
5. Bấm vào menu `📧 Email System` > `🚀 Khởi tạo hệ thống (chạy lần đầu)` và đồng ý cấp quyền.
6. Soạn một bản nháp trên Gmail, sau đó nhập danh sách vào Sheet và bắt đầu gửi.
