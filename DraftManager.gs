// ============================================
// DraftManager.gs - Quản lý bản nháp Gmail
// ============================================

/**
 * Lấy nội dung email theo chế độ cấu hình
 * Trả về: { subject: "...", htmlBody: "...", attachments: [...] }
 */
function getEmailContent(config) {
  var mode = config["Chế độ nội dung"] || "draft_first";
  
  switch (mode) {
    case "manual":
      return _getManualContent(config);
    case "draft_first":
      return _getFirstDraft();
    case "draft_by_subject":
      return _getDraftBySubject(config["Tiêu đề bản nháp"]);
    default:
      logError("Chế độ nội dung không hợp lệ: " + mode);
      return null;
  }
}

/**
 * Mode: manual - Lấy nội dung từ sheet cấu hình
 */
function _getManualContent(config) {
  var subject = config["Tiêu đề email"] || "Thông báo";
  var htmlBody = config["Nội dung HTML"] || "";
  
  if (!htmlBody) {
    logError("Mode manual nhưng chưa nhập Nội dung HTML trong sheet Cấu hình");
    return null;
  }
  
  return {
    subject: subject,
    htmlBody: htmlBody,
    attachments: []
  };
}

/**
 * Mode: draft_first - Lấy bản nháp Gmail đầu tiên (mới nhất)
 */
function _getFirstDraft() {
  var drafts = GmailApp.getDrafts();
  
  if (!drafts || drafts.length === 0) {
    logError("Không tìm thấy bản nháp nào trong Gmail");
    return null;
  }
  
  var draft = drafts[0]; // Bản nháp mới nhất
  return _extractDraftContent(draft);
}

/**
 * Mode: draft_by_subject - Tìm bản nháp theo tiêu đề
 */
function _getDraftBySubject(searchSubject) {
  if (!searchSubject) {
    logError("Chưa cấu hình 'Tiêu đề bản nháp' trong sheet Cấu hình");
    return null;
  }
  
  var drafts = GmailApp.getDrafts();
  
  for (var i = 0; i < drafts.length; i++) {
    var msg = drafts[i].getMessage();
    var subject = msg.getSubject() || "";
    
    // So sánh tiêu đề (không phân biệt hoa thường)
    if (subject.toLowerCase().trim() === searchSubject.toLowerCase().trim()) {
      return _extractDraftContent(drafts[i]);
    }
  }
  
  // Tìm gần đúng (chứa chuỗi)
  for (var i = 0; i < drafts.length; i++) {
    var msg = drafts[i].getMessage();
    var subject = msg.getSubject() || "";
    
    if (subject.toLowerCase().indexOf(searchSubject.toLowerCase().trim()) !== -1) {
      logInfo("Tìm thấy bản nháp gần đúng: '" + subject + "'");
      return _extractDraftContent(drafts[i]);
    }
  }
  
  logError("Không tìm thấy bản nháp với tiêu đề: " + searchSubject);
  return null;
}

/**
 * Trích xuất nội dung từ 1 bản nháp Gmail
 */
function _extractDraftContent(draft) {
  var msg = draft.getMessage();
  
  var subject = msg.getSubject() || "";
  var htmlBody = msg.getBody() || "";
  var attachments = msg.getAttachments() || [];
  
  // Xử lý inline images
  var inlineImages = {};
  var rawMsg = msg.getRawContent();
  
  // Lọc ra inline images vs file đính kèm thật
  var realAttachments = [];
  for (var i = 0; i < attachments.length; i++) {
    var att = attachments[i];
    var contentId = _getContentId(att, rawMsg);
    
    if (contentId && htmlBody.indexOf("cid:" + contentId) !== -1) {
      // Đây là inline image
      inlineImages[contentId] = att;
    } else {
      // Đây là file đính kèm thật
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
 * Trích xuất Content-ID của attachment từ raw email content
 */
function _getContentId(attachment, rawContent) {
  try {
    var name = attachment.getName();
    // Tìm Content-ID gắn với attachment này
    var regex = new RegExp('Content-Disposition:[^]*?filename="?' + escapeRegex(name) + '"?[^]*?Content-ID:\\s*<([^>]+)>', 'i');
    var match = rawContent.match(regex);
    if (match) return match[1];
    
    // Thử tìm theo thứ tự ngược
    regex = new RegExp('Content-ID:\\s*<([^>]+)>[^]*?filename="?' + escapeRegex(name) + '"?', 'i');
    match = rawContent.match(regex);
    if (match) return match[1];
  } catch(e) {
    // Ignore
  }
  return null;
}

/**
 * Liệt kê tất cả bản nháp (cho debug/menu)
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
