/* ===== MODULE: listen-game.js — "聞き取りゲーム" (Game nghe đoán nghĩa).
   Nghe phát âm 1 từ -> đoán NGHĨA (trắc nghiệm 4 đáp án) -> hiện đáp án đúng
   + đọc lại từ đó + trích 1 câu ví dụ trong tài liệu, đọc + hiển thị câu đó
   luôn. Tách file riêng (khác game.js) vì là 1 GAME KHÁC trong cùng danh sách
   "Game", không phải biến thể của game bong bóng/gõ chữ.
===== */

App.listenGame = null;

function initListenGameMode() {
  App.listenGame = null;
  document.querySelectorAll(".lg-phase").forEach((p) => p.classList.add("hidden"));
  document.getElementById("lgPhaseSetup").classList.remove("hidden");

  const picker = document.getElementById("lgDeckPicker");
  const tuvungDecks = App.decks.filter((d) => d.type === "TUVUNG");
  picker.innerHTML = tuvungDecks.map((d) => `<option value="${d.id}">${d.title} (${d.words.length})</option>`).join("");
  App.listenGameConfig = App.listenGameConfig || { deckId: tuvungDecks[0] ? tuvungDecks[0].id : null, count: 10 };
  if (!tuvungDecks.some((d) => d.id === App.listenGameConfig.deckId)) {
    App.listenGameConfig.deckId = tuvungDecks.length ? tuvungDecks[0].id : null;
  }
  picker.value = App.listenGameConfig.deckId;

  document.querySelectorAll(".lg-count-preset").forEach((b) => {
    b.classList.toggle("is-selected", b.dataset.count === String(App.listenGameConfig.count));
  });
}

function pickListenGameCount(preset) {
  document.querySelectorAll(".lg-count-preset").forEach((b) => b.classList.toggle("is-selected", b === preset));
  App.listenGameConfig.count = parseInt(preset.dataset.count, 10);
}

// Trích câu ví dụ ĐẦU TIÊN dạng THUẦN (không HTML/ruby) để: (1) đọc TTS được,
// (2) hiển thị text thường. Tái dùng đúng extractTranslationSuffix() đã có
// (tách phần dịch "(...)" cuối câu) — không viết lại logic tách câu.
function getFirstExampleSentencePlain(w) {
  const full = (w.vi_du || "").trim();
  if (!full) return null;
  const sentences = full.split(/(?<=\)) +(?=\S)/).filter(Boolean);
  const first = sentences[0];
  const translation = extractTranslationSuffix(first);
  const jp = translation ? first.slice(0, first.length - translation.length).trim() : first;
  const vi = translation.replace(/^\(|\)$/g, "").trim();
  return { jp, vi };
}

function buildListenGameQuestions(deck, count) {
  const pool = shuffle(deck.words).slice(0, Math.min(count, deck.words.length));
  return pool.map((w) => {
    const wrongPool = shuffle(deck.words.filter((x) => x._id !== w._id)).slice(0, 3);
    const options = shuffle([w, ...wrongPool]);
    return { word: w, options };
  });
}

function startListenGame() {
  App.listenGameConfig.deckId = document.getElementById("lgDeckPicker").value;
  const deck = App.decks.find((d) => d.id === App.listenGameConfig.deckId);
  if (!deck || deck.words.length < 4) {
    alert("このセットは4語未満です。別のセットを選んでください。");
    return;
  }
  App.listenGame = {
    deck,
    questions: buildListenGameQuestions(deck, App.listenGameConfig.count),
    index: 0,
    score: 0,
    answered: false,
  };
  document.getElementById("lgPhaseSetup").classList.add("hidden");
  document.getElementById("lgPhaseQuestion").classList.remove("hidden");
  document.getElementById("lgTotal").textContent = App.listenGame.questions.length;
  renderListenGameQuestion();
}

function renderListenGameQuestion() {
  const g = App.listenGame;
  g.answered = false;
  const q = g.questions[g.index];
  document.getElementById("lgPos").textContent = g.index + 1;
  document.getElementById("lgScore").textContent = g.score;

  const optsDiv = document.getElementById("lgOptions");
  optsDiv.innerHTML = "";
  q.options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.className = "lg-opt";
    btn.textContent = opt.nghia || "";
    btn.addEventListener("click", () => handleListenGameAnswer(btn, opt, q));
    optsDiv.appendChild(btn);
  });

  document.getElementById("lgReveal").classList.add("hidden");
  document.getElementById("lgPhaseQuestion").classList.remove("hidden");

  // Tự phát âm ngay khi câu hỏi hiện ra — dùng speakJapaneseForced() vì đây
  // là CƠ CHẾ CHÍNH của game (không phải tiện ích phụ như "tự đọc khi lật
  // thẻ"), không được phép bị tắt tiếng bởi App.speechEnabled.
  speakJapaneseForced(getListenGameAnswerText(q.word));
}

function getListenGameAnswerText(w) { return w.doc || w.cautruc || w.kanji || ""; }

function replayListenGameAudio() {
  const q = App.listenGame.questions[App.listenGame.index];
  speakJapaneseForced(getListenGameAnswerText(q.word));
}

function handleListenGameAnswer(btn, chosen, q) {
  const g = App.listenGame;
  if (g.answered) return;
  g.answered = true;
  const isCorrect = chosen._id === q.word._id;
  if (isCorrect) g.score++;
  document.getElementById("lgScore").textContent = g.score;

  document.querySelectorAll(".lg-opt").forEach((b) => b.classList.add("disabled"));
  btn.classList.add(isCorrect ? "correct" : "wrong");
  if (!isCorrect) {
    document.querySelectorAll(".lg-opt").forEach((b) => {
      if (b.textContent === (q.word.nghia || "")) b.classList.add("correct");
    });
  }

  setTimeout(() => showListenGameReveal(q.word), 550);
}

// Màn "hiện đáp án" — kanji + nghĩa + đọc LẠI từ đó + trích 1 câu ví dụ trong
// tài liệu, ĐỌC câu đó luôn (nối tiếp sau khi đọc xong từ) + HIỂN THỊ câu đó.
function showListenGameReveal(w) {
  document.getElementById("lgPhaseQuestion").classList.add("hidden");
  const reveal = document.getElementById("lgReveal");
  reveal.classList.remove("hidden");

  const example = getFirstExampleSentencePlain(w);
  reveal.innerHTML = `
    <div class="lg-reveal-kanji">${w.kanji || w.cautruc || ""}</div>
    <div class="lg-reveal-doc">${w.doc || w.cautruc || ""}</div>
    <div class="lg-reveal-nghia">${w.nghia || ""}</div>
    ${example ? `
      <div class="lg-reveal-example">
        <div class="lg-reveal-example-jp">${example.jp}</div>
        <div class="lg-reveal-example-vi">${example.vi}</div>
      </div>` : ""}
    <button class="lg-next-btn" id="btnLgNext">${App.listenGame.index + 1 >= App.listenGame.questions.length ? "結果を見る" : "次へ →"}</button>
  `;

  // Đọc từ TRƯỚC, đọc xong THẬT SỰ (onend) mới đọc tiếp câu ví dụ — không
  // đoán thời lượng bằng setTimeout (dễ chồng tiếng nếu đoán ngắn, hoặc chờ
  // thừa nếu đoán dài).
  speakJapaneseForced(getListenGameAnswerText(w), () => {
    if (example) speakJapaneseForced(example.jp);
  });

  document.getElementById("btnLgNext").addEventListener("click", nextListenGameQuestion);
}

function nextListenGameQuestion() {
  App.listenGame.index++;
  if (App.listenGame.index >= App.listenGame.questions.length) {
    finishListenGame();
  } else {
    renderListenGameQuestion();
  }
}

function finishListenGame() {
  document.getElementById("lgPhaseQuestion").classList.add("hidden");
  document.getElementById("lgReveal").classList.add("hidden");
  document.getElementById("lgPhaseResult").classList.remove("hidden");
  const g = App.listenGame;
  document.getElementById("lgResultStats").innerHTML = `
    <div class="lg-result-score">${g.score} / ${g.questions.length}</div>
    <div class="lg-result-pct">${Math.round((g.score / g.questions.length) * 100)}%</div>
  `;
}

function backToListenGameSetup() {
  App.listenGame = null;
  document.querySelectorAll(".lg-phase").forEach((p) => p.classList.add("hidden"));
  initListenGameMode();
}
