/* ===== MODULE: reading.js — "読解モード" REBUILD TOÀN DIỆN theo yêu cầu mới:
   - 2 chế độ dịch: xen kẽ từng đoạn / dịch toàn bài (cần field paragraphsVi
     song song với paragraphs trong JSON)
   - Câu hỏi hiện NGAY trong cùng trang với bài đọc (không chuyển màn riêng
     nữa) — tất cả câu hỏi hiện 1 lượt, trả lời câu nào khóa câu đó, dễ cuộn
     lên đọc lại bài khi cần dò
   - Sidebar trái: từ vựng N2 xuất hiện trong bài (từ field n2VocabList của
     CHÍNH bài đó — ĐỘC LẬP với deck), đối chiếu deck nếu trùng thì hiện thêm
     ghi chú, không trùng vẫn liệt kê bình thường, có Hán Việt
   - Sidebar phải: ngữ pháp N2/N1 xuất hiện trong bài (field grammarList)
===== */

App.dokkaiArticles = [];
App.reading = null;
App.dokkaiTranslateMode = "none"; // "none" | "interleave" | "full"

async function loadDokkaiArticles() {
  try {
    const idxRes = await fetch("dokkai-articles/index.json");
    const idx = await idxRes.json();
    const articles = [];
    for (const filename of idx.files) {
      const r = await fetch(`dokkai-articles/${filename}`);
      articles.push(await r.json());
    }
    return articles;
  } catch (e) {
    return [];
  }
}

const DOKKAI_LEVEL_COLORS = {
  N1: "#ff6b6b", N2: "#6b93ff", N3: "#48c98c", N4: "#ffd15c", N5: "#a98bff",
};

function buildDokkaiVocabIndex() {
  const list = [];
  App.decks.filter((d) => d.type === "TUVUNG" && d.level).forEach((deck) => {
    deck.words.forEach((w) => {
      const word = w.kanji;
      if (word && word.length >= 2) {
        list.push({ word, level: deck.level, reading: w.doc || "", meaning: w.nghia || "" });
      }
    });
  });
  list.sort((a, b) => b.word.length - a.word.length);
  return list;
}

function autoScanDokkaiText(text, vocabIndex) {
  let html = "";
  let i = 0;
  while (i < text.length) {
    let matched = null;
    for (const entry of vocabIndex) {
      if (text.startsWith(entry.word, i)) { matched = entry; break; }
    }
    if (matched) {
      const color = DOKKAI_LEVEL_COLORS[matched.level] || "#9aa3d0";
      html += `<span class="dokkai-auto-scan" style="--scan-color:${color}" data-word="${matched.word}" data-reading="${matched.reading}" data-meaning="${matched.meaning.replace(/"/g, "&quot;")}" data-level="${matched.level}">${matched.word}</span>`;
      i += matched.word.length;
    } else {
      html += text[i];
      i++;
    }
  }
  return html;
}

function parseDokkaiParagraph(text, vocabIndex) {
  const manualMatches = [];
  // Hỗ trợ CẢ 2 dạng cú pháp: {{chữ|đọc}} (2 phần, chỉ furigana cho kanji đơn
  // giản không cần giải nghĩa riêng) VÀ {{chữ|đọc|nghĩa}} (3 phần, glossing
  // đầy đủ). Trước đây regex CHỈ khớp đúng 3 phần, nên các chỗ tôi tự viết
  // 2 phần (rất nhiều trong các bài đã soạn) bị lộ ra thô ngoài màn hình.
  const placeholder = text.replace(/\{\{([^|}]+)\|([^|}]+)(?:\|([^}]+))?\}\}/g, (_, word, reading, meaning) => {
    const idx = manualMatches.length;
    if (meaning) {
      const safeMeaning = meaning.replace(/"/g, "&quot;");
      manualMatches.push(`<ruby class="dokkai-gloss" data-word="${word}" data-reading="${reading}" data-meaning="${safeMeaning}">${word}<rt>${reading}</rt></ruby>`);
    } else {
      // Chỉ furigana, không có nghĩa riêng -> không cần click-to-reveal,
      // chỉ hiện cách đọc phía trên như furigana thông thường.
      manualMatches.push(`<ruby class="dokkai-furigana-only">${word}<rt>${reading}</rt></ruby>`);
    }
    return `\u0000${idx}\u0000`;
  });
  const segments = placeholder.split(/(\u0000\d+\u0000)/);
  return segments.map((seg) => {
    const m = seg.match(/^\u0000(\d+)\u0000$/);
    if (m) return manualMatches[parseInt(m[1], 10)];
    return autoScanDokkaiText(seg, vocabIndex);
  }).join("");
}

// Minh họa SVG gốc theo TỪNG CHỦ ĐỀ (không phải từng bài, để hiệu quả) — tự
// vẽ tay, không lấy ảnh thật từ internet (tránh y hệt vấn đề bản quyền như
// NHK trước đó, chỉ khác là ảnh thay vì chữ). Dùng chung style tối/glow với
// game.css cho đồng bộ giao diện.
const DOKKAI_CATEGORY_ICONS = {
  "経済": `<svg viewBox="0 0 200 120"><rect width="200" height="120" fill="#0a0c1a"/><path d="M20 90 L60 60 L100 75 L140 35 L180 20" stroke="#6b93ff" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="180" cy="20" r="5" fill="#ffd15c"/><rect x="20" y="95" width="15" height="15" fill="#48c98c" opacity="0.6"/><rect x="60" y="80" width="15" height="30" fill="#48c98c" opacity="0.6"/><rect x="100" y="70" width="15" height="40" fill="#48c98c" opacity="0.6"/><rect x="140" y="55" width="15" height="55" fill="#48c98c" opacity="0.6"/></svg>`,
  "社会": `<svg viewBox="0 0 200 120"><rect width="200" height="120" fill="#0a0c1a"/><circle cx="60" cy="45" r="18" fill="#a98bff"/><rect x="42" y="66" width="36" height="40" rx="8" fill="#a98bff" opacity="0.7"/><circle cx="130" cy="50" r="14" fill="#6b93ff"/><rect x="116" y="66" width="28" height="36" rx="8" fill="#6b93ff" opacity="0.7"/><circle cx="165" cy="55" r="11" fill="#48c98c"/><rect x="154" y="68" width="22" height="30" rx="6" fill="#48c98c" opacity="0.7"/></svg>`,
  "心理学": `<svg viewBox="0 0 200 120"><rect width="200" height="120" fill="#0a0c1a"/><path d="M100 20 C60 20 40 50 45 75 C48 90 60 95 65 100 L70 110 L130 110 L135 100 C140 95 152 90 155 75 C160 50 140 20 100 20Z" fill="none" stroke="#ff6b6b" stroke-width="2.5"/><circle cx="80" cy="55" r="4" fill="#ffd15c"/><circle cx="105" cy="45" r="4" fill="#ffd15c"/><circle cx="125" cy="60" r="4" fill="#ffd15c"/><circle cx="95" cy="70" r="4" fill="#ffd15c"/><path d="M80 55 L105 45 M105 45 L125 60 M125 60 L95 70 M95 70 L80 55" stroke="#ffd15c" stroke-width="1" opacity="0.5"/></svg>`,
  "文化": `<svg viewBox="0 0 200 120"><rect width="200" height="120" fill="#0a0c1a"/><circle cx="100" cy="60" r="42" fill="none" stroke="#7de8ff" stroke-width="2"/><path d="M58 60 Q100 30 142 60 Q100 90 58 60Z" fill="none" stroke="#7de8ff" stroke-width="1.5"/><path d="M100 18 L100 102 M100 18 Q130 40 100 60 Q70 80 100 102" stroke="#7de8ff" stroke-width="1.5" fill="none"/></svg>`,
  "健康": `<svg viewBox="0 0 200 120"><rect width="200" height="120" fill="#0a0c1a"/><path d="M40 60 L70 60 L80 30 L95 90 L108 45 L118 60 L160 60" stroke="#48c98c" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/><circle cx="150" cy="35" r="16" fill="none" stroke="#ffd15c" stroke-width="2"/><path d="M150 27 L150 43 M142 35 L158 35" stroke="#ffd15c" stroke-width="2"/></svg>`,
};
function getDokkaiCategoryIcon(category) {
  return DOKKAI_CATEGORY_ICONS[category] || DOKKAI_CATEGORY_ICONS["社会"];
}

function initReadingMode() {
  App.reading = null;
  App.dokkaiCategoryFilter = App.dokkaiCategoryFilter || "all";
  document.querySelectorAll(".dokkai-phase").forEach((p) => p.classList.add("hidden"));
  document.getElementById("dokkaiPhasePicker").classList.remove("hidden");
  renderDokkaiCategoryFilter();
  renderDokkaiPicker();
}

function renderDokkaiCategoryFilter() {
  const categories = ["all", ...new Set(App.dokkaiArticles.map((a) => a.category).filter(Boolean))];
  const wrap = document.getElementById("dokkaiCategoryFilter");
  wrap.innerHTML = categories.map((c) =>
    `<button class="dokkai-category-btn${App.dokkaiCategoryFilter === c ? " is-active" : ""}" data-category="${c}">${c === "all" ? "すべて" : c}</button>`
  ).join("");
  wrap.querySelectorAll("[data-category]").forEach((btn) => {
    btn.addEventListener("click", () => {
      App.dokkaiCategoryFilter = btn.dataset.category;
      renderDokkaiCategoryFilter();
      renderDokkaiPicker();
    });
  });
}

function renderDokkaiPicker() {
  const grid = document.getElementById("dokkaiArticleGrid");
  const filter = App.dokkaiCategoryFilter || "all";
  const list = filter === "all" ? App.dokkaiArticles : App.dokkaiArticles.filter((a) => a.category === filter);
  if (!list.length) {
    grid.innerHTML = `<div class="dash-chart-empty">Chưa có bài đọc nào ở chủ đề này.</div>`;
    return;
  }
  grid.innerHTML = list.map((a) => `
    <button class="dokkai-article-card" data-article-id="${a.id}">
      <div class="dokkai-article-card-illust">${getDokkaiCategoryIcon(a.category)}</div>
      <div class="dokkai-article-card-head">
        <span class="dokkai-level-badge" style="background:${DOKKAI_LEVEL_COLORS[a.level] || "var(--accent)"}22; color:${DOKKAI_LEVEL_COLORS[a.level] || "var(--accent)"}">${a.level}</span>
        <span class="dokkai-source-badge dokkai-source-${a.source}">${a.source === "ai" ? "AI" : "Zane"}</span>
        ${a.category ? `<span class="dokkai-category-badge">${a.category}</span>` : ""}
      </div>
      <div class="dokkai-article-card-title">${a.title}</div>
      <div class="dokkai-article-card-sub">${a.titleVi || ""}</div>
    </button>
  `).join("");
  grid.querySelectorAll("[data-article-id]").forEach((btn) => {
    btn.addEventListener("click", () => startReadingArticle(btn.dataset.articleId));
  });
}

function startReadingArticle(articleId) {
  const article = App.dokkaiArticles.find((a) => a.id === articleId);
  if (!article) return;
  App.reading = { article, answers: {} }; // answers: qIndex -> {chosenIdx, correct}
  App.dokkaiTranslateMode = "none";

  document.getElementById("dokkaiPhasePicker").classList.add("hidden");
  document.getElementById("dokkaiPhaseRead").classList.remove("hidden");
  document.getElementById("dokkaiReadTitle").textContent = article.title;
  document.getElementById("dokkaiReadIllust").innerHTML = getDokkaiCategoryIcon(article.category);
  const noteEl = document.getElementById("dokkaiSourceNote");
  noteEl.textContent = article.sourceNote || "";
  noteEl.classList.toggle("hidden", !article.sourceNote);

  document.querySelectorAll(".dokkai-translate-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.translateMode === "none"));
  document.getElementById("btnDokkaiFuriganaToggle").classList.add("is-active");
  document.getElementById("dokkaiReadBody").classList.remove("dokkai-furigana-hidden");

  showLoadingOverlay(document.getElementById("dokkaiPhaseRead"), true);
  setTimeout(() => {
    const vocabIndex = buildDokkaiVocabIndex();
    renderDokkaiArticleBody(vocabIndex);
    renderDokkaiVocabSidebar(vocabIndex);
    renderDokkaiGrammarSidebar();
    renderDokkaiInlineQuiz();
    showLoadingOverlay(document.getElementById("dokkaiPhaseRead"), false);
  }, 50);
}

/* ===================================================================
   THÂN BÀI — hỗ trợ 3 chế độ dịch: nguyên văn / xen kẽ từng đoạn / dịch
   toàn bài. Cần field paragraphsVi song song với paragraphs trong JSON.
=================================================================== */
function renderDokkaiArticleBody(vocabIndex) {
  const article = App.reading.article;
  const mode = App.dokkaiTranslateMode;
  const hasVi = Array.isArray(article.paragraphsVi) && article.paragraphsVi.length === article.paragraphs.length;

  let html = "";
  if (mode === "full" && hasVi) {
    // Dịch toàn bài — hiện HẾT tiếng Nhật trước, rồi HẾT bản dịch sau
    html += article.paragraphs.map((p) => `<p class="dokkai-paragraph">${parseDokkaiParagraph(p, vocabIndex)}</p>`).join("");
    html += `<div class="dokkai-full-translation-divider">📖 Bản dịch toàn bài</div>`;
    html += article.paragraphsVi.map((p) => `<p class="dokkai-paragraph dokkai-paragraph-vi">${p}</p>`).join("");
  } else if (mode === "interleave" && hasVi) {
    // Xen kẽ từng đoạn — JP đoạn 1, VI đoạn 1, JP đoạn 2, VI đoạn 2...
    article.paragraphs.forEach((p, i) => {
      html += `<p class="dokkai-paragraph">${parseDokkaiParagraph(p, vocabIndex)}</p>`;
      html += `<p class="dokkai-paragraph dokkai-paragraph-vi">${article.paragraphsVi[i]}</p>`;
    });
  } else {
    html = article.paragraphs.map((p) => `<p class="dokkai-paragraph">${parseDokkaiParagraph(p, vocabIndex)}</p>`).join("");
  }

  document.getElementById("dokkaiReadBody").innerHTML = html;
  document.getElementById("dokkaiReadBody").querySelectorAll(".dokkai-gloss, .dokkai-auto-scan").forEach((el) => {
    el.addEventListener("click", (e) => showDokkaiGlossPopover(e, el));
  });
  // Hiện lại các ghi chú đã lưu (tái dùng nguyên hệ thống ghi chú của đề thi/
  // luyện nghe — kind="reading", qKey cố định "body").
  applyReadingNoteHighlights(document.getElementById("dokkaiReadBody"), article.id);
}

function setDokkaiTranslateMode(mode) {
  App.dokkaiTranslateMode = mode;
  document.querySelectorAll(".dokkai-translate-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.translateMode === mode));
  renderDokkaiArticleBody(buildDokkaiVocabIndex());
}

// Bật/tắt furigana toàn bài — chỉ ẩn/hiện <rt> qua CSS, không render lại
// (giữ nguyên trạng thái ghi chú/glossing đang có, không mất gì).
function toggleDokkaiFurigana() {
  const btn = document.getElementById("btnDokkaiFuriganaToggle");
  const isOn = !btn.classList.contains("is-active");
  btn.classList.toggle("is-active", isOn);
  document.getElementById("dokkaiReadBody").classList.toggle("dokkai-furigana-hidden", !isOn);
}

function showDokkaiGlossPopover(e, el) {
  e.stopPropagation();
  document.querySelectorAll(".dokkai-gloss-popover").forEach((p) => p.remove());
  const pop = document.createElement("div");
  pop.className = "dokkai-gloss-popover";
  pop.innerHTML = `<b>${el.dataset.reading}</b><span>${el.dataset.meaning}</span>`;
  document.body.appendChild(pop);
  const rect = el.getBoundingClientRect();
  pop.style.left = Math.min(rect.left, window.innerWidth - pop.offsetWidth - 12) + "px";
  pop.style.top = rect.bottom + 6 + "px";
  setTimeout(() => {
    document.addEventListener("click", function closeOnce() {
      pop.remove();
      document.removeEventListener("click", closeOnce);
    }, { once: true });
  }, 0);
}

/* ===================================================================
   SIDEBAR TRÁI — từ vựng N2 của CHÍNH bài đọc (article.n2VocabList),
   ĐỘC LẬP với deck. Đối chiếu deck TUVUNG đã load theo kanji — trùng thì
   hiện thêm ghi chú "đã có trong bộ...", không trùng vẫn liệt kê bình
   thường (không bỏ sót từ nào).
=================================================================== */
function renderDokkaiVocabSidebar(vocabIndex) {
  const article = App.reading.article;
  const list = article.n2VocabList || [];
  const wrap = document.getElementById("dokkaiVocabList");
  if (!list.length) {
    wrap.innerHTML = `<div class="dokkai-sidebar-empty">Chưa có danh sách từ vựng cho bài này.</div>`;
    return;
  }
  wrap.innerHTML = list.map((v) => {
    const deckMatch = vocabIndex.find((e) => e.word === v.kanji);
    return `
      <div class="dokkai-vocab-item">
        <div class="dokkai-vocab-item-head">
          <span class="dokkai-vocab-kanji">${v.kanji}</span>
          <span class="dokkai-vocab-reading">${v.reading}</span>
        </div>
        <div class="dokkai-vocab-hanviet">${v.hanviet || ""}</div>
        <div class="dokkai-vocab-meaning">${v.meaning}</div>
        ${deckMatch ? `<div class="dokkai-vocab-deck-match">✓ đã có trong bộ ${deckMatch.level}</div>` : ""}
      </div>`;
  }).join("");
}

/* ===================================================================
   SIDEBAR PHẢI — ngữ pháp N2/N1 của CHÍNH bài đọc (article.grammarList).
=================================================================== */
function renderDokkaiGrammarSidebar() {
  const article = App.reading.article;
  const list = article.grammarList || [];
  const wrap = document.getElementById("dokkaiGrammarList");
  if (!list.length) {
    wrap.innerHTML = `<div class="dokkai-sidebar-empty">Chưa có danh sách ngữ pháp cho bài này.</div>`;
    return;
  }
  wrap.innerHTML = list.map((g) => `
    <div class="dokkai-grammar-item">
      <div class="dokkai-grammar-pattern">${g.pattern}</div>
      <div class="dokkai-grammar-meaning">${g.meaning}</div>
    </div>
  `).join("");
}

/* ===================================================================
   QUIZ INLINE — TẤT CẢ câu hỏi hiện 1 lượt ngay dưới bài đọc (không chuyển
   màn riêng nữa), trả lời câu nào khóa câu đó, dễ cuộn lên dò lại bài.
=================================================================== */
function renderDokkaiInlineQuiz() {
  const article = App.reading.article;
  const wrap = document.getElementById("dokkaiInlineQuiz");
  wrap.innerHTML = `
    <div class="dokkai-quiz-divider">📝 問題（${article.questions.length}問）</div>
    ${article.questions.map((q, qi) => `
      <div class="dokkai-quiz-block" data-qi="${qi}">
        <div class="dokkai-quiz-block-head">
          <span class="dokkai-quiz-block-num">問${qi + 1}</span>
          <span class="dokkai-quiz-difficulty">${"★".repeat(q.difficulty)}${"☆".repeat(5 - q.difficulty)}</span>
        </div>
        <div class="dokkai-quiz-question">${q.q}</div>
        <div class="dokkai-quiz-options" data-qi="${qi}">
          ${q.options.map((opt, oi) => `<button class="dokkai-quiz-opt" data-qi="${qi}" data-oi="${oi}">${opt}</button>`).join("")}
        </div>
      </div>
    `).join("")}
    <button class="game-start-btn dokkai-submit-btn" id="btnDokkaiSubmitQuiz">結果を見る →</button>
  `;
  wrap.querySelectorAll(".dokkai-quiz-opt").forEach((btn) => {
    btn.addEventListener("click", () => handleDokkaiInlineAnswer(btn));
  });
  document.getElementById("btnDokkaiSubmitQuiz").addEventListener("click", finishDokkaiQuiz);
}

function handleDokkaiInlineAnswer(btn) {
  const qi = parseInt(btn.dataset.qi, 10);
  if (App.reading.answers[qi] !== undefined) return; // đã trả lời câu này rồi, khóa lại
  const oi = parseInt(btn.dataset.oi, 10);
  const q = App.reading.article.questions[qi];
  const isCorrect = oi === q.answer;
  App.reading.answers[qi] = { chosenIdx: oi, correct: isCorrect };

  const group = document.querySelector(`.dokkai-quiz-options[data-qi="${qi}"]`);
  group.querySelectorAll(".dokkai-quiz-opt").forEach((b, i) => {
    b.classList.add("disabled");
    if (i === q.answer) b.classList.add("correct");
    else if (i === oi) b.classList.add("wrong");
  });
}

function finishDokkaiQuiz() {
  const article = App.reading.article;
  const answered = Object.keys(App.reading.answers).length;
  if (answered < article.questions.length) {
    const ok = confirm(`まだ${article.questions.length - answered}問未回答です。結果を見ますか？`);
    if (!ok) return;
  }
  const score = Object.values(App.reading.answers).filter((a) => a.correct).length;
  document.getElementById("dokkaiPhaseRead").classList.add("hidden");
  document.getElementById("dokkaiPhaseResult").classList.remove("hidden");
  document.getElementById("dokkaiResultStats").innerHTML = `
    <div class="lg-result-score">${score} / ${article.questions.length}</div>
    <div class="lg-result-pct">${Math.round((score / article.questions.length) * 100)}%</div>
  `;
}

function backToDokkaiPicker() {
  App.reading = null;
  initReadingMode();
}
