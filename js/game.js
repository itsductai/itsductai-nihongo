/* ===== MODULE: game.js — "単語バトル" — Game ôn tập từ vựng.
   REBUILD TOÀN DIỆN theo yêu cầu mới:
   - Chọn bộ học riêng trong màn setup (không phụ thuộc deck đang active ở navbar)
   - Bong bóng bay CHAOTIC toàn màn hình (position:fixed, random path mỗi quả)
   - Tường lắp ghép FULL MÀN HÌNH (không phải 1 dải nhỏ)
   - Có nút Skip bỏ qua màn bong bóng
   - Gõ đáp án LUÔN hiện kanji+nghĩa, gõ cách đọc (bỏ hẳn chiều nghĩa->kanji ở
     màn gõ — chỉ màn bong bóng mới có 2 chiều)
   - Gợi ý = vòng tròn theo TỪNG vị trí ký tự, bấm xác nhận rồi mới lộ, không
     còn nút phát âm/gợi ý kiểu cũ
   - Icon toàn SVG, không emoji cứng (tim=mạng, sao=gợi ý)
===== */

const GAME_ACHIEVEMENTS_KEY = "n2vocab_game_achievements";
const GAME_MEDAL_DECAY_DAYS = 14;

const GAME_SVG = {
  heart: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 21s-7.5-4.6-10-9.3C.5 8.1 2.4 4.5 6 4.5c2 0 3.5 1 6 3.4 2.5-2.4 4-3.4 6-3.4 3.6 0 5.5 3.6 4 7.2C19.5 16.4 12 21 12 21Z"/></svg>`,
  star: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="m12 2 2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.8L6 21l1.6-7L2.2 9.3l7.1-.7L12 2Z"/></svg>`,
  play: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l14-8Z"/></svg>`,
  replay: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-3-6.7"/><path d="M21 3v6h-6"/></svg>`,
  skip: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M5 4v16l10-8Z"/><rect x="17" y="4" width="3" height="16"/></svg>`,
  medalGold: `<svg viewBox="0 0 24 24"><circle cx="12" cy="14" r="7" fill="#ffd54a" stroke="#e8a90a" stroke-width="1.2"/><path d="M9 3h6l1.5 6-4.5 3-4.5-3Z" fill="#ffd54a" stroke="#e8a90a" stroke-width="1"/><text x="12" y="17.5" font-size="7" text-anchor="middle" fill="#a06e00" font-weight="800">1</text></svg>`,
  medalSilver: `<svg viewBox="0 0 24 24"><circle cx="12" cy="14" r="7" fill="#d9dfe6" stroke="#9aa5b1" stroke-width="1.2"/><path d="M9 3h6l1.5 6-4.5 3-4.5-3Z" fill="#d9dfe6" stroke="#9aa5b1" stroke-width="1"/><text x="12" y="17.5" font-size="7" text-anchor="middle" fill="#5b6572" font-weight="800">2</text></svg>`,
  medalBronze: `<svg viewBox="0 0 24 24"><circle cx="12" cy="14" r="7" fill="#d69361" stroke="#9c5f30" stroke-width="1.2"/><path d="M9 3h6l1.5 6-4.5 3-4.5-3Z" fill="#d69361" stroke="#9c5f30" stroke-width="1"/><text x="12" y="17.5" font-size="7" text-anchor="middle" fill="#5c341a" font-weight="800">3</text></svg>`,
};
function gameSvg(name) { return GAME_SVG[name] || ""; }

App.game = null;
App.gameConfig = App.gameConfig || { deckId: null, count: 10, sourceMode: "fixed", direction: "kanji-to-nghia" };

/* ===================================================================
   MÀN THIẾT LẬP — chọn bộ học riêng cho game (KHÔNG phụ thuộc deck đang
   active ở navbar, vì 1 số bộ (vd Mimi có sẵn hira) gõ vô nghĩa — Zane dự
   định tạo bộ riêng cho game này).
=================================================================== */
function initGameMode() {
  App.game = null;
  document.querySelectorAll(".game-phase").forEach((p) => p.classList.add("hidden"));
  document.getElementById("gamePhaseSetup").classList.remove("hidden");
  document.getElementById("gameOverOverlay").classList.add("hidden");

  const picker = document.getElementById("gameDeckPicker");
  const tuvungDecks = App.decks.filter((d) => d.type === "TUVUNG");
  picker.innerHTML = tuvungDecks.map((d) => `<option value="${d.id}">${d.title} (${d.words.length})</option>`).join("");
  if (!App.gameConfig.deckId || !tuvungDecks.some((d) => d.id === App.gameConfig.deckId)) {
    App.gameConfig.deckId = tuvungDecks.length ? tuvungDecks[0].id : null;
  }
  picker.value = App.gameConfig.deckId;

  document.querySelectorAll(".game-count-preset").forEach((b) => {
    b.classList.toggle("is-selected", b.dataset.count === String(App.gameConfig.count) || (b.dataset.count === "due" && App.gameConfig.sourceMode === "due"));
  });
  document.querySelectorAll(".game-dir-preset").forEach((b) => {
    b.classList.toggle("is-selected", b.dataset.dir === App.gameConfig.direction);
  });

  renderGameIcons();
}

function renderGameIcons() {
  document.querySelectorAll(".game-svg-star").forEach((el) => { if (!el.innerHTML) el.innerHTML = gameSvg("star"); });
}

function pickGameWordCount(preset) {
  document.querySelectorAll(".game-count-preset").forEach((b) => b.classList.toggle("is-selected", b === preset));
  if (preset.dataset.count === "due") {
    App.gameConfig.sourceMode = "due";
  } else {
    App.gameConfig.sourceMode = "fixed";
    App.gameConfig.count = parseInt(preset.dataset.count, 10);
  }
}

function pickGameDirection(preset) {
  document.querySelectorAll(".game-dir-preset").forEach((b) => b.classList.toggle("is-selected", b === preset));
  App.gameConfig.direction = preset.dataset.dir;
}

function buildGameWordList() {
  const deck = App.decks.find((d) => d.id === App.gameConfig.deckId);
  if (!deck) return [];
  const progress = SRS.loadProgress(deck.id);
  if (App.gameConfig.sourceMode === "due") {
    const dueWords = deck.words.filter((w) => {
      const e = SRS.getEntry(progress, w._id);
      return e.seen && SRS.isDue(e);
    });
    return dueWords.length ? shuffle(dueWords) : shuffle(deck.words).slice(0, 10);
  }
  return shuffle(deck.words).slice(0, Math.min(App.gameConfig.count, deck.words.length));
}

function startGame() {
  App.gameConfig.deckId = document.getElementById("gameDeckPicker").value;
  const words = buildGameWordList();
  if (words.length < 3) {
    alert("このセットは3語未満です。別のセットか出題数を選んでください。");
    return;
  }
  App.game = {
    words,
    direction: App.gameConfig.direction,
    lives: 5,
    stars: 10,
    phase: "bubble",
    bubbleRemaining: words.map((w) => w._id),
    bubbleMatchedCount: 0,
    typingQueue: shuffle(words).map((w) => w._id),
    typingIndex: 0,
    typingRevealed: {},
  };
  document.getElementById("gamePhaseSetup").classList.add("hidden");
  startBubblePhase();
}

/* ===================================================================
   MÀN BONG BÓNG — bay CHAOTIC toàn màn hình, tường lắp ghép chiếm TOÀN BỘ
   nền phía sau. HTML5 Drag & Drop API gốc (không thư viện ngoài).
=================================================================== */
function startBubblePhase() {
  document.getElementById("gamePhaseBubble").classList.remove("hidden");
  document.getElementById("gameBubbleTotal").textContent = App.game.words.length;
  renderGameHud();
  renderGameIcons();
  renderFullWall();
  renderBubbleArena();
}

function getWordDisplay(w) { return w.kanji || w.cautruc || ""; }
function getWordMeaningShort(w) { return (w.nghia || "").split(/[,;、，；]/)[0].trim(); }

function renderFullWall() {
  const wall = document.getElementById("gameWall");
  const isK2N = App.game.direction === "kanji-to-nghia";
  wall.innerHTML = App.game.words.map((w) => {
    const zoneLabel = isK2N ? getWordMeaningShort(w) : getWordDisplay(w);
    const solved = !App.game.bubbleRemaining.includes(w._id);
    if (solved) {
      return `
        <div class="game-wall-slot is-solved" data-word-id="${w._id}">
          <div class="game-wall-kanji">${getWordDisplay(w)}</div>
          <div class="game-wall-doc">${w.doc || w.cautruc || ""}</div>
          <div class="game-wall-nghia">${w.nghia || ""}</div>
        </div>`;
    }
    return `
      <div class="game-wall-slot" data-word-id="${w._id}">
        <div class="game-wall-slot-label">${zoneLabel}</div>
      </div>`;
  }).join("");

  wall.querySelectorAll(".game-wall-slot:not(.is-solved)").forEach((zone) => {
    zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("is-hover"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("is-hover"));
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("is-hover");
      const droppedId = e.dataTransfer.getData("text/plain");
      handleBubbleDrop(droppedId, zone.dataset.wordId, zone);
    });
  });
}

function renderBubbleArena() {
  const arena = document.getElementById("gameBubbleArena");
  arena.innerHTML = "";
  const remainingWords = App.game.bubbleRemaining.map((id) => App.game.words.find((w) => w._id === id));
  const isK2N = App.game.direction === "kanji-to-nghia";

  remainingWords.forEach((w) => {
    const bubbleText = isK2N ? getWordDisplay(w) : getWordMeaningShort(w);
    const bubble = document.createElement("div");
    bubble.className = "game-bubble";
    bubble.draggable = true;
    bubble.dataset.wordId = w._id;
    bubble.textContent = bubbleText;

    bubble.style.left = (5 + Math.random() * 80) + "vw";
    bubble.style.top = (10 + Math.random() * 65) + "vh";
    bubble.style.setProperty("--dx1", (Math.random() * 2 - 1).toFixed(2));
    bubble.style.setProperty("--dy1", (Math.random() * 2 - 1).toFixed(2));
    bubble.style.setProperty("--dx2", (Math.random() * 2 - 1).toFixed(2));
    bubble.style.setProperty("--dy2", (Math.random() * 2 - 1).toFixed(2));
    bubble.style.setProperty("--dur", (6 + Math.random() * 6).toFixed(2) + "s");
    bubble.style.setProperty("--delay", (Math.random() * 4).toFixed(2) + "s");
    bubble.style.setProperty("--size", (76 + Math.random() * 34).toFixed(0) + "px");
    bubble.style.setProperty("--hue", Math.floor(Math.random() * 360));

    bubble.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", w._id);
      bubble.classList.add("is-dragging");
    });
    bubble.addEventListener("dragend", () => bubble.classList.remove("is-dragging"));
    arena.appendChild(bubble);
  });
}

function handleBubbleDrop(droppedId, zoneWordId, zoneEl) {
  if (droppedId === zoneWordId) {
    playGameSuccessEffect(zoneEl);
    App.game.bubbleRemaining = App.game.bubbleRemaining.filter((id) => id !== zoneWordId);
    App.game.bubbleMatchedCount++;
    document.getElementById("gameBubbleProgress").textContent = App.game.bubbleMatchedCount;
    setTimeout(() => {
      renderFullWall();
      if (App.game.bubbleRemaining.length === 0) {
        transitionToTypingPhase();
      } else {
        renderBubbleArena();
      }
    }, 550);
  } else {
    loseLife();
    playGameFailEffect(zoneEl);
  }
}

function skipBubblePhase() {
  if (!confirm("バブルモードをスキップして、直接タイピングに進みますか？")) return;
  App.game.bubbleRemaining = [];
  transitionToTypingPhase();
}

/* ===================================================================
   MÀN GÕ CHỮ — LUÔN hiện kanji + nghĩa cùng lúc, gõ CÁCH ĐỌC (hiragana).
   Gợi ý = vòng tròn theo từng VỊ TRÍ ký tự, bấm xác nhận rồi mới lộ.
=================================================================== */
function transitionToTypingPhase() {
  App.game.phase = "typing";
  document.getElementById("gamePhaseBubble").classList.add("hidden");
  document.getElementById("gamePhaseTyping").classList.remove("hidden");
  document.getElementById("gameTypingTotal").textContent = App.game.words.length;
  renderGameHud();
  renderGameIcons();
  renderTypingQuestion();
}

function getTypingAnswer(w) { return (w.doc || w.cautruc || "").trim(); }

function renderTypingQuestion() {
  const w = App.game.words.find((x) => x._id === App.game.typingQueue[App.game.typingIndex]);
  document.getElementById("gameTypingProgress").textContent = App.game.typingIndex + 1;

  document.getElementById("gameTypingPrompt").innerHTML = `
    <div class="game-typing-prompt-kanji">${getWordDisplay(w)}</div>
    <div class="game-typing-prompt-nghia">${w.nghia || ""}</div>
    <div class="game-typing-prompt-sub">読み方をひらがなで入力してください</div>
  `;

  const answer = getTypingAnswer(w);
  App.game.typingRevealed[w._id] = App.game.typingRevealed[w._id] || new Set();
  const revealed = App.game.typingRevealed[w._id];

  const slotsEl = document.getElementById("gameTypingSlots");
  slotsEl.innerHTML = Array.from(answer).map((ch, i) =>
    `<span class="game-typing-slot${revealed.has(i) ? " is-revealed" : ""}">${revealed.has(i) ? ch : ""}</span>`
  ).join("");

  const circlesEl = document.getElementById("gameTypingHintCircles");
  circlesEl.innerHTML = Array.from(answer).map((_, i) =>
    `<button class="game-hint-circle${revealed.has(i) ? " is-used" : ""}" data-pos="${i}">${i + 1}</button>`
  ).join("");
  circlesEl.querySelectorAll(".game-hint-circle").forEach((btn) => {
    btn.addEventListener("click", () => useGameHintCircle(w, parseInt(btn.dataset.pos, 10)));
  });

  document.getElementById("gameTypingInput").value = "";
  document.getElementById("gameTypingFeedback").textContent = "";
  document.getElementById("gameTypingFeedback").className = "game-typing-feedback";
  document.getElementById("gameTypingInput").focus();
}

function useGameHintCircle(w, pos) {
  const revealed = App.game.typingRevealed[w._id];
  if (revealed.has(pos)) return;
  if (App.game.stars <= 0) { alert("⭐が足りません！"); return; }
  const answer = getTypingAnswer(w);
  const ok = confirm(`⭐を1つ消費して、${pos + 1}文字目「${answer[pos]}」を開けますか？`);
  if (!ok) return;
  App.game.stars--;
  revealed.add(pos);
  renderGameHud();
  renderTypingQuestion();
}

function checkGameTypingAnswer() {
  const w = App.game.words.find((x) => x._id === App.game.typingQueue[App.game.typingIndex]);
  const answer = getTypingAnswer(w);
  const input = document.getElementById("gameTypingInput").value.trim();
  const feedback = document.getElementById("gameTypingFeedback");

  if (input === answer) {
    feedback.textContent = "正解！";
    feedback.className = "game-typing-feedback is-correct";
    playGameSuccessEffect(document.getElementById("gameTypingSlots"));
    setTimeout(() => {
      App.game.typingIndex++;
      if (App.game.typingIndex >= App.game.typingQueue.length) {
        finishGame();
      } else {
        renderTypingQuestion();
      }
    }, 700);
  } else {
    feedback.textContent = "違います。もう一度！";
    feedback.className = "game-typing-feedback is-wrong";
    playGameFailEffect(document.getElementById("gameTypingSlots"));
    loseLife();
  }
}

/* ===================================================================
   MẠNG / SAO / HUD — SVG tim + sao, KHÔNG emoji cứng.
=================================================================== */
function renderGameHud() {
  const heartsHtml = Array.from({ length: 5 }).map((_, i) =>
    `<span class="game-heart${i < App.game.lives ? "" : " is-lost"}">${gameSvg("heart")}</span>`
  ).join("");
  ["gameHudLives", "gameHudLivesTyping"].forEach((id) => { document.getElementById(id).innerHTML = heartsHtml; });
  ["gameHudStars", "gameHudStarsTyping"].forEach((id) => { document.getElementById(id).textContent = App.game.stars; });
  renderGameIcons();
}

function loseLife() {
  App.game.lives--;
  renderGameHud();
  if (App.game.lives <= 0) showGameOver();
}

function showGameOver() {
  document.getElementById("gameOverOverlay").classList.remove("hidden");
}

/* ===================================================================
   KẾT QUẢ + HUY CHƯƠNG
=================================================================== */
function computeGameMedal() {
  const score = App.game.stars + App.game.lives * 2;
  if (score >= 16) return "vang";
  if (score >= 9) return "bac";
  return "dong";
}

function finishGame() {
  App.game.phase = "result";
  document.getElementById("gamePhaseTyping").classList.add("hidden");
  document.getElementById("gamePhaseResult").classList.remove("hidden");

  const medal = computeGameMedal();
  const medalIcon = { vang: "medalGold", bac: "medalSilver", dong: "medalBronze" }[medal];
  const medalLabel = { vang: "金メダル獲得！", bac: "銀メダル獲得！", dong: "銅メダル" }[medal];
  document.getElementById("gameMedalDisplay").innerHTML = `<div class="game-medal-icon medal-${medal}">${gameSvg(medalIcon)}</div>`;
  document.getElementById("gameResultTitle").textContent = medalLabel;
  document.getElementById("gameResultStats").innerHTML = `
    <div>⭐ 残り: ${App.game.stars}/10</div>
    <div>ライフ残り: ${App.game.lives}/5</div>
    <div>単語数: ${App.game.words.length}</div>
  `;
  if (medal === "vang") playGameSuccessEffect(document.getElementById("gameMedalDisplay"));
  saveGameAchievement(medal);
}

/* ===================================================================
   THÀNH TÍCH — lưu huy chương, phai màu theo thời gian nếu không ôn lại.
=================================================================== */
function loadGameAchievements() {
  try { return JSON.parse(localStorage.getItem(GAME_ACHIEVEMENTS_KEY)) || []; } catch (e) { return []; }
}

function saveGameAchievement(medal) {
  const list = loadGameAchievements();
  const deck = App.decks.find((d) => d.id === App.gameConfig.deckId);
  list.unshift({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    deckId: App.gameConfig.deckId,
    deckTitle: deck ? deck.title : App.gameConfig.deckId,
    medal,
    earnedAt: Date.now(),
    lastRefreshedAt: Date.now(),
  });
  localStorage.setItem(GAME_ACHIEVEMENTS_KEY, JSON.stringify(list.slice(0, 200)));
}

function computeMedalDecay(lastRefreshedAt) {
  const daysSince = (Date.now() - lastRefreshedAt) / 86400000;
  return Math.min(1, daysSince / GAME_MEDAL_DECAY_DAYS);
}

function renderAchievementsView() {
  const list = loadGameAchievements();
  const grid = document.getElementById("achievementsGrid");
  const empty = document.getElementById("achievementsEmpty");
  empty.classList.toggle("hidden", list.length > 0);
  const iconMap = { vang: "medalGold", bac: "medalSilver", dong: "medalBronze" };
  grid.innerHTML = list.map((a) => {
    const decay = computeMedalDecay(a.lastRefreshedAt);
    const daysAgo = Math.floor((Date.now() - a.earnedAt) / 86400000);
    return `
      <div class="achievement-card" style="opacity:${1 - decay * 0.75}; filter:saturate(${1 - decay * 0.85})">
        <div class="achievement-icon">${gameSvg(iconMap[a.medal])}</div>
        <div class="achievement-deck">${a.deckTitle}</div>
        <div class="achievement-date">${daysAgo === 0 ? "今日" : daysAgo + "日前"}</div>
        ${decay > 0.5 ? '<div class="achievement-expiring">色あせ中 — もう一度プレイして復活</div>' : ""}
      </div>`;
  }).join("");
}

/* ===================================================================
   HIỆU ỨNG — pháo giấy, rung khi sai.
=================================================================== */
function playGameSuccessEffect(targetEl) {
  const rect = targetEl.getBoundingClientRect();
  for (let i = 0; i < 16; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 60 + Math.random() * 90;
    const p = document.createElement("div");
    p.className = "game-confetti-piece";
    p.style.left = rect.left + rect.width / 2 + "px";
    p.style.top = rect.top + rect.height / 2 + "px";
    // Tính sẵn tọa độ đích bằng JS thay vì cos()/sin() trong CSS — hàm CSS đó
    // quá mới (cùng loại rủi ro với color-mix() từng gây lỗi im lặng trước đó).
    p.style.setProperty("--dx", (Math.cos(angle) * dist).toFixed(1) + "px");
    p.style.setProperty("--dy", (Math.sin(angle) * dist + 60).toFixed(1) + "px");
    p.style.background = ["#ffd15c", "#6b93ff", "#48c98c", "#ff8f6b", "#a98bff", "#ff6bcb"][i % 6];
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 900);
  }
}

function playGameFailEffect(targetEl) {
  targetEl.classList.add("game-shake-fail");
  setTimeout(() => targetEl.classList.remove("game-shake-fail"), 500);
}

function backToGameSetup() {
  App.game = null;
  document.querySelectorAll(".game-phase").forEach((p) => p.classList.add("hidden"));
  document.getElementById("gameOverOverlay").classList.add("hidden");
  initGameMode();
}
