/* ===== MODULE: quiz-match.js — Mode Trắc nghiệm nhanh (quiz) + mode Nối từ (match) cho học từ vựng/ngữ pháp ===== */

function getQuizPromptAndAnswer(w, direction) {
  const type = App.currentDeckType;
  if (type === "NGUPHAP") {
    return { prompt: w.cautruc, answer: w.nghia };
  }
  const dir = direction || "kanji_nghia";
  if (dir === "kanji_hira") {
    return { prompt: w.kanji, answer: w.doc };
  }
  if (dir === "hira_nghia") {
    return { prompt: w.doc, answer: w.nghia };
  }
  return { prompt: w.kanji, answer: w.nghia };
}

function buildQuizQuestions() {
  const pool = App.currentWords;
  const qs = shuffle(pool).map((w) => {
    const wrongPool = shuffle(pool.filter((x) => x._id !== w._id)).slice(0, 3);
    const options = shuffle([w, ...wrongPool]);
    return { word: w, options };
  });
  return qs;
}

function initQuizMode() {
  const directionPicker = document.getElementById("quizDirectionPicker");
  if (App.currentDeckType === "NGUPHAP") {
    directionPicker.classList.add("hidden");
  } else {
    directionPicker.classList.remove("hidden");
    directionPicker.value = App.quizDirection;
  }

  App.quizQuestions = buildQuizQuestions();
  App.quizIndex = 0;
  App.quizScore = 0;
  App.quizStartTime = Date.now();

  document.getElementById("quizResult").classList.add("hidden");
  document.getElementById("quizBody").classList.remove("hidden");
  document.getElementById("quizTotal").textContent = App.quizQuestions.length;
  document.getElementById("quizScore").textContent = "0";

  if (App.quizTimerHandle) clearInterval(App.quizTimerHandle);
  App.quizTimerHandle = setInterval(() => {
    const sec = (Date.now() - App.quizStartTime) / 1000;
    document.getElementById("quizTimer").textContent = fmtTime(sec);
  }, 500);

  renderQuizQuestion();
}

function renderQuizQuestion() {
  App.quizAnswering = false;
  const q = App.quizQuestions[App.quizIndex];
  const { prompt } = getQuizPromptAndAnswer(q.word, App.quizDirection);
  document.getElementById("quizPos").textContent = App.quizIndex + 1;
  document.getElementById("quizQuestion").textContent = prompt;

  const optsDiv = document.getElementById("quizOptions");
  optsDiv.innerHTML = "";
  q.options.forEach((opt) => {
    const { answer } = getQuizPromptAndAnswer(opt, App.quizDirection);
    const btn = document.createElement("button");
    btn.className = "quiz-opt";
    btn.textContent = answer;
    btn.addEventListener("click", () => handleQuizAnswer(btn, opt, q));
    optsDiv.appendChild(btn);
  });
}

function handleQuizAnswer(btn, chosen, q) {
  if (App.quizAnswering) return; // chặn double-click vì giờ .disabled không còn pointer-events:none
  App.quizAnswering = true;

  document.querySelectorAll(".quiz-opt").forEach((b) => b.classList.add("disabled"));
  const correct = chosen._id === q.word._id;
  btn.classList.add(correct ? "correct" : "wrong");
  const { answer: correctAnswer } = getQuizPromptAndAnswer(q.word, App.quizDirection);

  if (correct) {
    App.quizScore++;
    document.getElementById("quizScore").textContent = App.quizScore;
    SRS.rate(App.progress, q.word._id, "easy");
    playCorrectSound();
    recordWeaknessResult(App.currentDeckId, q.word._id, true);
  } else {
    document.querySelectorAll(".quiz-opt").forEach((b) => {
      if (b.textContent === correctAnswer) b.classList.add("correct");
    });
    SRS.rate(App.progress, q.word._id, "again");
    playWrongSound();
    recordWeaknessResult(App.currentDeckId, q.word._id, false);
  }
  saveCurrentSrsProgress();

  setTimeout(() => {
    App.quizIndex++;
    if (App.quizIndex >= App.quizQuestions.length) {
      finishQuiz();
    } else {
      renderQuizQuestion();
    }
  }, 750);
}

function finishQuiz() {
  clearInterval(App.quizTimerHandle);
  const totalSec = (Date.now() - App.quizStartTime) / 1000;
  document.getElementById("quizBody").classList.add("hidden");
  document.getElementById("quizResult").classList.remove("hidden");
  document.getElementById("quizFinalScore").textContent =
    `${App.quizScore}/${App.quizQuestions.length} đúng — thời gian ${fmtTime(totalSec)}`;
}

/* ===================================================================
   MATCH GAME MODE
=================================================================== */

function initMatchMode() {
  const PAIR_COUNT = Math.min(8, App.currentWords.length);
  const chosen = shuffle(App.currentWords).slice(0, PAIR_COUNT);

  App.matchTotalPairs = chosen.length;
  App.matchPairs = 0;
  App.matchSelected = [];
  App.matchLocked = false;
  App.matchStartTime = Date.now();

  document.getElementById("matchPairs").textContent = "0";
  document.getElementById("matchTotalPairs").textContent = chosen.length;

  if (App.matchTimerHandle) clearInterval(App.matchTimerHandle);
  App.matchTimerHandle = setInterval(() => {
    const sec = (Date.now() - App.matchStartTime) / 1000;
    document.getElementById("matchTimer").textContent = fmtTime(sec);
  }, 500);

  const cells = [];
  chosen.forEach((w) => {
    const { prompt, answer } = getQuizPromptAndAnswer(w);
    cells.push({ pairId: w._id, type: "prompt", label: prompt, word: w });
    cells.push({ pairId: w._id, type: "answer", label: answer, word: w });
  });
  const shuffled = shuffle(cells);

  const grid = document.getElementById("matchGrid");
  grid.innerHTML = "";
  shuffled.forEach((cell) => {
    const div = document.createElement("div");
    div.className = "match-card" + (cell.type === "prompt" ? " kanji-card" : "");
    div.textContent = cell.label;
    div.dataset.pairId = cell.pairId;
    div.addEventListener("click", () => handleMatchClick(div, cell));
    grid.appendChild(div);
  });
}

function handleMatchClick(div, cell) {
  if (App.matchLocked) return;
  if (div.classList.contains("matched") || div.classList.contains("flipped-sel")) return;

  div.classList.add("flipped-sel");
  App.matchSelected.push({ div, cell });

  if (App.matchSelected.length === 2) {
    App.matchLocked = true;
    const [a, b] = App.matchSelected;
    const isMatch = a.cell.pairId === b.cell.pairId && a.cell.type !== b.cell.type;

    if (isMatch) {
      playCorrectSound();
      setTimeout(() => {
        a.div.classList.remove("flipped-sel");
        b.div.classList.remove("flipped-sel");
        a.div.classList.add("matched");
        b.div.classList.add("matched");
        App.matchPairs++;
        document.getElementById("matchPairs").textContent = App.matchPairs;
        SRS.rate(App.progress, a.cell.word._id, "easy");
        saveCurrentSrsProgress();
        recordWeaknessResult(App.currentDeckId, a.cell.word._id, true);
        App.matchSelected = [];
        App.matchLocked = false;
        if (App.matchPairs >= App.matchTotalPairs) {
          clearInterval(App.matchTimerHandle);
        }
      }, 350);
    } else {
      playWrongSound();
      a.div.classList.add("wrong-flash");
      b.div.classList.add("wrong-flash");
      setTimeout(() => {
        a.div.classList.remove("flipped-sel", "wrong-flash");
        b.div.classList.remove("flipped-sel", "wrong-flash");
        App.matchSelected = [];
        App.matchLocked = false;
      }, 650);
    }
  }
}

/* ===================================================================
   EXAM MODE — làm đề thi trắc nghiệm thật
   - Random thứ tự đáp án mỗi lần hiện câu (tránh học vị trí đáp án)
   - Câu sai bị đẩy xuống cuối hàng đợi, làm lại đến khi đúng
   - Tính điểm: 1 câu đúng (lần đầu) = 1 điểm, không cộng điểm khi làm lại câu sai
=================================================================== */

