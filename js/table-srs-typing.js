/* ===== MODULE: table-srs-typing.js — Mode Bảng, mode SRS (ôn theo thuật toán), mode Gõ (typing) ===== */

/* ===================================================================
   HỌC SRS GỘP NHIỀU BỘ NGỮ PHÁP TÙY Ý — tái dùng TOÀN BỘ giao diện/thuật toán
   SRS có sẵn (giống Anki), chỉ khác là App.currentWords/App.progress được gộp
   từ NHIỀU bộ cùng lúc thay vì 1 bộ. `_id` mỗi từ đã có dạng "deckId::key" sẵn
   (xem wordId() trong core.js) -> không trùng nhau giữa các bộ, gộp an toàn.
=================================================================== */
function startComboSrs(deckIds) {
  const decks = deckIds.map((id) => App.decks.find((d) => d.id === id)).filter(Boolean);
  if (!decks.length) return;

  const comboWords = [];
  const comboProgress = {};
  decks.forEach((deck) => {
    Object.assign(comboProgress, SRS.loadProgress(deck.id));
    comboWords.push(...deck.words);
  });

  App.srsComboActive = true;
  App.currentDeckId = "__combo__";
  App.currentDeckType = "NGUPHAP"; // combo chỉ áp dụng cho bộ ngữ pháp
  App.currentWords = comboWords;
  App.progress = comboProgress;

  const comboLabel = `🔀 Gộp ${decks.length} bộ: ${decks.map((d) => d.title).join(" + ")}`;
  document.getElementById("deckName").textContent = comboLabel;
  document.getElementById("mobileTopbarTitle").textContent = comboLabel;

  setMode("srs");
  initSrsMode();
}

// Lúc lưu progress của 1 phiên SRS GỘP — KHÔNG thể lưu chung 1 chỗ (vì các từ
// gốc từ NHIỀU bộ khác nhau) — tách lại đúng theo từng deckId gốc (lấy từ tiền
// tố của _id, dạng "deckId::key") rồi lưu riêng vào progress THẬT của bộ đó.
function saveComboProgress(progress) {
  const byDeck = {};
  Object.keys(progress).forEach((id) => {
    const sep = id.indexOf("::");
    const deckId = sep === -1 ? id : id.slice(0, sep);
    if (!byDeck[deckId]) byDeck[deckId] = {};
    byDeck[deckId][id] = progress[id];
  });
  Object.keys(byDeck).forEach((deckId) => {
    const real = SRS.loadProgress(deckId);
    Object.assign(real, byDeck[deckId]);
    SRS.saveProgress(deckId, real);
  });
}

// Wrapper DÙNG CHUNG cho mọi chỗ cần lưu progress trong file này — tự động lưu
// đúng cách theo có đang ở combo mode hay không, KHÔNG cần sửa từng nơi gọi.
function saveCurrentSrsProgress() {
  if (App.srsComboActive) saveComboProgress(App.progress);
  else SRS.saveProgress(App.currentDeckId, App.progress);
}

function renderTable() {
  const type = App.currentDeckType;
  const meta = TABLE_COL_META[type];
  const cols = App.visibleCols[type].filter((c) => meta[c]);

  const thead = document.getElementById("tableHead");
  thead.innerHTML = `<tr><th class="col-star-head"></th>${cols.map((c) => `<th>${meta[c].label}</th>`).join("")}<th class="col-edit-head"></th></tr>`;

  const tbody = document.getElementById("tableBody");
  const search = (document.getElementById("tableSearch").value || "").toLowerCase();
  const filter = document.getElementById("tableFilter").value;
  const starredIds = getStarredIdsForDeck(App.currentDeckId);

  tbody.innerHTML = "";

  App.currentWords.forEach((w) => {
    const entry = SRS.getEntry(App.progress, w._id);
    const st = SRS.status(entry);
    const starred = starredIds.includes(w._id);

    if (filter === "starred") {
      if (!starred) return;
    } else if (filter !== "all" && st !== filter) {
      return;
    }

    const searchKeys = type === "NGUPHAP"
      ? [w.cautruc, w.nghia, w.muc_do]
      : [w.kanji, w.doc, w.han_viet, w.nghia];
    const haystack = searchKeys.join(" ").toLowerCase();
    if (search && !haystack.includes(search)) return;

    const tr = document.createElement("tr");
    const starCell = `<td class="col-star-cell"><button class="table-star-btn ${starred ? "is-starred" : ""}" data-star-word-id="${w._id}" title="Đánh dấu sao">${starred ? "★" : "☆"}</button></td>`;
    const cells = cols.map((col) => {
      if (col === "status") {
        const statusLabel = { new: "Chưa học", learning: "Đang học", known: "Đã thuộc", mastered: "⭐ Đã thuộc" }[st];
        return `<td><span class="status-pill status-${st}">${statusLabel}</span></td>`;
      }
      const colMeta = meta[col];
      let raw = w[col] || "";
      if (col === "doc") raw = renderChoon(w.doc_marked || w.doc);
      if (col === "vi_du") raw = renderExampleSentencesForCard(w);
      if (col === "dong_nghia" || col === "trai_nghia") {
        raw = w[col] && w[col].length ? renderSynonymList(w[col]) : "";
      }
      const cssClass = col === "kanji" || col === "cautruc" ? "cell-kanji" : (col === "vi_du" ? "cell-vidu" : "");
      const isPeeking = colMeta.canPeek && App.peekCols[type].includes(col);

      if (isPeeking) {
        return `<td>
          <span class="cell-peek-wrap is-peeking">
            <span class="cell-real-content ${cssClass}">${raw}</span>
            <span class="peek-overlay"><span class="peek-dots">• • •</span></span>
          </span>
        </td>`;
      }
      return `<td class="${cssClass}">${raw}</td>`;
    });
    cells.unshift(starCell);
    cells.push(`<td class="col-edit-cell"><button class="table-edit-btn" data-edit-word-id="${w._id}" title="Sửa">✎</button></td>`);
    tr.innerHTML = cells.join("");
    tbody.appendChild(tr);
  });

  document.querySelectorAll(".table-edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => openEditModal(btn.dataset.editWordId));
  });
  document.querySelectorAll(".table-star-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      toggleStar(App.currentDeckId, btn.dataset.starWordId);
      renderTable();
    });
  });

  saveCurrentSrsProgress();
}

/* ===================================================================
   SRS REVIEW MODE
=================================================================== */

function initSrsMode(restrictToIds) {
  const wordPool = restrictToIds && restrictToIds.length
    ? App.currentWords.filter((w) => restrictToIds.includes(w._id))
    : App.currentWords;

  const due = [];
  const newWords = [];
  let mastered = 0;

  wordPool.forEach((w) => {
    const entry = SRS.getEntry(App.progress, w._id);
    const st = SRS.status(entry);
    // Tính cả 2 loại "đã thuộc": tự nhiên qua SRS (known) VÀ đánh dấu tay (mastered) —
    // trước đây chỉ tính "known" nên từ đánh dấu "Đã thuộc" bị thiếu khỏi số đếm này.
    if (st === "known" || st === "mastered") mastered++;
    if (!entry.seen) {
      newWords.push(w);
    } else if (SRS.isDue(entry)) {
      due.push(w);
    }
  });

  document.getElementById("srsDueCount").textContent = due.length;
  document.getElementById("srsNewCount").textContent = newWords.length;
  document.getElementById("srsMasteredCount").textContent = mastered;

  const shuffleOn = App.shuffleEnabled.srs;
  const orderedNew = shuffleOn ? shuffle(newWords) : newWords;
  const orderedDue = shuffleOn ? shuffle(due) : due;
  const newSlice = orderedNew.slice(0, 10);
  App.srsQueue = orderedDue.concat(newSlice);
  App.srsIndex = 0;

  saveCurrentSrsProgress();

  const empty = document.getElementById("srsEmpty");
  const stage = document.getElementById("srsStage");
  const rateRow = document.getElementById("srsRateRow");

  if (App.srsQueue.length === 0) {
    empty.classList.remove("hidden");
    stage.classList.add("hidden");
    rateRow.classList.add("hidden");
  } else {
    empty.classList.add("hidden");
    stage.classList.remove("hidden");
    rateRow.classList.remove("hidden");
    renderSrsCard();
  }
}

function renderSrsCard() {
  const card = document.getElementById("srsCard");
  card.classList.remove("flipped");
  const w = App.srsQueue[App.srsIndex];
  if (!w) return;
  const type = App.currentDeckType;

  renderCardFace(document.getElementById("srsFrontContent"), w, App.fieldConfig[type].front);
  renderCardFace(document.getElementById("srsBackContent"), w, App.fieldConfig[type].back);

  // Luôn cuộn về đầu nội dung mỗi khi đổi thẻ — cùng lý do như Flashcard.
  document.getElementById("srsFront").scrollTop = 0;
  document.getElementById("srsBack").scrollTop = 0;

  renderSrsStarButtons(w);
  updateSrsRateTimePreviews(w);
}

// Cập nhật trạng thái nút ★ trên thẻ SRS (2 mặt). Trong chế độ học GỘP nhiều bộ
// (__combo__) thì ẩn nút — vì các từ gộp không mang theo deckId gốc nên không thể
// đánh dấu sao đúng bộ; đánh dấu sao chỉ dùng khi ôn từng bộ riêng.
function renderSrsStarButtons(w) {
  const btns = document.querySelectorAll(".srs-star-btn");
  if (App.srsComboActive) {
    btns.forEach((btn) => { btn.classList.add("hidden"); });
    return;
  }
  const starred = isStarred(App.currentDeckId, w._id);
  btns.forEach((btn) => {
    btn.classList.remove("hidden");
    btn.classList.toggle("is-starred", starred);
    btn.textContent = starred ? "★" : "☆";
  });
}

function flipSrsCard() {
  const card = document.getElementById("srsCard");
  card.classList.toggle("flipped");
  if (card.classList.contains("flipped")) {
    speakWord(App.srsQueue[App.srsIndex]);
  }
}

function updateSrsRateTimePreviews(w) {
  if (!w) return;
  document.getElementById("rtAgainSrs").textContent = SRS.previewLabel(App.progress, w._id, "again");
  document.getElementById("rtHardSrs").textContent = SRS.previewLabel(App.progress, w._id, "hard");
  document.getElementById("rtEasySrs").textContent = SRS.previewLabel(App.progress, w._id, "easy");
}

function rateCurrentSrsWord(rating) {
  const w = App.srsQueue[App.srsIndex];
  if (!w) return;
  SRS.rate(App.progress, w._id, rating);
  saveCurrentSrsProgress();

  // Ghi nhận vào thống kê điểm yếu chung: "Quên" = sai, "Khó"/"Dễ" = đúng
  // (đã nhớ được, chỉ khác mức độ dễ/khó khi nhớ lại).
  recordWeaknessResult(App.currentDeckId, w._id, rating !== "again");

  App.srsIndex++;
  if (App.srsIndex >= App.srsQueue.length) {
    initSrsMode();
  } else {
    renderSrsCard();
  }
}

/* ===================================================================
   TYPING MODE — gõ tự luận: nhìn kanji + nghĩa, KHÔNG hiện khung target.
   Người học tự nhớ và gõ ra cách đọc hiragana, kiểm tra toàn bộ khi bấm
   "Kiểm tra". Có nút "Gợi ý" (hiện thêm 1 ký tự tiếp theo) và "Xem đáp án"
   (hiện full, tính là chưa nhớ -> xếp ôn lại theo SRS).
=================================================================== */

function initTypingMode() {
  // Chỉ áp dụng cho TUVUNG (ngữ pháp không có khái niệm "đọc kanji")
  const pool = App.currentWords.filter((w) => w.kanji && w.doc);
  App.typingPool = pool;
  App.typingOrder = shuffle(pool.map((_, i) => i));
  App.typingIndex = 0;
  App.typingScore = 0;
  App.typingRevealedCount = 0; // số ký tự đã "gợi ý" lộ ra cho từ hiện tại
  App.typingAnswered = false;  // đã kiểm tra/xem đáp án cho từ hiện tại chưa
  document.getElementById("typingScore").textContent = "0";
  document.getElementById("typingTotal").textContent = App.typingOrder.length;
  renderTypingCard();
}

function renderTypingCard() {
  if (App.typingIndex >= App.typingOrder.length) {
    document.getElementById("typingKanji").textContent = "🎉";
    document.getElementById("typingNghia").textContent = `Hoàn thành! Đúng ${App.typingScore}/${App.typingOrder.length}`;
    document.getElementById("typingRevealRow").innerHTML = "";
    document.getElementById("typingResultLine").textContent = "";
    document.getElementById("typingActionRow").classList.add("hidden");
    document.getElementById("typingFreeInput").classList.add("hidden");
    return;
  }
  const pool = App.typingPool;
  const w = pool[App.typingOrder[App.typingIndex]];

  App.typingCurrentTarget = stripChoonMarks(w.doc); // raw hiragana cần nhớ và gõ ra
  App.typingCurrentWord = w;
  App.typingRevealedCount = 0;
  App.typingAnswered = false;

  document.getElementById("typingKanji").textContent = w.kanji;
  document.getElementById("typingNghia").textContent = w.nghia;
  document.getElementById("typingPos").textContent = App.typingIndex + 1;
  const pct = (App.typingIndex / App.typingOrder.length) * 100;
  document.getElementById("typingBar").style.width = `${pct}%`;
  document.getElementById("typingFreeInput").classList.remove("hidden");
  document.getElementById("typingActionRow").classList.remove("hidden");
  document.getElementById("typingResultLine").textContent = "";
  document.getElementById("typingResultLine").className = "typing-result-line";

  const input = document.getElementById("typingFreeInput");
  input.value = "";
  input.disabled = false;
  input.focus();
  renderTypingRevealRow();
}

// Hiện dòng gợi ý phía dưới (chỉ hiện số ký tự đã được "Gợi ý" mở khoá, còn lại là dấu chấm)
function renderTypingRevealRow() {
  const target = App.typingCurrentTarget;
  const revealed = App.typingRevealedCount;
  let html = "";
  for (let i = 0; i < target.length; i++) {
    if (i < revealed) {
      html += `<span class="typing-reveal-char">${target[i]}</span>`;
    } else {
      html += `<span class="typing-reveal-dot">•</span>`;
    }
  }
  document.getElementById("typingRevealRow").innerHTML = html;
}

function typingShowHint() {
  if (App.typingAnswered) return;
  if (App.typingRevealedCount < App.typingCurrentTarget.length) {
    App.typingRevealedCount++;
    renderTypingRevealRow();
  }
}

function typingShowAnswer() {
  if (App.typingAnswered) return;
  App.typingAnswered = true;
  const w = App.typingCurrentWord;
  const target = App.typingCurrentTarget;

  document.getElementById("typingFreeInput").disabled = true;
  App.typingRevealedCount = target.length;
  renderTypingRevealRow();

  const resultLine = document.getElementById("typingResultLine");
  resultLine.textContent = `Đáp án: ${target}`;
  resultLine.className = "typing-result-line is-wrong";

  // Xem đáp án = coi như chưa nhớ được, xếp ôn lại sớm hơn
  SRS.rate(App.progress, w._id, "again");
  saveCurrentSrsProgress();
  recordWeaknessResult(App.currentDeckId, w._id, false);

  setTimeout(() => {
    App.typingIndex++;
    renderTypingCard();
  }, 1400);
}

function typingCheckAnswer() {
  if (App.typingAnswered) return;
  const rawValue = document.getElementById("typingFreeInput").value.trim();
  const target = App.typingCurrentTarget;
  const w = App.typingCurrentWord;
  const resultLine = document.getElementById("typingResultLine");

  App.typingAnswered = true;
  document.getElementById("typingFreeInput").disabled = true;
  App.typingRevealedCount = target.length;
  renderTypingRevealRow();

  if (rawValue === target) {
    resultLine.textContent = "Chính xác!";
    resultLine.className = "typing-result-line is-correct";
    App.typingScore++;
    document.getElementById("typingScore").textContent = App.typingScore;
    SRS.rate(App.progress, w._id, "easy");
    playCorrectSound();
    recordWeaknessResult(App.currentDeckId, w._id, true);
  } else {
    resultLine.textContent = `Chưa đúng. Đáp án: ${target}`;
    resultLine.className = "typing-result-line is-wrong";
    SRS.rate(App.progress, w._id, "again");
    playWrongSound();
    recordWeaknessResult(App.currentDeckId, w._id, false);
  }
  saveCurrentSrsProgress();

  setTimeout(() => {
    App.typingIndex++;
    renderTypingCard();
  }, 1200);
}

function typingHandleKeydown(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    typingCheckAnswer();
  }
}
/* ===================================================================
   QUIZ MODE — trắc nghiệm ý nghĩa (TUVUNG: kanji->nghĩa; NGUPHAP: cấu trúc->ý nghĩa)
=================================================================== */

// direction (chỉ áp dụng cho TUVUNG, NGUPHAP luôn cố định cautruc->nghia):
// "kanji_nghia"  : hỏi Kanji, đáp án là Nghĩa (mặc định, kiểu cũ)
// "kanji_hira"   : hỏi Kanji, đáp án là cách đọc Hiragana
// "hira_nghia"   : hỏi cách đọc Hiragana, đáp án là Nghĩa
