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
  const placeholder = text.replace(/\{\{([^|}]+)\|([^|}]+)\|([^}]+)\}\}/g, (_, word, reading, meaning) => {
    const safeMeaning = meaning.replace(/"/g, "&quot;");
    const idx = manualMatches.length;
    manualMatches.push(`<ruby class="dokkai-gloss" data-word="${word}" data-reading="${reading}" data-meaning="${safeMeaning}">${word}<rt>${reading}</rt></ruby>`);
    return `\u0000${idx}\u0000`;
  });
  const segments = placeholder.split(/(\u0000\d+\u0000)/);
  return segments.map((seg) => {
    const m = seg.match(/^\u0000(\d+)\u0000$/);
    if (m) return manualMatches[parseInt(m[1], 10)];
    return autoScanDokkaiText(seg, vocabIndex);
  }).join("");
}

function initReadingMode() {
  App.reading = null;
  document.querySelectorAll(".dokkai-phase").forEach((p) => p.classList.add("hidden"));
  document.getElementById("dokkaiPhasePicker").classList.remove("hidden");
  renderDokkaiPicker();
}

function renderDokkaiPicker() {
  const grid = document.getElementById("dokkaiArticleGrid");
  if (!App.dokkaiArticles.length) {
    grid.innerHTML = `<div class="dash-chart-empty">Chưa có bài đọc nào — thêm file JSON vào dokkai-articles/.</div>`;
    return;
  }
  grid.innerHTML = App.dokkaiArticles.map((a) => `
    <button class="dokkai-article-card" data-article-id="${a.id}">
      <div class="dokkai-article-card-head">
        <span class="dokkai-level-badge" style="background:${DOKKAI_LEVEL_COLORS[a.level] || "var(--accent)"}22; color:${DOKKAI_LEVEL_COLORS[a.level] || "var(--accent)"}">${a.level}</span>
        <span class="dokkai-source-badge dokkai-source-${a.source}">${a.source === "ai" ? "AI" : "Zane"}</span>
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
  const noteEl = document.getElementById("dokkaiSourceNote");
  noteEl.textContent = article.sourceNote || "";
  noteEl.classList.toggle("hidden", !article.sourceNote);

  document.querySelectorAll(".dokkai-translate-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.translateMode === "none"));

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
}

function setDokkaiTranslateMode(mode) {
  App.dokkaiTranslateMode = mode;
  document.querySelectorAll(".dokkai-translate-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.translateMode === mode));
  renderDokkaiArticleBody(buildDokkaiVocabIndex());
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
