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
  renderDashboardChart();
  renderDashboardCurriculumCards();
  renderDashboardProgressSummary();
  renderDashboardRecentResults();
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
          <div><i class="stats-dot stats-dot-known"></i> Đã thuộc: <b>${agg.known}</b></div>
          <div><i class="stats-dot stats-dot-learning"></i> Đang học: <b>${agg.learning}</b></div>
          <div><i class="stats-dot stats-dot-fresh"></i> Chưa học: <b>${agg.fresh}</b></div>
        </div>
      </div>`;
  } else {
    box.innerHTML = buildDailyActivityChart(getDailyActivitySeries(14));
  }
}

function setDashboardChartMode(mode) {
  App.dashboardChartMode = mode;
  renderDashboardChart();
}

// "Chọn giáo trình học" — card mỗi nhóm, bấm "Học ngay" nhảy thẳng vào deck
// dang dở gần nhất trong nhóm đó (findNextDeckToLearn), vào chế độ Flashcard.
function renderDashboardCurriculumCards() {
  const groups = getCurriculumGroups();
  const list = document.getElementById("dashCurriculumList");
  list.innerHTML = groups.map((g) => {
    const { pct } = computeCurriculumProgress(g);
    const next = findNextDeckToLearn(g);
    return `
      <div class="dash-course-card" data-curriculum-type="${g.type}">
        <div class="dash-course-card-head">
          <div class="dash-course-card-title">${g.label}</div>
          <div class="dash-course-card-badge">${g.decks.length} bộ</div>
        </div>
        <div class="dash-course-card-sub">Hoàn thành ${pct}%</div>
        <div class="dash-course-card-bar"><div class="dash-course-card-bar-fill" style="width:${pct}%"></div></div>
        <button class="dash-course-card-btn" data-jump-deck-id="${next.id}">Học ngay →</button>
      </div>`;
  }).join("");
  list.querySelectorAll("[data-jump-deck-id]").forEach((btn) => {
    btn.addEventListener("click", () => {
      switchDeck(btn.dataset.jumpDeckId);
      setMode("flash");
    });
  });
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
