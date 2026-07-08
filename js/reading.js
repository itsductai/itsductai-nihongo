/* ===== MODULE: reading.js — "読解モード" (Đọc hiểu kiểu Todaii).
   Bài đọc có từ vựng glossing (chạm/click hiện nghĩa), đọc xong làm 3-5 câu
   hỏi trắc nghiệm từ dễ tới khó. Nguồn bài: "ai" (tôi tự viết, KHÔNG phải tin
   thật — tránh vi phạm bản quyền báo chí) hoặc "user" (Zane tự cung cấp).
   Cú pháp soạn bài: {{漢字|かんじ|nghĩa}} trong text -> tự động thành
   <ruby> có furigana + click hiện nghĩa, không cần đánh index thủ công.
===== */

App.dokkaiArticles = [];
App.reading = null;

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

// Màu gạch chân theo TRÌNH ĐỘ deck (N2=xanh dương hiện tại, các trình độ khác
// định sẵn màu để khi thêm deck N1/N3/N4/N5 sau này tự động có màu riêng,
// KHÔNG cần sửa code gì thêm — chỉ cần deck JSON có field "level" đúng.
const DOKKAI_LEVEL_COLORS = {
  N1: "#ff6b6b", N2: "#6b93ff", N3: "#48c98c", N4: "#ffd15c", N5: "#a98bff",
};

// Xây "kho từ vựng" 1 lần từ TẤT CẢ deck TUVUNG đang load (kanji + trình độ +
// đọc + nghĩa) — sắp XẾP DÀI TRƯỚC (longest-match-first) để khi quét văn bản,
// từ ghép dài (vd 在宅勤務) được ưu tiên khớp trước, tránh bị vỡ vụn thành
// từng mảnh ngắn hơn (vd chỉ khớp 在宅 rồi bỏ sót 勤務).
function buildDokkaiVocabIndex() {
  const list = [];
  App.decks.filter((d) => d.type === "TUVUNG" && d.level).forEach((deck) => {
    deck.words.forEach((w) => {
      const word = w.kanji;
      if (word && word.length >= 2) { // bỏ qua từ 1 ký tự (quá phổ biến, dễ gạch nhầm lung tung)
        list.push({ word, level: deck.level, reading: w.doc || "", meaning: w.nghia || "" });
      }
    });
  });
  list.sort((a, b) => b.word.length - a.word.length);
  return list;
}

// Quét 1 đoạn text PHẲNG (không HTML) theo kho từ vựng, bọc từ khớp được vào
// span gạch chân màu theo trình độ. Trả về HTML string.
function autoScanDokkaiText(text, vocabIndex) {
  let html = "";
  let i = 0;
  while (i < text.length) {
    let matched = null;
    for (const entry of vocabIndex) {
      if (text.startsWith(entry.word, i)) { matched = entry; break; } // vocabIndex đã sort dài trước -> match đầu tiên luôn là dài nhất có thể
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

// Ghép cả 2 lớp: (1) glossing THỦ CÔNG {{word|reading|meaning}} soạn tay —
// giữ nguyên, KHÔNG bị auto-scan quét đè lên (tách ra bằng placeholder trước);
// (2) auto-scan TỰ ĐỘNG theo kho từ vựng cho phần text CÒN LẠI. 2 lớp không
// chồng lên nhau, không mất/nhân đôi glossing thủ công đã soạn.
function parseDokkaiParagraph(text, vocabIndex) {
  const manualMatches = [];
  const placeholder = text.replace(/\{\{([^|}]+)\|([^|}]+)\|([^}]+)\}\}/g, (_, word, reading, meaning) => {
    const safeMeaning = meaning.replace(/"/g, "&quot;");
    const idx = manualMatches.length;
    manualMatches.push(`<ruby class="dokkai-gloss" data-word="${word}" data-reading="${reading}" data-meaning="${safeMeaning}">${word}<rt>${reading}</rt></ruby>`);
    return `\u0000${idx}\u0000`; // ký tự điều khiển làm placeholder tạm, không trùng với text thật
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
        <span class="dokkai-level-badge">${a.level}</span>
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
  App.reading = { article, quizIndex: 0, score: 0, answered: false };

  document.getElementById("dokkaiPhasePicker").classList.add("hidden");
  document.getElementById("dokkaiPhaseRead").classList.remove("hidden");
  document.getElementById("dokkaiReadTitle").textContent = article.title;
  const noteEl = document.getElementById("dokkaiSourceNote");
  noteEl.textContent = article.sourceNote || "";
  noteEl.classList.toggle("hidden", !article.sourceNote);

  showLoadingOverlay(document.getElementById("dokkaiPhaseRead"), true);
  setTimeout(() => {
    const vocabIndex = buildDokkaiVocabIndex();
    document.getElementById("dokkaiReadBody").innerHTML = article.paragraphs
      .map((p) => `<p class="dokkai-paragraph">${parseDokkaiParagraph(p, vocabIndex)}</p>`)
      .join("");

    const body = document.getElementById("dokkaiReadBody");
    body.querySelectorAll(".dokkai-gloss, .dokkai-auto-scan").forEach((el) => {
      el.addEventListener("click", (e) => showDokkaiGlossPopover(e, el));
    });
    showLoadingOverlay(document.getElementById("dokkaiPhaseRead"), false);
  }, 50); // tách khỏi luồng chính 1 nhịp để hiệu ứng loading kịp render trước khi quét (quét đồng bộ có thể block UI 1 nhịp ngắn)
}

// Popover nhỏ hiện đúng vị trí chữ vừa chạm — reading + nghĩa, bấm chỗ khác
// để đóng lại (giống hành vi Todaii thật).
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

function goToDokkaiQuiz() {
  document.getElementById("dokkaiPhaseRead").classList.add("hidden");
  document.getElementById("dokkaiPhaseQuiz").classList.remove("hidden");
  const total = App.reading.article.questions.length;
  document.getElementById("dokkaiQuizTotal").textContent = total;
  renderDokkaiQuizQuestion();
}

function renderDokkaiQuizQuestion() {
  const r = App.reading;
  r.answered = false;
  const q = r.article.questions[r.quizIndex];
  document.getElementById("dokkaiQuizPos").textContent = r.quizIndex + 1;
  document.getElementById("dokkaiQuizDifficulty").textContent = "★".repeat(q.difficulty) + "☆".repeat(5 - q.difficulty);
  document.getElementById("dokkaiQuizQuestion").textContent = q.q;

  const optsDiv = document.getElementById("dokkaiQuizOptions");
  optsDiv.innerHTML = "";
  q.options.forEach((opt, i) => {
    const btn = document.createElement("button");
    btn.className = "dokkai-quiz-opt";
    btn.textContent = opt;
    btn.addEventListener("click", () => handleDokkaiQuizAnswer(btn, i, q));
    optsDiv.appendChild(btn);
  });
}

function handleDokkaiQuizAnswer(btn, chosenIdx, q) {
  const r = App.reading;
  if (r.answered) return;
  r.answered = true;
  const isCorrect = chosenIdx === q.answer;
  if (isCorrect) r.score++;

  document.querySelectorAll(".dokkai-quiz-opt").forEach((b, i) => {
    b.classList.add("disabled");
    if (i === q.answer) b.classList.add("correct");
    else if (b === btn) b.classList.add("wrong");
  });

  setTimeout(() => {
    r.quizIndex++;
    if (r.quizIndex >= r.article.questions.length) {
      finishDokkaiQuiz();
    } else {
      renderDokkaiQuizQuestion();
    }
  }, 900);
}

function finishDokkaiQuiz() {
  document.getElementById("dokkaiPhaseQuiz").classList.add("hidden");
  document.getElementById("dokkaiPhaseResult").classList.remove("hidden");
  const r = App.reading;
  const total = r.article.questions.length;
  document.getElementById("dokkaiResultStats").innerHTML = `
    <div class="lg-result-score">${r.score} / ${total}</div>
    <div class="lg-result-pct">${Math.round((r.score / total) * 100)}%</div>
  `;
}

function backToDokkaiPicker() {
  App.reading = null;
  initReadingMode();
}
