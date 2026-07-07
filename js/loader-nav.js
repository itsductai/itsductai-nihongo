/* ===== MODULE: loader-nav.js — Load decks/exams từ JSON, populate dropdown, render sidebar nav, switchDeck/setMode ===== */

/* ---------- Bộ icon SVG dùng chung cho navbar — thay emoji để đồng nhất tone
   (line-icon, stroke=currentColor, ăn theo màu chữ hiện tại, không cần font/
   CDN ngoài -> an toàn offline, không rủi ro phụ thuộc bên thứ 3). ---------- */
const NAV_SVG_ICONS = {
  home: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9"/></svg>`,
  book: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/></svg>`,
  bookOpen: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4.5c2.5-1 5.5-1 8 0v15c-2.5-1-5.5-1-8 0Z"/><path d="M22 4.5c-2.5-1-5.5-1-8 0v15c2.5-1 5.5-1 8 0Z"/></svg>`,
  fileText: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/><path d="M9 13h6"/><path d="M9 17h6"/></svg>`,
  headphones: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 14v-2a9 9 0 0 1 18 0v2"/><rect x="3" y="14" width="5" height="7" rx="1.5"/><rect x="16" y="14" width="5" height="7" rx="1.5"/></svg>`,
  volume: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>`,
  volumeMute: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H2v6h4l5 4Z"/><path d="M22 9l-6 6"/><path d="M16 9l6 6"/></svg>`,
  mic: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0"/><path d="M12 19v3"/></svg>`,
  palette: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 0 20c1.2 0 2-1 2-2 0-.5-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.3 0-1 .8-1.9 1.9-1.9H17a3 3 0 0 0 3-3c0-5.5-4-10.5-8-10.5Z"/><circle cx="7" cy="10" r="1.2" fill="currentColor" stroke="none"/><circle cx="11" cy="6.5" r="1.2" fill="currentColor" stroke="none"/><circle cx="16" cy="8.5" r="1.2" fill="currentColor" stroke="none"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"/></svg>`,
  search: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>`,
};
function navIcon(name, cls) {
  return `<span class="nav-svg-icon${cls ? " " + cls : ""}">${NAV_SVG_ICONS[name] || ""}</span>`;
}

/* ---------- Loading decks & exams ---------- */

async function loadDecks() {
  const res = await fetch("tailieu/index.json");
  const idx = await res.json();
  const decks = [];
  for (const filename of idx.files) {
    try {
      const r = await fetch(`tailieu/${filename}`);
      const data = await r.json();
      // "private": true trong JSON -> bỏ qua hoàn toàn, không đưa vào App.decks,
      // TRỪ KHI đã mở khóa (xem isPrivateContentUnlocked() trong core.js).
      if (data.private === true && !isPrivateContentUnlocked()) continue;
      const id = filename.replace(/\.json$/, "");
      const type = data.type === "NGUPHAP" ? "NGUPHAP" : "TUVUNG";

      // Tạo _id ổn định theo nội dung; nếu phát hiện trùng (hiếm, ví dụ 2 từ
      // đồng âm được liệt kê riêng để học 2 nghĩa), thêm hậu tố #2, #3... để
      // đảm bảo _id luôn duy nhất trong cùng 1 bộ.
      const seenIds = {};
      let words = data.words.map((w, i) => {
        let baseId = wordId(id, w, i);
        if (seenIds[baseId] !== undefined) {
          seenIds[baseId] += 1;
          baseId = `${baseId}#${seenIds[baseId]}`;
        } else {
          seenIds[baseId] = 0;
        }
        return { ...w, _id: baseId };
      });
      words = applyPatchesToWords(id, words);
      // "series" (vd "mimi") — field tùy chọn để nhóm các bộ thuộc cùng 1 giáo
      // trình lại với nhau trong dropdown, tách khỏi các bộ lẻ khác. Không có
      // field này thì coi như thuộc nhóm "khác" (không ảnh hưởng bộ cũ).
      decks.push({ id, title: data.title || filename, type, series: data.series || null, words });
    } catch (e) {
      console.error("Lỗi tải bộ", filename, e);
    }
  }
  // Sắp theo tên hiển thị A-Z (so sánh kiểu tiếng Việt, có dấu đúng thứ tự)
  // — áp dụng ngay tại đây để MỌI nơi dùng App.decks (dropdown, sửa tạm reload...)
  // đều tự động theo đúng thứ tự, không cần sort lặp lại ở từng nơi hiển thị.
  // numeric:true giúp so sánh hiểu ĐÚNG các số nằm trong tên (vd "Unit 10" phải
  // đứng SAU "Unit 3", không phải đứng trước như so sánh ký tự thường — so sánh
  // ký tự thường sẽ thấy '1' < '3' nên xếp "Unit 10","Unit 11" lên TRƯỚC "Unit 3",
  // "Unit 4", nhìn vào tưởng sai thứ tự dù về mặt chuỗi vẫn đúng A-Z.
  decks.sort((a, b) => a.title.localeCompare(b.title, "vi", { numeric: true }));
  return decks;
}

async function loadExams() {
  try {
    const res = await fetch("dethi/index.json");
    const idx = await res.json();
    const exams = [];
    for (const filename of idx.files) {
      try {
        const r = await fetch(`dethi/${filename}`);
        const data = await r.json();
        if (data.private === true && !isPrivateContentUnlocked()) continue;
        const id = filename.replace(/\.json$/, "");
        exams.push({ id, title: data.title || filename, questions: data.questions || [], mondai_breakdown: data.mondai_breakdown || null });
      } catch (e) {
        console.error("Lỗi tải đề thi", filename, e);
      }
    }
    // Cùng quy tắc với loadDecks(): sắp A-Z theo tên đề, hiểu số (numeric:true)
    // để các đề có số năm/tháng trong tên không bị xếp sai kiểu so sánh ký tự.
    exams.sort((a, b) => a.title.localeCompare(b.title, "vi", { numeric: true }));
    return exams;
  } catch (e) {
    console.warn("Không có thư mục đề thi hoặc index.json lỗi", e);
    return [];
  }
}

async function loadChoukaiTests() {
  try {
    const res = await fetch("dethi-choukai/index.json");
    const idx = await res.json();
    const tests = [];
    for (const filename of idx.files) {
      try {
        const r = await fetch(`dethi-choukai/${filename}`);
        const data = await r.json();
        if (data.private === true && !isPrivateContentUnlocked()) continue;
        tests.push(data);
      } catch (e) {
        console.error("Lỗi tải đề nghe", filename, e);
      }
    }
    tests.sort((a, b) => a.title.localeCompare(b.title, "vi", { numeric: true }));
    return tests;
  } catch (e) {
    console.warn("Không có thư mục đề nghe hoặc index.json lỗi", e);
    return [];
  }
}

function populateDeckPicker() {
  const picker = document.getElementById("deckPicker");
  picker.innerHTML = "";

  // Nhóm riêng "Mimi" (giáo trình chính) khỏi các bộ khác — yêu cầu mục 21
  // README. Bộ nào có "series": "mimi" trong file JSON sẽ rơi vào optgroup
  // Mimi, đứng ĐẦU dropdown; còn lại giữ nguyên optgroup "Tài liệu khác".
  // Thứ tự A-Z trong từng nhóm vẫn giữ nguyên (App.decks đã được sort sẵn).
  const mimiDecks = App.decks.filter((d) => d.series === "mimi");
  const otherDecks = App.decks.filter((d) => d.series !== "mimi");

  const renderGroup = (label, decks) => {
    if (decks.length === 0) return;
    const group = document.createElement("optgroup");
    group.label = label;
    decks.forEach((d) => {
      const opt = document.createElement("option");
      opt.value = d.id;
      const typeLabel = d.type === "NGUPHAP" ? "Ngữ pháp" : "Từ vựng";
      opt.textContent = `[${typeLabel}] ${d.title} (${d.words.length})`;
      group.appendChild(opt);
    });
    picker.appendChild(group);
  };

  renderGroup("📘 Mimi N2 (giáo trình chính)", mimiDecks);
  renderGroup("Tài liệu khác", otherDecks);

  picker.value = App.currentDeckId;
}

function populateExamPicker() {
  const picker = document.getElementById("examPicker");
  picker.innerHTML = '<option value="">— chọn đề thi —</option>';
  App.exams.forEach((ex) => {
    const opt = document.createElement("option");
    opt.value = ex.id;
    opt.textContent = `${ex.title} (${ex.questions.length} câu)`;
    picker.appendChild(opt);
  });
  renderExamPickerCards();
}

// Card grid thay cho dropdown — dropdown gốc vẫn giữ trong DOM (ẩn qua CSS
// .picker-hidden) vì vài chỗ khác trong code còn sync .value vào đó; bấm card
// gọi THẲNG openExamModeModal() giống hệt handler "change" của dropdown, đồng
// thời đồng bộ lại .value để 2 nơi không lệch nhau.
function renderExamPickerCards() {
  const grid = document.getElementById("examPickerGrid");
  if (!grid) return;
  grid.innerHTML = App.exams.map((ex) => {
    const best = getBestExamScore(ex.id);
    const scoreBadge = best
      ? `<span class="exam-picker-card-status is-done">${best.score}/${best.total} điểm</span>`
      : `<span class="exam-picker-card-status is-new">Chưa làm</span>`;
    return `
      <button class="exam-picker-card" data-exam-id="${ex.id}">
        <div class="exam-picker-card-title">${ex.title}</div>
        <div class="exam-picker-card-meta">${ex.questions.length} câu</div>
        ${scoreBadge}
      </button>`;
  }).join("");
  grid.querySelectorAll("[data-exam-id]").forEach((card) => {
    card.addEventListener("click", () => {
      const id = card.dataset.examId;
      document.getElementById("examPicker").value = id;
      openExamModeModal(id);
    });
  });
}

/* ---------- Navigation: nav items thay đổi theo TYPE ---------- */

const NAV_ITEMS_BY_TYPE = {
  TUVUNG: [
    { mode: "flash", icon: "▤", label: "Flashcard" },
    { mode: "table", icon: "☰", label: "Bảng danh sách" },
    { mode: "srs", icon: "◷", label: "Ôn tập (SRS)" },
    { mode: "typing", icon: "⌨", label: "Gõ hiragana" },
    { mode: "quiz", icon: "✓", label: "Trắc nghiệm nghĩa" },
    { mode: "match", icon: "▦", label: "Ghép thẻ" },
    { mode: "weakness", icon: "⚠", label: "Điểm yếu" },
    { mode: "stats", icon: "📊", label: "Thống kê" },
  ],
  NGUPHAP: [
    { mode: "flash", icon: "▤", label: "Flashcard" },
    { mode: "table", icon: "☰", label: "Bảng danh sách" },
    { mode: "srs", icon: "◷", label: "Ôn tập (SRS)" },
    { mode: "quiz", icon: "✓", label: "Trắc nghiệm ý nghĩa" },
    { mode: "weakness", icon: "⚠", label: "Điểm yếu" },
    { mode: "stats", icon: "📊", label: "Thống kê" },
  ],
  EXAM: [
    { mode: "exam", icon: "▤", label: "Làm đề thi" },
  ],
};

// Tạo 1 nút nav-item (giữ NGUYÊN class/data-mode/click handler như bản cũ —
// chỉ khác chỗ nó được append vào đâu: trước đây thẳng vào #navList, giờ vào
// trong .nav-dropdown của category tương ứng).
function buildNavItemBtn(mode, icon, label) {
  const btn = document.createElement("button");
  btn.className = "nav-item";
  btn.dataset.mode = mode;
  btn.innerHTML = `<span class="nav-icon">${icon}</span> <span>${label}</span>`;
  btn.addEventListener("click", () => {
    setMode(mode);
    closeAllNavDropdowns();
  });
  return btn;
}

// 1 category = icon trigger (không chữ, gọn) + dropdown xổ xuống chứa các
// nav-item con. modes: mảng data-mode thuộc category này, dùng để tô sáng
// trigger khi mode đang active nằm trong nhóm (dù dropdown đang đóng).
function buildNavCategory(icon, title, items, modes) {
  const wrap = document.createElement("div");
  wrap.className = "nav-category";
  wrap.dataset.navModes = modes.join(",");

  const trigger = document.createElement("button");
  trigger.className = "nav-category-trigger";
  trigger.title = title;
  trigger.innerHTML = `<span class="nav-icon">${icon}</span><span class="nav-caret">▾</span>`;
  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = wrap.classList.contains("is-open");
    closeAllNavDropdowns();
    if (!isOpen) wrap.classList.add("is-open");
  });
  wrap.appendChild(trigger);

  const dropdown = document.createElement("div");
  dropdown.className = "nav-dropdown";
  items.forEach((item) => dropdown.appendChild(item));
  wrap.appendChild(dropdown);

  return wrap;
}

function closeAllNavDropdowns() {
  document.querySelectorAll(".nav-category.is-open").forEach((c) => c.classList.remove("is-open"));
}

function renderNav() {
  const nav = document.getElementById("navList");
  nav.innerHTML = "";

  // Dashboard — icon đơn, bấm là vào thẳng, không cần dropdown vì chỉ có 1 hành động.
  const dashBtn = document.createElement("button");
  dashBtn.className = "nav-item nav-item-standalone";
  dashBtn.dataset.mode = "dashboard";
  dashBtn.title = "Dashboard";
  dashBtn.innerHTML = navIcon("home");
  dashBtn.addEventListener("click", () => setMode("dashboard"));
  nav.appendChild(dashBtn);

  // Nhóm "Từ vựng"/"Ngữ pháp" — icon + label đổi theo loại deck đang chọn.
  const isNguphap = App.currentDeckType === "NGUPHAP";
  const typeItems = (NAV_ITEMS_BY_TYPE[App.currentDeckType] || NAV_ITEMS_BY_TYPE.TUVUNG)
    .map((it) => buildNavItemBtn(it.mode, it.icon, it.label));
  // "Nhóm ngữ pháp" (học thông minh) gộp chung vào nhóm Ngữ pháp thay vì tách
  // category riêng — giảm số icon trên navbar (Well-Architected: đơn giản hóa).
  if (isNguphap && App.grammarGroupsData) {
    typeItems.push(buildNavItemBtn("grammargroups", "📚", "Nhóm ngữ pháp"));
  }
  const typeModes = typeItems.map((b) => b.dataset.mode);
  nav.appendChild(buildNavCategory(
    navIcon(isNguphap ? "book" : "bookOpen"),
    isNguphap ? "Học ngữ pháp" : "Học từ vựng",
    typeItems,
    typeModes
  ));

  // Nhóm "Đề thi thật"
  if (App.exams.length > 0) {
    const examItems = [
      buildNavItemBtn("exam", "▤", "Làm đề thi"),
      buildNavItemBtn("examnotes", "📝", "Ghi chú đề thi"),
    ];
    nav.appendChild(buildNavCategory(navIcon("fileText"), "Đề thi thật", examItems, examItems.map((b) => b.dataset.mode)));
  }

  // Nhóm "Luyện nghe (聴解)"
  if (App.choukaiTests.length > 0) {
    const choukaiItems = [
      buildNavItemBtn("choukai", "🎧", "Luyện nghe theo đề"),
      buildNavItemBtn("choukai-m4", "🎯", "Luyện riêng Mondai 4"),
      buildNavItemBtn("choukai-shadow", "🔁", "Luyện nghe câu"),
    ];
    nav.appendChild(buildNavCategory(navIcon("headphones"), "Luyện nghe (聴解)", choukaiItems, choukaiItems.map((b) => b.dataset.mode)));
  }

  // Re-apply active state: tô sáng nav-item con đang active, VÀ tô viền
  // category cha (has-active) để biết đang ở nhóm nào dù dropdown đang đóng.
  const current = document.querySelector(".view:not(.hidden)");
  if (current) {
    const mode = current.id.replace("view-", "");
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
    document.querySelectorAll(".nav-category").forEach((cat) => {
      cat.classList.toggle("has-active", cat.dataset.navModes.split(",").includes(mode));
    });
  }
}

// Đóng dropdown khi bấm ra ngoài navbar.
document.addEventListener("click", (e) => {
  if (!e.target.closest(".nav-category")) closeAllNavDropdowns();
});

/* ===================================================================
   TỪ ĐIỂN NỘI BỘ — search TOÀN BỘ deck (cả TUVUNG lẫn NGUPHAP) theo
   kanji/hiragana/Hán Việt/nghĩa tiếng Việt (hoặc cautruc/nghia/muc_do với
   ngữ pháp) — TÁI DÙNG đúng field-matching logic của renderTable() (không
   tạo hệ tìm kiếm song song, chỉ mở rộng phạm vi từ 1 deck ra TẤT CẢ deck).
=================================================================== */
function performGlobalSearch(query) {
  const resultsBox = document.getElementById("globalSearchResults");
  const q = query.trim().toLowerCase();
  if (!q) { resultsBox.classList.add("hidden"); resultsBox.innerHTML = ""; return; }

  const results = [];
  for (const deck of App.decks) {
    const keys = deck.type === "NGUPHAP" ? ["cautruc", "nghia", "muc_do"] : ["kanji", "doc", "han_viet", "nghia"];
    for (const w of deck.words) {
      const haystack = keys.map((k) => w[k] || "").join(" ").toLowerCase();
      if (haystack.includes(q)) {
        results.push({ deck, w });
        if (results.length >= 30) break;
      }
    }
    if (results.length >= 30) break;
  }

  if (!results.length) {
    resultsBox.innerHTML = `<div class="search-result-empty">Không tìm thấy "${query}"</div>`;
  } else {
    resultsBox.innerHTML = results.slice(0, 10).map(({ deck, w }) => {
      const display = w.kanji || w.cautruc || "";
      return `
        <button class="search-result-row" data-jump-deck="${deck.id}" data-jump-word="${w._id}">
          <span class="search-result-kanji">${display}</span>
          <span class="search-result-nghia">${w.nghia || ""}</span>
          <span class="search-result-deck">${deck.title}</span>
        </button>`;
    }).join("");
    resultsBox.querySelectorAll("[data-jump-word]").forEach((btn) => {
      btn.addEventListener("click", () => jumpToSearchResult(btn.dataset.jumpDeck, btn.dataset.jumpWord));
    });
  }
  resultsBox.classList.remove("hidden");
}

// Nhảy tới từ tìm được — chuyển đúng bộ chứa nó, vào Bảng danh sách và tự điền
// ô search của Bảng để lọc ngay ra đúng dòng đó (TÁI DÙNG bộ lọc Bảng sẵn có,
// không cần logic "nhảy tới vị trí" mới trong Flashcard/SRS).
function jumpToSearchResult(deckId, wordId) {
  const deck = App.decks.find((d) => d.id === deckId);
  if (!deck) return;
  const w = deck.words.find((x) => x._id === wordId);
  switchDeck(deckId);
  setMode("table");
  document.getElementById("tableSearch").value = w.kanji || w.cautruc || "";
  renderTable();
  document.getElementById("globalSearchResults").classList.add("hidden");
  document.getElementById("globalSearchInput").value = "";
}

function switchDeck(deckId) {
  const deck = App.decks.find((d) => d.id === deckId);
  if (!deck) return;
  localStorage.setItem(LAST_SESSION_STORAGE_KEY + "_deck", deckId);
  App.srsComboActive = false; // rời khỏi mode "học SRS gộp nhiều bộ" nếu đang ở đó
  App.srsComboDueOnly = false;
  App.currentDeckId = deckId;
  App.currentDeckType = deck.type;
  App.currentWords = deck.words;
  App.progress = SRS.loadProgress(deckId);
  document.getElementById("deckName").textContent = deck.title;

  if (App.quizTimerHandle) clearInterval(App.quizTimerHandle);
  if (App.matchTimerHandle) clearInterval(App.matchTimerHandle);

  // Đổi bộ học khác -> luôn bắt đầu lại ở trạng thái học toàn bộ (tắt chế độ chỉ ★)
  setFlashStarOnlyState(false);
  setSrsStarOnlyState(false);

  renderNav();
  buildFieldConfigPanel();
  buildColConfigPanel();
  initFlashMode();
  renderTable();
  initSrsMode();

  App.quizNeedsReset = true;
  App.matchNeedsReset = true;

  // Mặc định mở Flashcard sau khi đổi bộ
  setMode("flash");
}

// Ghi nhớ mode + deck đang xem — dùng khi reload trang thì quay lại ĐÚNG chỗ
// cũ thay vì luôn nhảy về Dashboard (xem chỗ khôi phục trong init.js).
const LAST_SESSION_STORAGE_KEY = "n2vocab_last_session";

function setMode(mode) {
  localStorage.setItem(LAST_SESSION_STORAGE_KEY + "_mode", mode);
  // Thoát focus mode khi chuyển sang chức năng khác, tránh kẹt UI vì sidebar đang ẩn
  exitFocusMode();

  // Panel "Chọn hiển thị mặt thẻ" giờ dùng CHUNG cho Flashcard + SRS (đặt ngoài
  // mọi view) -> phải tự đóng khi rời cả 2 view đó, tránh kẹt hiện lơ lửng
  // phía trên Dashboard/view khác không liên quan.
  if (mode !== "flash" && mode !== "srs") {
    document.getElementById("fieldConfigPanel").classList.remove("is-open");
  }

  // Dừng timer đề thi khi rời khỏi exam mode (nếu đang làm bài giữa lúc bật luyện tốc độ)
  if (mode !== "exam") {
    clearInterval(App.examPerQTimerHandle);
    clearInterval(App.examTotalTimerHandle);
  }

  // Tự dừng audio đang phát khi rời khỏi 2 tab luyện nghe — trước đây audio vẫn
  // chạy nền dù đã chuyển qua chức năng khác, gây khó chịu/lẫn âm thanh.
  if (mode !== "choukai") {
    const el = document.getElementById("choukaiAudioEl");
    if (el && !el.paused) el.pause();
  }
  if (mode !== "choukai-shadow") {
    const elShadow = document.getElementById("choukaiShadowAudioEl");
    if (elShadow && !elShadow.paused) elShadow.pause();
  }

  document.querySelectorAll(".nav-item").forEach((b) => {
    b.classList.toggle("active", b.dataset.mode === mode);
  });
  document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
  const view = document.getElementById(`view-${mode}`);
  if (view) view.classList.remove("hidden");

  if (mode === "dashboard") renderDashboard();
  if (mode === "table") renderTable();
  if (mode === "srs") initSrsMode();
  if (mode === "typing") initTypingMode();

  if (mode === "quiz" && (App.quizNeedsReset || !App.quizQuestions.length)) {
    initQuizMode();
    App.quizNeedsReset = false;
  }
  if (mode === "match" && (App.matchNeedsReset || App.matchTotalPairs === 0)) {
    initMatchMode();
    App.matchNeedsReset = false;
  }
  if (mode === "exam") renderExamPickerState();
  if (mode === "choukai") renderChoukaiPickerState();
  if (mode === "choukai-m4") renderChoukaiM4PickerState();
  if (mode === "choukai-shadow") renderChoukaiShadowPickerState();
  if (mode === "weakness") renderWeaknessMode();
  if (mode === "stats") renderStatsMode();
  if (mode === "examnotes") renderExamNotesMode();
  if (mode === "grammargroups") renderGrammarGroupsMode();
}

/* ===================================================================
   FIELD CONFIG PANEL (chọn field cho mặt trước / mặt sau flashcard)
=================================================================== */

