/* ===== MODULE: choukai.js — Toàn bộ tính năng "Luyện nghe" (dethi-choukai): làm đề nghe + Luyện nghe câu (shadow/karaoke) ===== */

function loadChoukaiHistoryStats() {
  try { return JSON.parse(localStorage.getItem(CHOUKAI_HISTORY_KEY)) || {}; } catch (e) { return {}; }
}
function saveChoukaiHistoryStats(stats) {
  localStorage.setItem(CHOUKAI_HISTORY_KEY, JSON.stringify(stats));
}
function loadChoukaiDetailHistoryStats() {
  try { return JSON.parse(localStorage.getItem(CHOUKAI_DETAIL_HISTORY_KEY)) || {}; } catch (e) { return {}; }
}
function saveChoukaiDetailHistoryStats(stats) {
  localStorage.setItem(CHOUKAI_DETAIL_HISTORY_KEY, JSON.stringify(stats));
}
function recordChoukaiCompletion(testId, info) {
  const stats = loadChoukaiHistoryStats();
  const prev = stats[testId] || { totalCompletions: 0 };
  stats[testId] = {
    totalCompletions: prev.totalCompletions + 1,
    lastScore: info.score,
    lastTotal: info.total,
    lastSeconds: info.seconds,
    lastCompletedAt: Date.now(),
  };
  saveChoukaiHistoryStats(stats);
}
function saveChoukaiDetailSnapshot(testId, answers) {
  const stats = loadChoukaiDetailHistoryStats();
  stats[testId] = { answers: answers, savedAt: Date.now() };
  saveChoukaiDetailHistoryStats(stats);
}

// Mỗi câu trả lời được định danh bằng key duy nhất trong 1 đề:
// "m{mondaiNumber}q{qnum}" hoặc thêm "s{subIndex}" cho câu có 2 câu hỏi con (Mondai 5).
function choukaiKeyFor(mNum, qnum, subIndex) {
  return (subIndex === undefined || subIndex === null) ? ("m" + mNum + "q" + qnum) : ("m" + mNum + "q" + qnum + "s" + subIndex);
}

function populateChoukaiPicker() {
  const picker = document.getElementById("choukaiPicker");
  picker.innerHTML = '<option value="">— chọn đề nghe —</option>';
  App.choukaiTests.forEach(function (t) {
    const opt = document.createElement("option");
    opt.value = t.id;
    let totalQ = 0;
    t.mondai.forEach(function (m) {
      m.questions.forEach(function (q) {
        totalQ += q.isDualQuestion ? q.subQuestions.length : 1;
      });
    });
    opt.textContent = t.title + " (" + totalQ + " câu)";
    picker.appendChild(opt);
  });
}

function renderChoukaiPickerState() {
  const picker = document.getElementById("choukaiPicker");
  if (picker.options.length <= 1) populateChoukaiPicker();
  const hasResultShown = !document.getElementById("choukaiResult").classList.contains("hidden");
  document.getElementById("choukaiEmpty").classList.toggle("hidden", !!App.currentChoukaiId);
  document.getElementById("choukaiBody").classList.toggle("hidden", !App.currentChoukaiId || hasResultShown);
}

function getChoukaiTest(testId) {
  return App.choukaiTests.find(function (t) { return t.id === testId; });
}

// Mở modal chọn Mondai cụ thể (hoặc cả đề) rồi chọn chế độ chấm.
function openChoukaiModeModal(testId) {
  App.choukaiPendingTestId = testId;
  const test = getChoukaiTest(testId);
  const mondaiPicker = document.getElementById("choukaiMondaiPicker");
  mondaiPicker.innerHTML = '<option value="all">Luyện cả đề (Mondai 1→5)</option>';
  test.mondai.forEach(function (m) {
    const opt = document.createElement("option");
    opt.value = String(m.number);
    opt.textContent = "Chỉ Mondai " + m.number + " (" + m.name + ")";
    mondaiPicker.appendChild(opt);
  });
  mondaiPicker.classList.remove("hidden");
  mondaiPicker.value = "all";

  const detailStats = loadChoukaiDetailHistoryStats();
  const saved = detailStats[testId];
  const viewSavedBtn = document.getElementById("btnChoukaiViewSavedResult");
  if (saved) {
    viewSavedBtn.classList.remove("hidden");
    const correctCount = Object.values(saved.answers).filter(function (a) { return a.correct; }).length;
    const total = Object.keys(saved.answers).length;
    const d = new Date(saved.savedAt);
    document.getElementById("choukaiSavedResultDesc").textContent =
      "Lần làm gần nhất (" + d.getDate() + "/" + (d.getMonth() + 1) + "): " + correctCount + "/" + total + " câu đúng. Xem lại không cần làm lại.";
  } else {
    viewSavedBtn.classList.add("hidden");
  }
  document.getElementById("choukaiModeModalOverlay").classList.remove("hidden");
}

function confirmChoukaiMode(mode) {
  document.getElementById("choukaiModeModalOverlay").classList.add("hidden");
  App.choukaiScoreMode = mode;
  const mondaiVal = document.getElementById("choukaiMondaiPicker").value;
  App.choukaiMondaiFilter = mondaiVal === "all" ? "all" : parseInt(mondaiVal, 10);
  startChoukai(App.choukaiPendingTestId);
}

// Xây hàng đợi câu hỏi dạng phẳng từ cấu trúc mondai lồng nhau — câu có
// isDualQuestion (Mondai 5, câu cuối) sẽ tách thành 2 mục riêng trong hàng đợi
// (subIndex 0 và 1) nhưng vẫn dùng chung audio/script.
function buildChoukaiQueue(test, mondaiFilter) {
  const queue = [];
  test.mondai.forEach(function (m, mIndex) {
    if (mondaiFilter !== "all" && m.number !== mondaiFilter) return;
    m.questions.forEach(function (q, qIndex) {
      if (q.isDualQuestion) {
        q.subQuestions.forEach(function (sub, subIndex) {
          queue.push({ mIndex: mIndex, qIndex: qIndex, subIndex: subIndex });
        });
      } else {
        queue.push({ mIndex: mIndex, qIndex: qIndex, subIndex: null });
      }
    });
  });
  return queue;
}

function startChoukai(testId) {
  const test = getChoukaiTest(testId);
  if (!test) return;
  App.currentChoukaiId = testId;
  App.choukaiQueue = buildChoukaiQueue(test, App.choukaiMondaiFilter);
  App.choukaiPos = 0;
  App.choukaiAnswers = {};
  App.choukaiScore = 0;
  App.choukaiHintEnabled = false;
  App.choukaiStartTime = Date.now();
  App.choukaiCurrentAudioSrc = null;
  App.choukaiAnswering = false;

  document.getElementById("choukaiEmpty").classList.add("hidden");
  document.getElementById("choukaiResult").classList.add("hidden");
  document.getElementById("choukaiBody").classList.remove("hidden");
  document.getElementById("btnChoukaiExitEarly").classList.toggle("hidden", App.choukaiScoreMode !== "instant");
  document.getElementById("choukaiHintToggle").checked = false;

  renderChoukaiQuestion();
}

function getChoukaiCurrentItem() {
  const test = getChoukaiTest(App.currentChoukaiId);
  const pos = App.choukaiQueue[App.choukaiPos];
  if (!test || !pos) return null;
  const mondai = test.mondai[pos.mIndex];
  const q = mondai.questions[pos.qIndex];
  const sub = pos.subIndex !== null ? q.subQuestions[pos.subIndex] : null;
  return { test: test, mondai: mondai, q: q, sub: sub, pos: pos };
}

function getChoukaiAudioSrc(test, mondai) {
  if (test.audioMode === "combined") return "file-nghe/" + test.audioFile;
  const fname = test.audioFiles && test.audioFiles[String(mondai.number)];
  return fname ? "file-nghe/" + fname : null;
}

function renderChoukaiQuestion() {
  const item = getChoukaiCurrentItem();
  if (!item) { finishChoukai(); return; }
  const test = item.test, mondai = item.mondai, q = item.q, sub = item.sub;

  App.choukaiAnswering = false; // mở khóa lựa chọn cho câu mới
  document.getElementById("choukaiReviewPanel").classList.add("hidden");
  document.getElementById("choukaiProgressText").textContent =
    "Câu " + (App.choukaiPos + 1) + "/" + App.choukaiQueue.length + " · Mondai " + mondai.number + " (" + mondai.name + ")";
  document.getElementById("choukaiMondaiInstruction").textContent = mondai.instruction;

  const audioSrc = getChoukaiAudioSrc(test, mondai);
  const audioEl = document.getElementById("choukaiAudioEl");
  const hint = document.getElementById("choukaiAudioHint");
  if (audioSrc) {
    // CHỈ load lại file khi file thật sự đổi (sang Mondai khác dùng file khác).
    // Trước đây set audioEl.src mỗi lần render khiến audio bị TẢI LẠI TỪ ĐẦU mỗi
    // khi qua câu kế trong CÙNG 1 Mondai (dùng chung 1 file) — làm gián đoạn nghe
    // liên tục dù câu 1→5 của 1 Mondai vốn nằm trong 1 file audio duy nhất.
    //
    // "startSec" (tùy chọn, số giây) trong JSON câu hỏi: nếu file JSON CÓ field
    // này, app tự seek audio tới đúng đoạn của câu khi chuyển câu (kể cả khi vẫn
    // dùng chung 1 file audio như cũ). Nếu KHÔNG có field này (file cũ chưa cập
    // nhật), app giữ nguyên hành vi cũ — không tự seek, người học tự kéo thanh
    // thời gian như trước, KHÔNG lỗi/crash gì cả.
    const seekToStart = function () {
      if (typeof q.startSec === "number") {
        try { audioEl.currentTime = q.startSec; } catch (e) { /* bỏ qua nếu chưa sẵn sàng */ }
      }
    };
    if (App.choukaiCurrentAudioSrc !== audioSrc) {
      audioEl.src = audioSrc;
      App.choukaiCurrentAudioSrc = audioSrc;
      if (typeof q.startSec === "number") {
        audioEl.addEventListener("loadedmetadata", seekToStart, { once: true });
      }
    } else {
      // Cùng file (cùng Mondai) — chỉ seek nếu câu mới có khai báo startSec.
      seekToStart();
    }
    hint.textContent = test.audioMode === "combined"
      ? "⚠ Đề này dùng 1 file audio chung cho cả đề — tự kéo thanh thời gian tới đúng đoạn."
      : "";
  } else {
    audioEl.removeAttribute("src");
    App.choukaiCurrentAudioSrc = null;
    hint.textContent = "⚠ Chưa có file audio cho Mondai này.";
  }

  const promptText = sub ? (sub.promptVi || "") : (q.prompt || "");
  document.getElementById("choukaiPrompt").textContent = promptText;

  const options = sub ? sub.options : q.options;
  const correctIndexForRender = sub ? sub.correctIndex : q.correctIndex;
  const key = choukaiKeyFor(mondai.number, q.qnum, item.pos.subIndex);
  const existingAnswer = App.choukaiAnswers[key];

  const optWrap = document.getElementById("choukaiOptions");
  optWrap.innerHTML = "";
  options.forEach(function (opt, idx) {
    const btn = document.createElement("button");
    btn.className = "quiz-opt";
    btn.textContent = opt;
    if (existingAnswer) {
      // Câu này đã trả lời rồi (quay lại bằng nút "Câu trước") — khóa lại, không
      // cho trả lời lần 2 (tránh lặp lại lỗi cộng điểm 2 lần), chỉ hiển thị lại
      // trạng thái đã chọn.
      btn.classList.add("disabled");
      if (idx === correctIndexForRender) btn.classList.add("correct");
      else if (idx === existingAnswer.chosenIndex) btn.classList.add("wrong");
    } else {
      btn.addEventListener("click", function () { handleChoukaiAnswer(idx); });
    }
    optWrap.appendChild(btn);
  });
  if (existingAnswer) {
    App.choukaiAnswering = true;
    if (App.choukaiScoreMode === "instant") showChoukaiReviewPanel(existingAnswer.correct);
  }

  // Gợi ý từ khóa — chỉ Mondai 3 & 5
  const hintRow = document.getElementById("choukaiHintRow");
  const showHintRow = (mondai.number === 3 || mondai.number === 5) && q.keywords && q.keywords.length;
  hintRow.classList.toggle("hidden", !showHintRow);
  const kwBox = document.getElementById("choukaiKeywords");
  if (showHintRow && App.choukaiHintEnabled) {
    kwBox.classList.remove("hidden");
    kwBox.innerHTML = q.keywords.map(function (k) { return '<span class="choukai-keyword-chip">' + k + '</span>'; }).join("");
  } else {
    kwBox.classList.add("hidden");
  }

  document.getElementById("btnChoukaiPrev").disabled = App.choukaiPos === 0;
}

function handleChoukaiAnswer(chosenIndex) {
  if (App.choukaiAnswering) return; // chặn bấm thêm lần nữa sau khi đã trả lời câu này
  const item = getChoukaiCurrentItem();
  if (!item) return;
  App.choukaiAnswering = true;

  const mondai = item.mondai, q = item.q, sub = item.sub, pos = item.pos;
  const correctIndex = sub ? sub.correctIndex : q.correctIndex;
  const correct = chosenIndex === correctIndex;
  const key = choukaiKeyFor(mondai.number, q.qnum, pos.subIndex);

  App.choukaiAnswers[key] = { chosenIndex: chosenIndex, correctIndex: correctIndex, correct: correct };
  if (correct) App.choukaiScore++;

  // Khóa toàn bộ lựa chọn ngay sau khi trả lời — trước đây các nút vẫn bấm được
  // dưới panel review, bấm thêm sẽ GHI ĐÈ đáp án + cộng điểm thêm lần nữa, khiến
  // điểm "câu đúng" bị đẩy lên gần bằng tổng số câu đã làm. Đây là lỗi đã sửa.
  document.querySelectorAll("#choukaiOptions .quiz-opt").forEach(function (b, idx) {
    b.classList.add("disabled");
    if (idx === correctIndex) b.classList.add("correct");
    else if (idx === chosenIndex) b.classList.add("wrong");
  });

  // Ghi vào hệ thống điểm yếu chung (deckId giả "__choukai__"), tái dùng
  // recordWeaknessResult đã có sẵn cho exam mode.
  const label = (sub ? sub.promptVi : q.prompt) || (q.script || "").slice(0, 50);
  recordWeaknessResult("__choukai__", App.currentChoukaiId + "::" + key, correct, "M" + mondai.number + " - " + label);

  if (App.choukaiScoreMode === "instant") {
    showChoukaiReviewPanel(correct);
  } else {
    choukaiGoNext();
  }
}

function showChoukaiReviewPanel(correct) {
  const panel = document.getElementById("choukaiReviewPanel");
  panel.classList.remove("hidden");
  const resultEl = document.getElementById("choukaiReviewResult");
  resultEl.textContent = correct ? "✓ Đúng!" : "✕ Sai";
  resultEl.className = "choukai-review-result " + (correct ? "is-correct" : "is-wrong");
  App.choukaiReviewTab = "script";
  document.querySelectorAll(".choukai-review-tab").forEach(function (b) {
    b.classList.toggle("is-active", b.dataset.tab === "script");
  });
  renderChoukaiReviewContent();
}

function clearKaraokeHandler(handlerKey) {
  const h = App.karaokeHandlers[handlerKey];
  if (h) {
    if (h.audioEl && h.fn) h.audioEl.removeEventListener("timeupdate", h.fn);
    if (h.scrollEl && h.onScroll) h.scrollEl.removeEventListener("scroll", h.onScroll);
    if (h.jumpBtn && h.jumpBtn.parentNode) h.jumpBtn.parentNode.removeChild(h.jumpBtn);
  }
  App.karaokeHandlers[handlerKey] = null;
}

// Tìm khung CUỘN ĐƯỢC gần nhất bao quanh 1 phần tử — dùng để biết nên lắng
// nghe sự kiện "scroll" ở đâu (vd panel xem đáp án cuộn riêng trong khung nhỏ,
// còn "Luyện nghe câu" full trang thì cuộn ở `.main`). Fallback về `.main` nếu
// không tìm thấy khung cuộn riêng nào (đây luôn là khung cuộn chính của app).
function findScrollParent(el) {
  // Kiểm tra CHÍNH phần tử được truyền vào trước (vd panel xem đáp án —
  // #choukaiReviewContent CHÍNH là khung cuộn riêng, không phải cha của nó),
  // sau đó mới đi lên các cha — vd "Luyện nghe câu" không có khung cuộn riêng,
  // nên đi lên tới `.main` (khung cuộn chính của app).
  let node = el;
  while (node && node !== document.body) {
    const cs = getComputedStyle(node);
    if ((cs.overflowY === "auto" || cs.overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
      return node;
    }
    node = node.parentElement;
  }
  return document.querySelector(".main");
}

/* Gắn hành vi karaoke (bôi sáng dòng đang phát + tự cuộn dòng đó vào GIỮA màn
 * hình + bấm dòng để phát lại) cho 1 danh sách phần tử dòng ĐÃ render sẵn —
 * dùng CHUNG cho cả "Luyện nghe câu" và panel xem đáp án.
 *
 * Hành vi cuộn theo yêu cầu: trong lúc audio đang phát, dòng đang nghe TỰ ĐỘNG
 * được cuộn ra giữa khung nhìn. Nếu người dùng tự kéo cuộn (muốn xem các dòng
 * khác trong script) thì NGỪNG tự cuộn để người dùng tự do xem — chỉ tính là
 * "tự kéo" khi việc cuộn đó KHÔNG phải do chính app gây ra (phân biệt bằng cờ
 * isAutoScrolling). Khi đó hiện nút "⬇ Về dòng đang nghe" — bấm vào sẽ nhảy
 * lại đúng dòng hiện tại ra giữa màn hình VÀ bật lại chế độ tự cuộn theo audio
 * như cũ. */
function attachKaraokeBehavior(lineEls, lineTimestamps, audioEl, handlerKey, container) {
  clearKaraokeHandler(handlerKey);
  if (!Array.isArray(lineTimestamps) || lineTimestamps.length !== lineEls.length || !audioEl) return;

  lineEls.forEach(function (el, i) {
    el.addEventListener("click", function () {
      try {
        audioEl.currentTime = lineTimestamps[i];
        const p = audioEl.play();
        if (p && p.catch) p.catch(function () {});
      } catch (e) { /* bỏ qua */ }
    });
  });

  const scrollEl = findScrollParent(container);
  const state = { follow: true, activeIdx: -1, isAutoScrolling: false, autoScrollTimer: null };

  const jumpBtn = document.createElement("button");
  jumpBtn.className = "karaoke-jump-btn hidden";
  jumpBtn.innerHTML = "⬇ Về dòng đang nghe";
  jumpBtn.addEventListener("click", function () {
    state.follow = true;
    jumpBtn.classList.add("hidden");
    scrollActiveIntoView();
  });
  container.insertAdjacentElement("afterend", jumpBtn);

  function scrollActiveIntoView() {
    const el = lineEls[state.activeIdx];
    if (!el) return;
    // Đặt cờ TRƯỚC khi cuộn, và chỉ tắt cờ sau khi cuộn smooth chắc đã xong —
    // để sự kiện "scroll" do CHÍNH lệnh cuộn này gây ra không bị hiểu lầm
    // thành người dùng tự kéo (tránh vừa tự cuộn xong lại tự ngắt theo dõi).
    state.isAutoScrolling = true;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    clearTimeout(state.autoScrollTimer);
    state.autoScrollTimer = setTimeout(function () { state.isAutoScrolling = false; }, 700);
  }

  const onScroll = function () {
    if (state.isAutoScrolling) return; // cuộn này là do app tự làm, bỏ qua
    if (state.follow) {
      state.follow = false;
      jumpBtn.classList.remove("hidden");
    }
  };
  scrollEl.addEventListener("scroll", onScroll);

  const handlerFn = function () {
    const t = audioEl.currentTime;
    let activeIdx = -1;
    for (let i = 0; i < lineTimestamps.length; i++) {
      if (t >= lineTimestamps[i]) activeIdx = i; else break;
    }
    if (activeIdx !== state.activeIdx) {
      state.activeIdx = activeIdx;
      lineEls.forEach(function (el, i) { el.classList.toggle("is-current-line", i === activeIdx); });
      if (state.follow) scrollActiveIntoView();
    }
  };
  App.karaokeHandlers[handlerKey] = { audioEl: audioEl, fn: handlerFn, scrollEl: scrollEl, onScroll: onScroll, jumpBtn: jumpBtn };
  audioEl.addEventListener("timeupdate", handlerFn);
}

function renderChoukaiReviewContent() {
  const item = getChoukaiCurrentItem();
  if (!item) return;
  const q = item.q;
  const box = document.getElementById("choukaiReviewContent");
  if (App.choukaiReviewTab === "tip") {
    clearKaraokeHandler("reviewScript");
    clearKaraokeHandler("reviewVi");
    box.textContent = q.tip || "(chưa có mẹo cho câu này)";
    return;
  }
  // Script & Dịch: hiện theo từng dòng, có karaoke highlight + bấm dòng để phát
  // lại audio đúng đoạn đó NẾU câu này có "lineTimestamps". Không có thì vẫn
  // hiện đúng nội dung như cũ, chỉ là không bôi sáng/không bấm được — không lỗi.
  const jpLines = (q.script || "").split("\n").filter(Boolean);
  const viLines = (q.scriptVi || "").split("\n").filter(Boolean);
  const lineTimestamps = Array.isArray(q.lineTimestamps) && q.lineTimestamps.length === jpLines.length
    ? q.lineTimestamps
    : null;
  const audioEl = document.getElementById("choukaiAudioEl");
  if (App.choukaiReviewTab === "script") {
    clearKaraokeHandler("reviewVi"); // đang xem tab khác — dọn handler của tab Dịch
    if (!jpLines.length) { box.textContent = "(không có script)"; return; }
    renderKaraokeLines(box, jpLines, lineTimestamps, audioEl, "reviewScript");
  } else {
    clearKaraokeHandler("reviewScript"); // đang xem tab khác — dọn handler của tab Script
    if (!viLines.length) { box.textContent = "(chưa có bản dịch)"; return; }
    renderKaraokeLines(box, viLines, lineTimestamps, audioEl, "reviewVi");
  }
}

function choukaiGoNext() {
  if (App.choukaiPos < App.choukaiQueue.length - 1) {
    App.choukaiPos++;
    renderChoukaiQuestion();
  } else {
    finishChoukai();
  }
}

function choukaiGoPrev() {
  if (App.choukaiPos > 0) {
    App.choukaiPos--;
    renderChoukaiQuestion();
  }
}

function exitChoukaiEarlyAndShowResult() {
  finishChoukai();
}

function finishChoukai() {
  const totalSeconds = App.choukaiStartTime ? Math.round((Date.now() - App.choukaiStartTime) / 1000) : 0;
  recordChoukaiCompletion(App.currentChoukaiId, {
    score: App.choukaiScore,
    total: App.choukaiQueue.length,
    seconds: totalSeconds,
  });
  // QUAN TRỌNG: phải gọi recordChoukaiAttempt() TRƯỚC saveChoukaiDetailSnapshot()
  // — vì recordChoukaiAttempt() có cơ chế tự "nâng cấp" snapshot CŨ (lần làm
  // trước đó, lưu trước khi có hệ thống nhiều lần làm) thành "Lần 1" nếu mảng
  // attempts mới chưa có gì. Nếu gọi saveChoukaiDetailSnapshot() TRƯỚC, nó sẽ
  // ghi đè snapshot bằng dữ liệu của CHÍNH lần làm vừa xong, khiến đoạn migrate
  // tưởng nhầm đó là "dữ liệu cũ" và tạo ra 1 attempt TRÙNG LẶP không có thật.
  recordChoukaiAttempt(App.currentChoukaiId);
  saveChoukaiDetailSnapshot(App.currentChoukaiId, App.choukaiAnswers);

  document.getElementById("choukaiBody").classList.add("hidden");
  document.getElementById("choukaiResult").classList.remove("hidden");
  document.getElementById("choukaiFinalScore").textContent =
    App.choukaiScore + "/" + App.choukaiQueue.length + " câu đúng";

  renderChoukaiMondaiBreakdown();
  renderChoukaiResultGrid();
}

function renderChoukaiMondaiBreakdown() {
  const test = getChoukaiTest(App.currentChoukaiId);
  const box = document.getElementById("choukaiMondaiBreakdown");
  const byMondai = {};
  App.choukaiQueue.forEach(function (pos) {
    const mondai = test.mondai[pos.mIndex];
    const key = mondai.number;
    if (!byMondai[key]) byMondai[key] = { correct: 0, total: 0 };
    byMondai[key].total++;
    const q = mondai.questions[pos.qIndex];
    const k = choukaiKeyFor(mondai.number, q.qnum, pos.subIndex);
    if (App.choukaiAnswers[k] && App.choukaiAnswers[k].correct) byMondai[key].correct++;
  });
  box.innerHTML = Object.keys(byMondai).sort().map(function (mNum) {
    return '<div class="choukai-mondai-breakdown-item"><span class="num">' + byMondai[mNum].correct + '/' + byMondai[mNum].total + '</span>Mondai ' + mNum + '</div>';
  }).join("");
}

function renderChoukaiResultGrid() {
  const test = getChoukaiTest(App.currentChoukaiId);
  const grid = document.getElementById("choukaiResultGrid");
  grid.innerHTML = App.choukaiQueue.map(function (pos, flatIdx) {
    const mondai = test.mondai[pos.mIndex];
    const q = mondai.questions[pos.qIndex];
    const key = choukaiKeyFor(mondai.number, q.qnum, pos.subIndex);
    const ans = App.choukaiAnswers[key];
    const stateClass = !ans ? "is-not-done" : (ans.correct ? "is-correct" : "is-wrong");
    return '<button class="exam-result-dot ' + stateClass + '" data-flat="' + flatIdx + '">' + (flatIdx + 1) + '</button>';
  }).join("");
  grid.querySelectorAll(".exam-result-dot").forEach(function (dot) {
    dot.addEventListener("click", function () { openChoukaiDetailModal(parseInt(dot.dataset.flat, 10)); });
  });
}

// opts.testId/opts.queue/opts.answers (tùy chọn) cho phép mở từ tab Điểm yếu
// (đề khác đề đang chạy trong session) — giống pattern openExamDetailModal.
function openChoukaiDetailModal(flatIdx, opts) {
  const testId = (opts && opts.testId) || App.currentChoukaiId;
  const queue = (opts && opts.queue) || App.choukaiQueue;
  const answers = (opts && opts.answers) || App.choukaiAnswers;
  const test = getChoukaiTest(testId);
  const pos = queue[flatIdx];
  if (!test || !pos) return;
  const mondai = test.mondai[pos.mIndex];
  const q = mondai.questions[pos.qIndex];
  const sub = pos.subIndex !== null ? q.subQuestions[pos.subIndex] : null;
  const key = choukaiKeyFor(mondai.number, q.qnum, pos.subIndex);
  const ans = answers[key];
  const options = sub ? sub.options : q.options;
  const correctIndex = sub ? sub.correctIndex : q.correctIndex;

  document.getElementById("choukaiDetailModalTitle").textContent =
    "Câu " + (flatIdx + 1) + " (Mondai " + mondai.number + ") — " + (!ans ? "Chưa làm" : (ans.correct ? "✓ Đúng" : "✕ Sai"));

  const optsHtml = options.map(function (opt, idx) {
    const isCorrect = idx === correctIndex;
    const isChosen = ans && ans.chosenIndex === idx;
    let cls = "exam-detail-opt";
    if (isCorrect) cls += " is-correct";
    else if (isChosen) cls += " is-wrong-chosen";
    const tags = [];
    if (isCorrect) tags.push('<span class="exam-detail-tag is-correct-tag">Đáp án đúng</span>');
    if (isChosen) tags.push('<span class="exam-detail-tag is-chosen-tag">Bạn đã chọn</span>');
    return '<div class="' + cls + '"><div class="exam-detail-opt-head"><span class="exam-detail-opt-text">' + opt + '</span>' + tags.join("") + '</div></div>';
  }).join("");

  document.getElementById("choukaiDetailModalBody").innerHTML =
    '<div class="choukai-review-tabs">' +
    '<button class="choukai-review-tab is-active" data-detailtab="script">Script</button>' +
    '<button class="choukai-review-tab" data-detailtab="vi">Dịch</button>' +
    '<button class="choukai-review-tab" data-detailtab="tip">💡 Mẹo nghe</button>' +
    '</div>' +
    '<div class="choukai-review-content" id="choukaiDetailReviewContent" style="margin-bottom:16px;">' + (q.script || "") + '</div>' +
    '<div class="exam-detail-opts">' + optsHtml + '</div>';

  document.querySelectorAll('[data-detailtab]').forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll('[data-detailtab]').forEach(function (b) { b.classList.toggle("is-active", b === btn); });
      const tab = btn.dataset.detailtab;
      const content = tab === "script" ? q.script : (tab === "vi" ? q.scriptVi : q.tip);
      document.getElementById("choukaiDetailReviewContent").textContent = content || "(chưa có dữ liệu)";
    });
  });

  document.getElementById("choukaiDetailModalOverlay").classList.remove("hidden");
}

function closeChoukaiDetailModal() {
  document.getElementById("choukaiDetailModalOverlay").classList.add("hidden");
}

// Xem lại kết quả lần làm gần nhất đã lưu — không cần làm lại đề.
function viewSavedChoukaiResult(testId) {
  document.getElementById("choukaiModeModalOverlay").classList.add("hidden");
  const test = getChoukaiTest(testId);
  const detailStats = loadChoukaiDetailHistoryStats();
  const saved = detailStats[testId];
  if (!test || !saved) return;

  const mondaiVal = document.getElementById("choukaiMondaiPicker").value;
  const mondaiFilter = mondaiVal === "all" ? "all" : parseInt(mondaiVal, 10);

  App.currentChoukaiId = testId;
  App.choukaiQueue = buildChoukaiQueue(test, mondaiFilter);
  App.choukaiAnswers = saved.answers;
  App.choukaiScore = Object.values(saved.answers).filter(function (a) { return a.correct; }).length;

  document.getElementById("choukaiEmpty").classList.add("hidden");
  document.getElementById("choukaiBody").classList.add("hidden");
  document.getElementById("choukaiResult").classList.remove("hidden");
  document.getElementById("choukaiFinalScore").textContent =
    App.choukaiScore + "/" + App.choukaiQueue.length + " câu đúng (kết quả đã lưu, lần làm gần nhất)";
  renderChoukaiMondaiBreakdown();
  renderChoukaiResultGrid();
}

// Mở popup chi tiết câu nghe TỪ TAB ĐIỂM YẾU — itemId dạng "testId::m{M}q{Q}[s{S}]"
function openChoukaiDetailFromWeakness(testId, key) {
  const test = getChoukaiTest(testId);
  if (!test) return;
  const detailStats = loadChoukaiDetailHistoryStats();
  const saved = detailStats[testId];
  const answers = (App.currentChoukaiId === testId) ? App.choukaiAnswers : (saved ? saved.answers : {});
  const queue = buildChoukaiQueue(test, "all");
  const flatIdx = queue.findIndex(function (pos) {
    const mondai = test.mondai[pos.mIndex];
    const q = mondai.questions[pos.qIndex];
    return choukaiKeyFor(mondai.number, q.qnum, pos.subIndex) === key;
  });
  if (flatIdx === -1) return;
  openChoukaiDetailModal(flatIdx, { testId: testId, queue: queue, answers: answers });
}

/* ---------- CHOUKAI SHADOW MODE (luyện nghe câu, dịch mờ) ---------- */

function populateChoukaiShadowPicker() {
  const picker = document.getElementById("choukaiShadowPicker");
  picker.innerHTML = '<option value="">— chọn đề nghe —</option>';
  App.choukaiTests.forEach(function (t) {
    const opt = document.createElement("option");
    opt.value = t.id;
    opt.textContent = t.title;
    picker.appendChild(opt);
  });
}

function renderChoukaiShadowPickerState() {
  const picker = document.getElementById("choukaiShadowPicker");
  if (picker.options.length <= 1) populateChoukaiShadowPicker();
}

function populateChoukaiShadowQuestionPicker(testId) {
  const test = getChoukaiTest(testId);
  const qPicker = document.getElementById("choukaiShadowQuestionPicker");
  qPicker.innerHTML = "";
  const queue = buildChoukaiQueue(test, "all");
  queue.forEach(function (pos, flatIdx) {
    const mondai = test.mondai[pos.mIndex];
    const opt = document.createElement("option");
    opt.value = String(flatIdx);
    opt.textContent = "Mondai " + mondai.number + " — Câu " + (flatIdx + 1);
    qPicker.appendChild(opt);
  });
  qPicker.classList.remove("hidden");
}

/* ---------- Helper chung: render script kiểu "karaoke" + bấm dòng để phát lại ----------
   Dùng CHUNG cho cả "Luyện nghe câu" (shadow mode) và panel xem đáp án lúc làm đề
   (choukaiReviewPanel) — tránh viết lặp code render dòng + gắn listener ở nhiều nơi.

   - container: thẻ DOM sẽ chứa các dòng (1 dòng = 1 div.karaoke-line)
   - lines: mảng string (mỗi dòng script HOẶC mỗi dòng dịch — gọi riêng cho từng loại)
   - lineTimestamps: mảng số giây cùng độ dài với "lines", hoặc null nếu không có
     dữ liệu mốc giờ — khi null, chỉ hiện chữ bình thường, không bôi sáng, không bấm
     được (giữ nguyên hành vi cũ với các đề CHƯA có timestamp, không lỗi gì cả).
   - audioEl: thẻ <audio> tương ứng để bấm dòng → nhảy tới đúng giây + play()
   - handlerKey: khóa định danh DUY NHẤT cho audioEl + nơi gọi (vd "shadow",
     "reviewScript", "reviewVi") để gỡ đúng listener "timeupdate" CŨ trước khi
     gắn cái MỚI — tránh nhiều listener cộng dồn qua mỗi lần đổi câu/đổi tab. */
function renderKaraokeLines(container, lines, lineTimestamps, audioEl, handlerKey) {
  const hasTime = Array.isArray(lineTimestamps) && lineTimestamps.length === lines.length;
  container.innerHTML = lines.map(function (line, i) {
    const cls = "karaoke-line" + (hasTime ? " is-seekable" : "");
    return '<div class="' + cls + '" data-idx="' + i + '">' + line + '</div>';
  }).join("");

  if (!hasTime) {
    clearKaraokeHandler(handlerKey);
    return;
  }
  const lineEls = Array.from(container.querySelectorAll(".karaoke-line"));
  attachKaraokeBehavior(lineEls, lineTimestamps, audioEl, handlerKey, container);
}

function renderChoukaiShadowQuestion(testId, flatIdx) {
  const test = getChoukaiTest(testId);
  const queue = buildChoukaiQueue(test, "all");
  const pos = queue[flatIdx];
  const mondai = test.mondai[pos.mIndex];
  const q = mondai.questions[pos.qIndex];

  document.getElementById("choukaiShadowEmpty").classList.add("hidden");
  document.getElementById("choukaiShadowBody").classList.remove("hidden");

  const audioSrc = getChoukaiAudioSrc(test, mondai);
  const audioEl = document.getElementById("choukaiShadowAudioEl");
  if (audioSrc) audioEl.src = audioSrc;

  // Tách script + dịch theo dòng (mỗi lượt nói = 1 dòng) để ghép cặp hiển thị.
  const jpLines = (q.script || "").split("\n").filter(Boolean);
  const viLines = (q.scriptVi || "").split("\n").filter(Boolean);
  // "lineTimestamps" (tùy chọn, mảng số giây — TÍNH TỪ ĐẦU FILE AUDIO của cả
  // Mondai, vì các câu trong 1 Mondai dùng chung 1 file): nếu file JSON CÓ mảng
  // này (cùng số dòng với script), app tự bôi sáng kiểu karaoke đúng dòng đang
  // phát, và cho bấm vào BẤT KỲ dòng nào (tiếng Nhật hoặc bản dịch) để nhảy audio
  // tới đúng đoạn đó. Nếu KHÔNG có (file cũ/chưa làm timestamp), giữ nguyên hành
  // vi cũ — chỉ hiện dòng + dịch, không bôi sáng, không bấm phát lại được.
  const lineTimestamps = Array.isArray(q.lineTimestamps) && q.lineTimestamps.length === jpLines.length
    ? q.lineTimestamps
    : null;

  // Có timestamp rồi thì không còn đúng nữa khi nói "không tách được theo từng
  // dòng" — ẩn note cảnh báo cũ trong trường hợp này.
  document.getElementById("choukaiShadowNote").classList.toggle("hidden", !!lineTimestamps);

  // Bản dịch hiện trực tiếp luôn, KHÔNG làm mờ/cần bấm để hiện nữa (theo yêu cầu
  // mới — trước đây có hiệu ứng blur, giờ bỏ để đọc song song dễ hơn).
  const linesWrap = document.getElementById("choukaiShadowLines");
  linesWrap.innerHTML = jpLines.map(function (jp, i) {
    return '<div class="choukai-shadow-line" data-idx="' + i + '">' +
      '<div class="choukai-shadow-line-jp">' + jp + '</div>' +
      '<div class="choukai-shadow-line-vi">' + (viLines[i] || "") + '</div></div>';
  }).join("");

  // Gỡ listener karaoke CŨ trước khi gắn listener mới — tránh cộng dồn qua từng câu.
  clearKaraokeHandler("shadow");

  if (lineTimestamps) {
    const lineEls = Array.from(linesWrap.querySelectorAll(".choukai-shadow-line"));
    lineEls.forEach(function (el) { el.classList.add("is-seekable"); });
    // Bấm vào dòng (CẢ tiếng Nhật và bản dịch) + bôi sáng + tự cuộn ra giữa màn
    // hình theo audio — dùng chung hành vi với panel xem đáp án lúc làm đề.
    attachKaraokeBehavior(lineEls, lineTimestamps, audioEl, "shadow", linesWrap);
  }
}

// Bảng kết quả chi tiết từng câu — chỉ dùng cho chế độ "Chấm sửa cuối bài",
// vì đó là lần DUY NHẤT người học biết đúng/sai của toàn bộ đề.
// 2 mốc thời gian theo yêu cầu:
// Mốc 1 = từ lúc bắt đầu đề tới khi đi hết LƯỢT ĐẦU (mỗi câu gốc đã được hỏi đúng 1 lần
//         theo thứ tự, chưa tính làm lại câu sai) -> cho biết số câu đúng/sai ngay từ đầu.
// Mốc 2 = từ lúc bắt đầu pha "sửa lại câu sai" cho tới khi mọi câu đều đã đúng (xong hẳn đề).
