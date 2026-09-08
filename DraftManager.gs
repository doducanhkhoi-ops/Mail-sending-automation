// ============================================
// DraftManager.gs - Quản lý và trích xuất thư nháp Gmail
// ============================================

/**
 * Lấy nội dung email theo chế độ đã thiết lập trong bảng Cấu hình
 * @param {Object} config - Bảng cấu hình
 * @returns {Object|null} { subject, htmlBody, attachments, inlineImages }
 */
function getEmailContent(config) {
  var mode = String(config["Chế độ nội dung"] || "draft_first").trim().toLowerCase();
  
  switch (mode) {
    case "manual":
      return _getManualContent(config);
    case "draft_first":
      return _getFirstDraft();
    case "draft_by_subject":
      var searchSubject = (config["Tiêu đề bản nháp"] || config["Tiêu đề email"] || "").trim();
      return _getDraftBySubject(searchSubject);
    default:
      logError("Chế độ nội dung không hợp lệ: " + mode);
      return null;
  }
}

/**
 * Chế độ manual: Lấy nội dung trực tiếp từ bảng Cấu hình
 */
function _getManualContent(config) {
  var subject = config["Tiêu đề email"] || "Thông báo";
  var htmlBody = config["Nội dung HTML"] || "";
  
  if (!htmlBody) {
    logError("Chế độ 'manual' yêu cầu nhập Nội dung HTML trong bảng Cấu hình.");
    showAlert("Chưa có nội dung HTML", "Bạn đang chọn chế độ 'manual' nhưng chưa nhập Nội dung HTML trong bảng Cấu hình.");
    return null;
  }
  
  return {
    subject: subject,
    htmlBody: htmlBody,
    attachments: [],
    inlineImages: {}
  };
}

/**
 * Chế độ draft_first: Lấy thư nháp mới nhất trong Gmail
 */
function _getFirstDraft() {
  var drafts = GmailApp.getDrafts();
  
  if (!drafts || drafts.length === 0) {
    logError("Không tìm thấy thư nháp nào trong Gmail.");
    showAlert("Không có thư nháp", "Không tìm thấy thư nháp nào trong hòm thư Gmail của bạn.\nVui lòng tạo một thư nháp trên Gmail trước khi gửi.");
    return null;
  }
  
  var draft = drafts[0];
  return _extractDraftContent(draft);
}

/**
 * Chuẩn hóa chuỗi tiếng Việt và ký tự để so sánh chính xác
 */
function _normalizeText(str) {
  if (!str) return "";
  return String(str)
    .normalize("NFC")
    .toLowerCase()
    .replace(/['""`]/g, "")
    .trim();
}

/**
 * Chế độ draft_by_subject: Tìm thư nháp theo tiêu đề
 */
function _getDraftBySubject(searchSubject) {
  if (!searchSubject) {
    logError("Chưa nhập 'Tiêu đề bản nháp' trong bảng Cấu hình.");
    showAlert("Chưa nhập tiêu đề", "Vui lòng nhập 'Tiêu đề bản nháp' (hoặc 'Tiêu đề email') trong bảng Cấu hình để hệ thống tìm kiếm trong Gmail.");
    return null;
  }
  
  var drafts = GmailApp.getDrafts();
  if (!drafts || drafts.length === 0) {
    logError("Không tìm thấy thư nháp nào trong hòm thư Gmail.");
    showAlert("Không có thư nháp", "Không tìm thấy bất kỳ thư nháp nào trong hòm thư Gmail của bạn.\nVui lòng tạo một thư nháp trên Gmail trước.");
    return null;
  }
  
  var searchKey = _normalizeText(searchSubject);
  
  // 1. So khớp chính xác tuyệt đối (đã chuẩn hóa Unicode NFC)
  for (var i = 0; i < drafts.length; i++) {
    var msg = drafts[i].getMessage();
    var realSubject = msg.getSubject() || "";
    var subj = _normalizeText(realSubject);
    
    if (subj === searchKey) {
      logInfo("Tìm thấy thư nháp khớp chính xác: '" + realSubject + "'");
      return _extractDraftContent(drafts[i]);
    }
  }
  
  // 2. So khớp gần đúng (chứa từ khóa 2 chiều)
  for (var i = 0; i < drafts.length; i++) {
    var msg = drafts[i].getMessage();
    var realSubject = msg.getSubject() || "";
    var subj = _normalizeText(realSubject);
    
    if (subj.indexOf(searchKey) !== -1 || searchKey.indexOf(subj) !== -1) {
      logInfo("Tìm thấy thư nháp khớp gần đúng: '" + realSubject + "'");
      return _extractDraftContent(drafts[i]);
    }
  }
  
  // 3. Nếu vẫn không tìm thấy: Báo danh sách các thư nháp hiện có trong Gmail
  var draftList = [];
  for (var i = 0; i < Math.min(drafts.length, 5); i++) {
    var title = drafts[i].getMessage().getSubject();
    draftList.push((i + 1) + ". \"" + (title || "(Không có tiêu đề)") + "\"");
  }
  
  var msgError = "Không tìm thấy thư nháp nào khớp với: \"" + searchSubject + "\"\n\n" +
                 "Các thư nháp hiện có trong Gmail của bạn:\n" + draftList.join("\n") + "\n\n" +
                 "Vui lòng copy đúng tên thư nháp ở trên dán vào ô 'Tiêu đề bản nháp' trong sheet Cấu hình.";
  
  logError(msgError);
  showAlert("Không tìm thấy thư nháp", msgError);
  return null;
}

/**
 * Trích xuất tiêu đề, nội dung HTML, file đính kèm và ảnh inline từ thư nháp
 */
function _extractDraftContent(draft) {
  var msg = draft.getMessage();
  
  var subject = msg.getSubject() || "";
  var htmlBody = msg.getBody() || "";
  var attachments = msg.getAttachments() || [];
  
  var inlineImages = {};
  var rawMsg = msg.getRawContent();
  var realAttachments = [];
  
  for (var i = 0; i < attachments.length; i++) {
    var att = attachments[i];
    var contentId = _getContentId(att, rawMsg);
    
    if (contentId && htmlBody.indexOf("cid:" + contentId) !== -1) {
      inlineImages[contentId] = att;
    } else {
      realAttachments.push(att);
    }
  }
  
  return {
    subject: subject,
    htmlBody: htmlBody,
    attachments: realAttachments,
    inlineImages: inlineImages
  };
}

/**
 * Trích xuất Content-ID của tệp đính kèm inline từ MIME raw content
 */
function _getContentId(attachment, rawContent) {
  try {
    var name = attachment.getName();
    var regex = new RegExp('Content-Disposition:[^]*?filename="?' + escapeRegex(name) + '"?[^]*?Content-ID:\\s*<([^>]+)>', 'i');
    var match = rawContent.match(regex);
    if (match) return match[1];
    
    regex = new RegExp('Content-ID:\\s*<([^>]+)>[^]*?filename="?' + escapeRegex(name) + '"?', 'i');
    match = rawContent.match(regex);
    if (match) return match[1];
  } catch(e) {
    // Bỏ qua lỗi phân tích MIME
  }
  return null;
}

/**
 * Liệt kê danh sách thư nháp trong Gmail để kiểm tra
 */
function listDrafts() {
  var drafts = GmailApp.getDrafts();
  var list = [];
  for (var i = 0; i < drafts.length; i++) {
    var msg = drafts[i].getMessage();
    list.push({
      index: i,
      subject: msg.getSubject() || "(Không có tiêu đề)",
      to: msg.getTo() || "",
      date: msg.getDate()
    });
  }
  return list;
}
