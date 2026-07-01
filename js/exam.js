/* ===== MODULE: exam.js — Toàn bộ tính năng "Luyện đề thi chữ" (dethi): chọn đề, làm bài, chấm, xem lại, lưu lịch sử ===== */

/* ===================================================================
   GHI CHÚ ĐỀ THI / ĐỀ NGHE — bôi đen 1 đoạn text trong câu hỏi/đáp án/giải
   thích lúc làm đề (CẢ đề thi chữ VÀ đề luyện nghe), ghi lại nghĩa/ghi nhớ
   riêng (vd bôi "必ず" ghi "nhất định"), xem lại sau ở trang "Ghi chú" (nhóm
   theo đề, theo câu), BẤM VÀO PHẦN ĐÃ GHI CHÚ để SỬA lại nội dung.
   Lưu riêng theo từng loại đề (không lẫn dữ liệu):
     n2vocab_exam_notes    = { [examId]:  { [qIndex]: [ {id,text,note,createdAt} ] } }
     n2vocab_choukai_notes = { [testId]:  { [qKey]:   [ {id,text,note,createdAt} ] } }
   (qKey của đề nghe là chuỗi dạng "m{M}q{Q}[s{S}]" — xem choukaiKeyFor() trong choukai.js)
=================================================================== */
function notesStorageKey(kind) {
  return kind === "choukai" ? "n2vocab_choukai_notes" : "n2vocab_exam_notes";
}

function loadNotesRawG(kind) {
  try {
    const raw = localStorage.getItem(notesStorageKey(kind));
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveNotesRawG(kind, data) {
  localStorage.setItem(notesStorageKey(kind), JSON.stringify(data));
}

function addNoteG(kind, id, qKey, text, note) {
  const all = loadNotesRawG(kind);
  if (!all[id]) all[id] = {};
  if (!all[id][qKey]) all[id][qKey] = [];
  all[id][qKey].push({
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    text, note, createdAt: Date.now(),
  });
  saveNotesRawG(kind, all);
}

function updateNoteG(kind, id, qKey, noteId, newNoteText) {
  const all = loadNotesRawG(kind);
  const arr = all[id] && all[id][qKey];
  const target = arr && arr.find((n) => n.id === noteId);
  if (target) target.note = newNoteText;
  saveNotesRawG(kind, all);
}

function deleteNoteG(kind, id, qKey, noteId) {
  const all = loadNotesRawG(kind);
  if (all[id] && all[id][qKey]) {
    all[id][qKey] = all[id][qKey].filter((n) => n.id !== noteId);
    if (all[id][qKey].length === 0) delete all[id][qKey];
    if (Object.keys(all[id]).length === 0) delete all[id];
  }
  saveNotesRawG(kind, all);
}

function getNotesForQuestionG(kind, id, qKey) {
  const all = loadNotesRawG(kind);
  return (all[id] && all[id][qKey]) || [];
}

// Gộp ghi chú (note) đề thi/đề nghe lúc NHẬP file — cấu trúc lồng 2 cấp
// { id: { qKey: [ {id, text, note, createdAt} ] } }. Gộp SÂU theo từng id rồi
// từng qKey (không đè cả cụm của 1 đề/1 câu), loại trùng theo `note.id` (phòng
// trường hợp export rồi nhập lại trên CHÍNH máy đó, tránh ghi chú bị nhân đôi).
function mergeNotesOnImport(kind, incomingNotes) {
  const current = loadNotesRawG(kind);
  Object.keys(incomingNotes).forEach((id) => {
    if (!current[id]) current[id] = {};
    Object.keys(incomingNotes[id]).forEach((qKey) => {
      const existing = current[id][qKey] || [];
      const incoming = incomingNotes[id][qKey] || [];
      const seenIds = new Set(existing.map((n) => n.id));
      const merged = [...existing];
      incoming.forEach((n) => {
        if (!seenIds.has(n.id)) {
          merged.push(n);
          seenIds.add(n.id);
        }
      });
      current[id][qKey] = merged;
    });
  });
  saveNotesRawG(kind, current);
}

// ---- Các tên hàm CŨ của riêng đề thi chữ — giữ lại làm wrapper mỏng để
// KHÔNG phải sửa các chỗ đã gọi chúng trước đó (giảm rủi ro vỡ tính năng cũ). ----
function loadExamNotesRaw() { return loadNotesRawG("exam"); }
function addExamNote(examId, qIndex, text, note) { addNoteG("exam", examId, qIndex, text, note); }
function getExamNotesForQuestion(examId, qIndex) { return getNotesForQuestionG("exam", examId, qIndex); }
function deleteExamNote(examId, qIndex, noteId) { deleteNoteG("exam", examId, qIndex, noteId); }

// Bọc lần xuất hiện ĐẦU TIÊN của `text` trong containerEl bằng <mark> kèm
// tooltip là nội dung ghi chú — đi qua từng text node con (kể cả trong button)
// bằng TreeWalker, dùng Range.surroundContents để bọc mà KHÔNG phá cấu trúc
// DOM xung quanh. Bấm vào <mark> này sẽ mở lại popup để SỬA ghi chú.
function highlightTextInContainer(containerEl, text, note, kind, id, qKey) {
  if (!text || !containerEl) return;
  const walker = document.createTreeWalker(containerEl, NodeFilter.SHOW_TEXT, null);
  let node;
  while ((node = walker.nextNode())) {
    const idx = node.nodeValue.indexOf(text);
    if (idx !== -1) {
      try {
        const range = document.createRange();
        range.setStart(node, idx);
        range.setEnd(node, idx + text.length);
        const mark = document.createElement("mark");
        mark.className = "exam-note-mark";
        mark.title = note.note + " (bấm để sửa)";
        mark.dataset.noteId = note.id;
        range.surroundContents(mark);
        mark.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          openNotePopupForEdit(kind, id, qKey, note.id, note.text, note.note, mark);
        });
      } catch (e) { /* range bất thường (hiếm) — bỏ qua, không vỡ trang */ }
      return;
    }
  }
}

// Áp TẤT CẢ ghi chú đã lưu của 1 câu vào 1 khung chứa (câu hỏi / đáp án /
// giải thích / modal xem chi tiết) — gọi lại mỗi khi nội dung khung đó vừa
// được render/innerHTML mới (vì innerHTML mới sẽ xóa mất highlight cũ).
function applyNoteHighlights(containerEl, kind, id, qKey) {
  if (!containerEl) return;
  const notes = getNotesForQuestionG(kind, id, qKey);
  notes.forEach((note) => highlightTextInContainer(containerEl, note.text, note, kind, id, qKey));
}

// Wrapper cũ riêng đề thi chữ — giữ tên cũ để không phải sửa các nơi đã gọi.
function applyExamNoteHighlights(containerEl, examId, qIndex) {
  applyNoteHighlights(containerEl, "exam", examId, qIndex);
}

// state của popup ghi chú đang mở — null nếu đang TẠO MỚI (từ bôi đen),
// có giá trị nếu đang SỬA 1 ghi chú có sẵn (bấm vào <mark>).
let noteCtx = { kind: "exam", id: null, qKey: null, selectedText: "", editingNoteId: null };

// Lắng nghe người dùng BÔI ĐEN (chọn) text trong vùng câu hỏi/đáp án/giải
// thích — áp dụng CHO CẢ đề thi chữ (view-exam) và đề luyện nghe (view-choukai,
// bao gồm panel xem đáp án) — hiện nút nổi "📝 Ghi chú" ngay cạnh đoạn vừa chọn.
function initExamNoteSelectionHandler() {
  document.addEventListener("mouseup", () => {
    const examView = document.getElementById("view-exam");
    const choukaiView = document.getElementById("view-choukai");
    let kind = null, allowedIds = [];
    if (examView && !examView.classList.contains("hidden")) {
      kind = "exam";
      allowedIds = ["examQuestion", "examOptions", "examExplainBox"];
    } else if (choukaiView && !choukaiView.classList.contains("hidden")) {
      kind = "choukai";
      allowedIds = ["choukaiPrompt", "choukaiOptions", "choukaiReviewContent"];
    }
    const toolbarBtn = document.getElementById("examNoteToolbarBtn");
    if (!kind) { toolbarBtn.classList.add("hidden"); return; }

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || !sel.toString().trim()) {
      toolbarBtn.classList.add("hidden");
      return;
    }
    const anchorNode = sel.anchorNode;
    const inAllowedArea = allowedIds.some((idd) => {
      const el = document.getElementById(idd);
      return el && el.contains(anchorNode);
    });
    if (!inAllowedArea) {
      toolbarBtn.classList.add("hidden");
      return;
    }

    noteCtx.kind = kind;
    noteCtx.selectedText = sel.toString().trim();
    noteCtx.editingNoteId = null;
    if (kind === "exam") {
      noteCtx.id = App.currentExamId;
      noteCtx.qKey = App.examCurrentQIndex;
    } else {
      noteCtx.id = App.currentChoukaiId;
      noteCtx.qKey = getCurrentChoukaiNoteKey();
    }
    if (noteCtx.id == null || noteCtx.qKey == null) { toolbarBtn.classList.add("hidden"); return; }

    const rect = sel.getRangeAt(0).getBoundingClientRect();
    toolbarBtn.style.top = `${rect.top + window.scrollY - 38}px`;
    toolbarBtn.style.left = `${rect.left + window.scrollX}px`;
    toolbarBtn.classList.remove("hidden");
  });
}

function openExamNotePopupForSelection() {
  document.getElementById("examNoteToolbarBtn").classList.add("hidden");
  const popup = document.getElementById("examNotePopup");
  document.getElementById("examNotePopupSelectedText").textContent = noteCtx.selectedText;
  const input = document.getElementById("examNotePopupInput");
  input.value = "";
  const toolbarBtn = document.getElementById("examNoteToolbarBtn");
  popup.style.top = toolbarBtn.style.top;
  popup.style.left = toolbarBtn.style.left;
  popup.classList.remove("hidden");
  input.focus();
}

// Mở popup để SỬA 1 ghi chú đã có (bấm vào <mark> hoặc nút ✎ ở trang Ghi chú).
function openNotePopupForEdit(kind, id, qKey, noteId, text, currentNote, anchorEl) {
  noteCtx = { kind, id, qKey, selectedText: text, editingNoteId: noteId };
  const popup = document.getElementById("examNotePopup");
  document.getElementById("examNotePopupSelectedText").textContent = text;
  const input = document.getElementById("examNotePopupInput");
  input.value = currentNote;
  const rect = anchorEl.getBoundingClientRect();
  popup.style.top = `${rect.bottom + window.scrollY + 6}px`;
  popup.style.left = `${rect.left + window.scrollX}px`;
  popup.classList.remove("hidden");
  document.getElementById("examNoteToolbarBtn").classList.add("hidden");
  input.focus();
  input.select();
}

function closeExamNotePopup() {
  document.getElementById("examNotePopup").classList.add("hidden");
}

function saveExamNoteFromPopup() {
  const noteContent = document.getElementById("examNotePopupInput").value.trim();
  if (!noteContent) { closeExamNotePopup(); return; }

  if (noteCtx.editingNoteId) {
    // ----- ĐANG SỬA ghi chú có sẵn -----
    updateNoteG(noteCtx.kind, noteCtx.id, noteCtx.qKey, noteCtx.editingNoteId, noteContent);
    closeExamNotePopup();
    // Cập nhật tooltip của <mark> tương ứng đang hiện trên màn hình (nếu có)
    document.querySelectorAll(`mark.exam-note-mark[data-note-id="${noteCtx.editingNoteId}"]`).forEach((m) => {
      m.title = noteContent + " (bấm để sửa)";
    });
    if (!document.getElementById("view-examnotes").classList.contains("hidden")) {
      renderExamNotesMode();
    }
    return;
  }

  // ----- ĐANG TẠO MỚI từ bôi đen -----
  if (!noteCtx.selectedText) { closeExamNotePopup(); return; }
  addNoteG(noteCtx.kind, noteCtx.id, noteCtx.qKey, noteCtx.selectedText, noteContent);
  closeExamNotePopup();
  window.getSelection().removeAllRanges();

  if (noteCtx.kind === "exam") {
    applyNoteHighlights(document.getElementById("examQuestion"), "exam", noteCtx.id, noteCtx.qKey);
    applyNoteHighlights(document.getElementById("examOptions"), "exam", noteCtx.id, noteCtx.qKey);
    applyNoteHighlights(document.getElementById("examExplainBox"), "exam", noteCtx.id, noteCtx.qKey);
  } else {
    applyNoteHighlights(document.getElementById("choukaiPrompt"), "choukai", noteCtx.id, noteCtx.qKey);
    applyNoteHighlights(document.getElementById("choukaiOptions"), "choukai", noteCtx.id, noteCtx.qKey);
    applyNoteHighlights(document.getElementById("choukaiReviewContent"), "choukai", noteCtx.id, noteCtx.qKey);
  }
}



// Trang "Ghi chú" — nhóm theo đề (đề mục lớn, cả đề thi chữ VÀ đề luyện nghe),
// trong mỗi đề sắp theo số câu tăng dần. Bấm "Câu N" để nhảy tới đúng câu đó
// (kèm highlight ghi chú), bấm ✎ để SỬA nội dung ghi chú, ✕ để xóa.
function renderExamNotesMode() {
  const container = document.getElementById("examNotesList");
  const examAll = loadNotesRawG("exam");
  const choukaiAll = loadNotesRawG("choukai");
  const examIds = Object.keys(examAll).filter((id) => Object.keys(examAll[id]).length > 0);
  const choukaiIds = Object.keys(choukaiAll).filter((id) => Object.keys(choukaiAll[id]).length > 0);

  if (examIds.length === 0 && choukaiIds.length === 0) {
    container.innerHTML = `<div class="examnotes-empty">Chưa có ghi chú nào. Khi làm đề thi chữ HOẶC đề luyện nghe, hãy BÔI ĐEN (chọn) từ/đoạn muốn ghi nhớ trong câu hỏi, đáp án, hoặc giải thích — nút "📝 Ghi chú" sẽ hiện lên ngay cạnh để bạn lưu lại.</div>`;
    return;
  }

// Escape ký tự đặc biệt khi chèn nội dung ghi chú (do người dùng tự gõ) vào
// HTML/thuộc tính — tránh vỡ layout hoặc lỗi hiển thị nếu ghi chú có dấu " < > &.
function escNoteHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

  function buildRows(all, examOrTests, idGetter) {
    return Object.keys(all).filter((id) => Object.keys(all[id]).length > 0).map((id) => {
      const item = examOrTests.find((e) => e.id === id);
      const title = item ? item.title : id;
      const qKeys = Object.keys(all[id]);
      // Sắp: số thì sắp tăng dần (đề thi chữ); chuỗi (đề nghe) sắp theo alphabet tự nhiên.
      qKeys.sort((a, b) => (isNaN(a) || isNaN(b)) ? a.localeCompare(b) : Number(a) - Number(b));
      const rows = qKeys.map((qKey) => {
        return all[id][qKey].map((n) => `
          <div class="examnotes-row">
            <button class="examnotes-jump" data-kind="${idGetter}" data-id="${id}" data-qkey="${qKey}">${idGetter === "exam" ? "Câu " + (Number(qKey) + 1) : qKey}</button>
            <span class="examnotes-text">${escNoteHtml(n.text)}</span>
            <span class="examnotes-arrow">→</span>
            <span class="examnotes-note">${escNoteHtml(n.note)}</span>
            <button class="examnotes-edit" data-kind="${idGetter}" data-id="${id}" data-qkey="${qKey}" data-noteid="${n.id}" data-text="${escNoteHtml(n.text)}" data-note="${escNoteHtml(n.note)}" title="Sửa ghi chú">✎</button>
            <button class="examnotes-del" data-kind="${idGetter}" data-id="${id}" data-qkey="${qKey}" data-noteid="${n.id}" title="Xóa ghi chú này">✕</button>
          </div>
        `).join("");
      }).join("");
      return `<div class="examnotes-group"><div class="examnotes-group-title">${idGetter === "exam" ? "📄" : "🎧"} ${title}</div>${rows}</div>`;
    }).join("");
  }

  container.innerHTML = buildRows(examAll, App.exams, "exam") + buildRows(choukaiAll, App.choukaiTests, "choukai");

  container.querySelectorAll(".examnotes-jump").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id, qKey = btn.dataset.qkey, kind = btn.dataset.kind;
      if (kind === "exam") {
        const qIndex = parseInt(qKey, 10);
        openExamDetailModal(qIndex, { examId: id, examHistory: {} });
        applyNoteHighlights(document.getElementById("examDetailModalBody"), "exam", id, qIndex);
      } else {
        jumpToChoukaiNote(id, qKey);
      }
    });
  });
  container.querySelectorAll(".examnotes-edit").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      openNotePopupForEdit(btn.dataset.kind, btn.dataset.id, btn.dataset.qkey, btn.dataset.noteid, btn.dataset.text, btn.dataset.note, btn);
      e.stopPropagation();
    });
  });
  container.querySelectorAll(".examnotes-del").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!confirm("Xóa ghi chú này?")) return;
      deleteNoteG(btn.dataset.kind, btn.dataset.id, btn.dataset.qkey, btn.dataset.noteid);
      renderExamNotesMode();
    });
  });
}

function renderExamPickerState() {
  const empty = document.getElementById("examEmpty");
  const body = document.getElementById("examBody");
  const result = document.getElementById("examResult");

  if (!App.currentExamId) {
    empty.classList.remove("hidden");
    body.classList.add("hidden");
    result.classList.add("hidden");
    document.getElementById("examTitleLabel").textContent = "Chưa chọn đề";
    return;
  }
  empty.classList.add("hidden");

  // Nếu đang giữa 1 đề thi (chưa hoàn thành) và speed mode đang bật, đếm lại
  // timer cho câu hiện tại (không ảnh hưởng điểm số, chỉ làm mới đồng hồ hiển thị)
  const isMidExam = !body.classList.contains("hidden") && App.examQueue.length > 0;
  if (isMidExam && App.examSpeedMode) {
    startExamPerQuestionTimer();
    startExamTotalTimer();
  }
}

// Hiện modal hỏi chế độ chấm điểm (chấm ngay / chấm cuối bài) mỗi khi chọn 1 đề
// thi mới từ dropdown. Lưu examId vào App.examPendingExamId, chỉ thực sự
// startExam() sau khi người dùng đã xác nhận chọn 1 trong 2 chế độ.
function openExamModeModal(examId) {
  App.examPendingExamId = examId;
  const detailStats = loadExamDetailHistoryStats();
  const saved = detailStats[examId];
  const viewSavedBtn = document.getElementById("btnExamViewSavedResult");
  if (saved) {
    viewSavedBtn.classList.remove("hidden");
    const correctCount = Object.values(saved.examHistory).filter((h) => h.firstTryCorrect === true).length;
    const total = Object.keys(saved.examHistory).length;
    const d = new Date(saved.savedAt);
    const dateStr = `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
    document.getElementById("examSavedResultDesc").textContent =
      `Lần làm gần nhất (${dateStr}): ${correctCount}/${total} câu đúng ngay lần đầu. Xem lại lưới đúng/sai và giải thích từng câu — không cần làm lại.`;
  } else {
    viewSavedBtn.classList.add("hidden");
  }
  document.getElementById("examModeModalOverlay").classList.remove("hidden");
}

// Xem lại kết quả CHI TIẾT của lần làm gần nhất đã lưu (không làm lại đề).
// Dùng cho trường hợp: đã làm đề trên máy khác, nhập (import) tiến độ vào máy này,
// muốn xem lại lưới đúng/sai + giải thích từng câu mà không cần làm lại từ đầu.
function viewSavedExamResult(examId) {
  document.getElementById("examModeModalOverlay").classList.add("hidden");
  const exam = App.exams.find((e) => e.id === examId);
  const detailStats = loadExamDetailHistoryStats();
  const saved = detailStats[examId];
  if (!exam || !saved) return;

  App.currentExamId = examId;
  App.examHistory = saved.examHistory;
  App.examOriginalTotal = exam.questions.length;
  App.examQueue = [];
  App.examReviewMode = false;

  document.getElementById("examTitleLabel").textContent = exam.title;
  document.getElementById("examEmpty").classList.add("hidden");
  document.getElementById("examBody").classList.add("hidden");
  document.getElementById("examResult").classList.remove("hidden");

  const correctCount = Object.values(App.examHistory).filter((h) => h.firstTryCorrect === true).length;
  document.getElementById("examFinalScore").textContent =
    `${correctCount}/${exam.questions.length} điểm (kết quả đã lưu, lần làm gần nhất)`;
  document.getElementById("examTimeSummary").innerHTML = "";
  document.getElementById("examSpeedSummary").classList.add("hidden");

  renderExamResultGrid();
}

function confirmExamMode(mode) {
  document.getElementById("examModeModalOverlay").classList.add("hidden");
  App.examScoreMode = mode;
  if (App.examPendingExamId) {
    startExam(App.examPendingExamId);
    App.examPendingExamId = null;
  }
}

function startExam(examId) {
  const exam = App.exams.find((e) => e.id === examId);
  if (!exam) return;

  App.currentExamId = examId;
  App.examOriginalTotal = exam.questions.length;
  App.examQueue = exam.questions.map((_, i) => i); // hàng đợi chứa index câu hỏi gốc
  App.examScore = 0;
  App.examAnswered = new Set();
  App.examHistory = {};
  App.examSeenOrder = [];
  App.examNavPos = -1;
  App.examReviewMode = false;
  App.examQuestionTimeLog = [];
  App.examFlagged = new Set();
  App.examUnsure = new Set();

  App.examSpeedMode = document.getElementById("examSpeedMode").checked;
  App.examTotalStartTime = null;
  App.examFirstPassStartTime = null;
  App.examFirstPassEndTime = null;
  App.examFirstPassDone = false;
  App.examRetryStartTime = null;

  document.getElementById("examTitleLabel").textContent = exam.title;
  document.getElementById("examScore").textContent = "0";
  document.getElementById("examTotal").textContent = exam.questions.length;
  document.getElementById("examResult").classList.add("hidden");
  document.getElementById("examBody").classList.remove("hidden");
  document.getElementById("examEmpty").classList.add("hidden");
  // Nút "Thoát & xem kết quả" chỉ có ý nghĩa ở chế độ chấm ngay (vì đó là chế độ
  // có vòng lặp làm-lại-câu-sai có thể kéo dài) — chấm cuối bài đã đi tuần tự
  // hết đề 1 lượt rồi nên không cần "thoát sớm".
  document.getElementById("btnExamExitEarly").classList.toggle("hidden", App.examScoreMode !== "instant");

  startExamTotalTimer();
  renderExamQuestion();
}

function startExamTotalTimer() {
  clearInterval(App.examTotalTimerHandle);
  const wrap = document.getElementById("examTotalTimerWrap");
  if (!App.examSpeedMode) {
    wrap.classList.add("hidden");
    return;
  }
  wrap.classList.remove("hidden");
  // Chỉ đặt mốc bắt đầu nếu chưa có (tránh reset về 0 khi rời rồi quay lại giữa đề)
  if (!App.examTotalStartTime) {
    App.examTotalStartTime = Date.now();
  }
  App.examTotalTimerHandle = setInterval(() => {
    const sec = (Date.now() - App.examTotalStartTime) / 1000;
    document.getElementById("examTotalTimer").textContent = fmtTime(sec);
  }, 500);
}

function startExamPerQuestionTimer() {
  clearInterval(App.examPerQTimerHandle);
  const wrap = document.getElementById("examPerQuestionTimerWrap");
  const timerEl = document.getElementById("examPerQuestionTimer");

  if (!App.examSpeedMode || App.examReviewMode) {
    wrap.classList.add("hidden");
    return;
  }
  wrap.classList.remove("hidden");
  App.examPerQSecondsLeft = 30;
  App.examPerQStartedAt = Date.now();
  timerEl.textContent = "30";
  wrap.classList.remove("is-warning", "is-overtime");

  App.examPerQTimerHandle = setInterval(() => {
    App.examPerQSecondsLeft--;
    if (App.examPerQSecondsLeft >= 0) {
      timerEl.textContent = App.examPerQSecondsLeft;
    } else {
      // Quá 30s: vẫn cho làm tiếp, hiển thị số giây đã vượt quá dạng "+N"
      timerEl.textContent = `+${Math.abs(App.examPerQSecondsLeft)}`;
      wrap.classList.add("is-overtime");
    }
    if (App.examPerQSecondsLeft <= 10 && App.examPerQSecondsLeft > 0) {
      wrap.classList.add("is-warning");
    }
  }, 1000);
}

// Bật/tắt luyện tốc độ NGAY LẬP TỨC mà không cần đổi đề (sửa bug cũ: trước đây
// examSpeedMode chỉ đọc 1 lần lúc startExam(), nên phải đổi đề mới re-trigger).
function toggleExamSpeedMode(enabled) {
  App.examSpeedMode = enabled;
  if (!App.currentExamId) return; // chưa chọn đề, chỉ lưu trạng thái checkbox, chưa cần làm gì thêm
  startExamTotalTimer();
  startExamPerQuestionTimer();
}

// Helper: đã đi hết lượt đầu chưa — tức mọi câu gốc (0..examOriginalTotal-1) đã
// xuất hiện trong examSeenOrder ít nhất 1 lần.
function checkFirstPassDone() {
  if (App.examFirstPassDone) return true;
  const seenSet = new Set(App.examSeenOrder);
  for (let i = 0; i < App.examOriginalTotal; i++) {
    if (!seenSet.has(i)) return false;
  }
  return true;
}

function renderExamQuestion() {
  if (App.examQueue.length === 0) {
    finishExam();
    return;
  }
  App.examReviewMode = false;
  App.examNavPos = -1; // -1 nghĩa là đang ở câu "live" (đang chờ trả lời), không phải xem lại

  const exam = App.exams.find((e) => e.id === App.currentExamId);
  const qIndex = App.examQueue[0];
  const q = exam.questions[qIndex];

  // Ghi nhận vào thứ tự đã-từng-thấy nếu đây là lần đầu thấy câu này trong phiên
  if (!App.examSeenOrder.includes(qIndex) || App.examSeenOrder[App.examSeenOrder.length - 1] !== qIndex) {
    App.examSeenOrder.push(qIndex);
  }

  // Số thứ tự câu LUÔN hiển thị đúng vị trí gốc của câu đang xem (qIndex+1) —
  // KHÔNG phải số câu đã trả lời đúng. Trước đây dùng App.examAnswered.size+1
  // (đếm số câu ĐÚNG) khiến số nhảy sai lệch hẳn so với câu đang hiện ra mỗi khi
  // có câu làm lại (chế độ chấm ngay) hoặc câu sai (chế độ chấm cuối bài).
  document.getElementById("examPos").textContent = qIndex + 1;
  document.getElementById("examQueueTotal").textContent = App.examOriginalTotal;

  const note = document.getElementById("examRetryNote");
  // Ghi chú "câu làm lại trong hàng đợi" CHỈ có ý nghĩa ở chế độ chấm ngay (vì
  // chỉ chế độ đó mới đẩy câu sai về cuối hàng đợi để làm lại). Chế độ chấm cuối
  // bài đi đúng 1 lượt, không có khái niệm "làm lại" — phép tính cũ
  // (dựa trên examAnswered chỉ tăng khi ĐÚNG) sẽ ra số âm vô nghĩa ở chế độ này.
  if (App.examScoreMode === "instant") {
    const remainingUnanswered = App.examOriginalTotal - App.examAnswered.size;
    const retryCount = App.examQueue.length - remainingUnanswered;
    note.textContent = retryCount > 0 ? `(có ${retryCount} câu làm lại trong hàng đợi)` : "";
  } else {
    note.textContent = "";
  }

  document.getElementById("examReviewBanner").classList.add("hidden");
  document.getElementById("examHistoryNote").classList.add("hidden");
  renderExamQuestionContent(q, qIndex, true);

  startExamPerQuestionTimer();

  // Bắt đầu mốc thời gian "mốc 2: sửa lại câu sai" ngay khi pha lượt-đầu kết thúc
  // và bắt đầu gặp lại 1 câu đã từng sai (retryCount > 0 từ thời điểm này).
  if (!App.examFirstPassDone && checkFirstPassDone()) {
    App.examFirstPassDone = true;
    App.examFirstPassEndTime = Date.now();
    if (App.examQueue.length > 0) {
      App.examRetryStartTime = Date.now();
    }
  }
}

// Render nội dung câu hỏi (dùng chung cho cả câu "live" đang chờ trả lời và khi xem lại).
// isLive=true: câu đang chờ trả lời thật, gắn click handler bình thường.
// isLive=false: đang xem lại câu cũ qua nút Câu trước/Câu sau, hiện lại lựa chọn đã chọn,
// không cho chọn lại (chỉ xem), không tính giờ.
function renderExamQuestionContent(q, qIndex, isLive) {
  // dùng innerHTML (không phải textContent) để cho phép thẻ <u> gạch chân đúng
  // từ kanji/từ được hỏi trong câu — dữ liệu de_bai do hệ thống tự kiểm soát,
  // không phải input người dùng nên an toàn khi render trực tiếp.
  document.getElementById("examQuestion").innerHTML = q.de_bai;
  App.examAnswering = false;
  App.examCurrentQuestion = q;
  App.examCurrentQIndex = qIndex;
  document.getElementById("btnExamFlag").classList.toggle("is-active", App.examFlagged.has(qIndex));
  document.getElementById("btnExamUnsure").classList.toggle("is-active", App.examUnsure.has(qIndex));

  const optsDiv = document.getElementById("examOptions");
  optsDiv.innerHTML = "";

  const history = App.examHistory[qIndex];
  const lastAttempt = history && history.attempts.length ? history.attempts[history.attempts.length - 1] : null;

  // Random thứ tự đáp án khi là câu live; khi xem lại giữ nguyên thứ tự đã hiện lúc đó
  // (lưu trong history để tránh đáp án nhảy lộn xộn khi quay lại xem)
  let optionIndices;
  if (isLive) {
    optionIndices = shuffle(q.options.map((_, i) => i));
    if (!App.examHistory[qIndex]) {
      App.examHistory[qIndex] = { attempts: [], firstTryCorrect: null, optionOrder: optionIndices };
    } else {
      App.examHistory[qIndex].optionOrder = optionIndices;
    }
  } else {
    optionIndices = (history && history.optionOrder) || q.options.map((_, i) => i);
  }

  optionIndices.forEach((optIdx) => {
    const btn = document.createElement("button");
    btn.className = "quiz-opt";
    btn.textContent = q.options[optIdx];

    if (!isLive && lastAttempt) {
      if (App.examScoreMode === "review") {
        // Chấm cuối bài: cho phép SỬA lại đáp án khi quay lại xem câu đã làm —
        // đúng với logic làm bài thật (được sửa đáp án tự do trước khi "nộp bài"
        // ở cuối). KHÔNG tô đúng/sai (vẫn giữ nguyên tinh thần "không biết kết quả
        // giữa lúc làm" của chế độ này), chỉ tô nhẹ ô đang được chọn.
        if (optIdx === lastAttempt.chosenIdx) btn.classList.add("was-chosen-neutral");
        btn.addEventListener("click", () => handleExamAnswerEditReview(btn, optIdx, qIndex, q));
      } else {
        // Chấm ngay: đã xem đáp án đúng/sai + giải thích rồi nên chỉ xem lại,
        // không cho sửa (sửa sau khi đã biết đáp án thì không còn ý nghĩa).
        btn.classList.add("disabled");
        if (optIdx === q.dap_an_dung) btn.classList.add(getExamCorrectColorClass(qIndex));
        if (optIdx === lastAttempt.chosenIdx && !lastAttempt.correct) btn.classList.add("wrong");
        if (optIdx === lastAttempt.chosenIdx) btn.classList.add("was-chosen");
      }
    } else if (isLive) {
      btn.addEventListener("click", () => handleExamAnswer(btn, optIdx, qIndex, q));
    }

    optsDiv.appendChild(btn);
  });

  // Quay lại xem 1 câu đã trả lời SAI và đã chọn đáp án thứ 2 đang phân vân
  // trước đó (instant mode) — phải VẼ LẠI hộp + viền đáp án thứ 2, nếu không sẽ
  // bị MẤT trạng thái khi điều hướng Câu trước/Câu sau (chỉ lưu trong examHistory,
  // không tự re-render như màu đúng/sai bình thường).
  document.getElementById("examSecondGuessBox").classList.add("hidden");
  if (!isLive && lastAttempt && App.examScoreMode !== "review" && !lastAttempt.correct
      && history && history.secondGuessIdx != null) {
    const box = document.getElementById("examSecondGuessBox");
    const isSecondCorrect = history.secondGuessIdx === q.dap_an_dung;
    const secondText = q.options[history.secondGuessIdx];
    box.innerHTML = `<div class="exam-secondguess-label">🤔 Bạn đã phân vân với đáp án khác:</div>
      <div class="exam-secondguess-opts">
        <button class="exam-secondguess-opt ${isSecondCorrect ? "is-second-correct" : "is-second-wrong"}" disabled>${secondText}</button>
      </div>`;
    box.classList.remove("hidden");
    optsDiv.querySelectorAll(".quiz-opt").forEach((o) => {
      if (o.textContent === secondText) o.classList.add(isSecondCorrect ? "is-second-correct-ring" : "is-second-wrong-ring");
    });
  }

  // Hiện ghi chú lịch sử nếu câu này đã từng bị sai trước đây (kể cả khi xem live lại sau khi đã trả lời)
  const histNote = document.getElementById("examHistoryNote");
  if (history && history.attempts.length > 0) {
    const wrongCount = history.attempts.filter((a) => !a.correct).length;
    if (wrongCount > 0) {
      histNote.classList.remove("hidden");
      histNote.textContent = `⚠ Câu này đã sai ${wrongCount} lần trong đề này`;
    } else {
      histNote.classList.add("hidden");
    }
  } else {
    histNote.classList.add("hidden");
  }

  // Nút "Xem giải thích" chỉ hiện khi: câu này CÓ field giai_thich trong dữ liệu,
  // ĐÃ từng được trả lời ít nhất 1 lần (không cho xem giải thích trước khi tự
  // làm), VÀ không phải đang ở chế độ "Chấm sửa cuối bài" trong lúc đề còn dang
  // dở (chế độ đó chỉ tiết lộ đúng/sai/giải thích ở trang kết quả cuối cùng).
  const explainRow = document.getElementById("examExplainRow");
  const explainBox = document.getElementById("examExplainBox");
  explainBox.classList.add("hidden");
  explainBox.innerHTML = "";
  document.getElementById("btnExamContinue").classList.add("hidden");
  const hasAnswered = history && history.attempts.length > 0;
  const allowExplainNow = App.examScoreMode !== "review";
  if (q.giai_thich && q.giai_thich.length && hasAnswered && allowExplainNow) {
    explainRow.classList.remove("hidden");
  } else {
    explainRow.classList.add("hidden");
  }

  // Áp lại ghi chú đã lưu trước đó cho câu này (nếu có) — vì innerHTML/options
  // vừa render mới xóa mất highlight cũ.
  applyExamNoteHighlights(document.getElementById("examQuestion"), App.currentExamId, qIndex);
  applyExamNoteHighlights(optsDiv, App.currentExamId, qIndex);
}

// Hiện/ẩn khu vực giải thích đáp án cho câu đang xem (cả live và review đều dùng được,
// vì đều cùng dựa vào App.examCurrentQuestion/QIndex đã lưu lúc render câu).
function toggleExamExplain() {
  const box = document.getElementById("examExplainBox");
  const isHidden = box.classList.contains("hidden");
  if (!isHidden) {
    box.classList.add("hidden");
    return;
  }

  const q = App.examCurrentQuestion;
  if (!q || !q.giai_thich) return;

  const optionIndices = q.options.map((_, i) => i); // hiện theo thứ tự gốc trong giải thích, không random
  const rows = optionIndices.map((optIdx) => {
    const isCorrect = optIdx === q.dap_an_dung;
    const explainText = q.giai_thich[optIdx] || "";
    return `
      <div class="exam-explain-item ${isCorrect ? "is-correct" : "is-wrong"}">
        <div class="exam-explain-item-head">
          <span class="exam-explain-mark">${isCorrect ? "✓" : "✕"}</span>
          <span class="exam-explain-opt-text">${q.options[optIdx]}</span>
        </div>
        <div class="exam-explain-item-body">${explainText}</div>
      </div>
    `;
  }).join("");

  box.innerHTML = rows;
  box.classList.remove("hidden");
  applyExamNoteHighlights(box, App.currentExamId, App.examCurrentQIndex);
}

// Sửa lại đáp án của 1 câu ĐÃ làm, khi đang quay lại xem qua nút "Câu trước/Câu
// sau" — CHỈ dùng cho chế độ chấm cuối bài (xem renderExamQuestionContent()).
// Không tô đúng/sai, không tự chuyển câu — chỉ cập nhật lựa chọn rồi để người
// học tự bấm điều hướng tiếp khi sẵn sàng, giống hệt cách làm bài thi giấy thật
// (sửa đáp án tự do, không có phản hồi gì cho tới lúc nộp bài).
function handleExamAnswerEditReview(btn, chosenIdx, qIndex, q) {
  const correct = chosenIdx === q.dap_an_dung;
  const hist = App.examHistory[qIndex];
  const wasCorrect = hist.firstTryCorrect;

  hist.attempts.push({ chosenIdx, correct, atMs: Date.now() });
  hist.firstTryCorrect = correct; // chấm cuối bài: đáp án MỚI NHẤT mới là đáp án chính thức để chấm

  // Điều chỉnh điểm + tập hợp examAnswered nếu đúng/sai có thay đổi so với trước
  if (wasCorrect !== correct) {
    if (correct) {
      App.examScore++;
      App.examAnswered.add(qIndex);
    } else {
      App.examScore--;
      App.examAnswered.delete(qIndex);
    }
    document.getElementById("examScore").textContent = App.examScore;
  }

  recordWeaknessResult("__exam__", `${App.currentExamId}::q${qIndex}`, correct, q.de_bai.slice(0, 60));

  // Chỉ cập nhật lại highlight ô đang chọn, không render lại toàn bộ (giữ nguyên
  // vị trí xem lại hiện tại, không tự nhảy đi đâu).
  document.querySelectorAll("#examOptions .quiz-opt").forEach((b) => b.classList.remove("was-chosen-neutral"));
  btn.classList.add("was-chosen-neutral");
}

// Trả về đúng class màu cho 1 đáp án ĐÚNG dựa theo có đánh dấu 🚩lụi/❓phân vân
// hay không khi làm câu đó — giống hệt logic bên đề nghe (choukai.js).
function getExamCorrectColorClass(qIndex) {
  if (App.examFlagged.has(qIndex)) return "is-correct-lucky";
  if (App.examUnsure.has(qIndex)) return "is-correct-unsure";
  return "correct";
}

function toggleExamFlag() {
  const qIndex = App.examCurrentQIndex;
  if (qIndex == null) return;
  if (App.examFlagged.has(qIndex)) App.examFlagged.delete(qIndex);
  else App.examFlagged.add(qIndex);
  document.getElementById("btnExamFlag").classList.toggle("is-active", App.examFlagged.has(qIndex));
}

function toggleExamUnsure() {
  const qIndex = App.examCurrentQIndex;
  if (qIndex == null) return;
  if (App.examUnsure.has(qIndex)) App.examUnsure.delete(qIndex);
  else App.examUnsure.add(qIndex);
  document.getElementById("btnExamUnsure").classList.toggle("is-active", App.examUnsure.has(qIndex));
}

function handleExamAnswer(btn, chosenIdx, qIndex, q) {
  if (App.examAnswering) return; // chặn double-click
  App.examAnswering = true;

  clearInterval(App.examPerQTimerHandle);

  const correct = chosenIdx === q.dap_an_dung;

  let secondsUsed = null;
  if (App.examSpeedMode && App.examPerQStartedAt) {
    secondsUsed = (Date.now() - App.examPerQStartedAt) / 1000;
    const isRetry = App.examAnswered.size > 0 && App.examHistory[qIndex] && App.examHistory[qIndex].attempts.length > 0;
    App.examQuestionTimeLog.push({ qIndex, seconds: secondsUsed, overTime: secondsUsed > 30, isRetry });
  }

  // Ghi vào lịch sử CHI TIẾT của câu này (mọi lượt trả lời, không chỉ lượt cuối)
  if (!App.examHistory[qIndex]) {
    App.examHistory[qIndex] = { attempts: [], firstTryCorrect: null, optionOrder: null };
  }
  const hist = App.examHistory[qIndex];
  hist.attempts.push({ chosenIdx, correct, atMs: Date.now() });
  if (hist.firstTryCorrect === null) {
    hist.firstTryCorrect = correct;
  }

  const examWeaknessKey = `${App.currentExamId}::q${qIndex}`;
  recordWeaknessResult("__exam__", examWeaknessKey, correct, q.de_bai.slice(0, 60));

  if (App.examScoreMode === "review") {
    // Chấm sửa cuối bài: KHÔNG tô đúng/sai, KHÔNG phát âm thanh, KHÔNG cho xem
    // giải thích ngay — chỉ ghi nhận lựa chọn rồi chuyển câu kế tiếp NGAY LẬP
    // TỨC, và mỗi câu chỉ đi qua đúng 1 lần theo thứ tự gốc (không đẩy lại câu
    // sai vào hàng đợi), vì mục đích là làm hết cả đề trước khi biết kết quả.
    document.querySelectorAll("#examOptions .quiz-opt").forEach((b) => b.classList.add("disabled"));
    btn.classList.add("was-chosen-neutral");
    App.examQueue.shift();
    if (correct && !App.examAnswered.has(qIndex)) {
      App.examScore++;
      App.examAnswered.add(qIndex);
      document.getElementById("examScore").textContent = App.examScore;
    }
    renderExamQuestion();
    return;
  }

  // Chấm ngay tại chỗ (instant): tô đúng/sai, phát âm thanh, hiện nút giải thích,
  // và KHÔNG tự động chuyển câu — chờ người học tự bấm "Tiếp tục →".
  document.querySelectorAll("#examOptions .quiz-opt").forEach((b) => b.classList.add("disabled"));
  btn.classList.add(correct ? getExamCorrectColorClass(qIndex) : "wrong");

  if (correct) {
    playCorrectSound();
  } else {
    playWrongSound();
    document.querySelectorAll("#examOptions .quiz-opt").forEach((b) => {
      if (b.textContent === q.options[q.dap_an_dung]) b.classList.add(getExamCorrectColorClass(qIndex));
    });
  }

  if (correct) {
    if (!App.examAnswered.has(qIndex)) {
      App.examScore++;
      App.examAnswered.add(qIndex);
      document.getElementById("examScore").textContent = App.examScore;
    }
  }
  // Lưu lại đúng/sai của lượt này để btnExamContinue biết phải làm gì khi bấm tiếp
  App.examLastAnswerCorrect = correct;
  App.examLastAnsweredQIndex = qIndex;

  if (q.giai_thich && q.giai_thich.length) {
    document.getElementById("examExplainRow").classList.remove("hidden");
  }
  document.getElementById("btnExamContinue").classList.remove("hidden");

  // Nếu câu này đã đánh dấu ❓ phân vân VÀ trả lời sai — hỏi thêm đáp án thứ 2
  // mà người học cũng đang lưỡng lự giữa 2 lựa chọn (không chỉ đáp án đã chọn).
  if (!correct && App.examUnsure.has(qIndex)) {
    showExamSecondGuessPicker(qIndex, q, chosenIdx);
  }
}

// UI hỏi "Bạn còn phân vân với đáp án nào khác?" — chỉ hiện khi câu đã đánh dấu
// ❓ và trả lời sai. Cho chọn 1 trong các đáp án CÒN LẠI (trừ đáp án vừa chọn)
// làm "lựa chọn thứ 2 đang lưỡng lự". Nếu lựa chọn thứ 2 đó ĐÚNG, tô riêng màu
// để biết là tuy chọn sai nhưng đáp án đúng đã nằm trong 2 phương án cân nhắc.
function showExamSecondGuessPicker(qIndex, q, firstChosenIdx) {
  const box = document.getElementById("examSecondGuessBox");
  const optsNow = document.querySelectorAll("#examOptions .quiz-opt");
  box.innerHTML = `<div class="exam-secondguess-label">🤔 Bạn còn phân vân với đáp án nào khác không?</div>
    <div class="exam-secondguess-opts" id="examSecondGuessOpts"></div>`;
  const wrap = document.getElementById("examSecondGuessOpts");
  q.options.forEach((opt, idx) => {
    if (idx === firstChosenIdx) return; // không cho chọn lại đáp án vừa chọn
    const b = document.createElement("button");
    b.className = "exam-secondguess-opt";
    b.textContent = opt;
    b.addEventListener("click", () => {
      const hist = App.examHistory[qIndex];
      hist.secondGuessIdx = idx;
      const isSecondCorrect = idx === q.dap_an_dung;
      wrap.querySelectorAll(".exam-secondguess-opt").forEach((x) => { x.disabled = true; });
      b.classList.add(isSecondCorrect ? "is-second-correct" : "is-second-wrong");
      // Tô luôn đáp án đó trong khung trả lời chính để dễ đối chiếu
      optsNow.forEach((o) => { if (o.textContent === opt) o.classList.add(isSecondCorrect ? "is-second-correct-ring" : "is-second-wrong-ring"); });
    });
    wrap.appendChild(b);
  });
  box.classList.remove("hidden");
}

// Bấm "Tiếp tục →" sau khi đã chấm ngay 1 câu (chế độ instant) — đây là lúc
// thật sự đẩy câu sai về cuối hàng đợi và chuyển sang câu kế tiếp.
function examContinueAfterInstantAnswer() {
  document.getElementById("btnExamContinue").classList.add("hidden");
  document.getElementById("examExplainBox").classList.add("hidden");
  document.getElementById("examExplainRow").classList.add("hidden");

  const qIndex = App.examLastAnsweredQIndex;
  App.examQueue.shift();
  if (!App.examLastAnswerCorrect) {
    App.examQueue.push(qIndex);
  }
  renderExamQuestion();
}

// ----- Điều hướng xem lại câu trước / câu sau -----
// QUAN TRỌNG: examSeenOrder[length-1] LUÔN là vị trí của câu "live" hiện tại
// (được push vào ngay khi câu đó trở thành câu đang chờ trả lời, xem renderExamQuestion()).
// Mọi vị trí TRƯỚC đó chắc chắn đã có lịch sử trả lời (vì phải trả lời xong mới
// qua câu kế). Vì vậy điều hướng KHÔNG được bao giờ gọi showExamReviewAt() cho
// chính vị trí live đó — phải luôn quay lại qua backToLiveExamQuestion() để câu
// đó được render đúng ở trạng thái "live" (có thể bấm chọn được), không phải
// trạng thái "xem lại" (vốn chỉ dành cho câu ĐÃ có lịch sử).
function examGoPrev() {
  // Không có câu nào để xem lại trước vị trí live hiện tại
  if (App.examSeenOrder.length <= 1) return;
  if (App.examNavPos === -1) {
    // Đang ở câu live -> lùi về câu liền trước (bỏ qua chính vị trí live ở cuối)
    App.examNavPos = App.examSeenOrder.length - 2;
  } else {
    App.examNavPos = Math.max(0, App.examNavPos - 1);
  }
  showExamReviewAt(App.examNavPos);
}

function examGoNext() {
  if (App.examNavPos === -1) return; // đã ở câu live, không có gì để "tiến" thêm
  const nextPos = App.examNavPos + 1;
  // Trước đây dùng "navPos >= length-1" để quyết định quay về live, nhưng kiểm
  // tra đó chạy SAU KHI đã tăng navPos, nên lần bấm đầu tiên từ vị trí length-2
  // sẽ tăng lên đúng length-1 (vị trí live) rồi mới showExamReviewAt() cho vị trí
  // ĐÓ — hiện sai vì câu live chưa có lịch sử trả lời, nút bấm rơi vào trạng thái
  // vừa không bị khóa vừa không gắn sự kiện click (không disabled, không listener)
  // — phải bấm "Câu sau" THÊM 1 LẦN NỮA mới thực sự về lại được câu live qua
  // nhánh backToLiveExamQuestion(). Sửa: kiểm tra TRƯỚC khi tăng, nếu vị trí kế
  // tiếp sẽ là vị trí live (length-1) thì đi thẳng về live ngay từ lần bấm đầu.
  if (nextPos >= App.examSeenOrder.length - 1) {
    backToLiveExamQuestion();
    return;
  }
  App.examNavPos = nextPos;
  showExamReviewAt(App.examNavPos);
}

function showExamReviewAt(pos) {
  const qIndex = App.examSeenOrder[pos];
  if (qIndex === undefined) return;
  const exam = App.exams.find((e) => e.id === App.currentExamId);
  const q = exam.questions[qIndex];

  App.examReviewMode = true;
  clearInterval(App.examPerQTimerHandle);
  document.getElementById("examPerQuestionTimerWrap").classList.add("hidden");
  document.getElementById("examReviewBanner").classList.remove("hidden");
  // Hiện đúng số thứ tự GỐC của câu (qIndex+1), không phải vị trí trong lịch sử
  // đã-từng-thấy (pos+1) — 2 con số này có thể khác nhau khi đã có câu làm lại.
  document.getElementById("examPos").textContent = qIndex + 1;

  renderExamQuestionContent(q, qIndex, false);
}

function backToLiveExamQuestion() {
  App.examReviewMode = false;
  App.examNavPos = -1;
  document.getElementById("examReviewBanner").classList.add("hidden");

  if (App.examQueue.length === 0) {
    finishExam();
    return;
  }
  const exam = App.exams.find((e) => e.id === App.currentExamId);
  const qIndex = App.examQueue[0];
  const q = exam.questions[qIndex];
  document.getElementById("examPos").textContent = qIndex + 1;
  renderExamQuestionContent(q, qIndex, true);
  startExamPerQuestionTimer();
}

// "Thoát & xem kết quả" (chỉ chế độ chấm ngay) — Zane bấm khi lười làm lại hết
// các câu sai còn đang nằm trong hàng đợi retry. Dừng ngay, chấm điểm với những
// gì đã làm được, các câu CHƯA TỪNG làm sẽ hiện riêng biệt là "chưa làm" (không
// tính là sai) trong lưới kết quả — finishExam() vẫn dùng được nguyên vì nó
// không phụ thuộc việc hàng đợi đã rỗng hay chưa.
function exitExamEarlyAndShowResult() {
  App.examQueue = [];
  finishExam();
}

function finishExam() {
  clearInterval(App.examPerQTimerHandle);
  clearInterval(App.examTotalTimerHandle);

  if (!App.examFirstPassDone) {
    App.examFirstPassDone = true;
    App.examFirstPassEndTime = Date.now();
  }

  document.getElementById("examBody").classList.add("hidden");
  document.getElementById("examResult").classList.remove("hidden");

  document.getElementById("examFinalScore").textContent =
    `${App.examScore}/${App.examOriginalTotal} điểm`;

  // Điểm mô phỏng JLPT (Linear + IRT) — chỉ tính được khi đề có field mondai_breakdown
  // (đã thêm cho mọi đề thi thật hiện có; đề nào THIẾU field này thì bỏ qua, không lỗi).
  const jlptScoring = computeExamJlptScoring(App.currentExamId, App.examHistory);
  document.getElementById("examJlptScoreBox").innerHTML = renderJlptScoreBox(jlptScoring, "Từ vựng - Ngữ pháp");

  // Lưu vào lịch sử lâu dài (riêng biệt khỏi state phiên hiện tại, không mất khi rời trang)
  const totalSeconds = App.examTotalStartTime ? (Date.now() - App.examTotalStartTime) / 1000 : 0;
  const firstTryWrongCount = Object.values(App.examHistory).filter((h) => h.firstTryCorrect === false).length;
  recordExamCompletion(App.currentExamId, {
    score: App.examScore,
    total: App.examOriginalTotal,
    seconds: totalSeconds,
    firstTryWrongCount,
  });
  // Lưu thành 1 LẦN LÀM MỚI (không ghi đè) vào lịch sử nhiều lần — phục vụ lưới
  // kết quả "Lần 1/Lần 2/Lần 3..." ở trang Thống kê. Đặt NGAY TẠI ĐÂY (chỉ chạy
  // khi finishExam() thực thi, tức đề đã hoàn thành hẳn) — làm dở dang bỏ ngang
  // (rời trang, đổi đề giữa chừng) sẽ KHÔNG bao giờ gọi tới hàm này.
  // QUAN TRỌNG: phải gọi TRƯỚC saveExamDetailSnapshot() ở dưới — xem giải thích
  // chi tiết tại đoạn tương tự trong choukai.js (finishChoukai), lý do giống nhau:
  // tránh đoạn migrate dữ liệu cũ đọc nhầm snapshot VỪA ghi thành "dữ liệu cũ".
  recordExamAttempt(App.currentExamId);
  // Lưu chi tiết từng câu (đáp án đã chọn, đúng/sai) để xem lại lưới kết quả +
  // popup giải thích sau này, kể cả sau khi tải lại trang hoặc nhập tiến độ từ máy khác.
  saveExamDetailSnapshot(App.currentExamId, App.examHistory);

  if (App.examSpeedMode) {
    if (App.examScoreMode === "instant") {
      renderExamTimeSummary();
    } else {
      // Chấm cuối bài: KHÔNG có khái niệm "lượt đầu / sửa lại câu sai" — mỗi câu
      // chỉ đi qua đúng 1 lần theo thứ tự gốc, không có vòng làm lại nào cả. Trước
      // đây vẫn gọi renderExamTimeSummary() ở đây nên hiện nhầm cả khối "Mốc 2 —
      // Sửa lại câu sai" dù chế độ này không hề có pha sửa lại nào. Giờ chỉ hiện
      // tổng thời gian làm bài đơn giản.
      document.getElementById("examTimeSummary").innerHTML = `
        <div class="exam-time-summary-block">
          <div class="exam-time-summary-title">Thời gian làm bài</div>
          <div class="exam-time-stats-row">
            <div class="exam-speed-stat"><div class="exam-speed-stat-num">${fmtTime(totalSeconds)}</div><div class="exam-speed-stat-label">tổng thời gian</div></div>
          </div>
        </div>
      `;
    }
    renderExamSpeedSummary();
  } else {
    document.getElementById("examTimeSummary").innerHTML = "";
    document.getElementById("examSpeedSummary").classList.add("hidden");
  }

  renderExamResultGrid();
}

// Lưới kết quả dạng ô tròn nhỏ — mỗi ô là 1 câu, xanh/đỏ = đúng/sai, bấm vào để
// xem chi tiết qua popup (đề bài, đáp án đã chọn, đáp án đúng, giải thích).
// Dùng chung cho cả 2 chế độ chấm (instant/review) — không cần phân biệt UI khác.
function renderExamResultGrid() {
  const exam = App.exams.find((e) => e.id === App.currentExamId);
  const grid = document.getElementById("examResultGrid");

  // 3 trạng thái: đúng / sai / CHƯA LÀM (chưa có lượt nào — quan trọng từ khi có
  // nút "Thoát & xem kết quả", vì giờ hoàn toàn có thể có câu chưa từng được làm).
  const cells = exam.questions.map((q, qIndex) => {
    const hist = App.examHistory[qIndex];
    let stateClass = "is-not-done";
    if (hist && hist.attempts.length) {
      stateClass = hist.firstTryCorrect ? getExamCorrectColorClass(qIndex) : "is-wrong";
      if (stateClass === "correct") stateClass = "is-correct";
    }
    const tag = (App.examFlagged.has(qIndex) ? "🚩" : "") + (App.examUnsure.has(qIndex) ? "❓" : "")
      + (hist && hist.secondGuessIdx === q.dap_an_dung ? "🤔" : "");
    return `<button class="exam-result-dot ${stateClass}" data-qindex="${qIndex}">${qIndex + 1}${tag ? `<span class="exam-result-dot-tag">${tag}</span>` : ""}</button>`;
  }).join("");

  grid.innerHTML = cells;

  grid.querySelectorAll(".exam-result-dot").forEach((dot) => {
    dot.addEventListener("click", () => openExamDetailModal(parseInt(dot.dataset.qindex, 10)));
  });
}

// Popup chi tiết 1 câu: đề bài, đáp án đã chọn (lần đầu), đáp án đúng, giải thích
// ngắn gọn cho TỪNG đáp án (không chỉ đáp án đúng/sai đã chọn).
// opts.examId / opts.examHistory (tùy chọn): dùng khi mở popup từ NGOÀI session
// đang làm đề hiện tại (ví dụ từ tab "Đề thi" ở trang Điểm yếu) — tránh phải
// ghi đè App.currentExamId / App.examHistory toàn cục, có thể phá dữ liệu của
// 1 đề khác đang làm giữa chừng.
function openExamDetailModal(qIndex, opts) {
  const examId = (opts && opts.examId) || App.currentExamId;
  const historySource = (opts && opts.examHistory) || App.examHistory;
  const exam = App.exams.find((e) => e.id === examId);
  const q = exam.questions[qIndex];
  const hist = historySource[qIndex];
  const firstAttempt = hist ? hist.attempts[0] : null;
  const chosenIdx = firstAttempt ? firstAttempt.chosenIdx : null;
  const correct = firstAttempt ? firstAttempt.correct : false;
  const notDone = !firstAttempt;

  document.getElementById("examDetailModalTitle").textContent = notDone
    ? `Câu ${qIndex + 1} — Chưa làm`
    : `Câu ${qIndex + 1} — ${correct ? "✓ Đúng" : "✕ Sai"}`;

  const optionsHtml = q.options.map((opt, idx) => {
    const isCorrectAnswer = idx === q.dap_an_dung;
    const isChosen = idx === chosenIdx;
    const explainText = (q.giai_thich && q.giai_thich[idx]) || "";
    const tags = [];
    if (isCorrectAnswer) tags.push('<span class="exam-detail-tag is-correct-tag">Đáp án đúng</span>');
    if (isChosen && !isCorrectAnswer) tags.push('<span class="exam-detail-tag is-chosen-tag">Bạn đã chọn</span>');
    if (isChosen && isCorrectAnswer) tags.push('<span class="exam-detail-tag is-chosen-tag">Bạn đã chọn</span>');
    return `
      <div class="exam-detail-opt ${isCorrectAnswer ? "is-correct" : ""} ${isChosen && !isCorrectAnswer ? "is-wrong-chosen" : ""}">
        <div class="exam-detail-opt-head">
          <span class="exam-detail-opt-text">${opt}</span>
          ${tags.join("")}
        </div>
        ${explainText ? `<div class="exam-detail-opt-explain">${explainText}</div>` : ""}
      </div>
    `;
  }).join("");

  document.getElementById("examDetailModalBody").innerHTML = `
    <div class="exam-detail-question">${q.de_bai}</div>
    <div class="exam-detail-opts">${optionsHtml}</div>
  `;

  document.getElementById("examDetailModalOverlay").classList.remove("hidden");
}

function closeExamDetailModal() {
  document.getElementById("examDetailModalOverlay").classList.add("hidden");
}

/* ===================================================================
   CHOUKAI MODE — Luyện nghe (聴解) theo đề thật, theo từng Mondai 1-5.
   Tái dùng nhiều pattern từ EXAM MODE (mode chấm ngay/cuối bài, lưu chi
   tiết từng câu, lưới kết quả, modal chi tiết, ghi điểm yếu) nhưng đây là
   1 hệ thống RIÊNG vì câu hỏi gắn với audio + script/dịch/mẹo thay vì
   4 lựa chọn giải thích từng đáp án như exam mode.
=================================================================== */

const CHOUKAI_HISTORY_KEY = "n2vocab_choukai_history";          // điểm tổng từng đề (giống EXAM_HISTORY_STORAGE_KEY)
const CHOUKAI_DETAIL_HISTORY_KEY = "n2vocab_choukai_detail_history"; // chi tiết từng câu lần làm gần nhất

function renderExamTimeSummary() {
  const wrap = document.getElementById("examTimeSummary");
  if (!App.examTotalStartTime || !App.examFirstPassEndTime) {
    wrap.innerHTML = "";
    return;
  }

  const firstPassSec = (App.examFirstPassEndTime - App.examTotalStartTime) / 1000;
  const firstPassCorrect = Object.values(App.examHistory).filter((h) => h.firstTryCorrect === true).length;
  const firstPassWrong = Object.values(App.examHistory).filter((h) => h.firstTryCorrect === false).length;

  let retrySecLabel = "—";
  if (App.examRetryStartTime) {
    const retrySec = (Date.now() - App.examRetryStartTime) / 1000;
    retrySecLabel = fmtTime(retrySec);
  } else {
    retrySecLabel = "0 giây (không có câu sai)";
  }

  wrap.innerHTML = `
    <div class="exam-time-summary-block">
      <div class="exam-time-summary-title">Mốc 1 — Lượt đầu (${App.examOriginalTotal} câu theo thứ tự gốc)</div>
      <div class="exam-time-stats-row">
        <div class="exam-speed-stat"><div class="exam-speed-stat-num">${fmtTime(firstPassSec)}</div><div class="exam-speed-stat-label">thời gian</div></div>
        <div class="exam-speed-stat"><div class="exam-speed-stat-num" style="color:var(--good)">${firstPassCorrect}</div><div class="exam-speed-stat-label">đúng ngay lần 1</div></div>
        <div class="exam-speed-stat ${firstPassWrong > 0 ? "is-warning" : ""}"><div class="exam-speed-stat-num">${firstPassWrong}</div><div class="exam-speed-stat-label">sai lần 1</div></div>
      </div>
    </div>
    <div class="exam-time-summary-block">
      <div class="exam-time-summary-title">Mốc 2 — Sửa lại câu sai</div>
      <div class="exam-time-stats-row">
        <div class="exam-speed-stat"><div class="exam-speed-stat-num">${retrySecLabel}</div><div class="exam-speed-stat-label">thời gian sửa lại</div></div>
      </div>
    </div>
  `;
}

function renderExamSpeedSummary() {
  const summaryDiv = document.getElementById("examSpeedSummary");
  if (!App.examSpeedMode || App.examQuestionTimeLog.length === 0) {
    summaryDiv.classList.add("hidden");
    summaryDiv.innerHTML = "";
    return;
  }

  const totalSec = App.examQuestionTimeLog.reduce((sum, e) => sum + e.seconds, 0);
  const avgSec = totalSec / App.examQuestionTimeLog.length;
  const overTimeCount = App.examQuestionTimeLog.filter((e) => e.overTime).length;

  summaryDiv.classList.remove("hidden");
  summaryDiv.innerHTML = `
    <div class="exam-speed-summary-title">⚡ Kết quả luyện tốc độ (mọi lượt trả lời, kể cả làm lại)</div>
    <div class="exam-speed-stats-row">
      <div class="exam-speed-stat"><div class="exam-speed-stat-num">${fmtTime(totalSec)}</div><div class="exam-speed-stat-label">tổng thời gian trả lời</div></div>
      <div class="exam-speed-stat"><div class="exam-speed-stat-num">${avgSec.toFixed(1)}s</div><div class="exam-speed-stat-label">trung bình/lượt</div></div>
      <div class="exam-speed-stat ${overTimeCount > 0 ? "is-warning" : ""}"><div class="exam-speed-stat-num">${overTimeCount}</div><div class="exam-speed-stat-label">lượt quá 30s</div></div>
    </div>
  `;
}

// Liệt kê chi tiết câu nào sai ở lần 1, câu nào sai nhiều lần — theo đúng yêu cầu
// "câu nào sai ở lần 1 và câu nào sai nhiều lần cho biết luôn".
// (Đã thay bằng renderExamResultGrid() — xem định nghĩa gần finishExam())

function restartCurrentExam() {
  if (App.currentExamId) openExamModeModal(App.currentExamId);
}
