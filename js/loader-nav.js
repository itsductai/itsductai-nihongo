/* ===== MODULE: loader-nav.js — Load decks/exams từ JSON, populate dropdown, render sidebar nav, switchDeck/setMode ===== */

/* ---------- Loading decks & exams ---------- */

async function loadDecks() {
  const res = await fetch("tailieu/index.json");
  const idx = await res.json();
  const decks = [];
  for (const filename of idx.files) {
    try {
      const r = await fetch(`tailieu/${filename}`);
      const data = await r.json();
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

function renderNav() {
  const nav = document.getElementById("navList");
  nav.innerHTML = "";

  const label = document.createElement("div");
  label.className = "nav-section-label";
  label.textContent = App.currentDeckType === "NGUPHAP" ? "Học ngữ pháp" : "Học từ vựng";
  nav.appendChild(label);

  const items = NAV_ITEMS_BY_TYPE[App.currentDeckType] || NAV_ITEMS_BY_TYPE.TUVUNG;
  items.forEach((item) => {
    const btn = document.createElement("button");
    btn.className = "nav-item";
    btn.dataset.mode = item.mode;
    btn.innerHTML = `<span class="nav-icon">${item.icon}</span> <span>${item.label}</span>`;
    btn.addEventListener("click", () => setMode(item.mode));
    nav.appendChild(btn);
  });

  if (App.exams.length > 0) {
    const examLabel = document.createElement("div");
    examLabel.className = "nav-section-label";
    examLabel.textContent = "Đề thi thật";
    nav.appendChild(examLabel);

    const examBtn = document.createElement("button");
    examBtn.className = "nav-item";
    examBtn.dataset.mode = "exam";
    examBtn.innerHTML = `<span class="nav-icon">▤</span> <span>Làm đề thi</span>`;
    examBtn.addEventListener("click", () => setMode("exam"));
    nav.appendChild(examBtn);

    const examNotesBtn = document.createElement("button");
    examNotesBtn.className = "nav-item";
    examNotesBtn.dataset.mode = "examnotes";
    examNotesBtn.innerHTML = `<span class="nav-icon">📝</span> <span>Ghi chú đề thi</span>`;
    examNotesBtn.addEventListener("click", () => setMode("examnotes"));
    nav.appendChild(examNotesBtn);
  }

  if (App.choukaiTests.length > 0) {
    const choukaiLabel = document.createElement("div");
    choukaiLabel.className = "nav-section-label";
    choukaiLabel.textContent = "Luyện nghe (聴解)";
    nav.appendChild(choukaiLabel);

    const choukaiBtn = document.createElement("button");
    choukaiBtn.className = "nav-item";
    choukaiBtn.dataset.mode = "choukai";
    choukaiBtn.innerHTML = `<span class="nav-icon">🎧</span> <span>Luyện nghe theo đề</span>`;
    choukaiBtn.addEventListener("click", () => setMode("choukai"));
    nav.appendChild(choukaiBtn);

    const shadowBtn = document.createElement("button");
    shadowBtn.className = "nav-item";
    shadowBtn.dataset.mode = "choukai-shadow";
    shadowBtn.innerHTML = `<span class="nav-icon">🔁</span> <span>Luyện nghe câu</span>`;
    shadowBtn.addEventListener("click", () => setMode("choukai-shadow"));
    nav.appendChild(shadowBtn);
  }

  if (App.grammarGroupsData) {
    const ggLabel = document.createElement("div");
    ggLabel.className = "nav-section-label";
    ggLabel.textContent = "Học thông minh";
    nav.appendChild(ggLabel);

    const ggBtn = document.createElement("button");
    ggBtn.className = "nav-item";
    ggBtn.dataset.mode = "grammargroups";
    ggBtn.innerHTML = `<span class="nav-icon">📚</span> <span>Nhóm ngữ pháp</span>`;
    ggBtn.addEventListener("click", () => setMode("grammargroups"));
    nav.appendChild(ggBtn);
  }

  // Re-apply active state for current mode if any nav-item matches
  const current = document.querySelector(".view:not(.hidden)");
  if (current) {
    const mode = current.id.replace("view-", "");
    document.querySelectorAll(".nav-item").forEach((b) => b.classList.toggle("active", b.dataset.mode === mode));
  }
}

function switchDeck(deckId) {
  const deck = App.decks.find((d) => d.id === deckId);
  if (!deck) return;
  App.currentDeckId = deckId;
  App.currentDeckType = deck.type;
  App.currentWords = deck.words;
  App.progress = SRS.loadProgress(deckId);
  document.getElementById("deckName").textContent = deck.title;
  document.getElementById("mobileTopbarTitle").textContent = deck.title;

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

function setMode(mode) {
  // Thoát focus mode khi chuyển sang chức năng khác, tránh kẹt UI vì sidebar đang ẩn
  exitFocusMode();

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
  if (mode === "choukai-shadow") renderChoukaiShadowPickerState();
  if (mode === "weakness") renderWeaknessMode();
  if (mode === "stats") renderStatsMode();
  if (mode === "examnotes") renderExamNotesMode();
  if (mode === "grammargroups") renderGrammarGroupsMode();
}

/* ===================================================================
   FIELD CONFIG PANEL (chọn field cho mặt trước / mặt sau flashcard)
=================================================================== */

