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
    const results = await Promise.all(idx.files.map(async (filename) => {
      const r = await fetch(`dokkai-articles/${filename}`);
      return r.json();
    }));
    // FIX: trước đây loader này CHƯA lọc "private" như loadDecks()/loadExams()/
    // loadChoukaiTests() đã làm — bài đọc riêng tư sẽ hiện công khai dù chưa
    // mở khóa key. Thêm đúng cùng quy tắc filter với các loader khác.
    return results.filter((a) => !(a.private === true && !isPrivateContentUnlocked()));
  } catch (e) {
    return [];
  }
}

const DOKKAI_LEVEL_COLORS = {
  N1: "#ff6b6b", N2: "#6b93ff", N3: "#48c98c", N4: "#ffd15c", N5: "#a98bff",
};

// BLOCKLIST — các động từ phụ trợ (auxiliary) mà deck có thể lưu dưới dạng
// vocab với nghĩa TỪ ĐIỂN GỐC (vd しまう = "cất, giữ"), nhưng khi đứng sau
// dạng て của động từ khác thì lại là NGỮ PHÁP hoàn toàn khác (〜てしまう =
// lỡ làm/hối tiếc, KHÔNG liên quan gì "cất giữ"). Auto-scan không phân biệt
// được ngữ cảnh (đứng riêng vs làm trợ động từ), nên loại hẳn các từ này khỏi
// kho auto-scan để tránh gán nhầm nghĩa từ vựng vào chỗ đang là ngữ pháp —
// đây chính xác là bug đã xảy ra thật với "しまう" trong bài viết.
const DOKKAI_AUXILIARY_BLOCKLIST = new Set(["しまう", "おく", "いく", "くる", "みる", "あげる", "もらう", "くれる", "いる", "ある", "する", "なる"]);

function buildDokkaiVocabIndex() {
  const list = [];
  App.decks.filter((d) => d.type === "TUVUNG" && d.level).forEach((deck) => {
    deck.words.forEach((w) => {
      const word = w.kanji;
      if (word && word.length >= 2 && !DOKKAI_AUXILIARY_BLOCKLIST.has(word)) {
        list.push({ word, level: deck.level, deckTitle: deck.title, series: deck.series || "khac", reading: w.doc || "", meaning: w.nghia || "" });
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
// Minh họa RIÊNG CHO TỪNG BÀI (không dùng chung theo chủ đề nữa — dễ nhận
// diện hơn khi nhìn lướt qua danh sách). Vẫn giữ tông màu theo category để
// nhất quán, nhưng mỗi bài có hình khác nhau gắn với nội dung cụ thể.
const DOKKAI_ARTICLE_ICONS = {
  "reading-01": `<svg viewBox="0 0 200 120"><rect width="200" height="120" fill="#0a0c1a"/><rect x="60" y="50" width="80" height="55" fill="none" stroke="#a98bff" stroke-width="2.5"/><path d="M50 55 L100 25 L150 55" stroke="#a98bff" stroke-width="2.5" fill="none"/><rect x="90" y="75" width="20" height="30" fill="#a98bff" opacity="0.5"/><circle cx="130" cy="35" r="10" fill="#48c98c" opacity="0.7"/></svg>`,
  "reading-02": `<svg viewBox="0 0 200 120"><rect width="200" height="120" fill="#0a0c1a"/><path d="M100 25 L100 95 M70 40 L130 40 M70 55 L130 55" stroke="#6b93ff" stroke-width="2"/><circle cx="100" cy="60" r="35" fill="none" stroke="#6b93ff" stroke-width="2.5"/><path d="M85 60 L95 70 L118 45" stroke="#ffd15c" stroke-width="3" fill="none" stroke-linecap="round"/></svg>`,
  "reading-03": `<svg viewBox="0 0 200 120"><rect width="200" height="120" fill="#0a0c1a"/><text x="100" y="70" font-size="40" fill="#6b93ff" text-anchor="middle" font-weight="bold">¥</text><path d="M40 90 L60 60 L90 80 L160 30" stroke="#ff6b6b" stroke-width="2.5" fill="none"/><path d="M150 30 L160 30 L160 40" stroke="#ff6b6b" stroke-width="2.5" fill="none"/></svg>`,
  "reading-04": `<svg viewBox="0 0 200 120"><rect width="200" height="120" fill="#0a0c1a"/><circle cx="80" cy="55" r="20" fill="none" stroke="#48c98c" stroke-width="2.5"/><rect x="65" y="75" width="30" height="30" rx="6" fill="#48c98c" opacity="0.5"/><rect x="115" y="40" width="45" height="60" rx="8" fill="none" stroke="#ffd15c" stroke-width="2"/><circle cx="137" cy="55" r="6" fill="#ffd15c"/><path d="M125 75 L150 75 M125 85 L150 85" stroke="#ffd15c" stroke-width="1.5"/></svg>`,
  "reading-05": `<svg viewBox="0 0 200 120"><rect width="200" height="120" fill="#0a0c1a"/><path d="M100 20 C60 20 40 50 45 75 C48 90 60 95 65 100 L70 110 L130 110 L135 100 C140 95 152 90 155 75 C160 50 140 20 100 20Z" fill="none" stroke="#ff6b6b" stroke-width="2.5"/><circle cx="80" cy="55" r="4" fill="#ffd15c"/><circle cx="105" cy="45" r="4" fill="#ffd15c"/><circle cx="125" cy="60" r="4" fill="#ffd15c"/></svg>`,
  "reading-06": `<svg viewBox="0 0 200 120"><rect width="200" height="120" fill="#0a0c1a"/><circle cx="100" cy="60" r="40" fill="none" stroke="#7de8ff" stroke-width="2"/><path d="M60 60 Q100 35 140 60 Q100 85 60 60Z" fill="none" stroke="#7de8ff" stroke-width="1.5"/><circle cx="100" cy="60" r="6" fill="#7de8ff"/></svg>`,
  "reading-07": `<svg viewBox="0 0 200 120"><rect width="200" height="120" fill="#0a0c1a"/><rect x="55" y="45" width="35" height="45" rx="4" fill="none" stroke="#48c98c" stroke-width="2"/><rect x="100" y="55" width="45" height="35" rx="4" fill="none" stroke="#ffd15c" stroke-width="2"/><path d="M65 55 L80 55 M65 65 L80 65 M65 75 L80 75" stroke="#48c98c" stroke-width="1.5"/></svg>`,
  "reading-08": `<svg viewBox="0 0 200 120"><rect width="200" height="120" fill="#0a0c1a"/><ellipse cx="100" cy="70" rx="55" ry="18" fill="none" stroke="#ff9f6b" stroke-width="2.5"/><circle cx="80" cy="70" r="8" fill="#ff9f6b" opacity="0.6"/><circle cx="105" cy="65" r="6" fill="#48c98c" opacity="0.6"/><circle cx="125" cy="72" r="7" fill="#ffd15c" opacity="0.6"/></svg>`,
  "reading-09": `<svg viewBox="0 0 200 120"><rect width="200" height="120" fill="#0a0c1a"/><path d="M70 40 L130 40 L140 100 L60 100Z" fill="none" stroke="#6b93ff" stroke-width="2.5"/><path d="M80 40 C80 25 120 25 120 40" stroke="#6b93ff" stroke-width="2" fill="none"/><circle cx="100" cy="70" r="4" fill="#ffd15c"/></svg>`,
  "reading-10": `<svg viewBox="0 0 200 120"><rect width="200" height="120" fill="#0a0c1a"/><circle cx="100" cy="60" r="38" fill="none" stroke="#a98bff" stroke-width="2.5"/><path d="M100 40 L100 60 L118 70" stroke="#a98bff" stroke-width="3" fill="none" stroke-linecap="round"/><circle cx="100" cy="60" r="3" fill="#a98bff"/></svg>`,
  "reading-11": `<svg viewBox="0 0 200 120"><rect width="200" height="120" fill="#0a0c1a"/><path d="M100 25 L112 55 L145 55 L118 75 L128 108 L100 88 L72 108 L82 75 L55 55 L88 55Z" fill="none" stroke="#ffd15c" stroke-width="2.5"/></svg>`,
  "reading-12": `<svg viewBox="0 0 200 120"><rect width="200" height="120" fill="#0a0c1a"/><circle cx="70" cy="60" r="22" fill="none" stroke="#48c98c" stroke-width="2"/><circle cx="130" cy="60" r="22" fill="none" stroke="#ff6b6b" stroke-width="2" opacity="0.6"/><circle cx="100" cy="60" r="10" fill="#a98bff" opacity="0.4"/></svg>`,
  "reading-13": `<svg viewBox="0 0 200 120"><rect width="200" height="120" fill="#0a0c1a"/><path d="M60 75 Q55 55 75 52 Q78 35 100 38 Q118 35 122 52 Q145 52 143 75Z" fill="none" stroke="#6b93ff" stroke-width="2.5"/><path d="M90 85 L90 95 M100 85 L100 100 M110 85 L110 95" stroke="#6b93ff" stroke-width="2"/></svg>`,
  "reading-14": `<svg viewBox="0 0 200 120"><rect width="200" height="120" fill="#0a0c1a"/><circle cx="100" cy="55" r="25" fill="none" stroke="#ff9f6b" stroke-width="2.5"/><path d="M90 52 L96 58 L112 42" stroke="#ffd15c" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M75 95 Q100 80 125 95" stroke="#ff9f6b" stroke-width="2" fill="none"/></svg>`,
  "reading-15": `<svg viewBox="0 0 200 120"><rect width="200" height="120" fill="#0a0c1a"/><path d="M60 50 A40 40 0 1 1 59 51" fill="none" stroke="#48c98c" stroke-width="2.5"/><path d="M55 45 L60 50 L68 40" stroke="#48c98c" stroke-width="2" fill="none"/></svg>`,
  "reading-16": `<svg viewBox="0 0 200 120"><rect width="200" height="120" fill="#0a0c1a"/><circle cx="75" cy="55" r="18" fill="none" stroke="#ff6b6b" stroke-width="2"/><circle cx="105" cy="55" r="18" fill="none" stroke="#6b93ff" stroke-width="2"/><circle cx="90" cy="80" r="18" fill="none" stroke="#48c98c" stroke-width="2"/></svg>`,
  "reading-17": `<svg viewBox="0 0 200 120"><rect width="200" height="120" fill="#0a0c1a"/><path d="M100 105 L100 60" stroke="#8b6b4a" stroke-width="6"/><path d="M100 75 L70 45 M100 65 L130 40" stroke="#48c98c" stroke-width="3" fill="none"/><circle cx="68" cy="42" r="6" fill="#ffd15c"/><circle cx="132" cy="37" r="6" fill="#ff9f6b"/><ellipse cx="100" cy="105" rx="30" ry="6" fill="#6b93ff" opacity="0.3"/></svg>`,
};
function getDokkaiCategoryIcon(category, articleId) {
  if (articleId && DOKKAI_ARTICLE_ICONS[articleId]) return DOKKAI_ARTICLE_ICONS[articleId];
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

const DOKKAI_HISTORY_KEY = "n2vocab_reading_history";
function loadDokkaiHistory() {
  try { return JSON.parse(localStorage.getItem(DOKKAI_HISTORY_KEY)) || {}; } catch (e) { return {}; }
}
function markDokkaiArticleRead(articleId) {
  const hist = loadDokkaiHistory();
  hist[articleId] = { readAt: Date.now() };
  localStorage.setItem(DOKKAI_HISTORY_KEY, JSON.stringify(hist));
}

function renderDokkaiPicker() {
  const grid = document.getElementById("dokkaiArticleGrid");
  const filter = App.dokkaiCategoryFilter || "all";
  let list = filter === "all" ? App.dokkaiArticles : App.dokkaiArticles.filter((a) => a.category === filter);
  // Sắp CŨ NHẤT -> MỚI NHẤT theo field date (yêu cầu rõ ràng).
  // Sắp MỚI NHẤT -> CŨ NHẤT (đảo lại theo đúng yêu cầu mới nhất).
  list = list.slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  if (!list.length) {
    grid.innerHTML = `<div class="dash-chart-empty">Chưa có bài đọc nào ở chủ đề này.</div>`;
    return;
  }
  const history = loadDokkaiHistory();
  const unread = list.filter((a) => !history[a.id]);
  const read = list.filter((a) => history[a.id]);

  function cardHtml(a) {
    const isRead = !!history[a.id];
    const daysSince = a.date ? (Date.now() - new Date(a.date).getTime()) / 86400000 : 999;
    const isNew = daysSince <= 7;
    return `
      <button class="dokkai-article-card${isRead ? " is-read" : ""}" data-article-id="${a.id}">
        ${isNew ? `<span class="dokkai-new-badge">NEW</span>` : ""}
        <div class="dokkai-article-card-illust">${getDokkaiCategoryIcon(a.category, a.id)}</div>
        <div class="dokkai-article-card-head">
          <span class="dokkai-level-badge" style="background:${DOKKAI_LEVEL_COLORS[a.level] || "var(--accent)"}22; color:${DOKKAI_LEVEL_COLORS[a.level] || "var(--accent)"}">${a.level}</span>
          <span class="dokkai-source-badge dokkai-source-${a.source}">${a.source === "ai" ? "AI" : "Zane"}</span>
          ${a.category ? `<span class="dokkai-category-badge">${a.category}</span>` : ""}
        </div>
        <div class="dokkai-article-card-title">${a.title}</div>
        <div class="dokkai-article-card-sub">${a.titleVi || ""}</div>
        <div class="dokkai-article-card-date">${a.date || ""}</div>
        ${isRead ? `<div class="dokkai-read-badge">✓ Đã đọc lúc ${new Date(history[a.id].readAt).toLocaleString("vi-VN")}</div>` : ""}
      </button>`;
  }

  grid.innerHTML = `
    ${unread.map(cardHtml).join("")}
    ${read.length ? `<div class="dokkai-read-divider">📖 Đã đọc</div>${read.map(cardHtml).join("")}` : ""}
  `;
  grid.querySelectorAll("[data-article-id]").forEach((btn) => {
    btn.addEventListener("click", () => startReadingArticle(btn.dataset.articleId));
  });
}

function startReadingArticle(articleId) {
  const article = App.dokkaiArticles.find((a) => a.id === articleId);
  if (!article) return;
  App.reading = { article, answers: {} }; // answers: qIndex -> {chosenIdx, correct}
  App.dokkaiTranslateMode = "none";
  markDokkaiArticleRead(articleId); // đánh dấu đã đọc NGAY khi mở bài (không cần đọc xong quiz)

  document.getElementById("dokkaiPhasePicker").classList.add("hidden");
  document.getElementById("dokkaiPhaseRead").classList.remove("hidden");
  document.getElementById("dokkaiReadTitle").textContent = article.title;
  document.getElementById("dokkaiReadIllust").innerHTML = getDokkaiCategoryIcon(article.category, article.id);
  const noteEl = document.getElementById("dokkaiSourceNote");
  noteEl.textContent = article.sourceNote || "";
  noteEl.classList.toggle("hidden", !article.sourceNote);

  document.querySelectorAll(".dokkai-translate-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.translateMode === "none"));
  document.getElementById("btnDokkaiFuriganaToggle").classList.add("is-active");
  document.getElementById("dokkaiReadBody").classList.remove("dokkai-furigana-hidden");
  if (dokkaiIsReading) { window.speechSynthesis.cancel(); dokkaiIsReading = false; }
  const readBtn = document.getElementById("btnDokkaiAutoRead");
  readBtn.classList.remove("is-active");
  readBtn.textContent = "🔊 記事を読む";

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

// Đọc bài tự động — tái dùng speakJapaneseForced() đã cải thiện chọn giọng
// (ưu tiên Google/Neural voice) từ game nghe, chain từng đoạn qua onend thật
// (không đoán thời lượng bằng setTimeout).
let dokkaiIsReading = false;
function toggleDokkaiAutoRead() {
  const btn = document.getElementById("btnDokkaiAutoRead");
  if (dokkaiIsReading) {
    window.speechSynthesis.cancel();
    dokkaiIsReading = false;
    btn.classList.remove("is-active");
    btn.textContent = "🔊 記事を読む";
    return;
  }
  dokkaiIsReading = true;
  btn.classList.add("is-active");
  btn.textContent = "⏹ 停止";
  const paragraphs = App.reading.article.paragraphs.map((p) => p.replace(/\{\{([^|}]+)\|[^}]*\}\}/g, "$1"));
  let i = 0;
  function readNext() {
    if (!dokkaiIsReading || i >= paragraphs.length) {
      dokkaiIsReading = false;
      btn.classList.remove("is-active");
      btn.textContent = "🔊 記事を読む";
      return;
    }
    speakJapaneseForced(paragraphs[i], readNext);
    i++;
  }
  readNext();
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
  const statsHtml = renderDokkaiLevelStats(article, vocabIndex);
  if (!list.length) {
    wrap.innerHTML = statsHtml + `<div class="dokkai-sidebar-empty">Chưa có danh sách từ vựng cho bài này.</div>`;
    return;
  }
  const SERIES_COLORS = { tango: "#ff6b6b", mimi: "#48c98c" }; // đỏ=Tango, xanh lá=Mimi theo đúng yêu cầu
  wrap.innerHTML = statsHtml + list.map((v) => {
    const deckMatch = vocabIndex.find((e) => e.word === v.kanji);
    const srcColor = deckMatch ? (SERIES_COLORS[deckMatch.series] || "var(--text-2)") : null;
    return `
      <div class="dokkai-vocab-item" ${srcColor ? `style="border-left:3px solid ${srcColor}"` : ""}>
        <div class="dokkai-vocab-item-head">
          <span class="dokkai-vocab-kanji">${v.kanji}</span>
          <span class="dokkai-vocab-reading">${v.reading}</span>
          <button class="dokkai-vocab-add-btn" data-word="${v.kanji}" title="Thêm vào sổ tay">+</button>
          ${deckMatch ? `<button class="dokkai-vocab-deck-badge" style="background:${srcColor}22;color:${srcColor}" data-deck-title="${deckMatch.deckTitle.replace(/"/g, "&quot;")}" title="Bấm để xem chương cụ thể">${deckMatch.series}</button>` : ""}
        </div>
        <div class="dokkai-vocab-hanviet">${v.hanviet || ""}</div>
        <div class="dokkai-vocab-meaning">${v.meaning}</div>
      </div>`;
  }).join("");
  wrap.querySelectorAll(".dokkai-vocab-add-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const vocab = list.find((v) => v.kanji === btn.dataset.word);
      if (vocab) addToDokkaiNotebook(vocab, article);
      btn.textContent = "✓";
      btn.disabled = true;
    });
  });
  wrap.querySelectorAll(".dokkai-vocab-deck-badge").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      document.querySelectorAll(".dokkai-deck-badge-popover").forEach((p) => p.remove());
      const pop = document.createElement("div");
      pop.className = "dokkai-deck-badge-popover";
      pop.textContent = `📚 ${btn.dataset.deckTitle}`;
      document.body.appendChild(pop);
      const rect = btn.getBoundingClientRect();
      pop.style.left = Math.min(rect.left, window.innerWidth - pop.offsetWidth - 12) + "px";
      pop.style.top = rect.bottom + 6 + "px";
      setTimeout(() => {
        document.addEventListener("click", function closeOnce() { pop.remove(); document.removeEventListener("click", closeOnce); }, { once: true });
      }, 0);
    });
  });
}

/* ===================================================================
   SIDEBAR PHẢI — ngữ pháp N2/N1 của CHÍNH bài đọc (article.grammarList).
=================================================================== */
// Rà NGỮ PHÁP thông minh theo CỤM — không gạch chân trong bài (khác từ vựng),
// chỉ gán TICK XANH nếu tìm thấy mẫu trong tài liệu ngữ pháp đã load. Mỗi
// cautruc có thể chứa NHIỀU biến thể cách nhau bởi "/", còn kèm phần đọc
// trong ngoặc hoặc hậu tố chia — phải TÁCH ĐÚNG từng biến thể rồi LÀM SẠCH
// (bỏ 〜/～ đầu, bỏ (...) chú thích đọc, bỏ khoảng trắng thừa) trước khi so
// khớp, nếu không sẽ không bao giờ khớp được (vd tìm nguyên cụm "〜次第（しだい）
// / 〜しだいで" sẽ KHÔNG BAO GIỜ khớp vì bài viết không chứa dấu "/").
function cleanGrammarVariant(raw) {
  return raw
    .replace(/^[〜～]+/, "")          // bỏ dấu sóng đầu cụm
    .replace(/（[^）]*）/g, "")        // bỏ chú thích đọc trong ngoặc tròn
    .replace(/[！!。、\s]+$/g, "")    // bỏ dấu câu/khoảng trắng thừa cuối
    .trim();
}
function buildDokkaiGrammarIndex() {
  const list = [];
  App.decks.filter((d) => d.type === "NGUPHAP").forEach((deck) => {
    deck.words.forEach((w) => {
      const raw = w.cautruc || "";
      raw.split(/[\/／]/).forEach((variant) => {
        const cleaned = cleanGrammarVariant(variant);
        if (cleaned && cleaned.length >= 2) {
          list.push({ pattern: cleaned, original: raw, deckTitle: deck.title, nghia: w.nghia || "" });
        }
      });
    });
  });
  list.sort((a, b) => b.pattern.length - a.pattern.length);
  return list;
}
function scanDokkaiGrammarMatches(article, grammarIndex) {
  const plainText = article.paragraphs.map((p) => p.replace(/\{\{[^}]*\}\}/g, (m) => {
    const parts = m.slice(2, -2).split("|");
    return parts[0]; // chỉ lấy phần chữ Hán/kana, bỏ phần đọc/nghĩa khi quét ngữ pháp
  })).join("");
  const found = [];
  const seen = new Set();
  grammarIndex.forEach((g) => {
    if (!seen.has(g.pattern) && plainText.includes(g.pattern)) {
      seen.add(g.pattern);
      found.push(g);
    }
  });
  return found;
}

// % thống kê trình độ (N5-N1) theo TỪ VỰNG auto-scan được trong bài — cho
// biết bài này thiên về mức nào, phục vụ đánh giá độ khó tổng quan.
function computeDokkaiLevelStats(article, vocabIndex) {
  const counts = { N1: 0, N2: 0, N3: 0, N4: 0, N5: 0 };
  let total = 0;
  article.paragraphs.forEach((p) => {
    const text = p.replace(/\{\{[^}]*\}\}/g, "");
    let i = 0;
    while (i < text.length) {
      let matched = null;
      for (const entry of vocabIndex) {
        if (text.startsWith(entry.word, i)) { matched = entry; break; }
      }
      if (matched) {
        counts[matched.level] = (counts[matched.level] || 0) + 1;
        total++;
        i += matched.word.length;
      } else i++;
    }
  });
  if (!total) return null;
  const pct = {};
  Object.keys(counts).forEach((lv) => { pct[lv] = Math.round((counts[lv] / total) * 100); });
  return pct;
}

function renderDokkaiLevelStats(article, vocabIndex) {
  const pct = computeDokkaiLevelStats(article, vocabIndex);
  if (!pct) return "";
  const order = ["N1", "N2", "N3", "N4", "N5"];
  return `
    <div class="dokkai-level-stats">
      <div class="dokkai-level-stats-title">📊 Độ khó từ vựng trong bài</div>
      ${order.filter((lv) => pct[lv] > 0).map((lv) => `
        <div class="dokkai-level-stats-row">
          <span class="dokkai-level-stats-label" style="color:${DOKKAI_LEVEL_COLORS[lv]}">${lv}</span>
          <div class="dokkai-level-stats-bar"><div class="dokkai-level-stats-fill" style="width:${pct[lv]}%; background:${DOKKAI_LEVEL_COLORS[lv]}"></div></div>
          <span class="dokkai-level-stats-pct">${pct[lv]}%</span>
        </div>
      `).join("")}
    </div>`;
}

function renderDokkaiGrammarSidebar() {
  const article = App.reading.article;
  const manualList = article.grammarList || [];
  const grammarIndex = buildDokkaiGrammarIndex();
  const autoFound = scanDokkaiGrammarMatches(article, grammarIndex);
  const wrap = document.getElementById("dokkaiGrammarList");

  let html = "";
  if (autoFound.length) {
    html += `<div class="dokkai-grammar-auto-title">✓ Có trong tài liệu ngữ pháp</div>`;
    html += autoFound.map((g) => `
      <button class="dokkai-grammar-tick" data-deck="${g.deckTitle}">
        <span class="dokkai-grammar-tick-icon">✓</span>
        <span class="dokkai-grammar-tick-pattern">${g.original}</span>
      </button>
    `).join("");
  }
  if (manualList.length) {
    html += `<div class="dokkai-grammar-auto-title">📕 Ngữ pháp khác trong bài</div>`;
    html += manualList.map((g) => `
      <div class="dokkai-grammar-item">
        <div class="dokkai-grammar-pattern">${g.pattern}</div>
        <div class="dokkai-grammar-meaning">${g.meaning}</div>
      </div>
    `).join("");
  }
  wrap.innerHTML = html || `<div class="dokkai-sidebar-empty">Chưa có ngữ pháp nào được phát hiện cho bài này.</div>`;
  wrap.querySelectorAll(".dokkai-grammar-tick").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      document.querySelectorAll(".dokkai-deck-badge-popover").forEach((p) => p.remove());
      const pop = document.createElement("div");
      pop.className = "dokkai-deck-badge-popover";
      pop.textContent = `📚 ${btn.dataset.deck}`;
      document.body.appendChild(pop);
      const rect = btn.getBoundingClientRect();
      pop.style.left = Math.min(rect.left, window.innerWidth - pop.offsetWidth - 12) + "px";
      pop.style.top = rect.bottom + 6 + "px";
      setTimeout(() => {
        document.addEventListener("click", function closeOnce() { pop.remove(); document.removeEventListener("click", closeOnce); }, { once: true });
      }, 0);
    });
  });
}

/* ===================================================================
   QUIZ INLINE — TẤT CẢ câu hỏi hiện 1 lượt ngay dưới bài đọc (không chuyển
   màn riêng nữa), trả lời câu nào khóa câu đó, dễ cuộn lên dò lại bài.
=================================================================== */
/* ===================================================================
   SỔ TAY TỪ VỰNG — bấm "+" ở sidebar từ vựng bài đọc để thêm vào, tự động
   trích câu chứa từ đó trong bài (kèm bản dịch nếu bài có paragraphsVi) làm
   ví dụ tường minh. Xuất được file .txt để tự làm bộ flashcard riêng.
=================================================================== */
const DOKKAI_NOTEBOOK_KEY = "n2vocab_reading_notebook";
function loadDokkaiNotebook() {
  try { return JSON.parse(localStorage.getItem(DOKKAI_NOTEBOOK_KEY)) || []; } catch (e) { return []; }
}
function saveDokkaiNotebook(list) {
  localStorage.setItem(DOKKAI_NOTEBOOK_KEY, JSON.stringify(list));
}
function addToDokkaiNotebook(vocab, article) {
  const notebook = loadDokkaiNotebook();
  // Tự động trích câu CHỨA từ này trong bài (ưu tiên đoạn nào có từ xuất hiện),
  // kèm bản dịch tương ứng nếu bài có paragraphsVi.
  let exampleJp = "", exampleVi = "";
  article.paragraphs.forEach((p, i) => {
    if (exampleJp) return;
    const plain = p.replace(/\{\{[^|}]*\|[^|}]*(?:\|[^}]*)?\}\}/g, (m) => m.match(/\{\{([^|}]+)/)[1]);
    if (plain.includes(vocab.kanji)) {
      exampleJp = plain;
      exampleVi = (article.paragraphsVi && article.paragraphsVi[i]) || "";
    }
  });
  notebook.push({
    kanji: vocab.kanji, reading: vocab.reading, hanviet: vocab.hanviet || "", meaning: vocab.meaning,
    exampleJp, exampleVi, fromArticle: article.title, addedAt: Date.now(),
  });
  saveDokkaiNotebook(notebook);
}

function openDokkaiNotebookModal() {
  renderDokkaiNotebookList();
  document.getElementById("dokkaiNotebookModalOverlay").classList.remove("hidden");
}

function renderDokkaiNotebookList() {
  const notebook = loadDokkaiNotebook();
  document.getElementById("dokkaiNotebookCount").textContent = `${notebook.length} từ đã ghi chú`;
  const wrap = document.getElementById("dokkaiNotebookList");
  if (!notebook.length) {
    wrap.innerHTML = `<div class="dash-chart-empty">Sổ tay đang trống — bấm "+" cạnh từ vựng trong bài đọc để thêm.</div>`;
    return;
  }
  // Mới thêm hiện TRƯỚC (dễ thấy từ vừa lưu), khác với danh sách bài đọc (cũ->mới).
  const sorted = notebook.slice().sort((a, b) => b.addedAt - a.addedAt);
  wrap.innerHTML = sorted.map((n, i) => `
    <div class="dokkai-notebook-item">
      <div class="dokkai-notebook-item-head">
        <span class="dokkai-notebook-kanji">${n.kanji}</span>
        <span class="dokkai-notebook-reading">${n.reading}</span>
        <span class="dokkai-notebook-hanviet">${n.hanviet || ""}</span>
        <button class="dokkai-notebook-del-btn" data-idx="${i}" title="Xóa khỏi sổ tay">✕</button>
      </div>
      <div class="dokkai-notebook-meaning">${n.meaning}</div>
      ${n.exampleJp ? `<div class="dokkai-notebook-example">${n.exampleJp}</div>` : ""}
      ${n.exampleVi ? `<div class="dokkai-notebook-example-vi">${n.exampleVi}</div>` : ""}
      <div class="dokkai-notebook-source">Từ bài: ${n.fromArticle}</div>
    </div>
  `).join("");
  wrap.querySelectorAll(".dokkai-notebook-del-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = parseInt(btn.dataset.idx, 10);
      const current = loadDokkaiNotebook().slice().sort((a, b) => b.addedAt - a.addedAt);
      const target = current[idx];
      const original = loadDokkaiNotebook().filter((n) => !(n.kanji === target.kanji && n.addedAt === target.addedAt));
      saveDokkaiNotebook(original);
      renderDokkaiNotebookList();
    });
  });
}

function exportDokkaiNotebookTxt() {
  const notebook = loadDokkaiNotebook();
  if (!notebook.length) { alert("Sổ tay đang trống."); return; }
  const lines = notebook.map((n, i) =>
    `${i + 1}. ${n.kanji} (${n.reading}) — ${n.hanviet}\n   Nghĩa: ${n.meaning}\n   Ví dụ: ${n.exampleJp}\n   Dịch: ${n.exampleVi}\n   (Từ bài: ${n.fromArticle})\n`
  );
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `so-tay-tu-vung-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

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
        <button class="dokkai-quiz-check-btn" data-qi="${qi}" disabled>答え合わせ</button>
      </div>
    `).join("")}
    <div class="dokkai-quiz-summary hidden" id="dokkaiQuizSummary"></div>
  `;
  // Chọn đáp án CHỈ highlight (chưa chấm) — đúng yêu cầu "chọn không ra đúng
  // sai liền", phải bấm nút "答え合わせ" (chấm điểm) riêng mới lộ đúng/sai.
  wrap.querySelectorAll(".dokkai-quiz-opt").forEach((btn) => {
    btn.addEventListener("click", () => selectDokkaiOption(btn));
  });
  wrap.querySelectorAll(".dokkai-quiz-check-btn").forEach((btn) => {
    btn.addEventListener("click", () => checkDokkaiAnswer(parseInt(btn.dataset.qi, 10)));
  });
}

function selectDokkaiOption(btn) {
  const qi = parseInt(btn.dataset.qi, 10);
  if (App.reading.answers[qi]) return; // câu này đã chấm rồi (khóa), không cho chọn lại
  const group = document.querySelector(`.dokkai-quiz-options[data-qi="${qi}"]`);
  group.querySelectorAll(".dokkai-quiz-opt").forEach((b) => b.classList.remove("is-selected"));
  btn.classList.add("is-selected");
  document.querySelector(`.dokkai-quiz-check-btn[data-qi="${qi}"]`).disabled = false;
}

// Chấm điểm ĐÚNG lúc bấm "答え合わせ" — KHÔNG tự động lộ khi vừa chọn. Kết
// quả hiện NGAY TẠI CHỖ (cùng trang), không chuyển màn nào cả.
function checkDokkaiAnswer(qi) {
  if (App.reading.answers[qi]) return;
  const group = document.querySelector(`.dokkai-quiz-options[data-qi="${qi}"]`);
  const selected = group.querySelector(".is-selected");
  if (!selected) return;
  const oi = parseInt(selected.dataset.oi, 10);
  const q = App.reading.article.questions[qi];
  const isCorrect = oi === q.answer;
  App.reading.answers[qi] = { chosenIdx: oi, correct: isCorrect };

  group.querySelectorAll(".dokkai-quiz-opt").forEach((b, i) => {
    b.classList.add("disabled");
    if (i === q.answer) b.classList.add("correct");
    else if (i === oi) b.classList.add("wrong");
  });
  document.querySelector(`.dokkai-quiz-check-btn[data-qi="${qi}"]`).remove();

  const allAnswered = Object.keys(App.reading.answers).length === App.reading.article.questions.length;
  if (allAnswered) showDokkaiInlineSummary();
}

// Tổng kết hiện NGAY DƯỚI cùng trang (không chuyển sang phase/màn khác nữa)
// — đúng yêu cầu "không nhảy đi đâu hết".
function showDokkaiInlineSummary() {
  const article = App.reading.article;
  const score = Object.values(App.reading.answers).filter((a) => a.correct).length;
  const box = document.getElementById("dokkaiQuizSummary");
  box.classList.remove("hidden");
  box.innerHTML = `
    <div class="lg-result-score">${score} / ${article.questions.length}</div>
    <div class="lg-result-pct">${Math.round((score / article.questions.length) * 100)}%</div>
  `;
  box.scrollIntoView({ behavior: "smooth", block: "center" });
}

function backToDokkaiPicker() {
  if (dokkaiIsReading) { window.speechSynthesis.cancel(); dokkaiIsReading = false; }
  App.reading = null;
  initReadingMode();
}
