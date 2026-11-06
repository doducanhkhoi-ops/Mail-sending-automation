# Project Context: Mail Sending Automation (Google Apps Script)

## 1. Mục đích
- Hệ thống gửi email hàng loạt tích hợp với Google Sheets & Gmail.
- **Nền tảng**: Google Apps Script (GAS) quản lý qua Google Clasp (`.clasp.json`, `appsscript.json`).

## 2. Quy chuẩn Code & File
- Đặt tên file `.gs` theo chuẩn `PascalCase` (vd: `BatchController.gs`, `DraftManager.gs`).
- Tách biệt rõ nhiệm vụ:
  - `Config.gs`: Cấu hình hệ thống.
  - `SheetManager.gs`: Đọc/ghi Google Sheets.
  - `EmailSender.gs`: Xử lý gửi thư qua GmailApp.
  - `BatchController.gs`: Điều phối tiến độ tránh vượt quá quota của Google.
