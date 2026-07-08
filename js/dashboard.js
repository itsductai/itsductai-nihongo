/* ===== MODULE: dashboard.js — Màn hình Dashboard mặc định khi mở app.
   Tái dùng TỐI ĐA data/hàm đã có (SRS progress, exam/choukai history) — không
   tạo hệ thống thống kê song song với stats-weakness.js, chỉ thêm lớp trình
   bày tổng quan + 2 mảnh data mới thật sự chưa có: log hoạt động theo ngày,
   và nhóm deck theo "giáo trình" (dùng field deck.series đã có sẵn). ===== */

/* ===================================================================
   LOG HOẠT ĐỘNG THEO NGÀY — cho chart "Theo thời gian". Ghi 1 dòng đếm mỗi
   khi rate 1 từ SRS bất kỳ (rateCurrentSrsWord gọi recordDailyActivity()).
   Cấu trúc: { "YYYY-MM-DD": { tuvung: n, nguphap: n } }
   Giới hạn giữ 90 ngày gần nhất để localStorage không phình to vô hạn.
=================================================================== */
const DAILY_ACTIVITY_STORAGE_KEY = "n2vocab_daily_activity";
const DAILY_ACTIVITY_MAX_DAYS = 90;

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function loadDailyActivity() {
  try {
    const raw = localStorage.getItem(DAILY_ACTIVITY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function recordDailyActivity(deckType) {
  const log = loadDailyActivity();
  const key = todayKey();
  if (!log[key]) log[key] = { tuvung: 0, nguphap: 0 };
  if (deckType === "NGUPHAP") log[key].nguphap++;
  else log[key].tuvung++;

  // Dọn bớt log quá cũ (giữ 90 ngày gần nhất) — tránh phình localStorage vô hạn.
  const dates = Object.keys(log).sort();
  if (dates.length > DAILY_ACTIVITY_MAX_DAYS) {
    dates.slice(0, dates.length - DAILY_ACTIVITY_MAX_DAYS).forEach((d) => delete log[d]);
  }
  localStorage.setItem(DAILY_ACTIVITY_STORAGE_KEY, JSON.stringify(log));
}

// Trả về mảng N ngày gần nhất (mặc định 14), điền 0 cho ngày không có hoạt động
// — luôn đủ N phần tử liên tục để vẽ chart không bị đứt quãng.
function getDailyActivitySeries(numDays) {
  const n = numDays || 14;
  const log = loadDailyActivity();
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const entry = log[key] || { tuvung: 0, nguphap: 0 };
    out.push({ date: key, day: d.getDate(), tuvung: entry.tuvung, nguphap: entry.nguphap, total: entry.tuvung + entry.nguphap });
  }
  return out;
}

/* ===================================================================
   NHÓM DECK THEO "GIÁO TRÌNH" — dùng field deck.series đã có sẵn trong
   loader-nav.js (KHÔNG thêm field data mới). Deck chưa gán series (series:
   null) rơi vào nhóm fallback theo type, để không mất khỏi Dashboard.
   Thêm giáo trình mới (vd N1 sau này) chỉ cần gán series mới trong file JSON
   — tự động xuất hiện thành nhóm riêng ở đây, không cần sửa code.
=================================================================== */
const CURRICULUM_LABELS = {
  mimi: "📘 Mimi N2",
  __tuvung_other__: "📚 Từ vựng khác",
  __nguphap_other__: "📖 Ngữ pháp khác",
};

function getCurriculumGroups() {
  const groups = {};
  App.decks.forEach((deck) => {
    const key = deck.series || (deck.type === "NGUPHAP" ? "__nguphap_other__" : "__tuvung_other__");
    if (!groups[key]) {
      groups[key] = { key, label: CURRICULUM_LABELS[key] || key, type: deck.type, decks: [] };
    }
    groups[key].decks.push(deck);
  });
  return Object.values(groups);
}

// % hoàn thành trung bình của 1 nhóm giáo trình — tính theo tỉ lệ từ known+mastered
// trên tổng số từ của TẤT CẢ deck trong nhóm (đồng nhất cách tính với renderStatsGrammarItems).
function computeCurriculumProgress(group) {
  let known = 0, total = 0;
  group.decks.forEach((deck) => {
    const progress = SRS.loadProgress(deck.id);
    deck.words.forEach((w) => {
      const st = SRS.status(SRS.getEntry(progress, w._id));
      if (st === "known" || st === "mastered") known++;
      total++;
    });
  });
  return { known, total, pct: total ? Math.round((known / total) * 100) : 0 };
}

// Deck ĐẦU TIÊN trong nhóm CHƯA hoàn thành 100% — dùng cho nút "Học ngay" nhảy
// thẳng vào chỗ đang dang dở thay vì luôn nhảy về deck số 1 dù đã học xong.
function findNextDeckToLearn(group) {
  for (const deck of group.decks) {
    const progress = SRS.loadProgress(deck.id);
    const allDone = deck.words.every((w) => {
      const st = SRS.status(SRS.getEntry(progress, w._id));
      return st === "known" || st === "mastered";
    });
    if (!allDone) return deck;
  }
  return group.decks[0]; // cả nhóm đã xong hết -> quay lại deck đầu để ôn lại
}

/* ===================================================================
   CHART "THEO GIÁO TRÌNH" — thanh ngang % đã thuộc, 1 thanh / nhóm giáo trình.
   Tái dùng computeCurriculumProgress() ở trên. Tự co giãn theo số nhóm, không
   giới hạn cứng chỉ Mimi (nhóm N1 sau này thêm vào tự động có thanh riêng).
=================================================================== */
function buildCurriculumBarChart(groups) {
  if (!groups.length) return `<div class="dash-chart-empty">Chưa có bộ nào để thống kê.</div>`;
  const rows = groups.map((g) => {
    const { known, total, pct } = computeCurriculumProgress(g);
    const color = g.type === "NGUPHAP" ? "var(--purple)" : "var(--accent)";
    return `
      <div class="dash-hbar-row">
        <div class="dash-hbar-label">${g.label}</div>
        <div class="dash-hbar-track">
          <div class="dash-hbar-fill" style="width:${pct}%; background:${color}"></div>
        </div>
        <div class="dash-hbar-value">${pct}% <span class="dash-hbar-sub">(${known}/${total})</span></div>
      </div>`;
  }).join("");
  return `<div class="dash-hbar-chart">${rows}</div>`;
}

/* ===================================================================
   CHART "THEO THỜI GIAN" — cột dựng đứng, số từ đã ôn mỗi ngày trong 14 ngày
   gần nhất, tách màu từ vựng (accent) / ngữ pháp (purple) chồng trong 1 cột.
=================================================================== */
function buildDailyActivityChart(series) {
  const maxVal = Math.max(1, ...series.map((d) => d.total));
  const chartH = 120;
  const barW = 100 / series.length;
  const bars = series.map((d, i) => {
    const tuvungH = (d.tuvung / maxVal) * chartH;
    const nguphapH = (d.nguphap / maxVal) * chartH;
    const x = i * barW;
    return `
      <g transform="translate(${x}, 0)">
        <rect x="${barW * 0.2}" y="${chartH - tuvungH - nguphapH}" width="${barW * 0.6}" height="${tuvungH}" fill="var(--accent)" rx="2"/>
        <rect x="${barW * 0.2}" y="${chartH - nguphapH}" width="${barW * 0.6}" height="${nguphapH}" fill="var(--purple)" rx="2"/>
        <text x="${barW / 2}" y="${chartH + 14}" text-anchor="middle" class="dash-chart-axis-label">${d.day}</text>
      </g>`;
  }).join("");
  const totalReviews = series.reduce((s, d) => s + d.total, 0);
  return `
    <svg viewBox="0 0 100 ${chartH + 20}" class="dash-timeseries-svg" preserveAspectRatio="none">
      ${bars}
    </svg>
    <div class="dash-chart-caption">${totalReviews} lượt ôn trong 14 ngày qua</div>
  `;
}

/* ===================================================================
   MAIN RENDER — gọi khi setMode("dashboard"). Chart mode lưu trong
   App.dashboardChartMode (mặc định "curriculum"), toggle không cần render
   lại toàn bộ Dashboard, chỉ render lại riêng phần chart.
=================================================================== */
function renderDashboard() {
  renderDashboardGreeting();
  renderDashboardTodayCount();
  renderDashboardChart();
  renderDashboardCurriculumCards();
  renderDashboardProgressSummary();
  renderDashboardRecentResults();
}

// "Hôm nay đã ôn bao nhiêu từ/cấu trúc" — tái dùng đúng log hoạt động theo
// ngày đã ghi (recordDailyActivity, xem trên) thay vì tạo hệ đếm mới.
// "Hôm nay cần học gì" — tổng số từ/cấu trúc ĐẾN HẠN ÔN ngay bây giờ, tái dùng
// đúng computeDueCounts() đã có (cùng nguồn data với 2 nút due-review bên dưới,
// không tính riêng "đã ôn hôm nay" — đó là khái niệm khác, spec yêu cầu đúng
// là tổng CẦN học, không phải đã học).
function renderDashboardTodayCount() {
  const { tuvung, nguphap } = computeDueCounts();
  document.getElementById("dashTodayCount").textContent = tuvung + nguphap;
}

function renderDashboardGreeting() {
  const hour = new Date().getHours();
  const greeting = hour < 11 ? "Chào buổi sáng" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";
  document.getElementById("dashGreeting").textContent = `${greeting} 👋`;
  const total = App.decks.reduce((s, d) => s + d.words.length, 0);
  document.getElementById("dashSubtitle").textContent = `Bạn có ${total} từ/cấu trúc trong ${App.decks.length} bộ tài liệu — cùng xem hôm nay nên học gì.`;
}

function renderDashboardChart() {
  const mode = App.dashboardChartMode || "curriculum";
  document.querySelectorAll(".dash-chart-tab").forEach((b) => b.classList.toggle("is-active", b.dataset.chartMode === mode));
  const box = document.getElementById("dashChartBox");
  const groups = getCurriculumGroups();
  if (mode === "curriculum") {
    box.innerHTML = buildCurriculumBarChart(groups);
  } else if (mode === "status") {
    const agg = { known: 0, learning: 0, fresh: 0 };
    App.decks.forEach((deck) => {
      const progress = SRS.loadProgress(deck.id);
      deck.words.forEach((w) => {
        const st = SRS.status(SRS.getEntry(progress, w._id));
        if (st === "known" || st === "mastered") agg.known++;
        else if (st === "learning") agg.learning++;
        else agg.fresh++;
      });
    });
    const total = agg.known + agg.learning + agg.fresh || 1;
    const pct = Math.round((agg.known / total) * 100);
    box.innerHTML = `
      <div class="dash-donut-wrap">
        ${buildDonutSvg([
          { value: agg.known, color: "var(--good)" },
          { value: agg.learning, color: "var(--warn)" },
          { value: agg.fresh, color: "var(--border)" },
        ], `${pct}%`, "đã thuộc")}
        <div class="dash-donut-legend">
          <button class="dash-donut-legend-row" data-status-filter="known"><i class="stats-dot stats-dot-known"></i> Đã thuộc: <b>${agg.known}</b></button>
          <button class="dash-donut-legend-row" data-status-filter="learning"><i class="stats-dot stats-dot-learning"></i> Đang học: <b>${agg.learning}</b></button>
          <button class="dash-donut-legend-row" data-status-filter="fresh"><i class="stats-dot stats-dot-fresh"></i> Chưa học: <b>${agg.fresh}</b></button>
        </div>
      </div>`;
    box.querySelectorAll("[data-status-filter]").forEach((btn) => {
      btn.addEventListener("click", () => openWordStatusModal(btn.dataset.statusFilter, "all"));
    });
  } else {
    box.innerHTML = buildDailyActivityChart(getDailyActivitySeries(14));
  }
}

function setDashboardChartMode(mode) {
  App.dashboardChartMode = mode;
  renderDashboardChart();
}

/* ===================================================================
   MODAL "DANH SÁCH TỪ THEO TRẠNG THÁI" — bấm vào donut legend (Đã thuộc/Đang
   học/Chưa học) mở modal này, liệt kê TỪNG TỪ cụ thể thuộc đúng trạng thái đó
   (quét TẤT CẢ deck), kèm hạn ôn tiếp theo + nút đưa về "đang học" ngay
   (tái dùng SRS.forceBackToReview() đã có, không viết logic mới).
=================================================================== */
const WORD_STATUS_LABEL = { known: "Đã thuộc", learning: "Đang học", fresh: "Chưa học", mastered: "⭐ Thành thạo" };

function formatDueDate(entry) {
  if (!entry.seen) return "Chưa học lần nào";
  const days = Math.round((entry.due - Date.now()) / 86400000);
  if (days <= 0) return "Đã đến hạn ôn";
  if (days === 1) return "Còn 1 ngày nữa";
  return `Còn ${days} ngày nữa`;
}

const WORD_STATUS_MODAL_LABELS = {
  known: "✅ Đã thuộc", learning: "🟡 Đang học", fresh: "⚪ Chưa học",
  mastered: "⭐ Đã thuộc làu", due: "🔥 Cần ôn ngay",
};

// scope: "all" (mọi bộ, dùng ở Dashboard) | "current" (chỉ bộ đang học SRS,
// dùng ở view-srs — 2 nơi khác nhau, số liệu khác nhau nên KHÔNG dùng chung
// 1 phạm vi mặc định).
function openWordStatusModal(statusFilter, scope) {
  App.wordStatusModalFilter = statusFilter;
  App.wordStatusModalScope = scope || "all";
  document.getElementById("wordStatusModalTitle").textContent = WORD_STATUS_MODAL_LABELS[statusFilter];
  renderWordStatusModalList();
  document.getElementById("wordStatusModalOverlay").classList.remove("hidden");
}

function wordStatusMatchesFilter(entry, st, statusFilter) {
  if (statusFilter === "known") return st === "known" || st === "mastered";
  if (statusFilter === "due") return entry.seen && SRS.isDue(entry);
  return st === statusFilter; // "learning" | "fresh" | "mastered" (khớp CHÍNH XÁC, khác "known" gộp cả mastered)
}

function renderWordStatusModalList() {
  const statusFilter = App.wordStatusModalFilter;
  const scope = App.wordStatusModalScope || "all";
  const decksToScan = scope === "current" ? App.decks.filter((d) => d.id === App.currentDeckId) : App.decks;

  const rows = [];
  decksToScan.forEach((deck) => {
    const progress = SRS.loadProgress(deck.id);
    deck.words.forEach((w) => {
      const entry = SRS.getEntry(progress, w._id);
      const st = SRS.status(entry);
      if (wordStatusMatchesFilter(entry, st, statusFilter)) rows.push({ deck, w, entry, st });
    });
  });

  const listEl = document.getElementById("wordStatusModalList");
  document.getElementById("wordStatusModalCount").textContent = `${rows.length} từ`;
  if (!rows.length) {
    listEl.innerHTML = `<div class="dash-chart-empty">Không có từ nào ở trạng thái này.</div>`;
    return;
  }
  listEl.innerHTML = rows.slice(0, 300).map(({ deck, w, entry, st }) => `
    <div class="word-status-row">
      <span class="word-status-kanji">${w.kanji || w.cautruc || ""}</span>
      <span class="word-status-deck">${deck.title}</span>
      <span class="word-status-due">${formatDueDate(entry)}</span>
      ${st !== "learning" ? `<button class="word-status-relearn-btn" data-deck-id="${deck.id}" data-word-id="${w._id}">↩ Đưa về đang học</button>` : ""}
    </div>
  `).join("") + (rows.length > 300 ? `<div class="dash-chart-empty">...và ${rows.length - 300} từ khác (chỉ hiện 300 từ đầu)</div>` : "");

  listEl.querySelectorAll("[data-word-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const progress = SRS.loadProgress(btn.dataset.deckId);
      SRS.forceBackToReview(progress, btn.dataset.wordId);
      SRS.saveProgress(btn.dataset.deckId, progress);
      renderWordStatusModalList();
      renderDashboardChart();
      renderDueReviewWidget();
    });
  });
}

// "Tua nhanh N ngày" — mô phỏng thời gian trôi qua, đẩy hạn ôn (due) của các
// từ đang "học dở" (learning/known, KHÔNG đụng "mastered" hay "chưa học lần
// nào") lùi về sớm hơn N ngày, để những từ nhớ mức trung bình tự nhiên trồi
// lên "cần ôn" ngay bây giờ thay vì phải đợi thật NGÀY đó tới. Chỉ áp dụng
// cho đúng danh sách đang xem trong modal (theo statusFilter hiện tại).
// "Tua nhanh N ngày" — bấm CÀNG NHIỀU LẦN thì càng tua thêm (mỗi lần cộng dồn
// thêm N ngày vào due hiện tại, không phải set cố định 1 lần) — nên KHÔNG hỏi
// confirm mỗi lần nữa (sẽ rất phiền khi bấm liên tiếp nhiều lần), thay bằng
// hiện ngay số từ VỪA chuyển sang "cần học" sau lần bấm đó để biết rõ tác
// động, tự nhiên đủ làm "lưới an toàn" thay cho hộp thoại xác nhận.
function fastForwardWordStatusList(days) {
  const ms = days * 86400000;
  const statusFilter = App.wordStatusModalFilter;
  const scope = App.wordStatusModalScope || "all";
  const decksToScan = scope === "current" ? App.decks.filter((d) => d.id === App.currentDeckId) : App.decks;
  let dueBefore = 0, dueAfter = 0;

  decksToScan.forEach((deck) => {
    const progress = SRS.loadProgress(deck.id);
    let changed = false;
    deck.words.forEach((w) => {
      const entry = SRS.getEntry(progress, w._id);
      const st = SRS.status(entry);
      const matches = wordStatusMatchesFilter(entry, st, statusFilter);
      if (matches && entry.seen) {
        if (SRS.isDue(entry)) dueBefore++;
        entry.due -= ms;
        if (SRS.isDue(entry)) dueAfter++;
        changed = true;
      }
    });
    if (changed) SRS.saveProgress(deck.id, progress);
  });

  const newlyDue = dueAfter - dueBefore;
  const feedback = document.getElementById("wordStatusFfFeedback");
  feedback.textContent = newlyDue > 0
    ? `+${days} ngày → vừa thêm ${newlyDue} từ cần học ngay`
    : `+${days} ngày → chưa có từ nào tới hạn thêm`;
  feedback.classList.remove("is-flash");
  void feedback.offsetWidth;
  feedback.classList.add("is-flash");

  renderWordStatusModalList();
  renderDashboardChart();
  renderDueReviewWidget();
}

// "Chọn giáo trình học" — card mỗi nhóm, bấm "Học ngay" MỞ MODAL chọn đúng bộ
// muốn học trong nhóm đó (KHÔNG tự nhảy bừa vào 1 bộ như trước) — vào modal
// là học luôn ngay khi bấm chọn 1 bộ cụ thể.
function renderDashboardCurriculumCards() {
  const groups = getCurriculumGroups();
  const list = document.getElementById("dashCurriculumList");
  list.innerHTML = groups.map((g) => {
    const { pct } = computeCurriculumProgress(g);
    return `
      <div class="dash-course-card" data-curriculum-type="${g.type}">
        <div class="dash-course-card-head">
          <div class="dash-course-card-title">${g.label}</div>
          <div class="dash-course-card-badge">${g.decks.length} bộ</div>
        </div>
        <div class="dash-course-card-sub">Hoàn thành ${pct}%</div>
        <div class="dash-course-card-bar"><div class="dash-course-card-bar-fill" style="width:${pct}%"></div></div>
        <button class="dash-course-card-btn" data-curriculum-key="${g.key}">Học ngay →</button>
      </div>`;
  }).join("");
  list.querySelectorAll("[data-curriculum-key]").forEach((btn) => {
    btn.addEventListener("click", () => openDashDeckPickerModal(btn.dataset.curriculumKey));
  });
}

// Modal chọn bộ cụ thể trong 1 nhóm giáo trình — bấm 1 bộ là vào Flashcard học
// luôn ngay lập tức.
function openDashDeckPickerModal(curriculumKey) {
  const group = getCurriculumGroups().find((g) => g.key === curriculumKey);
  if (!group) return;
  document.getElementById("dashDeckPickerTitle").textContent = `🎓 ${group.label} — chọn bộ để học`;
  const list = document.getElementById("dashDeckPickerList");
  list.innerHTML = group.decks.map((deck) => {
    const progress = SRS.loadProgress(deck.id);
    const known = deck.words.filter((w) => {
      const st = SRS.status(SRS.getEntry(progress, w._id));
      return st === "known" || st === "mastered";
    }).length;
    const pct = deck.words.length ? Math.round((known / deck.words.length) * 100) : 0;
    return `
      <button class="dash-deck-picker-row" data-deck-id="${deck.id}">
        <span class="dash-deck-picker-title">${deck.title}</span>
        <span class="dash-deck-picker-meta">${known}/${deck.words.length} đã thuộc (${pct}%)</span>
      </button>`;
  }).join("");
  list.querySelectorAll("[data-deck-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchDeck(btn.dataset.deckId);
      setMode("srs"); // đi thẳng vào SRS, không phải Flashcard thường — đúng ý ban đầu
      document.getElementById("dashDeckPickerModalOverlay").classList.add("hidden");
    });
  });
  document.getElementById("dashDeckPickerModalOverlay").classList.remove("hidden");
}

// Thanh tiến độ tổng quan Từ vựng / Ngữ pháp — tái dùng cùng công thức đã dùng
// ở trang Thống kê (known+mastered / total), gộp riêng theo type.
function renderDashboardProgressSummary() {
  const box = document.getElementById("dashProgressSummary");
  ["TUVUNG", "NGUPHAP"].forEach((type) => {
    let known = 0, total = 0;
    App.decks.filter((d) => d.type === type).forEach((deck) => {
      const progress = SRS.loadProgress(deck.id);
      deck.words.forEach((w) => {
        const st = SRS.status(SRS.getEntry(progress, w._id));
        if (st === "known" || st === "mastered") known++;
        total++;
      });
    });
    const pct = total ? Math.round((known / total) * 100) : 0;
    const rowId = type === "TUVUNG" ? "dashProgressTuvung" : "dashProgressNguphap";
    const row = document.getElementById(rowId);
    row.querySelector(".dash-progress-value").textContent = `${known}/${total}`;
    row.querySelector(".dash-progress-fill").style.width = `${pct}%`;
  });
}

// "Kết quả gần đây" — thay cho khối bảng xếp hạng bạn bè trong bản mẫu tham
// khảo (app học 1 mình, không có multiplayer) bằng lịch sử điểm thi thật của
// chính người học, tái dùng loadExamHistoryStats/loadChoukaiAttemptsRaw.
function renderDashboardRecentResults() {
  const box = document.getElementById("dashRecentResults");
  const rows = [];
  App.exams.forEach((ex) => {
    const best = getBestExamScore(ex.id);
    if (best) rows.push({ title: ex.title, score: best.score, total: best.total, kind: "📝" });
  });
  App.choukaiTests.forEach((t) => {
    const best = getBestChoukaiScore(t.id);
    if (best) rows.push({ title: t.title, score: best.score, total: best.total, kind: "🎧" });
  });
  if (!rows.length) {
    box.innerHTML = `<div class="dash-chart-empty">Chưa làm đề nào — bắt đầu luyện đề để thấy kết quả ở đây.</div>`;
    return;
  }
  box.innerHTML = rows.slice(0, 6).map((r) => {
    const pct = r.total ? Math.round((r.score / r.total) * 100) : 0;
    return `
      <div class="dash-result-row">
        <span class="dash-result-kind">${r.kind}</span>
        <span class="dash-result-title">${r.title}</span>
        <span class="dash-result-score">${r.score}/${r.total} <b>(${pct}%)</b></span>
      </div>`;
  }).join("");
}
