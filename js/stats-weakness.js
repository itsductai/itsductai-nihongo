/* ===== MODULE: stats-weakness.js — Theo dõi điểm yếu + lịch sử đề thi/đề nghe + trang Thống kê (donut chart) ===== */

function loadWeaknessStats() {
  try {
    const raw = localStorage.getItem(WEAKNESS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveWeaknessStats(stats) {
  localStorage.setItem(WEAKNESS_STORAGE_KEY, JSON.stringify(stats));
}

// deckId: tên bộ thật, hoặc "__exam__" cho câu hỏi đề thi
// itemId: _id của từ/cấu trúc, hoặc "examId::qIndex" cho câu đề thi
// correct: true/false
// label: (tùy chọn) nội dung ngắn để hiển thị trong bảng thống kê mà không cần tra lại data gốc
//
// HỆ THỐNG "HỆ SỐ QUAN TRỌNG" (priority) — thay cho cách tính tỉ lệ sai cũ:
// - Sai ở LẦN ĐẦU TIÊN gặp câu/từ này → priority khởi đầu CAO (100) — vì sai lần
//   đầu là dấu hiệu RÕ RÀNG nhất của 1 điểm yếu thật, cần ưu tiên ôn lại ngay.
// - Đúng ngay từ lần đầu → priority khởi đầu = 0 (chưa coi là điểm yếu).
// - Mỗi lần làm ĐÚNG tiếp theo (bất kể lần đầu sai hay không) → priority GIẢM 25,
//   tối thiểu 0 — làm đúng liên tục nhiều lần thì điểm yếu "mờ dần" rồi biến mất.
// - Mỗi lần làm SAI (kể cả không phải lần đầu) → priority TĂNG 35, tối đa 100 —
//   sai lại thì lại được coi là điểm yếu nghiêm trọng hơn ngay.
// Item chỉ được coi là "điểm yếu" khi priority > 0 (đọc ở getWeaknessListForDeck).
function getEntryPriority(entry) {
  if (typeof entry.priority === "number") return entry.priority;
  // Dữ liệu CŨ lưu trước khi có hệ "hệ số quan trọng" này — không biết chính xác
  // sai/đúng ở LẦN ĐẦU, nên ước lượng tạm theo tỉ lệ sai hiện có (vẫn hợp lý: tỉ
  // lệ sai cao -> coi như priority cao). Lần ghi kết quả tiếp theo sẽ "nâng cấp"
  // entry này sang hệ mới hẳn (xem recordWeaknessResult).
  if (entry.wrongCount <= 0) return 0;
  const total = entry.wrongCount + entry.correctCount;
  return Math.round((entry.wrongCount / total) * 100);
}

function recordWeaknessResult(deckId, itemId, correct, label) {
  const stats = loadWeaknessStats();
  if (!stats[deckId]) stats[deckId] = {};
  if (!stats[deckId][itemId]) {
    stats[deckId][itemId] = {
      correctCount: 0, wrongCount: 0, lastLabel: "", lastResultAt: 0,
      firstTryWrong: !correct, // CHỈ ghi nhận 1 LẦN DUY NHẤT lúc tạo entry — nhớ mãi kết quả lần đầu gặp
      priority: correct ? 0 : 100,
    };
  }
  const entry = stats[deckId][itemId];
  // Nâng cấp entry CŨ (tạo trước khi có field `priority`) sang hệ mới — chỉ chạy
  // đúng 1 lần cho mỗi entry, lần ghi kết quả đầu tiên SAU KHI nâng cấp app.
  if (typeof entry.priority !== "number") {
    entry.priority = getEntryPriority(entry);
    entry.firstTryWrong = entry.priority > 0;
  }
  if (correct) {
    entry.correctCount++;
    entry.priority = Math.max(0, entry.priority - 25);
  } else {
    entry.wrongCount++;
    entry.priority = Math.min(100, entry.priority + 35);
  }
  if (label) entry.lastLabel = label;
  entry.lastResultAt = Date.now();
  saveWeaknessStats(stats);
}

// "Điểm yếu" = priority > 0 (xem giải thích hệ thống ở trên recordWeaknessResult).
// Sắp theo priority giảm dần — câu/từ nào sai lần đầu + chưa khắc phục được sẽ
// luôn nổi lên ĐẦU danh sách, đúng đúng yêu cầu "sai lần đầu rất quan trọng".
function getWeaknessListForDeck(deckId) {
  const stats = loadWeaknessStats();
  const deckStats = stats[deckId] || {};
  const list = Object.keys(deckStats).map((itemId) => {
    const e = deckStats[itemId];
    return { itemId, ...e, priority: getEntryPriority(e) };
  });
  return list
    .filter((e) => e.priority > 0)
    .sort((a, b) => b.priority - a.priority);
}

function getWeaknessSummaryAcrossAll() {
  const stats = loadWeaknessStats();
  const summary = [];
  Object.keys(stats).forEach((deckId) => {
    const weakList = getWeaknessListForDeck(deckId);
    if (weakList.length > 0) {
      summary.push({ deckId, count: weakList.length });
    }
  });
  return summary;
}

// Badge trực quan mức độ ưu tiên — dùng chung cho cả 3 tab điểm yếu (từ vựng/ngữ
// pháp, đề thi, đề nghe). Màu chuyển dần đỏ (rất cần ôn) -> vàng (đang cải thiện)
// theo đúng giá trị priority (xem hệ thống ở recordWeaknessResult).
function renderPriorityBadge(e) {
  const pct = Math.max(0, Math.min(100, e.priority));
  const level = pct >= 70 ? "high" : pct >= 35 ? "mid" : "low";
  const firstTryTag = e.firstTryWrong ? '<span class="weakness-firsttry-tag">⚠ sai từ lần đầu</span>' : "";
  return `
    <div class="weakness-priority">
      <div class="weakness-priority-bar"><div class="weakness-priority-fill is-${level}" style="width:${pct}%"></div></div>
      <span class="weakness-priority-num is-${level}">${pct}</span>
    </div>
    ${firstTryTag}
  `;
}

/* ===================================================================
   LỊCH SỬ ĐỀ THI — lưu riêng trong localStorage, KHÔNG đụng tới file JSON
   gốc trong dethi/ (chỉ đọc câu hỏi từ đó, không bao giờ ghi gì lên đó).
   Cấu trúc: { [examId]: { totalCompletions, lastScore, lastTotal,
   lastSeconds, lastFirstTryWrongCount, lastCompletedAt } }
=================================================================== */

const EXAM_HISTORY_STORAGE_KEY = "n2vocab_exam_history";

function loadExamHistoryStats() {
  try {
    const raw = localStorage.getItem(EXAM_HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveExamHistoryStats(stats) {
  localStorage.setItem(EXAM_HISTORY_STORAGE_KEY, JSON.stringify(stats));
}

// ---------- Lưu CHI TIẾT từng câu của lần làm gần nhất (khác với loadExamHistoryStats
// chỉ lưu điểm số tổng) — đây là dữ liệu nuôi lưới kết quả (.exam-result-dot) + popup
// chi tiết từng câu. TRƯỚC ĐÂY dữ liệu này CHỈ tồn tại trong App.examHistory (biến tạm
// trong RAM), bị xóa mỗi khi chọn lại đề / tải lại trang / KHÔNG được export — đây
// chính là lý do Zane làm đề trên máy tính, export, nhập vào điện thoại nhưng không
// thấy dữ liệu chi tiết đề thi (chỉ có điểm số tổng ở trang Thống kê, không có lưới
// kết quả). Nay lưu lại để xem lại được trên mọi máy sau khi nhập tiến độ.
const EXAM_DETAIL_HISTORY_STORAGE_KEY = "n2vocab_exam_detail_history";

function loadExamDetailHistoryStats() {
  try {
    const raw = localStorage.getItem(EXAM_DETAIL_HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveExamDetailHistoryStats(stats) {
  localStorage.setItem(EXAM_DETAIL_HISTORY_STORAGE_KEY, JSON.stringify(stats));
}

// Gọi mỗi khi 1 đề thi hoàn thành — ghi đè snapshot chi tiết của examId này bằng
// lần làm VỪA XONG (chỉ giữ lần gần nhất, không cộng dồn, vì đây là ảnh chụp trạng
// thái để xem lại, không phải bộ đếm tích lũy).
function saveExamDetailSnapshot(examId, examHistory) {
  const stats = loadExamDetailHistoryStats();
  stats[examId] = { examHistory, savedAt: Date.now() };
  saveExamDetailHistoryStats(stats);
}

// Gọi đúng 1 lần khi 1 đề thi hoàn thành hẳn (finishExam). Cộng dồn totalCompletions
// (vì đây là bộ đếm tích lũy — làm thêm 1 lần thì +1, không phải trạng thái để ghi đè),
// còn các field "lần gần nhất" luôn lấy giá trị của lần vừa hoàn thành này.
function recordExamCompletion(examId, { score, total, seconds, firstTryWrongCount }) {
  const stats = loadExamHistoryStats();
  if (!stats[examId]) {
    stats[examId] = { totalCompletions: 0, lastScore: 0, lastTotal: 0, lastSeconds: 0, lastFirstTryWrongCount: 0, lastCompletedAt: 0 };
  }
  const entry = stats[examId];
  entry.totalCompletions += 1;
  entry.lastScore = score;
  entry.lastTotal = total;
  entry.lastSeconds = seconds;
  entry.lastFirstTryWrongCount = firstTryWrongCount;
  entry.lastCompletedAt = Date.now();
  saveExamHistoryStats(stats);
}

/* ===================================================================
   LƯU NHIỀU LẦN LÀM (attempts) — để xem lại lưới "Lần 1 / Lần 2 / Lần 3..."
   So với snapshot cũ (saveExamDetailSnapshot, chỉ giữ lần GẦN NHẤT, ghi đè mỗi
   lần), đây CỘNG DỒN từng lần hoàn thành riêng biệt — chỉ lưu kết quả ĐÚNG/SAI
   lần đầu của mỗi câu trong lần làm đó (không lưu đáp án đã chọn, không cần —
   "đáp án đúng" luôn tra trực tiếp từ file đề JSON lúc hiển thị, không đổi theo
   thời gian). CHỈ ghi khi `finishExam()` chạy (đề hoàn thành hẳn) — làm dở dang
   bỏ ngang giữa đường KHÔNG ghi gì vào đây cả, đúng yêu cầu.
   Cấu trúc: { [examId]: [ { completedAt, score, total, results: [bool,...] } ] }
   results[qIndex] = true/false/null (null = câu đó không tồn tại lần làm đó,
   hiếm khi xảy ra trừ khi đề bị sửa số câu — phòng hờ không vẽ nhầm). */
const EXAM_ATTEMPTS_KEY = "n2vocab_exam_attempts";
const MAX_ATTEMPTS_KEPT = 50; // chặn trên, tránh localStorage phình to vô hạn qua nhiều năm

function loadExamAttemptsRaw() {
  try {
    const raw = localStorage.getItem(EXAM_ATTEMPTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveExamAttemptsRaw(stats) {
  localStorage.setItem(EXAM_ATTEMPTS_KEY, JSON.stringify(stats));
}

// Trả về mảng attempts của 1 examId — TỰ ĐỘNG nâng cấp (migrate) dữ liệu CŨ
// (snapshot duy nhất lưu ở saveExamDetailSnapshot trước đây) thành "Lần 1" nếu
// hệ mới CHƯA có dữ liệu nào cho đề này — không mất lịch sử Zane đã làm trước khi
// có tính năng lưu nhiều lần này.
function getExamAttempts(examId) {
  const all = loadExamAttemptsRaw();
  if (all[examId] && all[examId].length > 0) return all[examId];

  const detailStats = loadExamDetailHistoryStats();
  const oldSnapshot = detailStats[examId];
  if (!oldSnapshot || !oldSnapshot.examHistory) return [];

  const exam = App.exams.find((ex) => ex.id === examId);
  const total = exam ? exam.questions.length : Object.keys(oldSnapshot.examHistory).length;
  const results = [];
  for (let i = 0; i < total; i++) {
    const h = oldSnapshot.examHistory[i];
    if (!h) { results.push(null); continue; }
    const firstAttempt = h.attempts && h.attempts[0];
    const chosenText = (firstAttempt && exam) ? exam.questions[i].options[firstAttempt.chosenIdx] : null;
    results.push({ correct: !!h.firstTryCorrect, chosenText: chosenText });
  }
  const score = results.filter((r) => isResultCorrect(r)).length;
  const migrated = [{ completedAt: oldSnapshot.savedAt || Date.now(), score, total, results }];
  all[examId] = migrated;
  saveExamAttemptsRaw(all);
  return migrated;
}

// Gọi trong finishExam() — đọc trực tiếp App.examHistory (đã có sẵn firstTryCorrect
// từng câu của lần làm VỪA XONG) để ghi thành 1 attempt mới, CỘNG VÀO cuối mảng.
// Đọc đúng/sai từ 1 phần tử results[i] — hỗ trợ CẢ 2 dạng: boolean (dữ liệu CŨ,
// trước khi lưu thêm chosenText) và object {correct, chosenText} (dữ liệu MỚI).
function isResultCorrect(r) {
  if (r === true) return true;
  if (r && typeof r === "object") return !!r.correct;
  return false;
}
// Nội dung đáp án ĐÃ CHỌN ở lần làm đó — null nếu là dữ liệu CŨ (chưa lưu cái này).
function getResultChosenText(r) {
  return (r && typeof r === "object") ? (r.chosenText || null) : null;
}

function recordExamAttempt(examId) {
  const exam = App.exams.find((ex) => ex.id === examId);
  const total = exam ? exam.questions.length : App.examOriginalTotal;
  const results = [];
  for (let i = 0; i < total; i++) {
    const h = App.examHistory[i];
    if (!h) { results.push(null); continue; }
    const firstAttempt = h.attempts && h.attempts[0];
    // LƯU Ý: chosenIdx ở đây là vị trí trong q.options GỐC (không phải vị trí
    // đang HIỂN THỊ sau khi đảo) — xem cách so sánh "chosenIdx === q.dap_an_dung"
    // ở các nơi khác trong file này, nên tra thẳng q.options[chosenIdx] luôn ra
    // đúng nội dung đã chọn, không bị lệch dù đáp án có đảo thứ tự hiển thị.
    const chosenText = (firstAttempt && exam) ? exam.questions[i].options[firstAttempt.chosenIdx] : null;
    results.push({ correct: !!h.firstTryCorrect, chosenText: chosenText });
  }
  const score = results.filter((r) => isResultCorrect(r)).length;

  // Lưu LUÔN điểm mô phỏng JLPT (Linear + IRT) của lần làm này vào attempt —
  // trước đây 2 điểm này chỉ tính tạm lúc hiện màn hình kết quả rồi mất, không
  // lưu ở đâu cả. Giờ lưu thẳng vào đây để: (1) xem lại được ở lưới kết quả
  // nhiều lần làm, (2) TỰ ĐỘNG được Xuất/Nhập tiến độ theo (mục 12) vì dùng
  // chung object `n2vocab_exam_attempts` đã có sẵn cơ chế export/import, không
  // cần sửa thêm gì ở phần export/import.
  const jlpt = computeExamJlptScoring(examId, App.examHistory);

  const all = loadExamAttemptsRaw();
  if (!all[examId]) all[examId] = getExamAttempts(examId); // đảm bảo đã migrate dữ liệu cũ trước khi cộng thêm
  all[examId].push({
    completedAt: Date.now(), score, total, results,
    linearScore: jlpt ? jlpt.linearScore : null,
    irtScore: jlpt ? jlpt.irtScore : null,
  });
  if (all[examId].length > MAX_ATTEMPTS_KEPT) {
    all[examId] = all[examId].slice(all[examId].length - MAX_ATTEMPTS_KEPT);
  }
  saveExamAttemptsRaw(all);
}

// Điểm CAO NHẤT trong tất cả các lần đã làm — dùng hiển thị "🏆 Điểm tốt nhất"
// ở trang Thống kê, không nhất thiết là lần gần nhất.
function getBestExamScore(examId) {
  const attempts = getExamAttempts(examId);
  if (attempts.length === 0) return null;
  return attempts.reduce((best, a) => (a.score > best.score ? a : best), attempts[0]);
}

// Dùng khi XUẤT tiến độ — đảm bảo MỌI đề (kể cả đề chỉ có snapshot CŨ chưa từng
// được mở/migrate qua hệ mới) đều được nâng cấp trước khi đọc ra để xuất, tránh
// xuất thiếu dữ liệu nếu Zane export ngay sau khi mở app lần đầu (chưa kịp vào
// trang Thống kê để trigger migrate).
function getAllExamAttemptsForExport() {
  App.exams.forEach((ex) => getExamAttempts(ex.id));
  return loadExamAttemptsRaw();
}

/* ===================================================================
   LƯU NHIỀU LẦN LÀM ĐỀ NGHE (attempts) — cùng cơ chế với đề thi chữ ở trên,
   chỉ khác: mỗi câu định danh bằng key dạng "m{M}q{Q}[s{S}]" (xem choukaiKeyFor)
   thay vì số thứ tự, vì đề nghe có cấu trúc Mondai lồng nhau + câu hỏi đôi.
   Cấu trúc: { [testId]: [ { completedAt, score, total, results: {key: bool} } ] } */
const CHOUKAI_ATTEMPTS_KEY = "n2vocab_choukai_attempts";

function loadChoukaiAttemptsRaw() {
  try {
    const raw = localStorage.getItem(CHOUKAI_ATTEMPTS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function saveChoukaiAttemptsRaw(stats) {
  localStorage.setItem(CHOUKAI_ATTEMPTS_KEY, JSON.stringify(stats));
}

// Danh sách các "cột" (câu hỏi) theo đúng thứ tự hiển thị của 1 đề nghe — dùng
// CHUNG cho cả việc ghi attempt mới và vẽ lưới kết quả, để đảm bảo 2 nơi luôn
// khớp thứ tự với nhau. Mỗi cột: { key, label } — label ngắn dùng làm tiêu đề
// cột trong lưới (ví dụ "M1-1", "M5-3a").
function getChoukaiColumns(test) {
  const queue = buildChoukaiQueue(test, "all");
  return queue.map((pos) => {
    const m = test.mondai[pos.mIndex];
    const q = m.questions[pos.qIndex];
    const key = choukaiKeyFor(m.number, q.qnum, pos.subIndex);
    const subLabel = pos.subIndex === null ? "" : (pos.subIndex === 0 ? "a" : "b");
    return { key, label: `M${m.number}-${q.qnum}${subLabel}` };
  });
}

function getChoukaiAttempts(testId) {
  const all = loadChoukaiAttemptsRaw();
  if (all[testId] && all[testId].length > 0) return all[testId];

  const detailStats = loadChoukaiDetailHistoryStats();
  const oldSnapshot = detailStats[testId];
  if (!oldSnapshot || !oldSnapshot.answers) return [];

  const test = getChoukaiTest(testId);
  const optsByKey = test ? getChoukaiOptionsByKey(test) : {};
  const results = {};
  Object.keys(oldSnapshot.answers).forEach((key) => {
    const a = oldSnapshot.answers[key];
    const opts = optsByKey[key];
    results[key] = { correct: !!a.correct, chosenText: opts ? opts[a.chosenIndex] : null };
  });
  const score = Object.values(results).filter((r) => isResultCorrect(r)).length;
  const total = Object.keys(results).length;
  const migrated = [{ completedAt: oldSnapshot.savedAt || Date.now(), score, total, results }];
  all[testId] = migrated;
  saveChoukaiAttemptsRaw(all);
  return migrated;
}

// Gọi trong finishChoukai() — đọc App.choukaiAnswers (đã có sẵn correct từng câu
// của lần làm VỪA XONG) để ghi thành 1 attempt mới.
// Map sẵn key -> mảng options của câu đó (đi 1 lần qua cả đề) — dùng để tra
// nhanh "đã chọn nội dung gì" mà không phải lặp lại buildChoukaiQueue nhiều lần.
function getChoukaiOptionsByKey(test) {
  const map = {};
  const queue = buildChoukaiQueue(test, "all");
  queue.forEach((pos) => {
    const m = test.mondai[pos.mIndex];
    const q = m.questions[pos.qIndex];
    const key = choukaiKeyFor(m.number, q.qnum, pos.subIndex);
    map[key] = pos.subIndex === null ? q.options : q.subQuestions[pos.subIndex].options;
  });
  return map;
}

function recordChoukaiAttempt(testId) {
  const test = getChoukaiTest(testId);
  if (!test) return;
  const columns = getChoukaiColumns(test);
  const optsByKey = getChoukaiOptionsByKey(test);
  const results = {};
  columns.forEach((col) => {
    const ans = App.choukaiAnswers[col.key];
    if (!ans) { results[col.key] = null; return; }
    const opts = optsByKey[col.key];
    results[col.key] = { correct: !!ans.correct, chosenText: opts ? opts[ans.chosenIndex] : null };
  });
  const score = Object.values(results).filter((r) => isResultCorrect(r)).length;
  const total = columns.length;

  // Lưu LUÔN điểm mô phỏng JLPT của lần làm này — dùng ĐÚNG App.choukaiMondaiFilter
  // tại thời điểm hoàn thành (nếu chỉ luyện riêng 1 Mondai thì điểm cũng chỉ tính
  // đúng Mondai đó, khớp với điều đã hiện trên màn hình kết quả lúc finishChoukai()).
  const jlpt = computeChoukaiJlptScoring(test, App.choukaiAnswers, App.choukaiMondaiFilter);

  const all = loadChoukaiAttemptsRaw();
  if (!all[testId]) all[testId] = getChoukaiAttempts(testId);
  all[testId].push({
    completedAt: Date.now(), score, total, results,
    linearScore: jlpt ? jlpt.linearScore : null,
    irtScore: jlpt ? jlpt.irtScore : null,
  });
  if (all[testId].length > MAX_ATTEMPTS_KEPT) {
    all[testId] = all[testId].slice(all[testId].length - MAX_ATTEMPTS_KEPT);
  }
  saveChoukaiAttemptsRaw(all);
}

function getBestChoukaiScore(testId) {
  const attempts = getChoukaiAttempts(testId);
  if (attempts.length === 0) return null;
  return attempts.reduce((best, a) => (a.score > best.score ? a : best), attempts[0]);
}

function getAllChoukaiAttemptsForExport() {
  App.choukaiTests.forEach((t) => getChoukaiAttempts(t.id));
  return loadChoukaiAttemptsRaw();
}

/* ---------- Weakness mode UI (cho từ vựng/ngữ pháp) ---------- */

let currentWeaknessIds = [];

function renderWeaknessMode() {
  document.getElementById("btnWeaknessTabDeck").classList.toggle("is-active", App.weaknessTab === "deck");
  document.getElementById("btnWeaknessTabExam").classList.toggle("is-active", App.weaknessTab === "exam");
  document.getElementById("btnWeaknessTabChoukai").classList.toggle("is-active", App.weaknessTab === "choukai");

  if (App.weaknessTab === "exam") {
    renderExamWeaknessTab();
  } else if (App.weaknessTab === "choukai") {
    renderChoukaiWeaknessTab();
  } else {
    renderDeckWeaknessTab();
  }
}

function renderDeckWeaknessTab() {
  document.getElementById("weaknessTitle").textContent = "Các từ/cấu trúc bạn hay sai nhất trong bộ này";
  document.getElementById("weaknessActionRow").classList.remove("hidden");
  document.getElementById("weaknessExamHint").classList.add("hidden");

  const weakList = getWeaknessListForDeck(App.currentDeckId);
  currentWeaknessIds = weakList.map((e) => e.itemId);

  const empty = document.getElementById("weaknessEmpty");
  const listWrap = document.getElementById("weaknessListWrap");

  if (weakList.length === 0) {
    document.getElementById("weaknessEmptyText").textContent =
      "Chưa phát hiện điểm yếu nào trong bộ này. Cứ tiếp tục học!";
    empty.classList.remove("hidden");
    listWrap.classList.add("hidden");
    return;
  }
  empty.classList.add("hidden");
  listWrap.classList.remove("hidden");

  const listDiv = document.getElementById("weaknessList");
  listDiv.innerHTML = "";

  weakList.forEach((e) => {
    const w = App.currentWords.find((cw) => cw._id === e.itemId);
    const title = w ? (w.kanji || w.cautruc) : e.lastLabel || e.itemId;
    const subtitle = w ? w.nghia : "";

    const row = document.createElement("div");
    row.className = "weakness-row";
    row.innerHTML = `
      <div class="weakness-row-main">
        <div class="weakness-row-title">${title}</div>
        <div class="weakness-row-sub">${subtitle}</div>
      </div>
      <div class="weakness-row-stats">
        <span class="weakness-wrong-count">✕ ${e.wrongCount} lần sai</span>
        <span class="weakness-correct-count">✓ ${e.correctCount} lần đúng</span>
        ${renderPriorityBadge(e)}
      </div>
    `;
    listDiv.appendChild(row);
  });
}

// Tab "Đề thi" — gộp câu sai của TẤT CẢ đề thi đã làm (deckId giả "__exam__"),
// itemId có dạng "examId::qN". Bấm vào 1 dòng sẽ mở lại đúng popup chi tiết
// (đề bài + đáp án + giải thích) đã dùng ở lưới kết quả, không cần làm lại đề.
// Đây là giải pháp Zane đã CHỦ ĐỘNG CHỌN (đơn giản hơn ý tưởng ban đầu "tự động
// tạo bộ flashcard từ câu sai") — chỉ cần xem lại được để tự ôn tập, không cần
// tự động hóa hoàn toàn thành flashcard.
function renderExamWeaknessTab() {
  document.getElementById("weaknessTitle").textContent = "Các câu bạn hay sai nhất trong mọi đề thi";
  document.getElementById("weaknessActionRow").classList.add("hidden");

  const weakList = getWeaknessListForDeck("__exam__");

  const empty = document.getElementById("weaknessEmpty");
  const listWrap = document.getElementById("weaknessListWrap");

  if (weakList.length === 0) {
    document.getElementById("weaknessEmptyText").textContent =
      "Chưa phát hiện câu nào hay sai trong các đề thi đã làm. Cứ tiếp tục luyện!";
    empty.classList.remove("hidden");
    listWrap.classList.add("hidden");
    return;
  }
  empty.classList.add("hidden");
  listWrap.classList.remove("hidden");
  document.getElementById("weaknessExamHint").classList.remove("hidden");

  const listDiv = document.getElementById("weaknessList");
  listDiv.innerHTML = "";

  weakList.forEach((e) => {
    // itemId dạng "examId::qN" — examId có thể chứa dấu "-" nhưng không chứa "::"
    const sepPos = e.itemId.indexOf("::q");
    const examId = sepPos >= 0 ? e.itemId.slice(0, sepPos) : null;
    const qIndex = sepPos >= 0 ? parseInt(e.itemId.slice(sepPos + 3), 10) : null;
    const exam = examId ? App.exams.find((ex) => ex.id === examId) : null;
    const examTitle = exam ? exam.title : (examId || "?");
    const qLabel = qIndex !== null && !Number.isNaN(qIndex) ? `Câu ${qIndex + 1}` : "";

    const row = document.createElement("div");
    row.className = "weakness-row weakness-row-clickable";
    row.innerHTML = `
      <div class="weakness-row-main">
        <div class="weakness-row-title">${examTitle} — ${qLabel}</div>
        <div class="weakness-row-sub">${(e.lastLabel || "").replace(/\n/g, " ")}</div>
      </div>
      <div class="weakness-row-stats">
        <span class="weakness-wrong-count">✕ ${e.wrongCount} lần sai</span>
        <span class="weakness-correct-count">✓ ${e.correctCount} lần đúng</span>
        ${renderPriorityBadge(e)}
      </div>
    `;
    if (examId !== null && qIndex !== null && !Number.isNaN(qIndex)) {
      row.addEventListener("click", () => openExamDetailFromWeakness(examId, qIndex));
    }
    listDiv.appendChild(row);
  });
}

// Tab "Nghe" — câu sai trong các đề luyện nghe, itemId dạng "testId::m{M}q{Q}[s{S}]"
function renderChoukaiWeaknessTab() {
  document.getElementById("weaknessTitle").textContent = "Các câu bạn hay sai nhất trong mọi đề nghe";
  document.getElementById("weaknessActionRow").classList.add("hidden");

  const weakList = getWeaknessListForDeck("__choukai__");

  const empty = document.getElementById("weaknessEmpty");
  const listWrap = document.getElementById("weaknessListWrap");

  if (weakList.length === 0) {
    document.getElementById("weaknessEmptyText").textContent =
      "Chưa phát hiện câu nào hay sai trong các đề nghe đã làm. Cứ tiếp tục luyện!";
    empty.classList.remove("hidden");
    listWrap.classList.add("hidden");
    return;
  }
  empty.classList.add("hidden");
  listWrap.classList.remove("hidden");
  document.getElementById("weaknessExamHint").classList.remove("hidden");

  const listDiv = document.getElementById("weaknessList");
  listDiv.innerHTML = "";

  weakList.forEach((e) => {
    const sepPos = e.itemId.indexOf("::m");
    const testId = sepPos >= 0 ? e.itemId.slice(0, sepPos) : null;
    const key = sepPos >= 0 ? e.itemId.slice(sepPos + 2) : null;
    const test = testId ? getChoukaiTest(testId) : null;
    const testTitle = test ? test.title : (testId || "?");

    const row = document.createElement("div");
    row.className = "weakness-row weakness-row-clickable";
    row.innerHTML = `
      <div class="weakness-row-main">
        <div class="weakness-row-title">${testTitle}</div>
        <div class="weakness-row-sub">${(e.lastLabel || "").replace(/\n/g, " ")}</div>
      </div>
      <div class="weakness-row-stats">
        <span class="weakness-wrong-count">✕ ${e.wrongCount} lần sai</span>
        <span class="weakness-correct-count">✓ ${e.correctCount} lần đúng</span>
        ${renderPriorityBadge(e)}
      </div>
    `;
    if (testId && key) {
      row.addEventListener("click", () => openChoukaiDetailFromWeakness(testId, key));
    }
    listDiv.appendChild(row);
  });
}

// Mở popup chi tiết 1 câu đề thi TỪ TAB ĐIỂM YẾU (không nhất thiết là đề đang mở
// trong session hiện tại) — ưu tiên dùng snapshot CHI TIẾT đã lưu lần làm gần
// nhất (saveExamDetailSnapshot) để có đủ "đáp án đã chọn" hiển thị trong popup.
// Dùng tham số override của openExamDetailModal — KHÔNG đụng tới App.currentExamId /
// App.examHistory toàn cục, để không ảnh hưởng 1 đề khác đang làm giữa chừng.
function openExamDetailFromWeakness(examId, qIndex) {
  const exam = App.exams.find((ex) => ex.id === examId);
  if (!exam) return;
  const detailStats = loadExamDetailHistoryStats();
  const saved = detailStats[examId];
  // Nếu đúng là đề đang mở trong session hiện tại, ưu tiên dùng App.examHistory
  // sống (mới hơn snapshot lưu, ví dụ vừa trả lời xong nhưng chưa finishExam()).
  const examHistory = App.currentExamId === examId ? App.examHistory : (saved ? saved.examHistory : {});
  openExamDetailModal(qIndex, { examId, examHistory });
}

function startWeaknessReview() {
  if (!currentWeaknessIds.length) return;
  setMode("flash");
  // Ôn từ yếu là giới hạn khác (không phải ★), nên tắt trạng thái toggle ★ để
  // tránh hiện sai là "đang lọc theo ★" trong khi thực ra đang lọc theo điểm yếu.
  setFlashStarOnlyState(false);
  initFlashMode(currentWeaknessIds);
}

/* ===================================================================
   STATS MODE — trang thống kê tổng quan toàn hệ thống (từ vựng, ngữ
   pháp, đề thi). Chỉ ĐỌC dữ liệu đã có (SRS, weakness, exam history),
   không tạo thêm state riêng nào — luôn tính lại tươi mỗi lần mở trang.
=================================================================== */

// Tính số liệu đầy đủ cho 1 bộ: known/learning/fresh (để vẽ thanh 3 màu),
// due (đến hạn ôn ngay) và % đã thuộc — dùng progress riêng của bộ đó
// (không phải App.progress hiện tại), vì bảng tổng quan hiện MỌI bộ cùng lúc.
function computeDeckStats(deck) {
  const progress = SRS.loadProgress(deck.id);
  let known = 0, learning = 0, fresh = 0, due = 0, mastered = 0;
  deck.words.forEach((w) => {
    const entry = SRS.getEntry(progress, w._id);
    const st = SRS.status(entry);
    // "mastered" (đánh dấu thủ công "Đã thuộc") được TÍNH VÀO known cho thanh % —
    // về bản chất đây cũng là trạng thái "đã thuộc", chỉ khác cách đạt tới đó.
    // Đếm riêng "mastered" thêm để có thể hiển thị huy hiệu ⭐ riêng nếu cần.
    if (st === "known") known++;
    else if (st === "mastered") { known++; mastered++; }
    else if (st === "learning") learning++;
    else fresh++;
    if (entry.seen && SRS.isDue(entry)) due++;
  });
  const total = deck.words.length || 1;
  const pctKnown = Math.round((known / total) * 100);
  const pctLearning = Math.round((learning / total) * 100);
  const pctFresh = 100 - pctKnown - pctLearning;
  return { known, learning, fresh, due, mastered, total: deck.words.length, pctKnown, pctLearning, pctFresh };
}

function renderStatsMode() {
  renderStatsOverviewTable();
  renderStatsGrammarItems();
  renderStatsExamHistory();
  renderStatsChoukaiHistory();
}

// Thống kê ngữ pháp theo TỪNG CẤU TRÚC riêng lẻ (KHÔNG gộp theo bộ như 2 nhóm
// Mimi/Tài liệu khác ở trên) — vì mỗi bộ NGUPHAP có thể gồm vài chục cấu trúc
// khác nhau, gộp theo bộ sẽ che mất việc "cấu trúc A trong bộ X đã thuộc, cấu
// trúc B trong CÙNG bộ X vẫn còn yếu". Sắp yếu nhất lên đầu giống quy ước chung.
function renderStatsGrammarItems() {
  const donutRow = document.getElementById("statsDonutRowGrammarItems");
  const tbody = document.getElementById("statsOverviewBodyGrammarItems");
  tbody.innerHTML = "";

  const grammarDecks = App.decks.filter((d) => d.type === "NGUPHAP");
  if (grammarDecks.length === 0) {
    donutRow.innerHTML = `<div class="stats-donut-empty">Chưa có bộ ngữ pháp nào.</div>`;
    return;
  }

  // Gộp TẤT CẢ cấu trúc của TẤT CẢ bộ NGUPHAP thành 1 danh sách phẳng — mỗi
  // dòng = 1 cấu trúc thật, kèm deckId để bấm vào nhảy đúng bộ chứa nó.
  const items = [];
  grammarDecks.forEach((deck) => {
    const progress = SRS.loadProgress(deck.id);
    deck.words.forEach((w) => {
      const entry = SRS.getEntry(progress, w._id);
      const st = SRS.status(entry);
      items.push({ deckId: deck.id, deckTitle: deck.title, cautruc: w.cautruc, nghia: w.nghia, status: st, due: entry.seen && SRS.isDue(entry) });
    });
  });

  const agg = items.reduce((acc, it) => {
    if (it.status === "known" || it.status === "mastered") acc.known++;
    else if (it.status === "learning") acc.learning++;
    else acc.fresh++;
    acc.total++;
    return acc;
  }, { known: 0, learning: 0, fresh: 0, total: 0 });
  const aggPct = agg.total ? Math.round((agg.known / agg.total) * 100) : 0;

  donutRow.innerHTML = `
    <div class="stats-donut-box">
      ${buildDonutSvg(
        [
          { value: agg.known, color: "var(--good)" },
          { value: agg.learning, color: "var(--warn)" },
          { value: agg.fresh, color: "var(--border)" },
        ],
        `${aggPct}%`,
        "đã thuộc"
      )}
    </div>
    <div class="stats-donut-summary">
      <div class="stats-donut-summary-title">📖 Ngữ pháp — ${agg.total} cấu trúc (tính riêng từng cấu trúc, ${grammarDecks.length} bộ)</div>
      <div class="stats-donut-summary-row"><i class="stats-dot stats-dot-known"></i> Đã thuộc: <b>${agg.known}</b></div>
      <div class="stats-donut-summary-row"><i class="stats-dot stats-dot-learning"></i> Đang học: <b>${agg.learning}</b></div>
      <div class="stats-donut-summary-row"><i class="stats-dot stats-dot-fresh"></i> Chưa học: <b>${agg.fresh}</b></div>
    </div>
  `;

  // Sắp YẾU NHẤT lên đầu (fresh/learning trước known) để biết nên ôn cấu trúc nào trước.
  const statusRank = { fresh: 0, learning: 1, known: 2, mastered: 3 };
  items.sort((a, b) => statusRank[a.status] - statusRank[b.status]);

  items.forEach((it) => {
    const pct = (it.status === "known" || it.status === "mastered") ? 100 : (it.status === "learning" ? 50 : 0);
    const knownW = (it.status === "known" || it.status === "mastered") ? 100 : 0;
    const learningW = it.status === "learning" ? 100 : 0;
    const freshW = it.status === "fresh" ? 100 : 0;
    const tr = document.createElement("tr");
    if (it.deckId === App.currentDeckId) tr.classList.add("is-current-deck-row");
    tr.innerHTML = `
      <td class="stats-deck-name-cell">
        <button class="stats-deck-link" data-jump-deck="${it.deckId}" title="${it.nghia}">${it.cautruc}</button>
        <span class="stats-deck-type-tag">${it.deckTitle}</span>
        ${it.due ? `<span class="stats-due-badge">cần ôn</span>` : ""}
      </td>
      <td class="stats-bar-cell">
        <div class="stats-hbar" title="${it.status}">
          <div class="stats-hbar-seg stats-hbar-known" style="width:${knownW}%"></div>
          <div class="stats-hbar-seg stats-hbar-learning" style="width:${learningW}%"></div>
          <div class="stats-hbar-seg stats-hbar-fresh" style="width:${freshW}%"></div>
        </div>
      </td>
      <td class="stats-pct-cell">${pct}%</td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-jump-deck]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const deckId = btn.dataset.jumpDeck;
      if (deckId !== App.currentDeckId) switchDeck(deckId);
      setMode("srs");
    });
  });
}

// Vẽ 1 biểu đồ tròn (donut) thuần SVG — không phụ thuộc thư viện ngoài (app
// vẫn là HTML/CSS/JS thuần). Nhận mảng segments [{value, color, label}] và vẽ
// các cung nối tiếp nhau bằng kỹ thuật stroke-dasharray/dashoffset, bắt đầu từ
// vị trí 12 giờ (xoay -90°). Trả về chuỗi HTML (SVG + chữ % ở giữa).
function buildDonutSvg(segments, centerLabel, centerSub) {
  const size = 120, r = 48, cx = size / 2, cy = size / 2;
  const circumference = 2 * Math.PI * r;
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1;
  let cumulative = 0;
  const circles = segments.map((s) => {
    const frac = s.value / total;
    const length = frac * circumference;
    const dasharray = `${length} ${circumference - length}`;
    const dashoffset = circumference - cumulative;
    cumulative += length;
    if (s.value <= 0) return "";
    return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="16"
      stroke-dasharray="${dasharray}" stroke-dashoffset="${dashoffset}" />`;
  }).join("");
  // Vòng nền xám mờ (trường hợp total=0, hoặc làm khung viền nhẹ phía dưới các cung màu)
  return `
    <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" class="stats-donut-svg">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="var(--bg-3)" stroke-width="16" />
      <g transform="rotate(-90 ${cx} ${cy})">${circles}</g>
      <text x="${cx}" y="${cy - 2}" text-anchor="middle" class="stats-donut-center-num">${centerLabel}</text>
      <text x="${cx}" y="${cy + 16}" text-anchor="middle" class="stats-donut-center-sub">${centerSub}</text>
    </svg>
  `;
}

// Render 1 nhóm (Mimi hoặc Khác): donut tổng quan + bảng từng bộ, sắp theo %
// đã thuộc tăng dần (bộ yếu nhất lên đầu).
function renderStatsGroup(decks, donutRowId, tbodyId, accentLabel) {
  const donutRow = document.getElementById(donutRowId);
  const tbody = document.getElementById(tbodyId);
  tbody.innerHTML = "";

  if (decks.length === 0) {
    donutRow.innerHTML = `<div class="stats-donut-empty">Chưa có bộ nào trong nhóm này.</div>`;
    return;
  }

  const decksWithStats = decks.map((deck) => ({ deck, s: computeDeckStats(deck) }));

  // Tổng hợp cả nhóm để vẽ donut tổng quan + vài số liệu nổi bật.
  const agg = decksWithStats.reduce((acc, { s }) => {
    acc.known += s.known; acc.learning += s.learning; acc.fresh += s.fresh; acc.total += s.total;
    return acc;
  }, { known: 0, learning: 0, fresh: 0, total: 0 });
  const aggPct = agg.total ? Math.round((agg.known / agg.total) * 100) : 0;
  const bestDeck = decksWithStats.reduce((best, cur) => (cur.s.pctKnown > best.s.pctKnown ? cur : best), decksWithStats[0]);
  const weakestDeck = decksWithStats.reduce((worst, cur) => (cur.s.pctKnown < worst.s.pctKnown ? cur : worst), decksWithStats[0]);

  donutRow.innerHTML = `
    <div class="stats-donut-box">
      ${buildDonutSvg(
        [
          { value: agg.known, color: "var(--good)" },
          { value: agg.learning, color: "var(--warn)" },
          { value: agg.fresh, color: "var(--border)" },
        ],
        `${aggPct}%`,
        "đã thuộc"
      )}
    </div>
    <div class="stats-donut-summary">
      <div class="stats-donut-summary-title">${accentLabel} — ${decks.length} bộ, ${agg.total} từ/cấu trúc</div>
      <div class="stats-donut-summary-row"><i class="stats-dot stats-dot-known"></i> Đã thuộc: <b>${agg.known}</b></div>
      <div class="stats-donut-summary-row"><i class="stats-dot stats-dot-learning"></i> Đang học: <b>${agg.learning}</b></div>
      <div class="stats-donut-summary-row"><i class="stats-dot stats-dot-fresh"></i> Chưa học: <b>${agg.fresh}</b></div>
      <div class="stats-donut-summary-highlight">🏆 Mạnh nhất: <b>${bestDeck.deck.title}</b> (${bestDeck.s.pctKnown}%)</div>
      <div class="stats-donut-summary-highlight is-weak">⚠ Cần ưu tiên: <b>${weakestDeck.deck.title}</b> (${weakestDeck.s.pctKnown}%)</div>
    </div>
  `;

  decksWithStats.sort((a, b) => a.s.pctKnown - b.s.pctKnown);
  decksWithStats.forEach(({ deck, s }) => {
    const tr = document.createElement("tr");
    if (deck.id === App.currentDeckId) tr.classList.add("is-current-deck-row");

    const dueNote = s.due > 0 ? `<span class="stats-due-badge">${s.due} cần ôn</span>` : "";
    const typeTag = deck.type === "NGUPHAP" ? "Ngữ pháp" : "Từ vựng";

    tr.innerHTML = `
      <td class="stats-deck-name-cell">
        <button class="stats-deck-link" data-jump-deck="${deck.id}">${deck.title}</button>
        <span class="stats-deck-type-tag">${typeTag}</span>
        ${deck.id === App.currentDeckId ? '<span class="stats-current-tag">(đang mở)</span>' : ""}
        ${dueNote}
      </td>
      <td class="stats-bar-cell">
        <div class="stats-hbar" title="Đã thuộc: ${s.known} · Đang học: ${s.learning} · Chưa học: ${s.fresh}">
          <div class="stats-hbar-seg stats-hbar-known" style="width:${s.pctKnown}%"></div>
          <div class="stats-hbar-seg stats-hbar-learning" style="width:${s.pctLearning}%"></div>
          <div class="stats-hbar-seg stats-hbar-fresh" style="width:${s.pctFresh}%"></div>
        </div>
        <div class="stats-hbar-legend">
          <span><i class="stats-dot stats-dot-known"></i>${s.known} thuộc</span>
          <span><i class="stats-dot stats-dot-learning"></i>${s.learning} đang học</span>
          <span><i class="stats-dot stats-dot-fresh"></i>${s.fresh} chưa học</span>
        </div>
      </td>
      <td class="stats-pct-cell">${s.pctKnown}%</td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll("[data-jump-deck]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const deckId = btn.dataset.jumpDeck;
      if (deckId !== App.currentDeckId) {
        switchDeck(deckId);
      }
      setMode("srs");
    });
  });
}

// Bảng tổng quan: tách riêng nhóm "Mimi" (giáo trình chính) khỏi các bộ khác —
// đồng bộ với cách nhóm ở dropdown sidebar (mục populateDeckPicker). Mỗi nhóm
// có 1 biểu đồ tròn (donut) tổng quan + bảng chi tiết từng bộ riêng.
function renderStatsOverviewTable() {
  const mimiDecks = App.decks.filter((d) => d.series === "mimi");
  const otherDecks = App.decks.filter((d) => d.series !== "mimi");
  document.querySelector(".stats-group-mimi").classList.toggle("hidden", mimiDecks.length === 0);
  renderStatsGroup(mimiDecks, "statsDonutRowMimi", "statsOverviewBodyMimi", "Mimi N2");
  renderStatsGroup(otherDecks, "statsDonutRowOther", "statsOverviewBodyOther", "Tài liệu khác");
}

// Bảng đề thi: liệt kê TẤT CẢ đề có trong hệ thống, kể cả CHƯA làm lần nào
// (để biết rõ đề nào còn thiếu, không chỉ đề đã làm). Nhấn tên đề -> nhảy
// thẳng sang trang Làm đề thi và tự chọn đúng đề đó.
/* ===================================================================
   MODAL "LƯỚI KẾT QUẢ NHIỀU LẦN LÀM" — dùng CHUNG cho cả đề thi chữ và đề
   nghe. Hàng ngang = số câu, cột dọc = lần làm (Lần 1, Lần 2...).
   Câu SAI ở lần đó → vòng ĐỎ, hiện NỘI DUNG đáp án ĐÚNG thật (không phải số
   thứ tự — vì thứ tự 1-2-3-4 bị ĐẢO khác nhau mỗi lần làm, số không có nghĩa
   gì để so sánh giữa các lần). Câu ĐÚNG → vòng XANH, không hiện chữ bên trong.
   BẤM VÀO BẤT KỲ Ô NÀO (đã làm) → mở modal xem ĐẦY ĐỦ câu hỏi/đáp án/giải thích.
   columns: [{key, label}], attempts: [{completedAt, score, total, results}]
     (results[key] = null nếu chưa làm, hoặc {correct, chosenText} — chosenText
     có thể null với dữ liệu CŨ trước khi tính năng này được nâng cấp).
   getCorrectText(key) => chuỗi nội dung đáp án ĐÚNG thật của câu đó.
   onCellClick(key) => mở modal xem chi tiết đầy đủ câu đó.
=================================================================== */
function escAttrText(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderAttemptsGrid(title, columns, attempts, getCorrectText, onCellClick) {
  document.getElementById("attemptsGridTitle").textContent = title;
  const body = document.getElementById("attemptsGridBody");

  if (attempts.length === 0) {
    body.innerHTML = `<div class="attempts-grid-empty">Chưa có lần làm nào được lưu cho đề này.</div>`;
    document.getElementById("attemptsGridModalOverlay").classList.remove("hidden");
    return;
  }

  const headerCells = columns.map((c) => `<th class="attempts-grid-col-head">${c.label}</th>`).join("");
  const rows = attempts.map((attempt, idx) => {
    const dateLabel = attempt.completedAt ? new Date(attempt.completedAt).toLocaleDateString("vi-VN") : "";
    const cells = columns.map((c) => {
      const r = attempt.results[c.key];
      if (r === null || r === undefined) {
        return `<td class="attempts-grid-cell"><span class="attempts-grid-dot is-empty">—</span></td>`;
      }
      const correct = isResultCorrect(r);
      const chosenText = getResultChosenText(r);
      if (correct) {
        const tip = "✓ Đúng" + (chosenText ? " — đã chọn: " + chosenText : "") + " (bấm để xem chi tiết)";
        return `<td class="attempts-grid-cell"><span class="attempts-grid-dot is-correct" data-qkey="${escAttrText(c.key)}" title="${escAttrText(tip)}"></span></td>`;
      }
      const correctText = getCorrectText(c.key) || "(?)";
      const shortText = correctText.length > 9 ? correctText.slice(0, 8) + "…" : correctText;
      const tip = "✕ Sai — đáp án ĐÚNG: " + correctText + (chosenText ? " | bạn đã chọn: " + chosenText : "") + " (bấm để xem chi tiết)";
      return `<td class="attempts-grid-cell"><span class="attempts-grid-dot is-wrong" data-qkey="${escAttrText(c.key)}" title="${escAttrText(tip)}">${escAttrText(shortText)}</span></td>`;
    }).join("");
    return `
      <tr>
        <th class="attempts-grid-row-head">
          Lần ${idx + 1}
          <div class="attempts-grid-row-score">${attempt.score}/${attempt.total} · ${dateLabel}${attempt.linearScore != null ? ` · Linear ${attempt.linearScore} / IRT ${attempt.irtScore}` : ""}</div>
        </th>
        ${cells}
      </tr>
    `;
  }).join("");

  body.innerHTML = `
    <div class="attempts-grid-scroll">
      <table class="attempts-grid-table">
        <thead><tr><th class="attempts-grid-row-head attempts-grid-corner">Lần \\ Câu</th>${headerCells}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <div class="attempts-grid-legend">
      <span><span class="attempts-grid-dot is-correct" style="margin-right:6px"></span>Đúng</span>
      <span><span class="attempts-grid-dot is-wrong" style="margin-right:6px">✕</span>Sai — chữ trong ô là đáp án ĐÚNG thật (di chuột/bấm để xem đầy đủ)</span>
    </div>
  `;
  document.getElementById("attemptsGridModalOverlay").classList.remove("hidden");

  if (onCellClick) {
    body.querySelectorAll(".attempts-grid-dot[data-qkey]").forEach((el) => {
      el.addEventListener("click", () => onCellClick(el.dataset.qkey));
    });
  }
}

function openExamAttemptsGridModal(examId) {
  const exam = App.exams.find((ex) => ex.id === examId);
  if (!exam) return;
  const attempts = getExamAttempts(examId);
  const columns = exam.questions.map((q, i) => ({ key: i, label: String(i + 1) }));
  renderAttemptsGrid(
    `📊 ${exam.title} — Lưới kết quả qua các lần làm`,
    columns,
    attempts,
    (qIndex) => exam.questions[qIndex].options[exam.questions[qIndex].dap_an_dung],
    (qKeyStr) => {
      const qIndex = parseInt(qKeyStr, 10);
      closeAttemptsGridModal();
      openExamDetailModal(qIndex, { examId, examHistory: {} });
      applyExamNoteHighlights(document.getElementById("examDetailModalBody"), examId, qIndex);
    }
  );
}

function openChoukaiAttemptsGridModal(testId) {
  const test = getChoukaiTest(testId);
  if (!test) return;
  const attempts = getChoukaiAttempts(testId);
  const columns = getChoukaiColumns(test);
  const optsByKey = getChoukaiOptionsByKey(test);
  // Map key -> đáp án đúng (nội dung thật) để hiện trong ô đỏ + tra flatIdx khi bấm.
  const correctByKey = {};
  const queue = buildChoukaiQueue(test, "all");
  queue.forEach((pos, flatIdx) => {
    const m = test.mondai[pos.mIndex];
    const q = m.questions[pos.qIndex];
    const key = choukaiKeyFor(m.number, q.qnum, pos.subIndex);
    const correctIdx = pos.subIndex === null ? q.correctIndex : q.subQuestions[pos.subIndex].correctIndex;
    correctByKey[key] = { correctIdx, flatIdx };
  });
  renderAttemptsGrid(
    `📊 ${test.title} — Lưới kết quả qua các lần làm`,
    columns,
    attempts,
    (key) => {
      const info = correctByKey[key];
      const opts = optsByKey[key];
      return info && opts ? opts[info.correctIdx] : null;
    },
    (key) => {
      const info = correctByKey[key];
      if (!info) return;
      closeAttemptsGridModal();
      openChoukaiDetailModal(info.flatIdx, { testId, queue, answers: {} });
    }
  );
}

function closeAttemptsGridModal() {
  document.getElementById("attemptsGridModalOverlay").classList.add("hidden");
}

function renderStatsExamHistory() {
  const stats = loadExamHistoryStats();
  const listDiv = document.getElementById("statsExamList");
  document.getElementById("statsExamEmpty").classList.add("hidden");

  if (!App.exams.length) {
    document.getElementById("statsExamEmpty").classList.remove("hidden");
    listDiv.innerHTML = "";
    return;
  }

  // Đề chưa làm lên trước (ưu tiên nhìn thấy ngay), đề đã làm sắp theo điểm thấp nhất trước
  const examsWithStats = App.exams.map((exam) => ({ exam, s: stats[exam.id] || null }));
  examsWithStats.sort((a, b) => {
    if (!a.s && !b.s) return 0;
    if (!a.s) return -1;
    if (!b.s) return 1;
    return (a.s.lastScore / a.s.lastTotal) - (b.s.lastScore / b.s.lastTotal);
  });

  const rows = examsWithStats.map(({ exam, s }) => {
    if (!s) {
      return `
        <div class="stats-exam-row is-not-done">
          <button class="stats-deck-link stats-exam-row-title" data-jump-exam="${exam.id}">${exam.title}</button>
          <div class="stats-exam-row-stats">
            <span class="stats-exam-not-done-badge">Chưa làm</span>
          </div>
        </div>
      `;
    }
    const pct = s.lastTotal ? Math.round((s.lastScore / s.lastTotal) * 100) : 0;
    const dateLabel = s.lastCompletedAt ? new Date(s.lastCompletedAt).toLocaleString("vi-VN") : "—";
    const timeLabel = s.lastSeconds ? fmtTime(s.lastSeconds) : "—";
    const best = getBestExamScore(exam.id);
    const bestLabel = best ? `${best.score}/${best.total}` : "—";
    const attemptsCount = getExamAttempts(exam.id).length;
    return `
      <div class="stats-exam-row">
        <button class="stats-deck-link stats-exam-row-title" data-jump-exam="${exam.id}">${exam.title}</button>
        <div class="stats-hbar stats-hbar-score" title="${s.lastScore}/${s.lastTotal} điểm">
          <div class="stats-hbar-seg stats-hbar-known" style="width:${pct}%"></div>
        </div>
        <div class="stats-exam-row-stats">
          <span class="stats-exam-stat">Đã làm <b>${s.totalCompletions}</b> lần</span>
          <span class="stats-exam-stat">Gần nhất: <b>${s.lastScore}/${s.lastTotal}</b> điểm</span>
          <span class="stats-exam-stat is-best">🏆 Tốt nhất: <b>${bestLabel}</b></span>
          <span class="stats-exam-stat">Sai lần 1: <b>${s.lastFirstTryWrongCount}</b> câu</span>
          <span class="stats-exam-stat">Thời gian: <b>${timeLabel}</b></span>
          <span class="stats-exam-stat-date">${dateLabel}</span>
          ${attemptsCount > 0 ? `<button class="stats-grid-btn" data-grid-exam="${exam.id}">📊 Xem lưới ${attemptsCount} lần làm</button>` : ""}
        </div>
      </div>
    `;
  }).join("");
  listDiv.innerHTML = rows;

  listDiv.querySelectorAll("[data-jump-exam]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const examId = btn.dataset.jumpExam;
      document.getElementById("examPicker").value = examId;
      startExam(examId);
      setMode("exam");
    });
  });
  listDiv.querySelectorAll("[data-grid-exam]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openExamAttemptsGridModal(btn.dataset.gridExam);
    });
  });
}

// Bảng đề nghe — cùng pattern với renderStatsExamHistory, liệt kê TẤT CẢ đề
// nghe có trong hệ thống, đề chưa làm lên trước.
function renderStatsChoukaiHistory() {
  const stats = loadChoukaiHistoryStats();
  const listDiv = document.getElementById("statsChoukaiList");
  document.getElementById("statsChoukaiEmpty").classList.add("hidden");

  if (!App.choukaiTests.length) {
    document.getElementById("statsChoukaiEmpty").classList.remove("hidden");
    listDiv.innerHTML = "";
    return;
  }

  const testsWithStats = App.choukaiTests.map((test) => ({ test, s: stats[test.id] || null }));
  testsWithStats.sort((a, b) => {
    if (!a.s && !b.s) return 0;
    if (!a.s) return -1;
    if (!b.s) return 1;
    return (a.s.lastScore / a.s.lastTotal) - (b.s.lastScore / b.s.lastTotal);
  });

  const rows = testsWithStats.map(({ test, s }) => {
    if (!s) {
      return `
        <div class="stats-exam-row is-not-done">
          <button class="stats-deck-link stats-exam-row-title" data-jump-choukai="${test.id}">${test.title}</button>
          <div class="stats-exam-row-stats">
            <span class="stats-exam-not-done-badge">Chưa làm</span>
          </div>
        </div>
      `;
    }
    const pct = s.lastTotal ? Math.round((s.lastScore / s.lastTotal) * 100) : 0;
    const dateLabel = s.lastCompletedAt ? new Date(s.lastCompletedAt).toLocaleString("vi-VN") : "—";
    const timeLabel = s.lastSeconds ? fmtTime(s.lastSeconds) : "—";
    const best = getBestChoukaiScore(test.id);
    const bestLabel = best ? `${best.score}/${best.total}` : "—";
    const attemptsCount = getChoukaiAttempts(test.id).length;
    return `
      <div class="stats-exam-row">
        <button class="stats-deck-link stats-exam-row-title" data-jump-choukai="${test.id}">${test.title}</button>
        <div class="stats-hbar stats-hbar-score" title="${s.lastScore}/${s.lastTotal} điểm">
          <div class="stats-hbar-seg stats-hbar-known" style="width:${pct}%"></div>
        </div>
        <div class="stats-exam-row-stats">
          <span class="stats-exam-stat">Đã làm <b>${s.totalCompletions}</b> lần</span>
          <span class="stats-exam-stat">Gần nhất: <b>${s.lastScore}/${s.lastTotal}</b> điểm</span>
          <span class="stats-exam-stat is-best">🏆 Tốt nhất: <b>${bestLabel}</b></span>
          <span class="stats-exam-stat">Thời gian: <b>${timeLabel}</b></span>
          <span class="stats-exam-stat-date">${dateLabel}</span>
          ${attemptsCount > 0 ? `<button class="stats-grid-btn" data-grid-choukai="${test.id}">📊 Xem lưới ${attemptsCount} lần làm</button>` : ""}
        </div>
      </div>
    `;
  }).join("");
  listDiv.innerHTML = rows;

  listDiv.querySelectorAll("[data-jump-choukai]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const testId = btn.dataset.jumpChoukai;
      document.getElementById("choukaiPicker").value = testId;
      openChoukaiModeModal(testId);
      setMode("choukai");
    });
  });
  listDiv.querySelectorAll("[data-grid-choukai]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      openChoukaiAttemptsGridModal(btn.dataset.gridChoukai);
    });
  });
}

