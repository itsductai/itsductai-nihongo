/* ===== MODULE: config-focus.js — Focus mode (phóng to toàn màn hình) + các config lưu localStorage (field/sound/speech/shuffle/patch/star) ===== */

/* ---------- Focus mode: phóng to toàn màn hình, ẩn sidebar + điều khiển thừa ---------- */

function enterFocusMode() {
  // Riêng exam: nếu chưa chọn đề thi (sidebar ẩn sẽ không bấm lại được dropdown chọn đề),
  // không cho vào focus mode, nhắc người dùng chọn đề trước.
  const examView = document.getElementById("view-exam");
  const isExamViewActive = examView && !examView.classList.contains("hidden");
  if (isExamViewActive && !App.currentExamId) {
    alert("Hãy chọn một đề thi ở sidebar trước khi phóng to toàn màn hình.");
    return;
  }
  // Riêng phần nghe: tương tự, cần đã chọn đề nghe trước.
  const choukaiView = document.getElementById("view-choukai");
  const isChoukaiViewActive = choukaiView && !choukaiView.classList.contains("hidden");
  if (isChoukaiViewActive && !App.currentChoukaiId) {
    alert("Hãy chọn một đề nghe ở trên trước khi phóng to toàn màn hình.");
    return;
  }
  // Riêng "Luyện nghe câu" (shadow mode): cần đã chọn đề + câu cụ thể trước.
  const shadowView = document.getElementById("view-choukai-shadow");
  const isShadowViewActive = shadowView && !shadowView.classList.contains("hidden");
  if (isShadowViewActive && document.getElementById("choukaiShadowBody").classList.contains("hidden")) {
    alert("Hãy chọn đề nghe + câu cụ thể ở trên trước khi phóng to toàn màn hình.");
    return;
  }
  document.getElementById("app").classList.add("focus-mode");
  document.getElementById("btnExitFocus").classList.remove("hidden");

  // Bật Fullscreen API THẬT của trình duyệt — che luôn cả thanh tab/địa chỉ trên
  // PC/laptop, không chỉ phóng to trong trang. Một số trình duyệt/khung nhúng
  // (vd iframe không có allow="fullscreen") sẽ TỪ CHỐI lời gọi này — bắt lỗi để
  // app vẫn hoạt động bình thường ở chế độ "phóng to trong trang" (CSS) như cũ,
  // không bị crash hay kẹt màn hình.
  const el = document.documentElement;
  const req = el.requestFullscreen || el.webkitRequestFullscreen || el.msRequestFullscreen;
  if (req) {
    try {
      const p = req.call(el);
      if (p && p.catch) p.catch(function () { /* trình duyệt từ chối — vẫn giữ focus-mode CSS, không sao */ });
    } catch (e) { /* bỏ qua, giữ nguyên chế độ phóng to bằng CSS */ }
  }
}

function exitFocusMode() {
  document.getElementById("app").classList.remove("focus-mode");
  document.getElementById("btnExitFocus").classList.add("hidden");

  // Thoát Fullscreen API thật nếu đang ở fullscreen do app bật (không gọi nếu
  // không phải app bật, để không ảnh hưởng fullscreen của trang khác/người dùng
  // tự bật F11 riêng).
  const isInFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
  if (isInFullscreen) {
    const exit = document.exitFullscreen || document.webkitExitFullscreen || document.msExitFullscreen;
    if (exit) {
      try {
        const p = exit.call(document);
        if (p && p.catch) p.catch(function () { /* bỏ qua */ });
      } catch (e) { /* bỏ qua */ }
    }
  }
}

function loadFieldConfig() {
  try {
    const raw = localStorage.getItem("n2vocab_fieldconfig");
    if (raw) {
      const parsed = JSON.parse(raw);
      Object.assign(App.fieldConfig, parsed);
    }
  } catch (e) { /* ignore */ }
  try {
    const raw2 = localStorage.getItem("n2vocab_colconfig");
    if (raw2) {
      const parsed2 = JSON.parse(raw2);
      Object.assign(App.visibleCols, parsed2);
    }
  } catch (e) { /* ignore */ }
  try {
    const raw3 = localStorage.getItem("n2vocab_peekcols");
    if (raw3) {
      const parsed3 = JSON.parse(raw3);
      Object.assign(App.peekCols, parsed3);
    }
  } catch (e) { /* ignore */ }
  try {
    const raw4 = localStorage.getItem("n2vocab_sound_enabled");
    if (raw4 !== null) App.soundEnabled = raw4 === "true";
  } catch (e) { /* ignore */ }
  try {
    const raw5 = localStorage.getItem("n2vocab_speech_enabled");
    if (raw5 !== null) App.speechEnabled = raw5 === "true";
  } catch (e) { /* ignore */ }
}

function saveSoundConfig() {
  localStorage.setItem("n2vocab_sound_enabled", String(App.soundEnabled));
}

function saveSpeechConfig() {
  localStorage.setItem("n2vocab_speech_enabled", String(App.speechEnabled));
}

function loadShuffleConfig() {
  try {
    const raw = localStorage.getItem("n2vocab_shuffle_enabled");
    if (raw) Object.assign(App.shuffleEnabled, JSON.parse(raw));
  } catch (e) { /* ignore */ }
}

function saveShuffleConfig() {
  localStorage.setItem("n2vocab_shuffle_enabled", JSON.stringify(App.shuffleEnabled));
}

function saveFieldConfig() {
  localStorage.setItem("n2vocab_fieldconfig", JSON.stringify(App.fieldConfig));
}

function saveColConfig() {
  localStorage.setItem("n2vocab_colconfig", JSON.stringify(App.visibleCols));
}

/* ---------- Patch sửa tạm: lưu các chỉnh sửa từ vựng/ngữ pháp, áp đè lên dữ liệu gốc ---------- */

function loadEditPatches() {
  try {
    const raw = localStorage.getItem("n2vocab_editpatches");
    if (raw) App.editPatches = JSON.parse(raw);
  } catch (e) { App.editPatches = {}; }
}

function saveEditPatches() {
  localStorage.setItem("n2vocab_editpatches", JSON.stringify(App.editPatches));
}

// Áp các patch đã lưu lên 1 danh sách words (gọi ngay sau khi load deck từ file JSON gốc)
function applyPatchesToWords(deckId, words) {
  const patchesForDeck = App.editPatches[deckId];
  if (!patchesForDeck) return words;
  return words.map((w) => {
    const patch = patchesForDeck[w._id];
    return patch ? { ...w, ...patch } : w;
  });
}

// Lưu 1 sửa tạm cho 1 từ cụ thể trong 1 bộ, rồi áp dụng ngay vào App.currentWords đang hiển thị
function saveWordEdit(deckId, wordId_, changedFields) {
  if (!App.editPatches[deckId]) App.editPatches[deckId] = {};
  App.editPatches[deckId][wordId_] = { ...App.editPatches[deckId][wordId_], ...changedFields };
  saveEditPatches();

  // Áp ngay vào dữ liệu đang dùng trong session, không cần tải lại trang
  const deck = App.decks.find((d) => d.id === deckId);
  if (deck) {
    deck.words = deck.words.map((w) => (w._id === wordId_ ? { ...w, ...changedFields } : w));
    if (App.currentDeckId === deckId) {
      App.currentWords = deck.words;
    }
  }
}

function clearAllEditPatches() {
  App.editPatches = {};
  localStorage.removeItem("n2vocab_editpatches");
}

/* ---------- Đánh dấu sao (kiểu Quizlet): { [deckId]: [itemId, ...] } ---------- */

function loadStarredItems() {
  try {
    const raw = localStorage.getItem("n2vocab_starred");
    App.starredItems = raw ? JSON.parse(raw) : {};
  } catch (e) {
    App.starredItems = {};
  }
}

function saveStarredItems() {
  localStorage.setItem("n2vocab_starred", JSON.stringify(App.starredItems));
}

function isStarred(deckId, itemId) {
  return !!(App.starredItems[deckId] && App.starredItems[deckId].includes(itemId));
}

function toggleStar(deckId, itemId) {
  if (!App.starredItems[deckId]) App.starredItems[deckId] = [];
  const list = App.starredItems[deckId];
  const idx = list.indexOf(itemId);
  if (idx === -1) {
    list.push(itemId);
  } else {
    list.splice(idx, 1);
  }
  saveStarredItems();
}

function getStarredIdsForDeck(deckId) {
  return App.starredItems[deckId] || [];
}


function savePeekConfig() {
  localStorage.setItem("n2vocab_peekcols", JSON.stringify(App.peekCols));
}

