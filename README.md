<div align="center">

# Mail-sending-automation

**Google Sheets & Gmail batch mail-merge engine built on Google Apps Script.**

[![CI](https://github.com/doducanhkhoi-ops/Mail-sending-automation/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/doducanhkhoi-ops/Mail-sending-automation/actions/workflows/ci.yml)
[![Platform](https://img.shields.io/badge/runtime-Google%20Apps%20Script-4285F4.svg)](#quick-start)
[![License](https://img.shields.io/github/license/doducanhkhoi-ops/Mail-sending-automation)](./LICENSE)

</div>

---

Runs server-side on Google Cloud with Gmail Draft template sync, batch cooldowns, sender ownership locking, live quota tracking, and 15-minute / form-submit triggers.

---

## Why Mail-sending-automation?

- **24/7 Cloud Execution**: Runs inside Google Apps Script triggers with zero local machine uptime.
- **50-email batches**: Splits large lists with configurable per-email delay (`3–5s`) and batch cooldowns (`5m`) to stay within Apps Script's 6-minute execution limit.
- **Live Gmail Draft sync**: Preserves HTML formatting, inline images, and attachments with `{{Variable}}` template interpolation and Unicode NFC normalization.
- **Sender Ownership Guard**: Locks active triggers to a single sender account to prevent duplicate or cross-account sends.
- **Live Quota Guard**: Detects daily limits (`100/day` personal/EDU, `1500/day` Workspace) and counts sent rows directly from `Danh sách`.

---

## Feature Overview

| Module | Responsibility |
| --- | --- |
| `BatchController.gs` | Batch splitting, cooldown scheduling, pause/resume state |
| `EmailSender.gs` | Personalized sending, test mail, completion report |
| `DraftManager.gs` | Gmail Draft lookup, inline image & attachment preservation |
| `Config.gs` | Sheet-backed settings, daily quota reset, time-window parsing |
| `Triggers.gs` | 15-minute interval & Form Submit triggers, ownership guard |
| `SheetManager.gs` & `Menu.gs` | Dashboard live formulas, duplicate scan, custom Sheets menu |

---

## Quick Start

### Deploy via Apps Script Library

1. Open your Google Sheet → **Extensions → Apps Script**.
2. Click **+** next to **Libraries** and paste the Script ID:
   ```text
   1venlK-fsZCmeXPcFPVcMHhcANascMjJdwFC_DROoKtxDqazk0SUdN0yz
   ```
3. Set **Identifier** to `EmailSystem`, select the latest version (`41`), and click **Add**.
4. Replace `Code.gs` with the bridge functions:

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
function onFormSubmitTrigger(e) { EmailSystem.onFormSubmitTrigger(e); }
```

---

## Testing

```bash
node --test tests/*.test.mjs
```

Verifies syntax compilation across all `.gs` modules, `appsscript.json` validity, email validation, `{{var}}` template interpolation, time normalization, and config defaults.

---

## License

[Apache License 2.0](./LICENSE)
