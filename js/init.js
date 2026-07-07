/* ===== MODULE: init.js — Gắn toàn bộ event listener và khởi động app khi load trang (chạy SAU CÙNG, sau khi mọi module khác đã load) ===== */

/* ===================================================================
   INIT — gắn toàn bộ event listener và khởi động app khi load trang
=================================================================== */

// Tự dừng audio luyện nghe khi người dùng chuyển sang TAB TRÌNH DUYỆT khác
// (không chỉ chuyển chức năng trong app) — đúng yêu cầu "tự tắt nếu không còn
// ở tab luyện nghe".
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    const el = document.getElementById("choukaiAudioEl");
    if (el && !el.paused) el.pause();
    const elShadow = document.getElementById("choukaiShadowAudioEl");
    if (elShadow && !elShadow.paused) elShadow.pause();
  }
});

// Đếm ngược tới ngày thi JLPT N2 (đọc data-exam-date trên #examCountdown).
// Thanh tiến độ lấy mốc 90 ngày trước ngày thi làm điểm bắt đầu để tạo cảm giác
// "kim đồng hồ đang chạy" — càng gần ngày thi thanh càng đầy.
// Tính tổng số từ/cấu trúc ĐẾN HẠN ÔN (SRS due) cộng dồn qua TẤT CẢ bộ, tách
// riêng theo type — hiện ở widget "Cần ôn tổng hợp" trong sidebar. Chỉ đếm
// (không load hết words vào bộ nhớ nặng nề) — mỗi entry đã lưu sẵn trong
// localStorage theo từng deck, duyệt qua "seen && isDue" là đủ.
function computeDueCounts() {
  let tuvung = 0, nguphap = 0;
  App.decks.forEach((deck) => {
    const progress = SRS.loadProgress(deck.id);
    const dueInDeck = deck.words.filter((w) => {
      const entry = progress[w._id];
      return entry && entry.seen && SRS.isDue(entry);
    }).length;
    if (deck.type === "NGUPHAP") nguphap += dueInDeck;
    else tuvung += dueInDeck;
  });
  return { tuvung, nguphap };
}

function renderDueReviewWidget() {
  const { tuvung, nguphap } = computeDueCounts();
  document.getElementById("dueReviewTuvungCount").textContent = tuvung;
  document.getElementById("dueReviewNguphapCount").textContent = nguphap;
  document.getElementById("btnDueReviewTuvung").classList.toggle("has-due", tuvung > 0);
  document.getElementById("btnDueReviewNguphap").classList.toggle("has-due", nguphap > 0);
}

// Bấm 1 phát "Cần ôn tổng hợp" — gộp TẤT CẢ bộ cùng loại (đang có ít nhất 1 từ
// đến hạn hoặc không, gộp hết cho đơn giản — bộ không có gì đến hạn thì cũng
// không góp thêm từ nào vào hàng đợi) rồi vào ôn ngay, dueOnly=true.
function startDueReviewCombo(type) {
  const deckIds = App.decks.filter((d) => d.type === type).map((d) => d.id);
  if (!deckIds.length) return;
  startComboSrs(deckIds, true);
}

function initExamCountdown() {
  const el = document.getElementById("examCountdown");
  if (!el) return;
  const examDate = new Date((el.dataset.examDate || "2026-07-05") + "T00:00:00");
  const RUNWAY_DAYS = 90;

  function render() {
    const now = new Date();
    const msPerDay = 24 * 60 * 60 * 1000;
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const days = Math.round((examDate - startOfToday) / msPerDay);
    const daysEl = document.getElementById("examCountdownDays");
    const dateEl = document.getElementById("examCountdownDate");
    const fill = document.getElementById("examCountdownBarFill");

    el.classList.remove("is-urgent", "is-today", "is-past");
    if (days > 0) {
      daysEl.textContent = days;
      dateEl.textContent = "05/07 · がんばって！";
      if (days <= 7) el.classList.add("is-urgent");
    } else if (days === 0) {
      daysEl.textContent = "0";
      dateEl.textContent = "Hôm nay thi — 頑張れ！💪";
      el.classList.add("is-today");
    } else {
      daysEl.textContent = "✓";
      dateEl.textContent = "Đã thi xong — お疲れ様！";
      el.classList.add("is-past");
    }
    if (fill) {
      const pct = Math.max(0, Math.min(100, ((RUNWAY_DAYS - days) / RUNWAY_DAYS) * 100));
      fill.style.width = pct + "%";
    }
  }
  render();
  // Cập nhật lại lúc nửa đêm (hoặc khi tab được mở lại lâu) — không cần chính xác từng giây.
  setInterval(render, 60 * 1000);
}

document.addEventListener("DOMContentLoaded", async () => {
  loadFieldConfig();
  loadEditPatches();
  loadStarredItems();
  loadShuffleConfig();
  ensureVoicesLoaded();
  initExamCountdown();
  renderDueReviewWidget();
  document.querySelectorAll(".dash-chart-tab").forEach((btn) => {
    btn.addEventListener("click", () => setDashboardChartMode(btn.dataset.chartMode));
  });
  document.getElementById("btnDueReviewTuvung").addEventListener("click", () => startDueReviewCombo("TUVUNG"));
  document.getElementById("btnDueReviewNguphap").addEventListener("click", () => startDueReviewCombo("NGUPHAP"));

  App.decks = await loadDecks();
  buildGrammarIndex();
  await loadGrammarGroups();
  App.exams = await loadExams();
  App.choukaiTests = await loadChoukaiTests();

  if (App.decks.length === 0) {
    document.getElementById("deckName").textContent = "Không tải được bộ học nào";
    return;
  }

  populateDeckPicker();
  populateExamPicker();

  // ----- Focus mode (phóng to toàn màn hình) -----
  document.querySelectorAll(".focus-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", enterFocusMode);
  });
  document.getElementById("btnExitFocus").addEventListener("click", exitFocusMode);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.getElementById("app").classList.contains("focus-mode")) {
      exitFocusMode();
    }
  });
  // Trình duyệt có thể tự thoát fullscreen (Esc, F11, vuốt xuống trên Mac...)
  // mà KHÔNG đi qua nút X của app — lắng nghe sự kiện này để ẩn lại sidebar-hidden
  // CSS đúng lúc, tránh app bị kẹt ở trạng thái "tưởng đang focus nhưng đã thoát
  // fullscreen thật rồi".
  ["fullscreenchange", "webkitfullscreenchange", "msfullscreenchange"].forEach((evt) => {
    document.addEventListener(evt, () => {
      const stillFullscreen = document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement;
      if (!stillFullscreen && document.getElementById("app").classList.contains("focus-mode")) {
        exitFocusMode();
      }
    });
  });

  // "Unlock" speechSynthesis trên iOS: phải gọi speak() ít nhất 1 lần ngay trong
  // user-gesture đầu tiên (bất kỳ tap nào trên trang), nếu không các lệnh speak()
  // gọi sau đó (kể cả trong gesture khác) có thể bị im lặng không phát ra tiếng.
  // Dùng utterance với volume=0 để không phát tiếng thật, chỉ "mở khóa" engine.
  let speechUnlocked = false;
  function unlockSpeechOnce() {
    if (speechUnlocked || !("speechSynthesis" in window)) return;
    speechUnlocked = true;
    try {
      const unlockUtter = new SpeechSynthesisUtterance(" ");
      unlockUtter.volume = 0;
      window.speechSynthesis.speak(unlockUtter);
    } catch (e) { /* ignore */ }
    document.removeEventListener("touchstart", unlockSpeechOnce);
    document.removeEventListener("click", unlockSpeechOnce);
  }
  document.addEventListener("touchstart", unlockSpeechOnce, { once: true });
  document.addEventListener("click", unlockSpeechOnce, { once: true });


  // ----- Panel Cài đặt (deck picker + xuất/nhập) trong navbar mới -----
  document.getElementById("btnNavbarSettings").addEventListener("click", (e) => {
    e.stopPropagation();
    document.getElementById("navbarSettingsPanel").classList.toggle("hidden");
  });
  document.addEventListener("click", (e) => {
    const panel = document.getElementById("navbarSettingsPanel");
    if (!panel.classList.contains("hidden") && !panel.contains(e.target) && e.target.id !== "btnNavbarSettings") {
      panel.classList.add("hidden");
    }
  });

  // ----- Từ điển nội bộ (search toàn bộ deck) -----
  document.getElementById("globalSearchInput").addEventListener("input", (e) => {
    performGlobalSearch(e.target.value);
  });
  document.addEventListener("click", (e) => {
    if (!e.target.closest(".navbar-search-wrap")) {
      document.getElementById("globalSearchResults").classList.add("hidden");
    }
  });

  // ----- Flashcard mode -----
  document.getElementById("flashCard").addEventListener("click", () => {
    flipFlashCard();
  });
  document.getElementById("btnFlip").addEventListener("click", (e) => {
    e.stopPropagation();
    flipFlashCard();
  });
  document.querySelectorAll("#flashRateRow [data-flash-result]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      // Kích hoạt sparkle bằng class do JS thêm/xóa — KHÔNG dùng :active vì
      // :active biến mất ngay khi thả tay/chuột, cắt đứt animation 0.6s giữa
      // chừng theo đúng cơ chế CSS (animation revert về none khi rule hết áp dụng).
      if (btn.dataset.flashResult === "remembered") {
        btn.classList.remove("is-sparkling");
        void btn.offsetWidth; // ép reflow để animation restart được nếu bấm liên tiếp nhanh
        btn.classList.add("is-sparkling");
        setTimeout(() => btn.classList.remove("is-sparkling"), 650);
      }
      flashMarkResult(btn.dataset.flashResult);
    });
  });
  document.getElementById("btnFieldConfig").addEventListener("click", () => {
    document.getElementById("fieldConfigPanel").classList.toggle("is-open");
  });
  document.getElementById("btnSrsFieldConfig").addEventListener("click", () => {
    document.getElementById("fieldConfigPanel").classList.toggle("is-open");
  });
  document.getElementById("btnEditCurrentFlash").addEventListener("click", (e) => {
    e.stopPropagation();
    const w = getCurrentFlashWord();
    if (w) openEditModal(w._id);
  });
  document.querySelectorAll(".flash-star-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const w = getCurrentFlashWord();
      if (!w) return;
      toggleStar(App.currentDeckId, w._id);
      renderFlashStarButtons(w);
      renderTable();
    });
  });
  document.getElementById("btnFlashRestartFull").addEventListener("click", flashRestartFull);
  document.getElementById("btnFlashRestartStarredOnly").addEventListener("click", flashRestartStarredOnly);

  document.getElementById("btnFlashStarOnly").addEventListener("click", () => {
    const isCurrentlyStarOnly = document.getElementById("btnFlashStarOnly").classList.contains("is-active");

    if (isCurrentlyStarOnly) {
      // Đang ở chế độ chỉ học ★ -> bấm lại để TẮT, quay về học toàn bộ bộ
      setFlashStarOnlyState(false);
      initFlashMode(null);
      return;
    }

    const starredIds = getStarredIdsForDeck(App.currentDeckId);
    if (!starredIds.length) {
      alert("Chưa có từ nào được đánh dấu ★ trong bộ này. Bấm ☆ trên góc thẻ để đánh dấu.");
      return;
    }
    setFlashStarOnlyState(true);
    initFlashMode(starredIds);
  });
  document.getElementById("btnSrsStarOnly").addEventListener("click", () => {
    const isCurrentlyStarOnly = document.getElementById("btnSrsStarOnly").classList.contains("is-active");

    if (isCurrentlyStarOnly) {
      // Đang ở chế độ chỉ ôn ★ -> bấm lại để TẮT, quay về ôn toàn bộ bộ
      setSrsStarOnlyState(false);
      initSrsMode(null);
      return;
    }

    const starredIds = getStarredIdsForDeck(App.currentDeckId);
    if (!starredIds.length) {
      alert("Chưa có từ nào được đánh dấu ★ trong bộ này.");
      return;
    }
    setSrsStarOnlyState(true);
    initSrsMode(starredIds);
  });

  // Phím tắt ← ↑ ↓ → dùng chung cho Flashcard và SRS (Ôn tập):
  // Flashcard: ← Chưa nhớ, ↑ Khó, ↓ Lật thẻ, → Đã nhớ
  // SRS:       ← Quên,    ↑ Khó, ↓ Lật thẻ, → Dễ
  document.addEventListener("keydown", (e) => {
    const isEditModalOpen = !document.getElementById("editModalOverlay").classList.contains("hidden");
    if (isEditModalOpen) return;
    const tag = document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;

    const flashView = document.getElementById("view-flash");
    const isFlashVisible = flashView && !flashView.classList.contains("hidden");
    const learnAreaVisible = !document.getElementById("flashLearnArea").classList.contains("hidden");

    const srsView = document.getElementById("view-srs");
    const isSrsVisible = srsView && !srsView.classList.contains("hidden");
    const srsStageVisible = !document.getElementById("srsStage").classList.contains("hidden");

    if (isFlashVisible && learnAreaVisible) {
      if (e.key === "ArrowLeft") { e.preventDefault(); flashMarkResult("not_remembered"); }
      else if (e.key === "ArrowUp") { e.preventDefault(); flashMarkResult("hard"); }
      else if (e.key === "ArrowDown") { e.preventDefault(); flipFlashCard(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); flashMarkResult("remembered"); }
      return;
    }
    if (isSrsVisible && srsStageVisible) {
      if (e.key === "ArrowLeft") { e.preventDefault(); rateCurrentSrsWord("again"); }
      else if (e.key === "ArrowUp") { e.preventDefault(); rateCurrentSrsWord("hard"); }
      else if (e.key === "ArrowDown") { e.preventDefault(); flipSrsCard(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); rateCurrentSrsWord("easy"); }
      return;
    }

    // ---- Phím tắt trả lời cho ĐỀ THI / NGHE / QUIZ (luyện đề bấm giờ nhanh) ----
    // Số 1–9: chọn đáp án theo đúng vị trí đang hiện (chỉ khi đáp án còn bấm được).
    // Enter: chốt / tiếp tục theo ngữ cảnh từng chế độ.
    // Chỉ 1 đáp án bị bấm cho mỗi lần nhấn, không tự ý làm gì thêm.
    function clickNthOption(containerSel, key) {
      if (!(key >= "1" && key <= "9")) return false;
      const opts = document.querySelectorAll(containerSel + " .quiz-opt");
      const idx = parseInt(key, 10) - 1;
      const btn = opts[idx];
      if (btn && !btn.classList.contains("disabled")) { btn.click(); return true; }
      return false;
    }

    const examView = document.getElementById("view-exam");
    const isExamVisible = examView && !examView.classList.contains("hidden");
    const examBodyVisible = !document.getElementById("examBody").classList.contains("hidden");
    if (isExamVisible && examBodyVisible) {
      if (clickNthOption("#examOptions", e.key)) { e.preventDefault(); return; }
      if (e.key === "Enter") {
        const cont = document.getElementById("btnExamContinue");
        if (cont && !cont.classList.contains("hidden")) { e.preventDefault(); cont.click(); }
      }
      return;
    }

    const choukaiView = document.getElementById("view-choukai");
    const isChoukaiVisible = choukaiView && !choukaiView.classList.contains("hidden");
    const choukaiBodyVisible = !document.getElementById("choukaiBody").classList.contains("hidden");
    if (isChoukaiVisible && choukaiBodyVisible) {
      if (clickNthOption("#choukaiOptions", e.key)) { e.preventDefault(); return; }
      if (e.key === "Enter") {
        const confirmBtn = document.getElementById("btnChoukaiConfirm");
        const contBtn = document.getElementById("btnChoukaiContinue");
        // Ưu tiên chốt đáp án nếu nút Xác nhận đang hiện & bật; nếu không thì Tiếp tục.
        if (confirmBtn && !confirmBtn.classList.contains("hidden") && !confirmBtn.disabled) {
          e.preventDefault(); confirmBtn.click();
        } else if (contBtn && contBtn.offsetParent !== null) {
          e.preventDefault(); contBtn.click();
        }
      }
      return;
    }

    const quizView = document.getElementById("view-quiz");
    const isQuizVisible = quizView && !quizView.classList.contains("hidden");
    const quizBodyVisible = !document.getElementById("quizBody").classList.contains("hidden");
    if (isQuizVisible && quizBodyVisible) {
      if (clickNthOption("#quizOptions", e.key)) { e.preventDefault(); }
      return;
    }
  });

  // ----- Edit modal (dùng chung cho flashcard + bảng) -----
  document.getElementById("btnEditModalClose").addEventListener("click", closeEditModal);
  document.getElementById("btnEditCancel").addEventListener("click", closeEditModal);
  document.getElementById("btnEditSave").addEventListener("click", saveEditModal);
  document.getElementById("editModalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "editModalOverlay") closeEditModal();
  });

  // ----- Weakness mode -----
  document.getElementById("btnReviewWeakness").addEventListener("click", startWeaknessReview);
  document.getElementById("btnWeaknessTabDeck").addEventListener("click", () => {
    App.weaknessTab = "deck";
    renderWeaknessMode();
  });
  document.getElementById("btnWeaknessTabExam").addEventListener("click", () => {
    App.weaknessTab = "exam";
    renderWeaknessMode();
  });
  document.getElementById("btnWeaknessTabChoukai").addEventListener("click", () => {
    App.weaknessTab = "choukai";
    renderWeaknessMode();
  });

  // ----- Theme toggle: classic (theme-plus.css) <-> new (theme-new.css, Beta) -----
  // Feature-flag đơn giản qua localStorage — bật/tắt disabled trên 2 thẻ <link>,
  // KHÔNG cần reload trang. Nếu theme mới ổn định, xóa hẳn theme-plus.css +
  // nút này sau, không ảnh hưởng gì tới theme-new.css đang chạy.
  const themeBtn = document.getElementById("btnToggleTheme");
  const themeClassicLink = document.getElementById("themeClassicLink");
  const themeNewLink = document.getElementById("themeNewLink");
  const THEME_STORAGE_KEY = "n2vocab_theme";

  function applyTheme(theme) {
    const isNew = theme === "new";
    themeClassicLink.disabled = isNew;
    themeNewLink.disabled = !isNew;
    themeBtn.classList.toggle("is-active", isNew);
    themeBtn.title = isNew ? "Đang dùng giao diện MỚI (Beta) — bấm để quay lại giao diện cũ" : "Chuyển sang giao diện mới (Beta)";
  }
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || "classic";
  applyTheme(savedTheme);
  themeBtn.addEventListener("click", () => {
    const current = localStorage.getItem(THEME_STORAGE_KEY) || "classic";
    const next = current === "new" ? "classic" : "new";
    localStorage.setItem(THEME_STORAGE_KEY, next);
    applyTheme(next);
  });

  // ----- Sound toggle -----
  const soundBtn = document.getElementById("btnToggleSound");
  function refreshSoundBtnUI() {
    soundBtn.textContent = App.soundEnabled ? "🔊" : "🔇";
    soundBtn.classList.toggle("is-muted", !App.soundEnabled);
  }
  refreshSoundBtnUI();
  soundBtn.addEventListener("click", () => {
    App.soundEnabled = !App.soundEnabled;
    saveSoundConfig();
    refreshSoundBtnUI();
    if (App.soundEnabled) playCorrectSound();
  });

  // ----- Speech (phát âm) toggle -----
  const speechBtn = document.getElementById("btnToggleSpeech");
  function refreshSpeechBtnUI() {
    speechBtn.classList.toggle("is-muted", !App.speechEnabled);
  }
  refreshSpeechBtnUI();
  speechBtn.addEventListener("click", () => {
    App.speechEnabled = !App.speechEnabled;
    saveSpeechConfig();
    refreshSpeechBtnUI();
    if (App.speechEnabled) speakJapanese("発音オン");
  });

  // ----- Table mode -----
  document.getElementById("tableSearch").addEventListener("input", renderTable);
  document.getElementById("tableFilter").addEventListener("change", renderTable);
  document.getElementById("btnColConfig").addEventListener("click", () => {
    document.getElementById("colConfigPanel").classList.toggle("hidden");
  });

  // ----- SRS mode -----
  document.getElementById("srsCard").addEventListener("click", () => {
    flipSrsCard();
  });
  // Nút ★ ngay trên thẻ SRS — đánh dấu sao trực tiếp khi đang ôn, không lật thẻ.
  document.querySelectorAll(".srs-star-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (App.srsComboActive) return; // combo gộp bộ: không đánh dấu sao (xem renderSrsStarButtons)
      const w = App.srsQueue[App.srsIndex];
      if (!w) return;
      toggleStar(App.currentDeckId, w._id);
      renderSrsStarButtons(w);
      renderTable();
    });
  });
  document.getElementById("btnSrsFlip").addEventListener("click", (e) => {
    e.stopPropagation();
    flipSrsCard();
  });
  document.querySelectorAll("#srsRateRow [data-srs-rate], #btnSrsMastered").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      rateCurrentSrsWord(btn.dataset.srsRate);
    });
  });

  // ----- Toggle "Học ngẫu nhiên" (dùng chung pattern cho Flashcard + SRS) -----
  document.getElementById("flashShuffleToggle").checked = App.shuffleEnabled.flash;
  document.getElementById("srsShuffleToggle").checked = App.shuffleEnabled.srs;

  document.getElementById("flashShuffleToggle").addEventListener("change", (e) => {
    App.shuffleEnabled.flash = e.target.checked;
    saveShuffleConfig();
    // Áp dụng ngay: nếu đang học flashcard, xáo trộn phần còn lại của queue
    // (hoặc sắp lại theo thứ tự gốc) mà không reset tiến độ (flashRememberedCount giữ nguyên).
    if (App.flashQueue.length > 0) {
      if (App.shuffleEnabled.flash) {
        App.flashQueue = shuffle(App.flashQueue);
      } else {
        // Sắp xếp lại theo thứ tự gốc của currentWords, chỉ giữ các _id còn trong queue
        const queueSet = new Set(App.flashQueue);
        App.flashQueue = App.currentWords
          .map((w) => w._id)
          .filter((id) => queueSet.has(id));
      }
      renderFlashCard();
    }
  });
  document.getElementById("srsShuffleToggle").addEventListener("change", (e) => {
    App.shuffleEnabled.srs = e.target.checked;
    saveShuffleConfig();
    // Áp dụng ngay: xáo trộn phần còn lại của srsQueue từ vị trí hiện tại trở đi
    if (App.srsQueue.length > App.srsIndex + 1) {
      const done = App.srsQueue.slice(0, App.srsIndex + 1);
      const remaining = App.srsQueue.slice(App.srsIndex + 1);
      App.srsQueue = done.concat(App.shuffleEnabled.srs ? shuffle(remaining) : remaining.sort((a, b) => {
        const ia = App.currentWords.findIndex(w => w._id === a._id);
        const ib = App.currentWords.findIndex(w => w._id === b._id);
        return ia - ib;
      }));
    }
  });

  // ----- Typing mode -----
  document.getElementById("typingFreeInput").addEventListener("keydown", typingHandleKeydown);
  document.getElementById("btnTypingCheck").addEventListener("click", typingCheckAnswer);
  document.getElementById("btnTypingHint").addEventListener("click", typingShowHint);
  document.getElementById("btnTypingShowAnswer").addEventListener("click", typingShowAnswer);

  // ----- Quiz mode -----
  document.getElementById("btnQuizRestart").addEventListener("click", initQuizMode);
  document.getElementById("quizDirectionPicker").addEventListener("change", (e) => {
    App.quizDirection = e.target.value;
    initQuizMode();
  });

  // ----- Match mode -----
  document.getElementById("btnMatchRestart").addEventListener("click", initMatchMode);

  // ----- Exam mode -----
  document.getElementById("examPicker").addEventListener("change", (e) => {
    if (e.target.value) openExamModeModal(e.target.value);
  });
  document.getElementById("btnExamModeInstant").addEventListener("click", () => {
    confirmExamMode("instant");
  });
  document.getElementById("btnExamViewSavedResult").addEventListener("click", () => {
    if (App.examPendingExamId) {
      viewSavedExamResult(App.examPendingExamId);
      App.examPendingExamId = null;
    }
  });
  document.getElementById("btnExamModeReview").addEventListener("click", () => {
    confirmExamMode("review");
  });
  document.getElementById("btnExamRestart").addEventListener("click", restartCurrentExam);
  document.getElementById("btnExamDetailModalClose").addEventListener("click", closeExamDetailModal);
  document.getElementById("examDetailModalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "examDetailModalOverlay") closeExamDetailModal();
  });
  document.getElementById("btnAttemptsGridModalClose").addEventListener("click", closeAttemptsGridModal);
  document.getElementById("attemptsGridModalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "attemptsGridModalOverlay") closeAttemptsGridModal();
  });

  // Nút "🔗 Xem ngữ pháp liên quan" được tạo ĐỘNG (innerHTML) mỗi lần render
  // thẻ flashcard/SRS, nên gắn listener qua delegation ở document thay vì gắn
  // trực tiếp (gắn trực tiếp sẽ mất ngay khi card render lại).
  document.addEventListener("click", (e) => {
    const btn = e.target.closest(".grammar-related-btn");
    if (btn) openGrammarRelatedPopup(btn.dataset.cautruc);
  });
  document.getElementById("btnGrammarRelatedClose").addEventListener("click", closeGrammarRelatedPopup);
  document.getElementById("grammarRelatedModalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "grammarRelatedModalOverlay") closeGrammarRelatedPopup();
  });

  // ----- Trang "Nhóm ngữ pháp" -----
  document.querySelectorAll(".gg-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => setGrammarGroupsTab(btn.dataset.tab));
  });
  document.getElementById("btnGgFlashClose").addEventListener("click", closeGgFlashModal);
  document.getElementById("ggFlashModalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "ggFlashModalOverlay") closeGgFlashModal();
  });
  document.getElementById("ggFlashCardInner").addEventListener("click", ggFlashFlip);
  document.getElementById("btnGgFlashPrev").addEventListener("click", ggFlashPrev);
  document.getElementById("btnGgFlashNext").addEventListener("click", ggFlashNext);
  document.getElementById("btnGgFlashFlip").addEventListener("click", ggFlashFlip);
  document.getElementById("btnGgQuizClose").addEventListener("click", closeGgQuizModal);
  document.getElementById("ggQuizModalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "ggQuizModalOverlay") closeGgQuizModal();
  });

  // ----- Modal "Học SRS gộp nhiều bộ" -----
  document.getElementById("btnOpenComboSrs").addEventListener("click", () => openComboSrsModal("NGUPHAP"));
  document.getElementById("btnComboSrsSelectAll").addEventListener("click", () => {
    const allChecked = Array.from(document.querySelectorAll(".combo-srs-checkbox")).every((c) => c.checked);
    toggleAllComboSrsCheckboxes(!allChecked); // bấm lại lần 2 -> bỏ chọn hết
  });
  document.getElementById("btnComboSrsClose").addEventListener("click", closeComboSrsModal);
  document.getElementById("comboSrsModalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "comboSrsModalOverlay") closeComboSrsModal();
  });
  document.getElementById("btnComboSrsStart").addEventListener("click", confirmStartComboSrs);

  // ----- Ghi chú đề thi (bôi đen text trong câu hỏi/đáp án/giải thích) -----
  initExamNoteSelectionHandler();
  document.getElementById("examNoteToolbarBtn").addEventListener("click", openExamNotePopupForSelection);
  document.getElementById("btnExamNotePopupSave").addEventListener("click", saveExamNoteFromPopup);
  document.getElementById("btnExamNotePopupCancel").addEventListener("click", closeExamNotePopup);
  document.getElementById("examNotePopupInput").addEventListener("keydown", (e) => {
    if (e.key === "Enter") saveExamNoteFromPopup();
    if (e.key === "Escape") closeExamNotePopup();
  });
  document.getElementById("examSpeedMode").addEventListener("change", (e) => {
    toggleExamSpeedMode(e.target.checked);
  });
  document.getElementById("btnExamPrev").addEventListener("click", examGoPrev);
  document.getElementById("btnExamNext").addEventListener("click", examGoNext);
  document.getElementById("btnExamExitEarly").addEventListener("click", () => {
    if (confirm("Dừng làm các câu sai còn lại và xem kết quả ngay với những gì đã làm?")) {
      exitExamEarlyAndShowResult();
    }
  });
  document.getElementById("btnExamShowExplain").addEventListener("click", toggleExamExplain);
  document.getElementById("btnExamContinue").addEventListener("click", examContinueAfterInstantAnswer);

  // ----- CHOUKAI mode listeners -----
  document.getElementById("choukaiPicker").addEventListener("change", (e) => {
    if (e.target.value) openChoukaiModeModal(e.target.value);
  });
  // Cho phép đổi Mondai NGAY GIỮA LÚC đang làm bài (không chỉ chọn trước khi bắt
  // đầu) — đổi dropdown này khi đã đang trong session sẽ nhảy thẳng tới Mondai đó,
  // không mất tiến độ các câu đã làm (đáp án vẫn lưu theo key riêng từng câu).
  document.getElementById("choukaiMondaiPicker").addEventListener("change", (e) => {
    const sessionActive = App.currentChoukaiId && !document.getElementById("choukaiBody").classList.contains("hidden");
    if (!sessionActive) return; // đang ở modal chọn trước khi bắt đầu — để confirmChoukaiMode() đọc giá trị, không xử lý ở đây
    const val = e.target.value;
    App.choukaiMondaiFilter = val === "all" ? "all" : parseInt(val, 10);
    const test = getChoukaiTest(App.currentChoukaiId);
    App.choukaiQueue = buildChoukaiQueue(test, App.choukaiMondaiFilter);
    App.choukaiPos = 0;
    renderChoukaiQuestion();
  });
  document.getElementById("btnChoukaiModeInstant").addEventListener("click", () => confirmChoukaiMode("instant"));
  document.getElementById("btnChoukaiModeReview").addEventListener("click", () => confirmChoukaiMode("review"));
  document.getElementById("btnChoukaiViewSavedResult").addEventListener("click", () => {
    if (App.choukaiPendingTestId) {
      viewSavedChoukaiResult(App.choukaiPendingTestId);
      App.choukaiPendingTestId = null;
    }
  });
  document.getElementById("btnChoukaiPrev").addEventListener("click", choukaiGoPrev);
  document.getElementById("btnChoukaiNext").addEventListener("click", choukaiGoNext);
  document.getElementById("btnChoukaiExitEarly").addEventListener("click", () => {
    if (confirm("Dừng làm các câu còn lại và xem kết quả ngay với những gì đã làm?")) {
      exitChoukaiEarlyAndShowResult();
    }
  });
  document.getElementById("btnChoukaiContinue").addEventListener("click", choukaiGoNext);
  document.getElementById("btnChoukaiConfirm").addEventListener("click", confirmChoukaiAnswer);
  document.getElementById("btnChoukaiFlag").addEventListener("click", toggleChoukaiFlag);
  // (Phân vân nay đánh dấu theo TỪNG đáp án qua badge 🤔 trên mỗi lựa chọn —
  //  không còn nút toggle cả-câu ở thanh công cụ.)
  document.getElementById("btnChoukaiPlay").addEventListener("click", () => {
    const el = document.getElementById("choukaiAudioEl");
    if (el.src) { el.currentTime = 0; el.play().catch(() => {}); }
  });
  // Tua nhanh 5s/10s — thay cho kéo thanh thủ công, tiện khi cần nghe lại đúng
  // đoạn ngắn (đặc biệt hữu ích ở Mondai 3/4 khi lỡ mất 1 câu ngắn).
  bindChoukaiSeekButtons("choukaiAudioEl", "btnChoukaiSeekBack10", -10);
  bindChoukaiSeekButtons("choukaiAudioEl", "btnChoukaiSeekBack5", -5);
  bindChoukaiSeekButtons("choukaiAudioEl", "btnChoukaiSeekFwd5", 5);
  bindChoukaiSeekButtons("choukaiAudioEl", "btnChoukaiSeekFwd10", 10);
  document.getElementById("choukaiHintToggle").addEventListener("change", (e) => {
    App.choukaiHintEnabled = e.target.checked;
    renderChoukaiQuestion();
  });
  document.querySelectorAll(".choukai-review-tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".choukai-review-tab").forEach((b) => b.classList.toggle("is-active", b === btn));
      App.choukaiReviewTab = btn.dataset.tab;
      renderChoukaiReviewContent();
    });
  });
  document.getElementById("btnChoukaiRestart").addEventListener("click", () => {
    document.getElementById("choukaiResult").classList.add("hidden");
    openChoukaiModeModal(App.currentChoukaiId);
  });
  document.getElementById("btnChoukaiDetailModalClose").addEventListener("click", closeChoukaiDetailModal);
  document.getElementById("choukaiDetailModalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "choukaiDetailModalOverlay") closeChoukaiDetailModal();
  });

  // ----- CHOUKAI SHADOW mode listeners -----
  document.getElementById("choukaiShadowPicker").addEventListener("change", (e) => {
    const testId = e.target.value;
    if (!testId) {
      document.getElementById("choukaiShadowQuestionPicker").classList.add("hidden");
      document.getElementById("choukaiShadowBody").classList.add("hidden");
      document.getElementById("choukaiShadowEmpty").classList.remove("hidden");
      return;
    }
    populateChoukaiShadowQuestionPicker(testId);
    renderChoukaiShadowQuestion(testId, 0);
  });
  document.getElementById("choukaiShadowQuestionPicker").addEventListener("change", (e) => {
    const testId = document.getElementById("choukaiShadowPicker").value;
    if (testId && e.target.value !== "") renderChoukaiShadowQuestion(testId, parseInt(e.target.value, 10));
  });
  document.getElementById("btnChoukaiShadowPlay").addEventListener("click", () => {
    const el = document.getElementById("choukaiShadowAudioEl");
    if (el.src) { el.currentTime = 0; el.play().catch(() => {}); }
  });
  bindChoukaiSeekButtons("choukaiShadowAudioEl", "btnChoukaiShadowSeekBack10", -10);
  bindChoukaiSeekButtons("choukaiShadowAudioEl", "btnChoukaiShadowSeekBack5", -5);
  bindChoukaiSeekButtons("choukaiShadowAudioEl", "btnChoukaiShadowSeekFwd5", 5);
  bindChoukaiSeekButtons("choukaiShadowAudioEl", "btnChoukaiShadowSeekFwd10", 10);

  // ----- Deck picker -----
  document.getElementById("deckPicker").addEventListener("change", (e) => {
    switchDeck(e.target.value);
  });

  // ----- Export / Import progress (toàn bộ lịch sử học + cấu hình + sửa tạm) -----
  document.getElementById("btnExport").addEventListener("click", () => {
    const exportPayload = {
      exportedAt: new Date().toISOString(),
      version: 8,
      srsProgress: SRS.exportAll(),
      fieldConfig: App.fieldConfig,
      visibleCols: App.visibleCols,
      peekCols: App.peekCols,
      editPatches: App.editPatches,
      starredItems: App.starredItems,
      weaknessStats: loadWeaknessStats(),
      examHistory: loadExamHistoryStats(),
      examDetailHistory: loadExamDetailHistoryStats(),
      examAttempts: getAllExamAttemptsForExport(),
      examNotes: loadNotesRawG("exam"),
      choukaiHistory: loadChoukaiHistoryStats(),
      choukaiDetailHistory: loadChoukaiDetailHistoryStats(),
      choukaiAttempts: getAllChoukaiAttemptsForExport(),
      choukaiNotes: loadNotesRawG("choukai"),
      shuffleEnabled: App.shuffleEnabled,
      soundEnabled: App.soundEnabled,
      speechEnabled: App.speechEnabled,
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `n2vocab-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
  document.getElementById("btnImport").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);

        // Hỗ trợ cả file export cũ (chỉ có srsProgress trực tiếp, không có wrapper)
        const srsData = data.srsProgress || data;
        SRS.importAll(srsData);

        if (data.fieldConfig) {
          Object.assign(App.fieldConfig, data.fieldConfig);
          saveFieldConfig();
        }
        if (data.visibleCols) {
          Object.assign(App.visibleCols, data.visibleCols);
          saveColConfig();
        }
        if (data.peekCols) {
          Object.assign(App.peekCols, data.peekCols);
          savePeekConfig();
        }
        if (data.editPatches) {
          // Gộp patch nhập vào với patch hiện có (patch nhập đè lên nếu trùng key)
          Object.keys(data.editPatches).forEach((deckId) => {
            App.editPatches[deckId] = { ...App.editPatches[deckId], ...data.editPatches[deckId] };
          });
          saveEditPatches();
          // Áp lại patch lên toàn bộ deck đang có trong session
          App.decks.forEach((deck) => {
            deck.words = applyPatchesToWords(deck.id, deck.words);
          });
          const curDeck = App.decks.find((d) => d.id === App.currentDeckId);
          if (curDeck) App.currentWords = curDeck.words;
        }
        if (data.starredItems) {
          // Gộp danh sách ★ đã đánh dấu (không trùng lặp) theo từng bộ
          Object.keys(data.starredItems).forEach((deckId) => {
            const merged = new Set([...(App.starredItems[deckId] || []), ...data.starredItems[deckId]]);
            App.starredItems[deckId] = Array.from(merged);
          });
          saveStarredItems();
        }
        if (data.weaknessStats) {
          // Gộp số liệu đúng/sai (CỘNG DỒN, không đè) — vì đây là số liệu tích lũy theo
          // thời gian, đè thẳng sẽ làm mất lịch sử đã có sẵn trên máy hiện tại.
          const currentStats = loadWeaknessStats();
          Object.keys(data.weaknessStats).forEach((deckId) => {
            if (!currentStats[deckId]) currentStats[deckId] = {};
            Object.keys(data.weaknessStats[deckId]).forEach((itemId) => {
              const incoming = data.weaknessStats[deckId][itemId];
              const existing = currentStats[deckId][itemId];
              if (!existing) {
                currentStats[deckId][itemId] = { ...incoming };
              } else {
                existing.correctCount += incoming.correctCount || 0;
                existing.wrongCount += incoming.wrongCount || 0;
                if (incoming.lastResultAt > existing.lastResultAt) {
                  existing.lastLabel = incoming.lastLabel || existing.lastLabel;
                  existing.lastResultAt = incoming.lastResultAt;
                }
              }
            });
          });
          saveWeaknessStats(currentStats);
        }
        if (data.examHistory) {
          // totalCompletions CỘNG DỒN (giống weaknessStats — đếm tích lũy, mỗi máy
          // có thể đã làm thêm số lần riêng, không máy nào "đúng hơn" máy nào).
          // Các field "lần gần nhất" lấy theo bản có lastCompletedAt LỚN HƠN (mới hơn),
          // vì đây là trạng thái snapshot của 1 lần làm cụ thể, không phải số đếm.
          const currentExamStats = loadExamHistoryStats();
          Object.keys(data.examHistory).forEach((examId) => {
            const incoming = data.examHistory[examId];
            const existing = currentExamStats[examId];
            if (!existing) {
              currentExamStats[examId] = { ...incoming };
            } else {
              existing.totalCompletions = (existing.totalCompletions || 0) + (incoming.totalCompletions || 0);
              if ((incoming.lastCompletedAt || 0) > (existing.lastCompletedAt || 0)) {
                existing.lastScore = incoming.lastScore;
                existing.lastTotal = incoming.lastTotal;
                existing.lastSeconds = incoming.lastSeconds;
                existing.lastFirstTryWrongCount = incoming.lastFirstTryWrongCount;
                existing.lastCompletedAt = incoming.lastCompletedAt;
              }
            }
          });
          saveExamHistoryStats(currentExamStats);
        }
        if (data.examDetailHistory) {
          // Đây là dữ liệu CHI TIẾT từng câu (lưới đúng/sai + giải thích) — khác
          // examHistory ở trên (chỉ có điểm số tổng). Lấy theo savedAt MỚI HƠN
          // (vì đây là ảnh chụp 1 lần làm cụ thể, không phải bộ đếm tích lũy).
          const currentDetailStats = loadExamDetailHistoryStats();
          Object.keys(data.examDetailHistory).forEach((examId) => {
            const incoming = data.examDetailHistory[examId];
            const existing = currentDetailStats[examId];
            if (!existing || (incoming.savedAt || 0) > (existing.savedAt || 0)) {
              currentDetailStats[examId] = incoming;
            }
          });
          saveExamDetailHistoryStats(currentDetailStats);
        }
        if (data.examAttempts) {
          // Gộp mảng "nhiều lần làm" của 2 máy lại với nhau (không đè) — vì mỗi máy
          // có thể có những lần làm mà máy kia KHÔNG có. Loại trùng theo `completedAt`
          // (phòng trường hợp export rồi nhập lại trên CHÍNH máy đó, tránh nhân đôi),
          // sắp theo thời gian tăng dần để "Lần 1/Lần 2..." luôn đúng thứ tự thật.
          const currentAttempts = loadExamAttemptsRaw();
          Object.keys(data.examAttempts).forEach((examId) => {
            const merged = [...(currentAttempts[examId] || []), ...(data.examAttempts[examId] || [])];
            const seen = new Set();
            const dedup = merged.filter((a) => {
              if (seen.has(a.completedAt)) return false;
              seen.add(a.completedAt);
              return true;
            });
            dedup.sort((a, b) => a.completedAt - b.completedAt);
            currentAttempts[examId] = dedup.slice(-MAX_ATTEMPTS_KEPT);
          });
          saveExamAttemptsRaw(currentAttempts);
        }
        if (data.choukaiHistory) {
          const currentChoukaiStats = loadChoukaiHistoryStats();
          Object.keys(data.choukaiHistory).forEach((testId) => {
            const incoming = data.choukaiHistory[testId];
            const existing = currentChoukaiStats[testId];
            if (!existing) {
              currentChoukaiStats[testId] = { ...incoming };
            } else {
              existing.totalCompletions = (existing.totalCompletions || 0) + (incoming.totalCompletions || 0);
              if ((incoming.lastCompletedAt || 0) > (existing.lastCompletedAt || 0)) {
                existing.lastScore = incoming.lastScore;
                existing.lastTotal = incoming.lastTotal;
                existing.lastSeconds = incoming.lastSeconds;
                existing.lastCompletedAt = incoming.lastCompletedAt;
              }
            }
          });
          saveChoukaiHistoryStats(currentChoukaiStats);
        }
        if (data.choukaiDetailHistory) {
          const currentChoukaiDetailStats = loadChoukaiDetailHistoryStats();
          Object.keys(data.choukaiDetailHistory).forEach((testId) => {
            const incoming = data.choukaiDetailHistory[testId];
            const existing = currentChoukaiDetailStats[testId];
            if (!existing || (incoming.savedAt || 0) > (existing.savedAt || 0)) {
              currentChoukaiDetailStats[testId] = incoming;
            }
          });
          saveChoukaiDetailHistoryStats(currentChoukaiDetailStats);
        }
        if (data.choukaiAttempts) {
          const currentChoukaiAttempts = loadChoukaiAttemptsRaw();
          Object.keys(data.choukaiAttempts).forEach((testId) => {
            const merged = [...(currentChoukaiAttempts[testId] || []), ...(data.choukaiAttempts[testId] || [])];
            const seen = new Set();
            const dedup = merged.filter((a) => {
              if (seen.has(a.completedAt)) return false;
              seen.add(a.completedAt);
              return true;
            });
            dedup.sort((a, b) => a.completedAt - b.completedAt);
            currentChoukaiAttempts[testId] = dedup.slice(-MAX_ATTEMPTS_KEPT);
          });
          saveChoukaiAttemptsRaw(currentChoukaiAttempts);
        }
        // Ghi chú (note) đề thi/đề nghe — cấu trúc lồng 2 cấp { id: { qKey: [notes] } },
        // GỘP SÂU theo từng id rồi từng qKey (không đè cả cụm), loại trùng theo
        // `note.id` (phòng export rồi nhập lại trên CHÍNH máy đó, tránh nhân đôi).
        if (data.examNotes) mergeNotesOnImport("exam", data.examNotes);
        if (data.choukaiNotes) mergeNotesOnImport("choukai", data.choukaiNotes);
        if (data.shuffleEnabled) {
          Object.assign(App.shuffleEnabled, data.shuffleEnabled);
          saveShuffleConfig();
          document.getElementById("flashShuffleToggle").checked = App.shuffleEnabled.flash;
          document.getElementById("srsShuffleToggle").checked = App.shuffleEnabled.srs;
        }
        if (data.soundEnabled !== undefined) {
          App.soundEnabled = data.soundEnabled;
          saveSoundConfig();
        }
        if (data.speechEnabled !== undefined) {
          App.speechEnabled = data.speechEnabled;
          saveSpeechConfig();
        }

        App.progress = SRS.loadProgress(App.currentDeckId);
        buildColConfigPanel();
        buildFieldConfigPanel();
        renderTable();
        initSrsMode();
        renderFlashCard();
        alert("Đã nhập tiến độ, cấu hình và các sửa tạm thành công.");
      } catch (err) {
        console.error("Lỗi nhập file:", err);
        alert("File không hợp lệ.\n\nChi tiết lỗi: " + err.message);
      }
    };
    reader.readAsText(file);
  });

  document.getElementById("btnClearPatches").addEventListener("click", () => {
    const confirmed = confirm(
      "Xóa toàn bộ các sửa tạm đã lưu trên máy này? Hành động này không ảnh hưởng tiến độ học (SRS), chỉ xóa các chỉnh sửa từ vựng/ngữ pháp bạn đã sửa qua nút ✎ Sửa."
    );
    if (!confirmed) return;
    clearAllEditPatches();
    // Tải lại deck từ file gốc (không còn patch) để phản ánh ngay
    loadDecks().then((decks) => {
      App.decks = decks;
      buildGrammarIndex();
      const stillExists = decks.find((d) => d.id === App.currentDeckId);
      switchDeck(stillExists ? App.currentDeckId : decks[0].id);
      alert("Đã xóa toàn bộ các sửa tạm.");
    });
  });

  // ----- Bắt đầu với bộ đầu tiên -----
  switchDeck(App.decks[0].id);

  // switchDeck() ở trên mặc định mở Flashcard (đúng hành vi khi NGƯỜI DÙNG tự đổi
  // bộ giữa lúc đang dùng app — xem comment trong switchDeck()). Nhưng lúc MỞ APP
  // LẦN ĐẦU thì mở thẳng trang Thống kê để nhìn tổng quan tiến độ trước, nên ghi
  // đè lại mode ngay sau đó — CHỈ áp dụng cho lần load trang này, không ảnh hưởng
  // gì tới việc đổi bộ học bình thường sau đó.
  setMode("dashboard");
});
