/* ===== MODULE: game.js — "単語バトル" (Game ôn tập từ vựng) — thay thế mode
   Typing cũ. 2 màn: bong bóng ghép nghĩa (kéo-thả) rồi gõ chữ trả lời, có
   mạng/sao/huy chương. UI tiếng Nhật theo yêu cầu. ===== */

const GAME_ACHIEVEMENTS_KEY = "n2vocab_game_achievements";
const GAME_MEDAL_DECAY_DAYS = 14; // huy chương phai màu dần trong 14 ngày nếu không ôn lại

App.game = null; // state của ván đang chơi, null khi ở màn thiết lập

/* ===================================================================
   MÀN THIẾT LẬP
=================================================================== */
function initGameMode() {
  App.game = null;
  document.querySelectorAll(".game-phase").forEach((p) => p.classList.add("hidden"));
  document.getElementById("gamePhaseSetup").classList.remove("hidden");
  document.getElementById("gameOverOverlay").classList.add("hidden");

  // Đánh dấu preset đang chọn (mặc định 10 từ, chiều kanji->nghĩa)
  App.gameConfig = App.gameConfig || { count: 10, sourceMode: "fixed", direction: "kanji-to-nghia" };
  document.querySelectorAll(".game-count-preset").forEach((b) => {
    b.classList.toggle("is-selected", b.dataset.count === String(App.gameConfig.count) || (b.dataset.count === "due" && App.gameConfig.sourceMode === "due"));
  });
  document.querySelectorAll(".game-dir-preset").forEach((b) => {
    b.classList.toggle("is-selected", b.dataset.dir === App.gameConfig.direction);
  });
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

// Lấy danh sách từ cho ván chơi — theo số lượng cố định (random trong bộ đang
// chọn) hoặc toàn bộ từ đến hạn ôn (SRS due) của bộ đang chọn.
function buildGameWordList() {
  const allWords = App.currentWords;
  if (App.gameConfig.sourceMode === "due") {
    const dueWords = allWords.filter((w) => SRS.isDue(SRS.getEntry(App.progress, w._id)) && SRS.getEntry(App.progress, w._id).seen);
    return dueWords.length ? shuffle(dueWords) : shuffle(allWords).slice(0, 10);
  }
  return shuffle(allWords).slice(0, Math.min(App.gameConfig.count, allWords.length));
}

function startGame() {
  const words = buildGameWordList();
  if (words.length < 3) {
    alert("Bộ từ này chưa đủ ít nhất 3 từ để chơi — chọn bộ khác hoặc số lượng nhỏ hơn nhé.");
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
    typingHintUsed: {}, // _id -> {speak: bool, letter: bool}
  };
  document.getElementById("gamePhaseSetup").classList.add("hidden");
  startBubblePhase();
}

/* ===================================================================
   MÀN BONG BÓNG — kéo-thả bong bóng (kanji/nghĩa) vào đúng ô đích.
   Dùng HTML5 Drag & Drop API gốc trình duyệt (không cần thư viện ngoài).
=================================================================== */
function startBubblePhase() {
  document.getElementById("gamePhaseBubble").classList.remove("hidden");
  document.getElementById("gameBubbleTotal").textContent = App.game.words.length;
  renderGameHud();
  renderBubbleArena();
}

function getWordDisplay(w) {
  return w.kanji || w.cautruc || "";
}

// Render toàn bộ bong bóng (nguồn kéo) + toàn bộ ô đích (drop zone) cho các
// từ CHƯA ghép xong. Xáo trộn vị trí ô đích để không thẳng hàng với bong bóng
// nguồn (tăng độ khó/thử thách thay vì chỉ đơn giản kéo thẳng xuống).
function renderBubbleArena() {
  const arena = document.getElementById("gameBubbleArena");
  const remainingIds = App.game.bubbleRemaining;
  const remainingWords = remainingIds.map((id) => App.game.words.find((w) => w._id === id));

  const isK2N = App.game.direction === "kanji-to-nghia";
  const bubbleSourceField = isK2N ? "kanjiSide" : "nghiaSide";

  arena.innerHTML = `
    <div class="game-bubble-pool" id="gameBubblePool"></div>
    <div class="game-drop-zones" id="gameDropZones"></div>
  `;
  const pool = document.getElementById("gameBubblePool");
  const zones = document.getElementById("gameDropZones");

  remainingWords.forEach((w, i) => {
    const bubbleText = isK2N ? getWordDisplay(w) : (w.nghia || "").split(/[,;、，；]/)[0].trim();
    const bubble = document.createElement("div");
    bubble.className = "game-bubble";
    bubble.draggable = true;
    bubble.dataset.wordId = w._id;
    bubble.textContent = bubbleText;
    // Vị trí trôi nổi ngẫu nhiên bằng CSS custom property, animation tự chạy
    bubble.style.setProperty("--float-x", (Math.random() * 2 - 1).toFixed(2));
    bubble.style.setProperty("--float-delay", (Math.random() * 3).toFixed(2) + "s");
    bubble.style.setProperty("--float-dur", (4 + Math.random() * 3).toFixed(2) + "s");
    bubble.addEventListener("dragstart", (e) => {
      e.dataTransfer.setData("text/plain", w._id);
      bubble.classList.add("is-dragging");
    });
    bubble.addEventListener("dragend", () => bubble.classList.remove("is-dragging"));
    pool.appendChild(bubble);
  });

  const shuffledZoneWords = shuffle(remainingWords);
  shuffledZoneWords.forEach((w) => {
    const zoneLabel = isK2N ? (w.nghia || "").split(/[,;、，；]/)[0].trim() : getWordDisplay(w);
    const zone = document.createElement("div");
    zone.className = "game-drop-zone";
    zone.dataset.wordId = w._id;
    zone.textContent = zoneLabel;
    zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("is-hover"); });
    zone.addEventListener("dragleave", () => zone.classList.remove("is-hover"));
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      zone.classList.remove("is-hover");
      const droppedId = e.dataTransfer.getData("text/plain");
      handleBubbleDrop(droppedId, w._id, zone);
    });
    zones.appendChild(zone);
  });
}

function handleBubbleDrop(droppedId, zoneWordId, zoneEl) {
  if (droppedId === zoneWordId) {
    // ĐÚNG — bong bóng vỡ, chữ hiện lên tường kèm nghĩa + cách đọc
    playGameSuccessEffect(zoneEl);
    const w = App.game.words.find((x) => x._id === zoneWordId);
    addToGameWall(w);
    App.game.bubbleRemaining = App.game.bubbleRemaining.filter((id) => id !== zoneWordId);
    App.game.bubbleMatchedCount++;
    document.getElementById("gameBubbleProgress").textContent = App.game.bubbleMatchedCount;
    setTimeout(() => {
      if (App.game.bubbleRemaining.length === 0) {
        transitionToTypingPhase();
      } else {
        renderBubbleArena();
      }
    }, 500);
  } else {
    // SAI — mất 1 mạng, hiệu ứng rầu rĩ
    loseLife();
    playGameFailEffect(zoneEl);
  }
}

function addToGameWall(w) {
  const wall = document.getElementById("gameWall");
  const item = document.createElement("div");
  item.className = "game-wall-item";
  item.innerHTML = `
    <div class="game-wall-kanji">${getWordDisplay(w)}</div>
    <div class="game-wall-doc">${w.doc || w.cautruc || ""}</div>
    <div class="game-wall-nghia">${w.nghia || ""}</div>
  `;
  wall.appendChild(item);
}

/* ===================================================================
   MÀN GÕ CHỮ — hiện số ký tự bằng ô trống, gõ xong bấm "答える" để kiểm tra.
   Sai thì KHÔNG qua từ tiếp theo (giữ nguyên ở từ đó), mất 1 mạng.
=================================================================== */
function transitionToTypingPhase() {
  App.game.phase = "typing";
  document.getElementById("gamePhaseBubble").classList.add("hidden");
  document.getElementById("gamePhaseTyping").classList.remove("hidden");
  document.getElementById("gameTypingTotal").textContent = App.game.words.length;
  renderGameHud();
  renderTypingQuestion();
}

function getTypingAnswer(w) {
  return (w.doc || w.cautruc || "").trim();
}

function renderTypingQuestion() {
  const w = App.game.words.find((x) => x._id === App.game.typingQueue[App.game.typingIndex]);
  document.getElementById("gameTypingProgress").textContent = App.game.typingIndex + 1;
  const promptEl = document.getElementById("gameTypingPrompt");
  // Chiều kanji->nghĩa: đề hiện kanji, gõ CÁCH ĐỌC. Chiều nghĩa->kanji: đề hiện
  // nghĩa, vẫn gõ cách đọc (gõ kanji trên bàn phím thường không khả thi) —
  // nhưng hiện thêm kanji đáp án ở gợi ý cuối cùng để xác nhận đang hỏi từ nào.
  if (App.game.direction === "kanji-to-nghia") {
    promptEl.innerHTML = `<div class="game-typing-prompt-main">${getWordDisplay(w)}</div><div class="game-typing-prompt-sub">この言葉の読み方は？</div>`;
  } else {
    promptEl.innerHTML = `<div class="game-typing-prompt-main">${w.nghia || ""}</div><div class="game-typing-prompt-sub">この意味の言葉の読み方は？</div>`;
  }

  const answer = getTypingAnswer(w);
  const slotsEl = document.getElementById("gameTypingSlots");
  slotsEl.innerHTML = Array.from(answer).map(() => `<span class="game-typing-slot"></span>`).join("");

  document.getElementById("gameTypingInput").value = "";
  document.getElementById("gameTypingFeedback").textContent = "";
  document.getElementById("gameTypingFeedback").className = "game-typing-feedback";
  document.getElementById("gameTypingInput").focus();
}

function updateTypingSlotsLive() {
  const input = document.getElementById("gameTypingInput").value;
  const slots = document.querySelectorAll("#gameTypingSlots .game-typing-slot");
  slots.forEach((slot, i) => { slot.textContent = input[i] || ""; slot.classList.toggle("is-filled", !!input[i]); });
}

function checkGameTypingAnswer() {
  const w = App.game.words.find((x) => x._id === App.game.typingQueue[App.game.typingIndex]);
  const answer = getTypingAnswer(w);
  const input = document.getElementById("gameTypingInput").value.trim();
  const feedback = document.getElementById("gameTypingFeedback");

  if (input === answer) {
    feedback.textContent = "✅ 正解！";
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
    feedback.textContent = "❌ 違います。もう一度！";
    feedback.className = "game-typing-feedback is-wrong";
    playGameFailEffect(document.getElementById("gameTypingSlots"));
    loseLife();
  }
}

// Gợi ý — tốn 1 sao mỗi lần dùng, mỗi loại gợi ý chỉ dùng được 1 lần/từ.
function useGameHint(type) {
  const w = App.game.words.find((x) => x._id === App.game.typingQueue[App.game.typingIndex]);
  const used = App.game.typingHintUsed[w._id] || {};
  if (used[type]) return; // đã dùng rồi, không trừ sao lần 2
  if (App.game.stars <= 0) { alert("⭐が足りません！"); return; }

  App.game.stars--;
  used[type] = true;
  App.game.typingHintUsed[w._id] = used;
  renderGameHud();

  if (type === "speak") {
    speakForGameHint(getTypingAnswer(w));
  } else if (type === "letter") {
    const answer = getTypingAnswer(w);
    const feedback = document.getElementById("gameTypingFeedback");
    feedback.textContent = `💡 最初の文字：「${answer[0]}」`;
    feedback.className = "game-typing-feedback is-hint";
  }
}

// Phát âm gợi ý — KHÔNG phụ thuộc App.speechEnabled (setting đó dành cho
// "tự đọc khi lật thẻ Flashcard", khác ngữ cảnh — đây là gợi ý CHỦ ĐỘNG bấm
// mua bằng sao nên phải luôn phát được dù setting kia đang tắt).
function speakForGameHint(text) {
  if (!text || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "ja-JP";
    utter.rate = 0.9;
    const voice = cachedJapaneseVoice || pickJapaneseVoice();
    if (voice) utter.voice = voice;
    window.speechSynthesis.speak(utter);
  } catch (e) { /* ignore */ }
}

/* ===================================================================
   MẠNG / SAO / HUD
=================================================================== */
function renderGameHud() {
  const heartsHtml = Array.from({ length: 5 }).map((_, i) => `<span class="game-heart${i < App.game.lives ? "" : " is-lost"}">💧</span>`).join("");
  ["gameHudLives", "gameHudLivesTyping"].forEach((id) => { document.getElementById(id).innerHTML = heartsHtml; });
  ["gameHudStars", "gameHudStarsTyping"].forEach((id) => { document.getElementById(id).textContent = App.game.stars; });
}

function loseLife() {
  App.game.lives--;
  renderGameHud();
  if (App.game.lives <= 0) {
    showGameOver();
  }
}

function showGameOver() {
  document.getElementById("gameOverOverlay").classList.remove("hidden");
}

/* ===================================================================
   KẾT QUẢ + HUY CHƯƠNG — kết hợp CẢ sao còn lại VÀ mạng còn lại.
   Điểm tổng = sao_còn_lại (tối đa 10) + mạng_còn_lại*2 (tối đa 10) = tối đa 20.
   Vàng >= 16, Bạc >= 9, còn lại = Đồng.
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
  document.getElementById("gamePhaseBubble").classList.add("hidden");
  document.getElementById("gamePhaseResult").classList.remove("hidden");

  const medal = computeGameMedal();
  const medalLabel = { vang: "🥇 金メダル！", bac: "🥈 銀メダル！", dong: "🥉 銅メダル" }[medal];
  document.getElementById("gameMedalDisplay").innerHTML = `<div class="game-medal-icon medal-${medal}">${{ vang: "🥇", bac: "🥈", dong: "🥉" }[medal]}</div>`;
  document.getElementById("gameResultTitle").textContent = medalLabel;
  document.getElementById("gameResultStats").innerHTML = `
    <div>⭐ 残り: ${App.game.stars}/10</div>
    <div>💧 残りライフ: ${App.game.lives}/5</div>
    <div>📚 単語数: ${App.game.words.length}</div>
  `;
  playGameEndEffect(medal);
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
  const deck = App.decks.find((d) => d.id === App.currentDeckId);
  list.unshift({
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    deckId: App.currentDeckId,
    deckTitle: deck ? deck.title : App.currentDeckId,
    medal,
    earnedAt: Date.now(),
    lastRefreshedAt: Date.now(),
  });
  localStorage.setItem(GAME_ACHIEVEMENTS_KEY, JSON.stringify(list.slice(0, 200)));
}

// Độ phai màu 0 (mới, rực rỡ) -> 1 (hết hạn hoàn toàn, xám xịt) trong 14 ngày.
function computeMedalDecay(lastRefreshedAt) {
  const daysSince = (Date.now() - lastRefreshedAt) / 86400000;
  return Math.min(1, daysSince / GAME_MEDAL_DECAY_DAYS);
}

function renderAchievementsView() {
  const list = loadGameAchievements();
  const grid = document.getElementById("achievementsGrid");
  const empty = document.getElementById("achievementsEmpty");
  empty.classList.toggle("hidden", list.length > 0);
  grid.innerHTML = list.map((a) => {
    const decay = computeMedalDecay(a.lastRefreshedAt);
    const icon = { vang: "🥇", bac: "🥈", dong: "🥉" }[a.medal];
    const daysAgo = Math.floor((Date.now() - a.earnedAt) / 86400000);
    return `
      <div class="achievement-card" style="opacity:${1 - decay * 0.75}; filter:saturate(${1 - decay * 0.85})">
        <div class="achievement-icon">${icon}</div>
        <div class="achievement-deck">${a.deckTitle}</div>
        <div class="achievement-date">${daysAgo === 0 ? "今日" : daysAgo + "日前"}</div>
        ${decay > 0.5 ? '<div class="achievement-expiring">⚠ 色あせ中 — もう一度プレイして復活させよう</div>' : ""}
      </div>`;
  }).join("");
}

/* ===================================================================
   HIỆU ỨNG — pháo giấy khi đúng, rầu rĩ khi sai, hiệu ứng kết thúc.
   Thuần CSS animation qua class tạm thời + particle span tự tạo/tự xóa.
=================================================================== */
function playGameSuccessEffect(targetEl) {
  const rect = targetEl.getBoundingClientRect();
  for (let i = 0; i < 14; i++) {
    const p = document.createElement("div");
    p.className = "game-confetti-piece";
    p.style.left = rect.left + rect.width / 2 + "px";
    p.style.top = rect.top + rect.height / 2 + "px";
    p.style.setProperty("--angle", (Math.random() * 360) + "deg");
    p.style.setProperty("--dist", (60 + Math.random() * 80) + "px");
    p.style.background = ["#ffd15c", "#6b93ff", "#48c98c", "#ff8f6b", "#a98bff"][i % 5];
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 900);
  }
}

function playGameFailEffect(targetEl) {
  targetEl.classList.add("game-shake-fail");
  setTimeout(() => targetEl.classList.remove("game-shake-fail"), 500);
}

function playGameEndEffect(medal) {
  if (medal === "vang") playGameSuccessEffect(document.getElementById("gameMedalDisplay"));
}

/* ===================================================================
   NÚT "CHƠI LẠI"/"QUAY LẠI THIẾT LẬP" ở màn kết quả + game over
=================================================================== */
function backToGameSetup() {
  App.game = null;
  document.querySelectorAll(".game-phase").forEach((p) => p.classList.add("hidden"));
  document.getElementById("gameOverOverlay").classList.add("hidden");
  document.getElementById("gameWall").innerHTML = "";
  initGameMode();
}
