/* ===== N2 Vocab Lab v2 — main app logic ===== */

const App = {
  decks: [],
  exams: [],
  currentDeckId: null,
  currentDeckType: null, // "TUVUNG" | "NGUPHAP"
  currentWords: [],
  progress: {},

  // Cấu hình hiển thị mặt thẻ flashcard, theo từng TYPE riêng (lưu localStorage)
  fieldConfig: {
    TUVUNG: { front: ["kanji"], back: ["doc", "han_viet", "nghia", "vi_du", "dong_nghia", "trai_nghia"] },
    NGUPHAP: { front: ["cautruc"], back: ["nghia", "cau_truc_ngu_phap", "vi_du", "dong_nghia", "trai_nghia", "so_sanh_de_nham"] },
  },
  visibleCols: {
    TUVUNG: ["kanji", "doc", "han_viet", "nghia", "vi_du", "dong_nghia", "trai_nghia", "status"],
    NGUPHAP: ["cautruc", "nghia", "muc_do", "vi_du", "dong_nghia", "trai_nghia", "status"],
  },
  // Cột nào đang ở trạng thái "ẩn để tự kiểm tra" (peek khi hover) — riêng biệt với việc ẩn/hiện cả cột
  peekCols: {
    TUVUNG: [],
    NGUPHAP: [],
  },

  flashQueue: [],            // hàng đợi itemId xoay vòng trong phiên học hiện tại
  flashRememberedCount: 0,   // số từ đã bấm "Đã nhớ" trong phiên này
  flashTotalCount: 0,        // tổng số từ ban đầu của phiên (để tính % progress)
  flashRestrictToIds: null,  // nếu học giới hạn theo 1 danh sách _id cụ thể (ví dụ "chỉ học từ yếu")

  srsQueue: [],
  srsIndex: 0,

  typingOrder: [],
  typingIndex: 0,
  typingScore: 0,
  typingPool: [],
  typingCurrentTarget: "", // hiragana raw cần nhớ và gõ ra
  typingCurrentWord: null,
  typingRevealedCount: 0,
  typingAnswered: false,

  quizQuestions: [],
  quizIndex: 0,
  quizScore: 0,
  quizAnswering: false, // chặn double-click khi đang xử lý 1 câu trả lời
  quizTimerHandle: null,
  quizStartTime: null,
  quizNeedsReset: false,

  matchPairs: 0,
  matchTotalPairs: 0,
  matchTimerHandle: null,
  matchStartTime: null,
  matchSelected: [],
  matchLocked: false,
  matchNeedsReset: false,

  currentExamId: null,
  examQueue: [],     // mảng index câu hỏi còn phải làm (FIFO, câu sai bị đẩy xuống cuối)
  examOriginalTotal: 0,
  examScore: 0,
  examAnswered: new Set(), // index câu đã trả lời đúng (để không cộng điểm trùng)

  // Lịch sử trả lời TỪNG câu trong đề đang làm — dùng để: quay lại xem câu trước,
  // biết câu nào sai ở lần đầu, câu nào sai nhiều lần. Cấu trúc:
  // { [qIndex]: { attempts: [{chosenIdx, correct, atMs}], firstTryCorrect: bool|null } }
  examHistory: {},
  // Vị trí đang xem trong danh sách "đã từng hiện ra" (theo thứ tự xuất hiện thật,
  // không phải theo qIndex gốc) — dùng cho nút quay lại/tiến tới xem lại câu đã làm.
  examSeenOrder: [],   // mảng qIndex theo đúng thứ tự đã hiện ra cho người học
  examNavPos: -1,       // vị trí hiện tại trong examSeenOrder; -1 = đang ở câu mới nhất (live)
  examReviewMode: false, // true khi đang xem lại câu cũ (không phải câu đang chờ trả lời)

  // Chế độ luyện tốc độ (mojigoi/ngữ pháp): đếm 30s mỗi câu, đo tổng thời gian làm cả đề
  examSpeedMode: false,
  examPerQTimerHandle: null,
  examPerQSecondsLeft: 30,
  examPerQStartedAt: null,
  examTotalTimerHandle: null,
  examTotalStartTime: null,
  examQuestionTimeLog: [], // mảng { qIndex, seconds, overTime, isRetry } ghi lại thời gian mỗi lần trả lời

  // 2 mốc thời gian riêng biệt theo yêu cầu: mốc 1 = làm hết lượt đầu (mỗi câu gặp đúng 1 lần
  // theo thứ tự gốc), mốc 2 = từ khi bắt đầu pha sửa lại các câu đã sai cho tới khi xong hẳn.
  examFirstPassStartTime: null,
  examFirstPassEndTime: null,
  examFirstPassDone: false, // đã đi hết lượt đầu (mọi câu gốc đã được hỏi ít nhất 1 lần) chưa
  examRetryStartTime: null,

  // Các sửa tạm (qua nút "Sửa") áp đè lên dữ liệu gốc, lưu localStorage.
  // Cấu trúc: { [deckId]: { [_id]: { ...field đã sửa } } }
  editPatches: {},

  soundEnabled: true,
  speechEnabled: true, // phát âm tự động khi lật thẻ sang mặt sau

  // Bật/tắt học theo thứ tự ngẫu nhiên, riêng cho Flashcard và SRS (mặc định bật cả 2)
  shuffleEnabled: { flash: true, srs: true },

  // Đánh dấu sao (kiểu Quizlet): { [deckId]: [itemId, itemId, ...] }
  starredItems: {},
};

/* ---------- Field metadata (nhãn hiển thị + cách render) ---------- */

const FIELD_META = {
  TUVUNG: {
    kanji: { label: "Kanji", render: (w) => `<div class="cf-kanji">${w.kanji}</div>` },
    doc: { label: "Hiragana (trường âm đỏ)", render: (w) => `<div class="cf-doc">${renderChoon(w.doc_marked || w.doc)}</div>` },
    han_viet: { label: "Hán Việt", render: (w) => `<div class="cf-hanviet">${w.han_viet}</div>` },
    nghia: { label: "Nghĩa tiếng Việt", render: (w) => `<div class="cf-nghia">${w.nghia}</div>` },
    vi_du: { label: "Ví dụ (furigana)", render: (w) => `<div class="cf-vidu">${renderExampleSentences(w.vi_du_ruby || w.vi_du)}</div>` },
    dong_nghia: {
      label: "Từ đồng nghĩa",
      render: (w) => (w.dong_nghia && w.dong_nghia.length
        ? `<div class="cf-block-label">Đồng nghĩa</div><div class="cf-synonyms">${renderSynonymList(w.dong_nghia)}</div>` : ""),
    },
    trai_nghia: {
      label: "Từ trái nghĩa",
      render: (w) => (w.trai_nghia && w.trai_nghia.length
        ? `<div class="cf-block-label">Trái nghĩa</div><div class="cf-antonyms">${renderSynonymList(w.trai_nghia)}</div>` : ""),
    },
  },
  NGUPHAP: {
    cautruc: { label: "Cấu trúc", render: (w) => `<div class="cf-cautruc">${w.cautruc}</div>` },
    nghia: { label: "Ý nghĩa", render: (w) => `<div class="cf-nghia">${w.nghia}</div>` },
    muc_do: { label: "Mức độ trang trọng", render: (w) => (w.muc_do ? `<div class="cf-mucdo">${w.muc_do}</div>` : "") },
    cau_truc_ngu_phap: { label: "Công thức ngữ pháp", render: (w) => (w.cau_truc_ngu_phap ? `<div class="cf-ngphap-structure">${w.cau_truc_ngu_phap}</div>` : "") },
    vi_du: { label: "Ví dụ (furigana)", render: (w) => `<div class="cf-vidu">${renderExampleSentences(w.vi_du)}</div>` },
    so_sanh_de_nham: {
      label: "So sánh cấu trúc dễ nhầm",
      render: (w) => {
        if (!w.so_sanh_de_nham || !w.so_sanh_de_nham.length) return "";
        const items = w.so_sanh_de_nham
          .map((s) => `<div class="cf-sosanh-item"><span class="cf-sosanh-tag">${s.cautruc}</span> — ${s.khac_biet}</div>`)
          .join("");
        return `<div class="cf-block-label">So sánh dễ nhầm</div>${items}`;
      },
    },
    dong_nghia: {
      label: "Cấu trúc đồng nghĩa",
      render: (w) => (w.dong_nghia && w.dong_nghia.length
        ? `<div class="cf-block-label">Đồng nghĩa</div><div class="cf-synonyms">${renderSynonymList(w.dong_nghia)}</div>` : ""),
    },
    trai_nghia: {
      label: "Cấu trúc trái nghĩa",
      render: (w) => (w.trai_nghia && w.trai_nghia.length
        ? `<div class="cf-block-label">Trái nghĩa</div><div class="cf-antonyms">${renderSynonymList(w.trai_nghia)}</div>` : ""),
    },
  },
};

/* ---------- Field nào cho phép sửa qua modal, loại input gì ---------- */

const EDIT_FIELD_META = {
  TUVUNG: [
    { key: "kanji", label: "Kanji", type: "text" },
    { key: "doc", label: "Cách đọc (raw, dùng để so khớp gõ chữ — không chứa **)", type: "text" },
    { key: "doc_marked", label: "Cách đọc có đánh dấu trường âm", type: "choon-editor" },
    { key: "han_viet", label: "Hán Việt", type: "text" },
    { key: "nghia", label: "Nghĩa tiếng Việt", type: "text" },
    { key: "vi_du", label: "Ví dụ (tiếng Nhật + dịch)", type: "textarea" },
    { key: "vi_du_ruby", label: "Ví dụ có furigana (dùng <ruby>kanji<rt>đọc</rt></ruby>)", type: "ruby-editor" },
    { key: "dong_nghia", label: "Từ đồng nghĩa (cách nhau bằng dấu phẩy)", type: "list" },
    { key: "trai_nghia", label: "Từ trái nghĩa (cách nhau bằng dấu phẩy)", type: "list" },
  ],
  NGUPHAP: [
    { key: "cautruc", label: "Cấu trúc", type: "text" },
    { key: "nghia", label: "Ý nghĩa", type: "text" },
    { key: "muc_do", label: "Mức độ trang trọng", type: "text" },
    { key: "cau_truc_ngu_phap", label: "Công thức ngữ pháp", type: "text" },
    { key: "vi_du", label: "Ví dụ (dùng <ruby>kanji<rt>đọc</rt></ruby> để thêm furigana)", type: "ruby-editor" },
    { key: "dong_nghia", label: "Cấu trúc đồng nghĩa (cách nhau bằng dấu phẩy)", type: "list" },
    { key: "trai_nghia", label: "Cấu trúc trái nghĩa (cách nhau bằng dấu phẩy)", type: "list" },
  ],
};

const TABLE_COL_META = {
  TUVUNG: {
    kanji: { label: "Kanji", canPeek: false },
    doc: { label: "Đọc", canPeek: true },
    han_viet: { label: "Hán Việt", canPeek: true },
    nghia: { label: "Nghĩa", canPeek: true },
    vi_du: { label: "Ví dụ", canPeek: true },
    dong_nghia: { label: "Đồng nghĩa", canPeek: false },
    trai_nghia: { label: "Trái nghĩa", canPeek: false },
    status: { label: "Trạng thái", canPeek: false },
  },
  NGUPHAP: {
    cautruc: { label: "Cấu trúc", canPeek: false },
    nghia: { label: "Ý nghĩa", canPeek: true },
    muc_do: { label: "Mức độ", canPeek: true },
    vi_du: { label: "Ví dụ", canPeek: true },
    dong_nghia: { label: "Đồng nghĩa", canPeek: false },
    trai_nghia: { label: "Trái nghĩa", canPeek: false },
    status: { label: "Trạng thái", canPeek: false },
  },
};

/* ---------- Render trường âm: chuyển **xxx** -> <span class="choon">xxx</span> ---------- */

function renderChoon(text) {
  if (!text) return "";
  return text.replace(/\*\*(.+?)\*\*/g, '<span class="choon">$1</span>');
}

// Tách 1 chuỗi vi_du/vi_du_ruby chứa NHIỀU câu ví dụ viết liền nhau (cách nhau
// bằng khoảng trắng sau dấu ")") thành từng dòng riêng — chỉ xử lý ở tầng hiển
// thị, KHÔNG cần sửa lại cấu trúc dữ liệu JSON gốc đã có. An toàn với câu chỉ
// có 1 ví dụ (không có gì để tách) và với các thẻ <ruby> bên trong.
function renderExampleSentences(text) {
  if (!text) return "";
  const sentences = text.split(/(?<=\)) +(?=\S)/).filter(Boolean);
  if (sentences.length <= 1) return renderChoon(text);
  return sentences.map((s) => `<div class="cf-vidu-line">${renderChoon(s)}</div>`).join("");
}

function stripChoonMarks(text) {
  if (!text) return "";
  return text.replace(/\*\*/g, "");
}

// Render 1 mục đồng/trái nghĩa, hỗ trợ cả 2 format dữ liệu:
// - Format cũ (chuỗi thuần): "低下"  -> chỉ hiện kanji, không furigana/nghĩa
// - Format mới (object): {kanji, doc, nghia} -> hiện furigana nhỏ trên kanji + nghĩa kèm theo
// Giữ cả 2 để không phải sửa toàn bộ dữ liệu JSON cũ ngay lập tức.
function renderSynonymItem(item) {
  if (typeof item === "string") {
    return `<span class="syn-item">${item}</span>`;
  }
  if (item && typeof item === "object") {
    const kanjiWithFurigana = item.doc
      ? `<ruby>${item.kanji}<rt>${item.doc}</rt></ruby>`
      : item.kanji;
    const nghiaPart = item.nghia ? `<span class="syn-nghia">（${item.nghia}）</span>` : "";
    return `<span class="syn-item">${kanjiWithFurigana}${nghiaPart}</span>`;
  }
  return "";
}

function renderSynonymList(list) {
  if (!list || !list.length) return "";
  return list.map(renderSynonymItem).join("、");
}

/* ---------- Utilities ---------- */

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function wordId(deckId, word, idx) {
  // Dùng nội dung (kanji/cautruc) làm khóa chính để _id ổn định ngay cả khi
  // thêm/xóa từ khác làm dịch chuyển vị trí trong mảng. idx chỉ dùng làm fallback
  // khi từ không có kanji/cautruc (hiếm), và cộng thêm để tránh trùng nếu 2 từ
  // trong cùng bộ có kanji/cautruc giống nhau y hệt.
  const key = word.kanji || word.cautruc || `item${idx}`;
  return `${deckId}::${key}`;
}

function fmtTime(sec) {
  const m = Math.floor(sec / 60).toString().padStart(2, "0");
  const s = Math.floor(sec % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

/* ---------- Âm thanh phản hồi nhẹ (đúng/sai), dùng Web Audio API, không cần file mp3 ---------- */

let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  return audioCtx;
}

function playTone(freq, durationMs, type = "sine", volume = 0.12) {
  if (!App.soundEnabled) return;
  const ctx = getAudioCtx();
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = volume;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + durationMs / 1000);
    osc.start(now);
    osc.stop(now + durationMs / 1000);
  } catch (e) { /* ignore audio errors silently */ }
}

function playCorrectSound() {
  playTone(880, 110, "sine", 0.1);
  setTimeout(() => playTone(1320, 130, "sine", 0.09), 70);
}

function playWrongSound() {
  playTone(220, 180, "sine", 0.12);
}

/* ---------- Phát âm tiếng Nhật bằng Web Speech API (miễn phí, có sẵn trong trình duyệt) ---------- */

/* ---------- Phát âm tiếng Nhật bằng Web Speech API (miễn phí, có sẵn trong trình duyệt) ----------
   Lưu ý quan trọng cho mobile (đặc biệt iOS Safari/Chrome):
   - speechSynthesis.getVoices() có thể trả về RỖNG ngay lúc trang vừa load, danh sách
     giọng chỉ có sau khi browser bắn event 'voiceschanged'. Nếu gọi speak() trước khi
     có giọng, một số máy sẽ ÂM THẦM không phát ra gì (không lỗi, không tiếng).
   - Một số máy mobile không có giọng "ja-JP" cụ thể, chỉ có giọng chung; cần dò tìm
     theo prefix "ja" thay vì so khớp chính xác "ja-JP".
   - speechSynthesis.speak() PHẢI được gọi trong cùng 1 user-gesture (click/tap) —
     không qua setTimeout/Promise delay — nếu không iOS sẽ chặn im lặng. Code gọi
     speakWord() hiện tại đều gọi trực tiếp trong handler click, không qua async, OK.
*/

let cachedJapaneseVoice = null;
let voicesLoadAttempted = false;

function pickJapaneseVoice() {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || !voices.length) return null;
  // Ưu tiên khớp chính xác "ja-JP", sau đó bất kỳ giọng có lang bắt đầu bằng "ja"
  return (
    voices.find((v) => v.lang === "ja-JP") ||
    voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("ja")) ||
    null
  );
}

function ensureVoicesLoaded() {
  if (!("speechSynthesis" in window) || voicesLoadAttempted) return;
  voicesLoadAttempted = true;
  cachedJapaneseVoice = pickJapaneseVoice();
  if (!cachedJapaneseVoice && "onvoiceschanged" in window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => {
      cachedJapaneseVoice = pickJapaneseVoice();
    };
  }
}

function speakJapanese(text) {
  if (!App.speechEnabled) return;
  if (!text) return;
  if (!("speechSynthesis" in window)) return; // trình duyệt không hỗ trợ -> bỏ qua êm, không lỗi
  try {
    window.speechSynthesis.cancel(); // hủy câu đang đọc trước đó (nếu có) tránh xếp hàng dồn lại
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "ja-JP";
    utter.rate = 0.95;
    // Cố gắng dùng giọng Nhật cụ thể nếu tìm được, để tránh trường hợp browser
    // chọn giọng mặc định không đọc được tiếng Nhật (im lặng hoặc đọc sai âm)
    const voice = cachedJapaneseVoice || pickJapaneseVoice();
    if (voice) utter.voice = voice;
    window.speechSynthesis.speak(utter);
  } catch (e) { /* ignore lỗi phát âm, không làm ảnh hưởng trải nghiệm học */ }
}

// Đọc đúng cách đọc thật (doc, không phải doc_marked có dấu **) hoặc cautruc cho ngữ pháp
function speakWord(w) {
  if (!w) return;
  const text = w.doc || w.cautruc || w.kanji;
  speakJapanese(text);
}

/* ===================================================================
   THỐNG KÊ ĐIỂM YẾU — tự động ghi nhận số lần đúng/sai cho mỗi từ/câu,
   áp dụng cho cả 3 mảng: từ vựng, ngữ pháp (theo deckId thật), và đề thi
   (dùng deckId giả "__exam__" để tách riêng khỏi namespace từ vựng/ngữ pháp).
   Lưu trong localStorage, không phụ thuộc server.
=================================================================== */

const WEAKNESS_STORAGE_KEY = "n2vocab_weakness_stats";

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
function recordWeaknessResult(deckId, itemId, correct, label) {
  const stats = loadWeaknessStats();
  if (!stats[deckId]) stats[deckId] = {};
  if (!stats[deckId][itemId]) {
    stats[deckId][itemId] = { correctCount: 0, wrongCount: 0, lastLabel: "", lastResultAt: 0 };
  }
  const entry = stats[deckId][itemId];
  if (correct) entry.correctCount++; else entry.wrongCount++;
  if (label) entry.lastLabel = label;
  entry.lastResultAt = Date.now();
  saveWeaknessStats(stats);
}

// "Điểm yếu" = đã sai ít nhất 1 lần, VÀ (nếu đã làm ≥3 lần thì tỷ lệ sai phải ≥40%
// để tránh báo nhầm các từ đã từng sai nhưng sau đó học tốt hẳn lên). Với số lần làm
// ít (1-2 lần), chỉ cần có sai là đủ để hiện ra ngay — để người mới dùng tính năng
// này thấy kết quả ngay, không phải làm rất nhiều lần mới thấy gì.
function getWeaknessListForDeck(deckId) {
  const stats = loadWeaknessStats();
  const deckStats = stats[deckId] || {};
  const list = Object.keys(deckStats).map((itemId) => ({ itemId, ...deckStats[itemId] }));
  return list
    .filter((e) => {
      if (e.wrongCount < 1) return false;
      const total = e.wrongCount + e.correctCount;
      if (total < 3) return true; // chưa đủ dữ liệu để xét tỷ lệ -> cứ hiện nếu có sai
      return e.wrongCount / total >= 0.4;
    })
    .sort((a, b) => {
      const totalA = a.wrongCount + a.correctCount;
      const totalB = b.wrongCount + b.correctCount;
      return (b.wrongCount / totalB) - (a.wrongCount / totalA);
    });
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

/* ---------- Weakness mode UI (cho từ vựng/ngữ pháp) ---------- */

let currentWeaknessIds = [];

function renderWeaknessMode() {
  const weakList = getWeaknessListForDeck(App.currentDeckId);
  currentWeaknessIds = weakList.map((e) => e.itemId);

  const empty = document.getElementById("weaknessEmpty");
  const listWrap = document.getElementById("weaknessListWrap");

  if (weakList.length === 0) {
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
      </div>
    `;
    listDiv.appendChild(row);
  });
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

// Tính % đã thuộc/đang học/chưa học cho 1 bộ cụ thể (dùng progress riêng của
// bộ đó, không phải App.progress hiện tại — vì người dùng có thể đang xem
// thống kê của bộ khác với bộ đang mở).
function computeDeckStats(deck) {
  const progress = SRS.loadProgress(deck.id);
  let known = 0, learning = 0, fresh = 0;
  deck.words.forEach((w) => {
    const entry = SRS.getEntry(progress, w._id);
    const st = SRS.status(entry);
    if (st === "known") known++;
    else if (st === "learning") learning++;
    else fresh++;
  });
  const total = deck.words.length || 1;
  const pct = Math.round((known / total) * 100);
  return { known, learning, fresh, total: deck.words.length, pct };
}

function renderStatsMode() {
  renderStatsOverviewTable();
  renderStatsCurrentDeck();
  renderStatsExamHistory();
}

function renderStatsOverviewTable() {
  const tbody = document.getElementById("statsOverviewBody");
  tbody.innerHTML = "";
  App.decks.forEach((deck) => {
    const s = computeDeckStats(deck);
    const tr = document.createElement("tr");
    if (deck.id === App.currentDeckId) tr.classList.add("is-current-deck-row");
    tr.innerHTML = `
      <td class="stats-deck-name">${deck.title}${deck.id === App.currentDeckId ? ' <span class="stats-current-tag">(đang mở)</span>' : ""}</td>
      <td>${s.known}</td>
      <td>${s.learning}</td>
      <td>${s.fresh}</td>
      <td>
        <div class="stats-pct-bar-wrap">
          <div class="stats-pct-bar"><div class="stats-pct-bar-fill" style="width:${s.pct}%"></div></div>
          <span class="stats-pct-label">${s.pct}%</span>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function renderStatsCurrentDeck() {
  const deck = App.decks.find((d) => d.id === App.currentDeckId);
  if (!deck) return;

  document.getElementById("statsCurrentDeckTitle").textContent = `📖 Chi tiết: ${deck.title}`;

  let due = 0, newCount = 0, known = 0, learning = 0;
  deck.words.forEach((w) => {
    const entry = SRS.getEntry(App.progress, w._id);
    const st = SRS.status(entry);
    if (st === "known") known++;
    else if (st === "learning") learning++;
    if (!entry.seen) newCount++;
    else if (SRS.isDue(entry)) due++;
  });

  const grid = document.getElementById("statsCurrentDeckGrid");
  grid.innerHTML = `
    <div class="stats-stat-box"><div class="stats-stat-num">${due}</div><div class="stats-stat-label">thẻ đến hạn ôn ngay</div></div>
    <div class="stats-stat-box"><div class="stats-stat-num">${newCount}</div><div class="stats-stat-label">từ mới chưa học</div></div>
    <div class="stats-stat-box"><div class="stats-stat-num">${learning}</div><div class="stats-stat-label">đang học</div></div>
    <div class="stats-stat-box is-good"><div class="stats-stat-num">${known}</div><div class="stats-stat-label">đã thuộc</div></div>
  `;

  // Ước tính thời gian học hết các từ MỚI còn lại: dựa trên tốc độ SRS thật —
  // mỗi từ mới lần đầu "Dễ" tốn FIRST_EASY phút trước khi rảnh (ước tính rất
  // thô, chỉ mang tính tham khảo, không phải cam kết chính xác).
  const etaDiv = document.getElementById("statsEta");
  if (newCount === 0 && due === 0) {
    etaDiv.textContent = "🎉 Không còn gì cần học/ôn ngay trong bộ này — làm tốt lắm!";
  } else {
    const parts = [];
    if (due > 0) parts.push(`${due} thẻ cần ôn ngay`);
    if (newCount > 0) parts.push(`${newCount} từ mới chưa học`);
    etaDiv.textContent = `Còn ${parts.join(" và ")}. Học/ôn dần qua SRS hoặc Flashcard để tiến tới 100%.`;
  }

  // Mini điểm yếu của riêng bộ này
  const weakList = getWeaknessListForDeck(App.currentDeckId);
  const miniDiv = document.getElementById("statsWeaknessMini");
  if (weakList.length === 0) {
    miniDiv.innerHTML = "";
  } else {
    const top3 = weakList.slice(0, 3);
    const rows = top3.map((e) => {
      const w = deck.words.find((cw) => cw._id === e.itemId);
      const title = w ? (w.kanji || w.cautruc) : e.lastLabel || e.itemId;
      return `<span class="stats-weak-chip">${title} <span class="stats-weak-chip-count">✕${e.wrongCount}</span></span>`;
    }).join("");
    miniDiv.innerHTML = `<div class="stats-weakness-mini-title">⚠ Điểm yếu hàng đầu (${weakList.length} từ đang yếu):</div><div class="stats-weak-chips">${rows}</div>`;
  }
}

function renderStatsExamHistory() {
  const stats = loadExamHistoryStats();
  const examEmpty = document.getElementById("statsExamEmpty");
  const listDiv = document.getElementById("statsExamList");

  const examIds = Object.keys(stats).filter((id) => App.exams.find((e) => e.id === id));
  if (examIds.length === 0) {
    examEmpty.classList.remove("hidden");
    listDiv.innerHTML = "";
    return;
  }
  examEmpty.classList.add("hidden");

  const rows = examIds.map((examId) => {
    const exam = App.exams.find((e) => e.id === examId);
    if (!exam) return ""; // đề đã bị xóa khỏi dethi/index.json -> bỏ qua an toàn, không crash
    const s = stats[examId];
    const dateLabel = s.lastCompletedAt ? new Date(s.lastCompletedAt).toLocaleString("vi-VN") : "—";
    const timeLabel = s.lastSeconds ? fmtTime(s.lastSeconds) : "—";
    return `
      <div class="stats-exam-row">
        <div class="stats-exam-row-title">${exam.title}</div>
        <div class="stats-exam-row-stats">
          <span class="stats-exam-stat">Đã làm <b>${s.totalCompletions}</b> lần</span>
          <span class="stats-exam-stat">Gần nhất: <b>${s.lastScore}/${s.lastTotal}</b> điểm</span>
          <span class="stats-exam-stat">Sai lần 1: <b>${s.lastFirstTryWrongCount}</b> câu</span>
          <span class="stats-exam-stat">Thời gian: <b>${timeLabel}</b></span>
          <span class="stats-exam-stat-date">${dateLabel}</span>
        </div>
      </div>
    `;
  }).join("");
  listDiv.innerHTML = rows;
}

/* ---------- Focus mode: phóng to toàn màn hình, ẩn sidebar + điều khiển thừa ---------- */

function enterFocusMode() {
  // Riêng exam: nếu chưa chọn đề thi (sidebar ẩn sẽ không bấm lại được dropdown chọn đề),
  // không cho vào focus mode, nhắc người dùng chọn đề trước.
  const examView = document.getElementById("view-exam");
  const isExamViewActive = examView && !examView.classList.contains("hidden");
  if (isExamViewActive && !App.currentExamId) {
    alert("Hãy chọn một đề thi ở sidebar trước khi phóng to toàn màn hình.");
    return;
  }
  document.getElementById("app").classList.add("focus-mode");
  document.getElementById("btnExitFocus").classList.remove("hidden");
}

function exitFocusMode() {
  document.getElementById("app").classList.remove("focus-mode");
  document.getElementById("btnExitFocus").classList.add("hidden");
}

function loadFieldConfig() {
  try {
    const raw = localStorage.getItem("n2vocab_fieldconfig");
    if (raw) {
      const parsed = JSON.parse(raw);
      Object.assign(App.fieldConfig, parsed);
    }
  } catch (e) { /* ignore */ }
  try {
    const raw2 = localStorage.getItem("n2vocab_colconfig");
    if (raw2) {
      const parsed2 = JSON.parse(raw2);
      Object.assign(App.visibleCols, parsed2);
    }
  } catch (e) { /* ignore */ }
  try {
    const raw3 = localStorage.getItem("n2vocab_peekcols");
    if (raw3) {
      const parsed3 = JSON.parse(raw3);
      Object.assign(App.peekCols, parsed3);
    }
  } catch (e) { /* ignore */ }
  try {
    const raw4 = localStorage.getItem("n2vocab_sound_enabled");
    if (raw4 !== null) App.soundEnabled = raw4 === "true";
  } catch (e) { /* ignore */ }
  try {
    const raw5 = localStorage.getItem("n2vocab_speech_enabled");
    if (raw5 !== null) App.speechEnabled = raw5 === "true";
  } catch (e) { /* ignore */ }
}

function saveSoundConfig() {
  localStorage.setItem("n2vocab_sound_enabled", String(App.soundEnabled));
}

function saveSpeechConfig() {
  localStorage.setItem("n2vocab_speech_enabled", String(App.speechEnabled));
}

function loadShuffleConfig() {
  try {
    const raw = localStorage.getItem("n2vocab_shuffle_enabled");
    if (raw) Object.assign(App.shuffleEnabled, JSON.parse(raw));
  } catch (e) { /* ignore */ }
}

function saveShuffleConfig() {
  localStorage.setItem("n2vocab_shuffle_enabled", JSON.stringify(App.shuffleEnabled));
}

function saveFieldConfig() {
  localStorage.setItem("n2vocab_fieldconfig", JSON.stringify(App.fieldConfig));
}

function saveColConfig() {
  localStorage.setItem("n2vocab_colconfig", JSON.stringify(App.visibleCols));
}

/* ---------- Patch sửa tạm: lưu các chỉnh sửa từ vựng/ngữ pháp, áp đè lên dữ liệu gốc ---------- */

function loadEditPatches() {
  try {
    const raw = localStorage.getItem("n2vocab_editpatches");
    if (raw) App.editPatches = JSON.parse(raw);
  } catch (e) { App.editPatches = {}; }
}

function saveEditPatches() {
  localStorage.setItem("n2vocab_editpatches", JSON.stringify(App.editPatches));
}

// Áp các patch đã lưu lên 1 danh sách words (gọi ngay sau khi load deck từ file JSON gốc)
function applyPatchesToWords(deckId, words) {
  const patchesForDeck = App.editPatches[deckId];
  if (!patchesForDeck) return words;
  return words.map((w) => {
    const patch = patchesForDeck[w._id];
    return patch ? { ...w, ...patch } : w;
  });
}

// Lưu 1 sửa tạm cho 1 từ cụ thể trong 1 bộ, rồi áp dụng ngay vào App.currentWords đang hiển thị
function saveWordEdit(deckId, wordId_, changedFields) {
  if (!App.editPatches[deckId]) App.editPatches[deckId] = {};
  App.editPatches[deckId][wordId_] = { ...App.editPatches[deckId][wordId_], ...changedFields };
  saveEditPatches();

  // Áp ngay vào dữ liệu đang dùng trong session, không cần tải lại trang
  const deck = App.decks.find((d) => d.id === deckId);
  if (deck) {
    deck.words = deck.words.map((w) => (w._id === wordId_ ? { ...w, ...changedFields } : w));
    if (App.currentDeckId === deckId) {
      App.currentWords = deck.words;
    }
  }
}

function clearAllEditPatches() {
  App.editPatches = {};
  localStorage.removeItem("n2vocab_editpatches");
}

/* ---------- Đánh dấu sao (kiểu Quizlet): { [deckId]: [itemId, ...] } ---------- */

function loadStarredItems() {
  try {
    const raw = localStorage.getItem("n2vocab_starred");
    App.starredItems = raw ? JSON.parse(raw) : {};
  } catch (e) {
    App.starredItems = {};
  }
}

function saveStarredItems() {
  localStorage.setItem("n2vocab_starred", JSON.stringify(App.starredItems));
}

function isStarred(deckId, itemId) {
  return !!(App.starredItems[deckId] && App.starredItems[deckId].includes(itemId));
}

function toggleStar(deckId, itemId) {
  if (!App.starredItems[deckId]) App.starredItems[deckId] = [];
  const list = App.starredItems[deckId];
  const idx = list.indexOf(itemId);
  if (idx === -1) {
    list.push(itemId);
  } else {
    list.splice(idx, 1);
  }
  saveStarredItems();
}

function getStarredIdsForDeck(deckId) {
  return App.starredItems[deckId] || [];
}


function savePeekConfig() {
  localStorage.setItem("n2vocab_peekcols", JSON.stringify(App.peekCols));
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
      decks.push({ id, title: data.title || filename, type, words });
    } catch (e) {
      console.error("Lỗi tải bộ", filename, e);
    }
  }
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
        exams.push({ id, title: data.title || filename, questions: data.questions || [] });
      } catch (e) {
        console.error("Lỗi tải đề thi", filename, e);
      }
    }
    return exams;
  } catch (e) {
    console.warn("Không có thư mục đề thi hoặc index.json lỗi", e);
    return [];
  }
}

function populateDeckPicker() {
  const picker = document.getElementById("deckPicker");
  picker.innerHTML = "";
  App.decks.forEach((d) => {
    const opt = document.createElement("option");
    opt.value = d.id;
    const typeLabel = d.type === "NGUPHAP" ? "Ngữ pháp" : "Từ vựng";
    opt.textContent = `[${typeLabel}] ${d.title} (${d.words.length})`;
    picker.appendChild(opt);
  });
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
  if (mode === "weakness") renderWeaknessMode();
  if (mode === "stats") renderStatsMode();
}

/* ===================================================================
   FIELD CONFIG PANEL (chọn field cho mặt trước / mặt sau flashcard)
=================================================================== */

function buildFieldConfigPanel() {
  const type = App.currentDeckType;
  const meta = FIELD_META[type];
  const config = App.fieldConfig[type];

  const frontDiv = document.getElementById("frontFieldOptions");
  const backDiv = document.getElementById("backFieldOptions");
  frontDiv.innerHTML = "";
  backDiv.innerHTML = "";

  Object.keys(meta).forEach((key) => {
    // Mặt trước: chọn 1 field duy nhất (radio)
    const frontLabel = document.createElement("label");
    const frontRadio = document.createElement("input");
    frontRadio.type = "radio";
    frontRadio.name = "frontField";
    frontRadio.value = key;
    frontRadio.checked = config.front.includes(key);
    frontRadio.addEventListener("change", () => {
      App.fieldConfig[type].front = [key];
      saveFieldConfig();
      renderFlashCard();
      renderSrsCard();
    });
    frontLabel.appendChild(frontRadio);
    frontLabel.appendChild(document.createTextNode(meta[key].label));
    frontDiv.appendChild(frontLabel);

    // Mặt sau: chọn nhiều (checkbox)
    const backLabel = document.createElement("label");
    const backCheck = document.createElement("input");
    backCheck.type = "checkbox";
    backCheck.value = key;
    backCheck.checked = config.back.includes(key);
    backCheck.addEventListener("change", () => {
      const cur = new Set(App.fieldConfig[type].back);
      if (backCheck.checked) cur.add(key); else cur.delete(key);
      App.fieldConfig[type].back = Array.from(cur);
      saveFieldConfig();
      renderFlashCard();
      renderSrsCard();
    });
    backLabel.appendChild(backCheck);
    backLabel.appendChild(document.createTextNode(meta[key].label));
    backDiv.appendChild(backLabel);
  });
}

function buildColConfigPanel() {
  const type = App.currentDeckType;
  const meta = TABLE_COL_META[type];
  const visible = App.visibleCols[type];
  const peeking = App.peekCols[type];

  const colDiv = document.getElementById("colOptions");
  colDiv.innerHTML = "";

  Object.keys(meta).forEach((key) => {
    const row = document.createElement("div");
    row.className = "col-config-row";

    // Checkbox: hiện / ẩn hẳn cột này khỏi bảng
    const nameLabel = document.createElement("label");
    nameLabel.className = "col-name";
    const check = document.createElement("input");
    check.type = "checkbox";
    check.checked = visible.includes(key);
    check.addEventListener("change", () => {
      const cur = new Set(App.visibleCols[type]);
      if (check.checked) cur.add(key); else cur.delete(key);
      App.visibleCols[type] = Array.from(cur);
      saveColConfig();
      renderTable();
    });
    nameLabel.appendChild(check);
    nameLabel.appendChild(document.createTextNode(meta[key].label));
    row.appendChild(nameLabel);

    // Switch riêng: "ẩn để tự kiểm tra" (chỉ cho cột canPeek=true)
    if (meta[key].canPeek) {
      const switchWrap = document.createElement("label");
      switchWrap.className = "mini-switch";
      const peekInput = document.createElement("input");
      peekInput.type = "checkbox";
      peekInput.checked = peeking.includes(key);
      peekInput.addEventListener("change", () => {
        const cur = new Set(App.peekCols[type]);
        if (peekInput.checked) cur.add(key); else cur.delete(key);
        App.peekCols[type] = Array.from(cur);
        savePeekConfig();
        renderTable();
      });
      const track = document.createElement("span");
      track.className = "mini-switch-track";
      switchWrap.appendChild(peekInput);
      switchWrap.appendChild(track);

      const peekLabelText = document.createElement("span");
      peekLabelText.className = "col-config-peek-label";
      peekLabelText.textContent = "ẩn để tự kiểm tra";

      const peekGroup = document.createElement("div");
      peekGroup.style.display = "flex";
      peekGroup.style.alignItems = "center";
      peekGroup.style.gap = "6px";
      peekGroup.appendChild(peekLabelText);
      peekGroup.appendChild(switchWrap);
      row.appendChild(peekGroup);
    }

    colDiv.appendChild(row);
  });
}

function renderCardFace(containerEl, word, fieldKeys) {
  const type = App.currentDeckType;
  const meta = FIELD_META[type];
  const html = fieldKeys
    .map((key) => (meta[key] ? meta[key].render(word) : ""))
    .filter(Boolean)
    .join("");
  containerEl.innerHTML = html || '<div class="cf-nghia">(chưa chọn field hiển thị)</div>';
}

/* ===================================================================
   EDIT MODAL — sửa tạm 1 từ/cấu trúc, áp đè ngay + lưu vào editPatches
=================================================================== */

let editModalCurrentWordId = null;

function openEditModal(wordId_) {
  const w = App.currentWords.find((cw) => cw._id === wordId_);
  if (!w) return;
  editModalCurrentWordId = wordId_;

  const type = App.currentDeckType;
  const fields = EDIT_FIELD_META[type];
  const body = document.getElementById("editModalBody");
  body.innerHTML = "";

  fields.forEach((f) => {
    const wrap = document.createElement("div");
    wrap.className = "edit-field-row";

    const label = document.createElement("label");
    label.className = "edit-field-label";
    label.textContent = f.label;
    wrap.appendChild(label);

    if (f.type === "text") {
      const input = document.createElement("input");
      input.type = "text";
      input.className = "edit-field-input";
      input.dataset.fieldKey = f.key;
      input.value = w[f.key] || "";
      wrap.appendChild(input);
    } else if (f.type === "textarea") {
      const textarea = document.createElement("textarea");
      textarea.className = "edit-field-input edit-field-textarea";
      textarea.dataset.fieldKey = f.key;
      textarea.value = w[f.key] || "";
      wrap.appendChild(textarea);
    } else if (f.type === "list") {
      const input = document.createElement("input");
      input.type = "text";
      input.className = "edit-field-input";
      input.dataset.fieldKey = f.key;
      input.dataset.fieldType = "list";
      input.value = (w[f.key] || []).join(", ");
      wrap.appendChild(input);
    } else if (f.type === "choon-editor") {
      const input = document.createElement("input");
      input.type = "text";
      input.className = "edit-field-input choon-input";
      input.dataset.fieldKey = f.key;
      input.value = w[f.key] || w.doc || "";
      wrap.appendChild(input);

      const choonBtnRow = document.createElement("div");
      choonBtnRow.className = "choon-btn-row";

      const markBtn = document.createElement("button");
      markBtn.type = "button";
      markBtn.className = "ghost-btn choon-mark-btn";
      markBtn.textContent = "Đánh dấu trường âm (đỏ)";
      markBtn.addEventListener("click", () => applyChoonMark(input));
      choonBtnRow.appendChild(markBtn);

      const clearBtn = document.createElement("button");
      clearBtn.type = "button";
      clearBtn.className = "ghost-btn choon-clear-btn";
      clearBtn.textContent = "Xóa hết đánh dấu";
      clearBtn.addEventListener("click", () => {
        input.value = stripChoonMarks(input.value);
      });
      choonBtnRow.appendChild(clearBtn);

      wrap.appendChild(choonBtnRow);

      const preview = document.createElement("div");
      preview.className = "choon-preview";
      preview.id = "choonPreview";
      wrap.appendChild(preview);

      const updatePreview = () => {
        preview.innerHTML = "Xem trước: " + renderChoon(input.value);
      };
      input.addEventListener("input", updatePreview);
      updatePreview();
    } else if (f.type === "ruby-editor") {
      const textarea = document.createElement("textarea");
      textarea.className = "edit-field-input edit-field-textarea";
      textarea.dataset.fieldKey = f.key;
      textarea.value = w[f.key] || "";
      wrap.appendChild(textarea);

      const rubyBtnRow = document.createElement("div");
      rubyBtnRow.className = "choon-btn-row";

      const rubyBtn = document.createElement("button");
      rubyBtn.type = "button";
      rubyBtn.className = "ghost-btn choon-mark-btn";
      rubyBtn.textContent = "Thêm furigana cho đoạn bôi đen";
      rubyBtn.addEventListener("click", () => applyRubyTag(textarea));
      rubyBtnRow.appendChild(rubyBtn);

      wrap.appendChild(rubyBtnRow);

      const hint = document.createElement("div");
      hint.className = "ruby-hint";
      hint.textContent = "Bôi đen 1 kanji hoặc cụm kanji trong câu, bấm nút trên, nhập cách đọc khi được hỏi.";
      wrap.appendChild(hint);
    }

    body.appendChild(wrap);
  });

  document.getElementById("editModalOverlay").classList.remove("hidden");
}

// Bọc đoạn text đang bôi đen (selection) trong <ruby>...<rt>...</rt></ruby>,
// dùng để thêm furigana cho TỪNG kanji riêng lẻ trong câu ví dụ (không chỉ từ
// chính đang học) — vì cách đọc của 1 kanji phụ thuộc ngữ cảnh nên không thể
// tự động đoán đúng 100%, cần người học tự xác nhận cách đọc khi thêm.
function applyRubyTag(textarea) {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  if (start === end) {
    alert("Hãy bôi đen (chọn) đoạn kanji cần thêm furigana trước.");
    return;
  }
  const value = textarea.value;
  const selected = value.slice(start, end);
  const reading = prompt(`Nhập cách đọc (hiragana) cho "${selected}":`, "");
  if (!reading) return;
  const newValue = value.slice(0, start) + `<ruby>${selected}<rt>${reading}</rt></ruby>` + value.slice(end);
  textarea.value = newValue;
}

// Bọc phần text đang được bôi đen (selection) trong ô input bằng **...** để đánh dấu trường âm
function applyChoonMark(input) {
  const start = input.selectionStart;
  const end = input.selectionEnd;
  if (start === end) {
    alert("Hãy bôi đen (chọn) đoạn ký tự cần đánh dấu trường âm trước.");
    return;
  }
  const value = input.value;
  const selected = value.slice(start, end);
  const newValue = value.slice(0, start) + "**" + selected + "**" + value.slice(end);
  input.value = newValue;
  input.dispatchEvent(new Event("input"));
  // Đặt lại con trỏ sau đoạn vừa đánh dấu
  const newPos = end + 4;
  input.setSelectionRange(newPos, newPos);
  input.focus();
}

function closeEditModal() {
  document.getElementById("editModalOverlay").classList.add("hidden");
  editModalCurrentWordId = null;
}

function saveEditModal() {
  if (!editModalCurrentWordId) return;
  const body = document.getElementById("editModalBody");
  const changed = {};

  body.querySelectorAll("[data-field-key]").forEach((el) => {
    const key = el.dataset.fieldKey;
    if (el.dataset.fieldType === "list") {
      changed[key] = el.value.split(",").map((s) => s.trim()).filter(Boolean);
    } else {
      changed[key] = el.value;
    }
  });

  // Nếu sửa doc_marked, đồng bộ luôn doc (raw, bỏ dấu **) để gõ chữ vẫn so khớp đúng
  if (changed.doc_marked !== undefined) {
    changed.doc = stripChoonMarks(changed.doc_marked);
  }

  saveWordEdit(App.currentDeckId, editModalCurrentWordId, changed);

  closeEditModal();
  renderFlashCard();
  renderTable();
  renderSrsCard();
}

/* ===================================================================
   FLASHCARD MODE — kiểu Quizlet: hàng đợi xoay vòng trong 1 phiên học.
   3 nút: Chưa nhớ (quay lại sớm, ~3 thẻ sau) / Khó (quay lại muộn hơn,
   ~7 thẻ sau) / Đã nhớ (ra khỏi hàng đợi). Học hết hàng đợi -> màn hình
   hoàn thành, gợi ý học lại toàn bộ hoặc chỉ học các từ đã ★.
   Đây KHÔNG đụng đến lịch SRS theo phút/giờ (đó là việc của mode SRS).
=================================================================== */

const FLASHCARD_REINSERT_NOT_REMEMBERED = 3; // "Chưa nhớ" -> chèn lại sau ~3 thẻ
const FLASHCARD_REINSERT_HARD = 7;            // "Khó" -> chèn lại sau ~7 thẻ (muộn hơn)

function initFlashMode(restrictToIds) {
  let pool;
  if (restrictToIds && restrictToIds.length) {
    pool = App.currentWords.filter((w) => restrictToIds.includes(w._id));
  } else {
    pool = App.currentWords;
  }
  const ids = pool.map((w) => w._id);
  App.flashQueue = App.shuffleEnabled.flash ? shuffle(ids) : ids;
  App.flashRememberedCount = 0;
  App.flashTotalCount = App.flashQueue.length;
  App.flashRestrictToIds = restrictToIds || null;

  document.getElementById("flashResultScreen").classList.add("hidden");
  document.getElementById("flashLearnArea").classList.remove("hidden");

  renderFlashCard();
}

function getCurrentFlashWord() {
  if (!App.flashQueue.length) return null;
  const itemId = App.flashQueue[0];
  return App.currentWords.find((w) => w._id === itemId) || null;
}

// Lật thẻ Flashcard. Khi lật SANG mặt sau (xem đáp án), tự phát âm cách đọc
// thật của từ đang học (nếu bật phát âm) — đây là thời điểm hợp lý nhất để
// đọc, vì người học vừa xem đáp án và muốn nghe cách đọc đúng ngay lúc đó.
function flipFlashCard() {
  const card = document.getElementById("flashCard");
  card.classList.toggle("flipped");
  if (card.classList.contains("flipped")) {
    speakWord(getCurrentFlashWord());
  }
}

function renderFlashCard() {
  const card = document.getElementById("flashCard");
  card.classList.remove("flipped");

  if (App.flashQueue.length === 0) {
    showFlashCompletionScreen();
    return;
  }

  const w = getCurrentFlashWord();
  if (!w) {
    // Trường hợp hiếm: itemId không tìm thấy (ví dụ đã bị xóa khỏi bộ) -> bỏ qua
    App.flashQueue.shift();
    renderFlashCard();
    return;
  }
  const type = App.currentDeckType;

  renderCardFace(document.getElementById("flashFrontContent"), w, App.fieldConfig[type].front);
  renderCardFace(document.getElementById("flashBackContent"), w, App.fieldConfig[type].back);
  renderFlashStarButtons(w);

  // Thẻ X/Y (số thứ tự trong hàng đợi hiện tại, bao gồm cả từ chưa nhớ đang chờ)
  const queuePos = App.flashTotalCount - App.flashQueue.length + 1;
  document.getElementById("flashQueuePos").textContent = queuePos;
  document.getElementById("flashQueueTotal").textContent = App.flashTotalCount;
  // Đã nhớ A/B (số từ thực sự đã hoàn thành / tổng số từ ban đầu)
  document.getElementById("flashPos").textContent = App.flashRememberedCount;
  document.getElementById("flashTotal").textContent = App.flashTotalCount;
  const pct = (App.flashRememberedCount / App.flashTotalCount) * 100;
  document.getElementById("flashBar").style.width = `${pct}%`;
}

function renderFlashStarButtons(w) {
  const starred = isStarred(App.currentDeckId, w._id);
  document.querySelectorAll(".flash-star-btn").forEach((btn) => {
    btn.classList.toggle("is-starred", starred);
    btn.textContent = starred ? "★" : "☆";
  });
}

// Chèn lại 1 itemId vào hàng đợi, cách vị trí đầu (đã shift ra) khoảng `offset` thẻ.
// Nếu hàng đợi còn lại ngắn hơn offset, chèn xuống cuối.
function reinsertIntoFlashQueue(itemId, offset) {
  const insertPos = Math.min(offset, App.flashQueue.length);
  App.flashQueue.splice(insertPos, 0, itemId);
}

function flashMarkResult(result) {
  // result: "not_remembered" | "hard" | "remembered"
  if (!App.flashQueue.length) return;
  const itemId = App.flashQueue.shift();

  if (result === "remembered") {
    // Chỉ cập nhật SRS khi từ thực sự "tốt nghiệp" khỏi hàng đợi phiên này, để
    // tránh gọi SRS.rate() nhiều lần liên tiếp trong vài giây (do hàng đợi xoay
    // vòng) làm nhiễu ease factor — SRS chỉ nên phản ánh đánh giá sau cùng.
    SRS.rate(App.progress, itemId, "easy");
    SRS.saveProgress(App.currentDeckId, App.progress);
    recordWeaknessResult(App.currentDeckId, itemId, true);
    App.flashRememberedCount++;
  } else if (result === "not_remembered") {
    recordWeaknessResult(App.currentDeckId, itemId, false);
    reinsertIntoFlashQueue(itemId, FLASHCARD_REINSERT_NOT_REMEMBERED);
  } else if (result === "hard") {
    recordWeaknessResult(App.currentDeckId, itemId, false);
    reinsertIntoFlashQueue(itemId, FLASHCARD_REINSERT_HARD);
  }

  renderFlashCard();
}

function showFlashCompletionScreen() {
  document.getElementById("flashLearnArea").classList.add("hidden");
  const screen = document.getElementById("flashResultScreen");
  screen.classList.remove("hidden");

  document.getElementById("flashCompletionCount").textContent = App.flashTotalCount;

  const starredCount = getStarredIdsForDeck(App.currentDeckId).length;
  const btnStarredOnly = document.getElementById("btnFlashRestartStarredOnly");
  if (starredCount > 0) {
    btnStarredOnly.classList.remove("hidden");
    btnStarredOnly.textContent = `Chỉ học các từ đã ★ đánh dấu (${starredCount})`;
  } else {
    btnStarredOnly.classList.add("hidden");
  }
}

// Cập nhật trạng thái nút toggle "★ Học/Ôn từ đã sao" — dùng chung cho mọi nơi
// kích hoạt/tắt chế độ này (không chỉ nút bấm trực tiếp), để class CSS và text
// trên nút luôn đồng bộ đúng với trạng thái thật.
function setFlashStarOnlyState(active) {
  const btn = document.getElementById("btnFlashStarOnly");
  btn.classList.toggle("is-active", active);
  btn.textContent = active ? "★ Đang học từ đã sao (bấm để tắt)" : "★ Học từ đã sao";
}

function setSrsStarOnlyState(active) {
  const btn = document.getElementById("btnSrsStarOnly");
  btn.classList.toggle("is-active", active);
  btn.textContent = active ? "★ Đang ôn từ đã sao (bấm để tắt)" : "★ Ôn từ đã sao";
}

function flashRestartFull() {
  // "Học lại toàn bộ" phải luôn học hết bộ, không giữ giới hạn ★ của phiên trước
  setFlashStarOnlyState(false);
  initFlashMode(null);
}

function flashRestartStarredOnly() {
  const starredIds = getStarredIdsForDeck(App.currentDeckId);
  setFlashStarOnlyState(true);
  initFlashMode(starredIds);
}

/* ===================================================================
   TABLE MODE
=================================================================== */

function renderTable() {
  const type = App.currentDeckType;
  const meta = TABLE_COL_META[type];
  const cols = App.visibleCols[type].filter((c) => meta[c]);

  const thead = document.getElementById("tableHead");
  thead.innerHTML = `<tr><th class="col-star-head"></th>${cols.map((c) => `<th>${meta[c].label}</th>`).join("")}<th class="col-edit-head"></th></tr>`;

  const tbody = document.getElementById("tableBody");
  const search = (document.getElementById("tableSearch").value || "").toLowerCase();
  const filter = document.getElementById("tableFilter").value;
  const starredIds = getStarredIdsForDeck(App.currentDeckId);

  tbody.innerHTML = "";

  App.currentWords.forEach((w) => {
    const entry = SRS.getEntry(App.progress, w._id);
    const st = SRS.status(entry);
    const starred = starredIds.includes(w._id);

    if (filter === "starred") {
      if (!starred) return;
    } else if (filter !== "all" && st !== filter) {
      return;
    }

    const searchKeys = type === "NGUPHAP"
      ? [w.cautruc, w.nghia, w.muc_do]
      : [w.kanji, w.doc, w.han_viet, w.nghia];
    const haystack = searchKeys.join(" ").toLowerCase();
    if (search && !haystack.includes(search)) return;

    const tr = document.createElement("tr");
    const starCell = `<td class="col-star-cell"><button class="table-star-btn ${starred ? "is-starred" : ""}" data-star-word-id="${w._id}" title="Đánh dấu sao">${starred ? "★" : "☆"}</button></td>`;
    const cells = cols.map((col) => {
      if (col === "status") {
        const statusLabel = { new: "Chưa học", learning: "Đang học", known: "Đã thuộc" }[st];
        return `<td><span class="status-pill status-${st}">${statusLabel}</span></td>`;
      }
      const colMeta = meta[col];
      let raw = w[col] || "";
      if (col === "doc") raw = renderChoon(w.doc_marked || w.doc);
      if (col === "vi_du") raw = renderExampleSentences(w.vi_du_ruby || w.vi_du);
      if (col === "dong_nghia" || col === "trai_nghia") {
        raw = w[col] && w[col].length ? renderSynonymList(w[col]) : "";
      }
      const cssClass = col === "kanji" || col === "cautruc" ? "cell-kanji" : (col === "vi_du" ? "cell-vidu" : "");
      const isPeeking = colMeta.canPeek && App.peekCols[type].includes(col);

      if (isPeeking) {
        return `<td>
          <span class="cell-peek-wrap is-peeking">
            <span class="cell-real-content ${cssClass}">${raw}</span>
            <span class="peek-overlay"><span class="peek-dots">• • •</span></span>
          </span>
        </td>`;
      }
      return `<td class="${cssClass}">${raw}</td>`;
    });
    cells.unshift(starCell);
    cells.push(`<td class="col-edit-cell"><button class="table-edit-btn" data-edit-word-id="${w._id}" title="Sửa">✎</button></td>`);
    tr.innerHTML = cells.join("");
    tbody.appendChild(tr);
  });

  document.querySelectorAll(".table-edit-btn").forEach((btn) => {
    btn.addEventListener("click", () => openEditModal(btn.dataset.editWordId));
  });
  document.querySelectorAll(".table-star-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      toggleStar(App.currentDeckId, btn.dataset.starWordId);
      renderTable();
    });
  });

  SRS.saveProgress(App.currentDeckId, App.progress);
}

/* ===================================================================
   SRS REVIEW MODE
=================================================================== */

function initSrsMode(restrictToIds) {
  const wordPool = restrictToIds && restrictToIds.length
    ? App.currentWords.filter((w) => restrictToIds.includes(w._id))
    : App.currentWords;

  const due = [];
  const newWords = [];
  let mastered = 0;

  wordPool.forEach((w) => {
    const entry = SRS.getEntry(App.progress, w._id);
    const st = SRS.status(entry);
    if (st === "known") mastered++;
    if (!entry.seen) {
      newWords.push(w);
    } else if (SRS.isDue(entry)) {
      due.push(w);
    }
  });

  document.getElementById("srsDueCount").textContent = due.length;
  document.getElementById("srsNewCount").textContent = newWords.length;
  document.getElementById("srsMasteredCount").textContent = mastered;

  const shuffleOn = App.shuffleEnabled.srs;
  const orderedNew = shuffleOn ? shuffle(newWords) : newWords;
  const orderedDue = shuffleOn ? shuffle(due) : due;
  const newSlice = orderedNew.slice(0, 10);
  App.srsQueue = orderedDue.concat(newSlice);
  App.srsIndex = 0;

  SRS.saveProgress(App.currentDeckId, App.progress);

  const empty = document.getElementById("srsEmpty");
  const stage = document.getElementById("srsStage");
  const rateRow = document.getElementById("srsRateRow");

  if (App.srsQueue.length === 0) {
    empty.classList.remove("hidden");
    stage.classList.add("hidden");
    rateRow.classList.add("hidden");
  } else {
    empty.classList.add("hidden");
    stage.classList.remove("hidden");
    rateRow.classList.remove("hidden");
    renderSrsCard();
  }
}

function renderSrsCard() {
  const card = document.getElementById("srsCard");
  card.classList.remove("flipped");
  const w = App.srsQueue[App.srsIndex];
  if (!w) return;
  const type = App.currentDeckType;

  renderCardFace(document.getElementById("srsFront"), w, App.fieldConfig[type].front);
  renderCardFace(document.getElementById("srsBack"), w, App.fieldConfig[type].back);

  updateSrsRateTimePreviews(w);
}

function flipSrsCard() {
  const card = document.getElementById("srsCard");
  card.classList.toggle("flipped");
  if (card.classList.contains("flipped")) {
    speakWord(App.srsQueue[App.srsIndex]);
  }
}

function updateSrsRateTimePreviews(w) {
  if (!w) return;
  document.getElementById("rtAgainSrs").textContent = SRS.previewLabel(App.progress, w._id, "again");
  document.getElementById("rtHardSrs").textContent = SRS.previewLabel(App.progress, w._id, "hard");
  document.getElementById("rtEasySrs").textContent = SRS.previewLabel(App.progress, w._id, "easy");
}

function rateCurrentSrsWord(rating) {
  const w = App.srsQueue[App.srsIndex];
  if (!w) return;
  SRS.rate(App.progress, w._id, rating);
  SRS.saveProgress(App.currentDeckId, App.progress);

  // Ghi nhận vào thống kê điểm yếu chung: "Quên" = sai, "Khó"/"Dễ" = đúng
  // (đã nhớ được, chỉ khác mức độ dễ/khó khi nhớ lại).
  recordWeaknessResult(App.currentDeckId, w._id, rating !== "again");

  App.srsIndex++;
  if (App.srsIndex >= App.srsQueue.length) {
    initSrsMode();
  } else {
    renderSrsCard();
  }
}

/* ===================================================================
   TYPING MODE — gõ tự luận: nhìn kanji + nghĩa, KHÔNG hiện khung target.
   Người học tự nhớ và gõ ra cách đọc hiragana, kiểm tra toàn bộ khi bấm
   "Kiểm tra". Có nút "Gợi ý" (hiện thêm 1 ký tự tiếp theo) và "Xem đáp án"
   (hiện full, tính là chưa nhớ -> xếp ôn lại theo SRS).
=================================================================== */

function initTypingMode() {
  // Chỉ áp dụng cho TUVUNG (ngữ pháp không có khái niệm "đọc kanji")
  const pool = App.currentWords.filter((w) => w.kanji && w.doc);
  App.typingPool = pool;
  App.typingOrder = shuffle(pool.map((_, i) => i));
  App.typingIndex = 0;
  App.typingScore = 0;
  App.typingRevealedCount = 0; // số ký tự đã "gợi ý" lộ ra cho từ hiện tại
  App.typingAnswered = false;  // đã kiểm tra/xem đáp án cho từ hiện tại chưa
  document.getElementById("typingScore").textContent = "0";
  document.getElementById("typingTotal").textContent = App.typingOrder.length;
  renderTypingCard();
}

function renderTypingCard() {
  if (App.typingIndex >= App.typingOrder.length) {
    document.getElementById("typingKanji").textContent = "🎉";
    document.getElementById("typingNghia").textContent = `Hoàn thành! Đúng ${App.typingScore}/${App.typingOrder.length}`;
    document.getElementById("typingRevealRow").innerHTML = "";
    document.getElementById("typingResultLine").textContent = "";
    document.getElementById("typingActionRow").classList.add("hidden");
    document.getElementById("typingFreeInput").classList.add("hidden");
    return;
  }
  const pool = App.typingPool;
  const w = pool[App.typingOrder[App.typingIndex]];

  App.typingCurrentTarget = stripChoonMarks(w.doc); // raw hiragana cần nhớ và gõ ra
  App.typingCurrentWord = w;
  App.typingRevealedCount = 0;
  App.typingAnswered = false;

  document.getElementById("typingKanji").textContent = w.kanji;
  document.getElementById("typingNghia").textContent = w.nghia;
  document.getElementById("typingPos").textContent = App.typingIndex + 1;
  const pct = (App.typingIndex / App.typingOrder.length) * 100;
  document.getElementById("typingBar").style.width = `${pct}%`;
  document.getElementById("typingFreeInput").classList.remove("hidden");
  document.getElementById("typingActionRow").classList.remove("hidden");
  document.getElementById("typingResultLine").textContent = "";
  document.getElementById("typingResultLine").className = "typing-result-line";

  const input = document.getElementById("typingFreeInput");
  input.value = "";
  input.disabled = false;
  input.focus();
  renderTypingRevealRow();
}

// Hiện dòng gợi ý phía dưới (chỉ hiện số ký tự đã được "Gợi ý" mở khoá, còn lại là dấu chấm)
function renderTypingRevealRow() {
  const target = App.typingCurrentTarget;
  const revealed = App.typingRevealedCount;
  let html = "";
  for (let i = 0; i < target.length; i++) {
    if (i < revealed) {
      html += `<span class="typing-reveal-char">${target[i]}</span>`;
    } else {
      html += `<span class="typing-reveal-dot">•</span>`;
    }
  }
  document.getElementById("typingRevealRow").innerHTML = html;
}

function typingShowHint() {
  if (App.typingAnswered) return;
  if (App.typingRevealedCount < App.typingCurrentTarget.length) {
    App.typingRevealedCount++;
    renderTypingRevealRow();
  }
}

function typingShowAnswer() {
  if (App.typingAnswered) return;
  App.typingAnswered = true;
  const w = App.typingCurrentWord;
  const target = App.typingCurrentTarget;

  document.getElementById("typingFreeInput").disabled = true;
  App.typingRevealedCount = target.length;
  renderTypingRevealRow();

  const resultLine = document.getElementById("typingResultLine");
  resultLine.textContent = `Đáp án: ${target}`;
  resultLine.className = "typing-result-line is-wrong";

  // Xem đáp án = coi như chưa nhớ được, xếp ôn lại sớm hơn
  SRS.rate(App.progress, w._id, "again");
  SRS.saveProgress(App.currentDeckId, App.progress);
  recordWeaknessResult(App.currentDeckId, w._id, false);

  setTimeout(() => {
    App.typingIndex++;
    renderTypingCard();
  }, 1400);
}

function typingCheckAnswer() {
  if (App.typingAnswered) return;
  const rawValue = document.getElementById("typingFreeInput").value.trim();
  const target = App.typingCurrentTarget;
  const w = App.typingCurrentWord;
  const resultLine = document.getElementById("typingResultLine");

  App.typingAnswered = true;
  document.getElementById("typingFreeInput").disabled = true;
  App.typingRevealedCount = target.length;
  renderTypingRevealRow();

  if (rawValue === target) {
    resultLine.textContent = "Chính xác!";
    resultLine.className = "typing-result-line is-correct";
    App.typingScore++;
    document.getElementById("typingScore").textContent = App.typingScore;
    SRS.rate(App.progress, w._id, "easy");
    playCorrectSound();
    recordWeaknessResult(App.currentDeckId, w._id, true);
  } else {
    resultLine.textContent = `Chưa đúng. Đáp án: ${target}`;
    resultLine.className = "typing-result-line is-wrong";
    SRS.rate(App.progress, w._id, "again");
    playWrongSound();
    recordWeaknessResult(App.currentDeckId, w._id, false);
  }
  SRS.saveProgress(App.currentDeckId, App.progress);

  setTimeout(() => {
    App.typingIndex++;
    renderTypingCard();
  }, 1200);
}

function typingHandleKeydown(e) {
  if (e.key === "Enter") {
    e.preventDefault();
    typingCheckAnswer();
  }
}
/* ===================================================================
   QUIZ MODE — trắc nghiệm ý nghĩa (TUVUNG: kanji->nghĩa; NGUPHAP: cấu trúc->ý nghĩa)
=================================================================== */

function getQuizPromptAndAnswer(w) {
  const type = App.currentDeckType;
  if (type === "NGUPHAP") {
    return { prompt: w.cautruc, answer: w.nghia };
  }
  return { prompt: w.kanji, answer: w.nghia };
}

function buildQuizQuestions() {
  const pool = App.currentWords;
  const qs = shuffle(pool).map((w) => {
    const wrongPool = shuffle(pool.filter((x) => x._id !== w._id)).slice(0, 3);
    const options = shuffle([w, ...wrongPool]);
    return { word: w, options };
  });
  return qs;
}

function initQuizMode() {
  App.quizQuestions = buildQuizQuestions();
  App.quizIndex = 0;
  App.quizScore = 0;
  App.quizStartTime = Date.now();

  document.getElementById("quizResult").classList.add("hidden");
  document.getElementById("quizBody").classList.remove("hidden");
  document.getElementById("quizTotal").textContent = App.quizQuestions.length;
  document.getElementById("quizScore").textContent = "0";

  if (App.quizTimerHandle) clearInterval(App.quizTimerHandle);
  App.quizTimerHandle = setInterval(() => {
    const sec = (Date.now() - App.quizStartTime) / 1000;
    document.getElementById("quizTimer").textContent = fmtTime(sec);
  }, 500);

  renderQuizQuestion();
}

function renderQuizQuestion() {
  App.quizAnswering = false;
  const q = App.quizQuestions[App.quizIndex];
  const { prompt } = getQuizPromptAndAnswer(q.word);
  document.getElementById("quizPos").textContent = App.quizIndex + 1;
  document.getElementById("quizQuestion").textContent = prompt;

  const optsDiv = document.getElementById("quizOptions");
  optsDiv.innerHTML = "";
  q.options.forEach((opt) => {
    const { answer } = getQuizPromptAndAnswer(opt);
    const btn = document.createElement("button");
    btn.className = "quiz-opt";
    btn.textContent = answer;
    btn.addEventListener("click", () => handleQuizAnswer(btn, opt, q));
    optsDiv.appendChild(btn);
  });
}

function handleQuizAnswer(btn, chosen, q) {
  if (App.quizAnswering) return; // chặn double-click vì giờ .disabled không còn pointer-events:none
  App.quizAnswering = true;

  document.querySelectorAll(".quiz-opt").forEach((b) => b.classList.add("disabled"));
  const correct = chosen._id === q.word._id;
  btn.classList.add(correct ? "correct" : "wrong");
  const { answer: correctAnswer } = getQuizPromptAndAnswer(q.word);

  if (correct) {
    App.quizScore++;
    document.getElementById("quizScore").textContent = App.quizScore;
    SRS.rate(App.progress, q.word._id, "easy");
    playCorrectSound();
    recordWeaknessResult(App.currentDeckId, q.word._id, true);
  } else {
    document.querySelectorAll(".quiz-opt").forEach((b) => {
      if (b.textContent === correctAnswer) b.classList.add("correct");
    });
    SRS.rate(App.progress, q.word._id, "again");
    playWrongSound();
    recordWeaknessResult(App.currentDeckId, q.word._id, false);
  }
  SRS.saveProgress(App.currentDeckId, App.progress);

  setTimeout(() => {
    App.quizIndex++;
    if (App.quizIndex >= App.quizQuestions.length) {
      finishQuiz();
    } else {
      renderQuizQuestion();
    }
  }, 750);
}

function finishQuiz() {
  clearInterval(App.quizTimerHandle);
  const totalSec = (Date.now() - App.quizStartTime) / 1000;
  document.getElementById("quizBody").classList.add("hidden");
  document.getElementById("quizResult").classList.remove("hidden");
  document.getElementById("quizFinalScore").textContent =
    `${App.quizScore}/${App.quizQuestions.length} đúng — thời gian ${fmtTime(totalSec)}`;
}

/* ===================================================================
   MATCH GAME MODE
=================================================================== */

function initMatchMode() {
  const PAIR_COUNT = Math.min(8, App.currentWords.length);
  const chosen = shuffle(App.currentWords).slice(0, PAIR_COUNT);

  App.matchTotalPairs = chosen.length;
  App.matchPairs = 0;
  App.matchSelected = [];
  App.matchLocked = false;
  App.matchStartTime = Date.now();

  document.getElementById("matchPairs").textContent = "0";
  document.getElementById("matchTotalPairs").textContent = chosen.length;

  if (App.matchTimerHandle) clearInterval(App.matchTimerHandle);
  App.matchTimerHandle = setInterval(() => {
    const sec = (Date.now() - App.matchStartTime) / 1000;
    document.getElementById("matchTimer").textContent = fmtTime(sec);
  }, 500);

  const cells = [];
  chosen.forEach((w) => {
    const { prompt, answer } = getQuizPromptAndAnswer(w);
    cells.push({ pairId: w._id, type: "prompt", label: prompt, word: w });
    cells.push({ pairId: w._id, type: "answer", label: answer, word: w });
  });
  const shuffled = shuffle(cells);

  const grid = document.getElementById("matchGrid");
  grid.innerHTML = "";
  shuffled.forEach((cell) => {
    const div = document.createElement("div");
    div.className = "match-card" + (cell.type === "prompt" ? " kanji-card" : "");
    div.textContent = cell.label;
    div.dataset.pairId = cell.pairId;
    div.addEventListener("click", () => handleMatchClick(div, cell));
    grid.appendChild(div);
  });
}

function handleMatchClick(div, cell) {
  if (App.matchLocked) return;
  if (div.classList.contains("matched") || div.classList.contains("flipped-sel")) return;

  div.classList.add("flipped-sel");
  App.matchSelected.push({ div, cell });

  if (App.matchSelected.length === 2) {
    App.matchLocked = true;
    const [a, b] = App.matchSelected;
    const isMatch = a.cell.pairId === b.cell.pairId && a.cell.type !== b.cell.type;

    if (isMatch) {
      playCorrectSound();
      setTimeout(() => {
        a.div.classList.remove("flipped-sel");
        b.div.classList.remove("flipped-sel");
        a.div.classList.add("matched");
        b.div.classList.add("matched");
        App.matchPairs++;
        document.getElementById("matchPairs").textContent = App.matchPairs;
        SRS.rate(App.progress, a.cell.word._id, "easy");
        SRS.saveProgress(App.currentDeckId, App.progress);
        recordWeaknessResult(App.currentDeckId, a.cell.word._id, true);
        App.matchSelected = [];
        App.matchLocked = false;
        if (App.matchPairs >= App.matchTotalPairs) {
          clearInterval(App.matchTimerHandle);
        }
      }, 350);
    } else {
      playWrongSound();
      a.div.classList.add("wrong-flash");
      b.div.classList.add("wrong-flash");
      setTimeout(() => {
        a.div.classList.remove("flipped-sel", "wrong-flash");
        b.div.classList.remove("flipped-sel", "wrong-flash");
        App.matchSelected = [];
        App.matchLocked = false;
      }, 650);
    }
  }
}

/* ===================================================================
   EXAM MODE — làm đề thi trắc nghiệm thật
   - Random thứ tự đáp án mỗi lần hiện câu (tránh học vị trí đáp án)
   - Câu sai bị đẩy xuống cuối hàng đợi, làm lại đến khi đúng
   - Tính điểm: 1 câu đúng (lần đầu) = 1 điểm, không cộng điểm khi làm lại câu sai
=================================================================== */

function renderExamPickerState() {
  const empty = document.getElementById("examEmpty");
  const body = document.getElementById("examBody");
  const result = document.getElementById("examResult");

  if (!App.currentExamId) {
    empty.classList.remove("hidden");
    body.classList.add("hidden");
    result.classList.add("hidden");
    document.getElementById("examTitleLabel").textContent = "Chưa chọn đề";
    return;
  }
  empty.classList.add("hidden");

  // Nếu đang giữa 1 đề thi (chưa hoàn thành) và speed mode đang bật, đếm lại
  // timer cho câu hiện tại (không ảnh hưởng điểm số, chỉ làm mới đồng hồ hiển thị)
  const isMidExam = !body.classList.contains("hidden") && App.examQueue.length > 0;
  if (isMidExam && App.examSpeedMode) {
    startExamPerQuestionTimer();
    startExamTotalTimer();
  }
}

function startExam(examId) {
  const exam = App.exams.find((e) => e.id === examId);
  if (!exam) return;

  App.currentExamId = examId;
  App.examOriginalTotal = exam.questions.length;
  App.examQueue = exam.questions.map((_, i) => i); // hàng đợi chứa index câu hỏi gốc
  App.examScore = 0;
  App.examAnswered = new Set();
  App.examHistory = {};
  App.examSeenOrder = [];
  App.examNavPos = -1;
  App.examReviewMode = false;
  App.examQuestionTimeLog = [];

  App.examSpeedMode = document.getElementById("examSpeedMode").checked;
  App.examTotalStartTime = null;
  App.examFirstPassStartTime = null;
  App.examFirstPassEndTime = null;
  App.examFirstPassDone = false;
  App.examRetryStartTime = null;

  document.getElementById("examTitleLabel").textContent = exam.title;
  document.getElementById("examScore").textContent = "0";
  document.getElementById("examTotal").textContent = exam.questions.length;
  document.getElementById("examResult").classList.add("hidden");
  document.getElementById("examBody").classList.remove("hidden");
  document.getElementById("examEmpty").classList.add("hidden");

  startExamTotalTimer();
  renderExamQuestion();
}

function startExamTotalTimer() {
  clearInterval(App.examTotalTimerHandle);
  const wrap = document.getElementById("examTotalTimerWrap");
  if (!App.examSpeedMode) {
    wrap.classList.add("hidden");
    return;
  }
  wrap.classList.remove("hidden");
  // Chỉ đặt mốc bắt đầu nếu chưa có (tránh reset về 0 khi rời rồi quay lại giữa đề)
  if (!App.examTotalStartTime) {
    App.examTotalStartTime = Date.now();
  }
  App.examTotalTimerHandle = setInterval(() => {
    const sec = (Date.now() - App.examTotalStartTime) / 1000;
    document.getElementById("examTotalTimer").textContent = fmtTime(sec);
  }, 500);
}

function startExamPerQuestionTimer() {
  clearInterval(App.examPerQTimerHandle);
  const wrap = document.getElementById("examPerQuestionTimerWrap");
  const timerEl = document.getElementById("examPerQuestionTimer");

  if (!App.examSpeedMode || App.examReviewMode) {
    wrap.classList.add("hidden");
    return;
  }
  wrap.classList.remove("hidden");
  App.examPerQSecondsLeft = 30;
  App.examPerQStartedAt = Date.now();
  timerEl.textContent = "30";
  wrap.classList.remove("is-warning", "is-overtime");

  App.examPerQTimerHandle = setInterval(() => {
    App.examPerQSecondsLeft--;
    if (App.examPerQSecondsLeft >= 0) {
      timerEl.textContent = App.examPerQSecondsLeft;
    } else {
      // Quá 30s: vẫn cho làm tiếp, hiển thị số giây đã vượt quá dạng "+N"
      timerEl.textContent = `+${Math.abs(App.examPerQSecondsLeft)}`;
      wrap.classList.add("is-overtime");
    }
    if (App.examPerQSecondsLeft <= 10 && App.examPerQSecondsLeft > 0) {
      wrap.classList.add("is-warning");
    }
  }, 1000);
}

// Bật/tắt luyện tốc độ NGAY LẬP TỨC mà không cần đổi đề (sửa bug cũ: trước đây
// examSpeedMode chỉ đọc 1 lần lúc startExam(), nên phải đổi đề mới re-trigger).
function toggleExamSpeedMode(enabled) {
  App.examSpeedMode = enabled;
  if (!App.currentExamId) return; // chưa chọn đề, chỉ lưu trạng thái checkbox, chưa cần làm gì thêm
  startExamTotalTimer();
  startExamPerQuestionTimer();
}

// Helper: đã đi hết lượt đầu chưa — tức mọi câu gốc (0..examOriginalTotal-1) đã
// xuất hiện trong examSeenOrder ít nhất 1 lần.
function checkFirstPassDone() {
  if (App.examFirstPassDone) return true;
  const seenSet = new Set(App.examSeenOrder);
  for (let i = 0; i < App.examOriginalTotal; i++) {
    if (!seenSet.has(i)) return false;
  }
  return true;
}

function renderExamQuestion() {
  if (App.examQueue.length === 0) {
    finishExam();
    return;
  }
  App.examReviewMode = false;
  App.examNavPos = -1; // -1 nghĩa là đang ở câu "live" (đang chờ trả lời), không phải xem lại

  const exam = App.exams.find((e) => e.id === App.currentExamId);
  const qIndex = App.examQueue[0];
  const q = exam.questions[qIndex];

  // Ghi nhận vào thứ tự đã-từng-thấy nếu đây là lần đầu thấy câu này trong phiên
  if (!App.examSeenOrder.includes(qIndex) || App.examSeenOrder[App.examSeenOrder.length - 1] !== qIndex) {
    App.examSeenOrder.push(qIndex);
  }

  document.getElementById("examPos").textContent = App.examAnswered.size + 1;
  document.getElementById("examQueueTotal").textContent = App.examOriginalTotal;

  const remainingUnanswered = App.examOriginalTotal - App.examAnswered.size;
  const retryCount = App.examQueue.length - remainingUnanswered;
  const note = document.getElementById("examRetryNote");
  note.textContent = retryCount > 0 ? `(có ${retryCount} câu làm lại trong hàng đợi)` : "";

  document.getElementById("examReviewBanner").classList.add("hidden");
  document.getElementById("examHistoryNote").classList.add("hidden");
  renderExamQuestionContent(q, qIndex, true);

  startExamPerQuestionTimer();

  // Bắt đầu mốc thời gian "mốc 2: sửa lại câu sai" ngay khi pha lượt-đầu kết thúc
  // và bắt đầu gặp lại 1 câu đã từng sai (retryCount > 0 từ thời điểm này).
  if (!App.examFirstPassDone && checkFirstPassDone()) {
    App.examFirstPassDone = true;
    App.examFirstPassEndTime = Date.now();
    if (App.examQueue.length > 0) {
      App.examRetryStartTime = Date.now();
    }
  }
}

// Render nội dung câu hỏi (dùng chung cho cả câu "live" đang chờ trả lời và khi xem lại).
// isLive=true: câu đang chờ trả lời thật, gắn click handler bình thường.
// isLive=false: đang xem lại câu cũ qua nút Câu trước/Câu sau, hiện lại lựa chọn đã chọn,
// không cho chọn lại (chỉ xem), không tính giờ.
function renderExamQuestionContent(q, qIndex, isLive) {
  document.getElementById("examQuestion").textContent = q.de_bai;
  App.examAnswering = false;

  const optsDiv = document.getElementById("examOptions");
  optsDiv.innerHTML = "";

  const history = App.examHistory[qIndex];
  const lastAttempt = history && history.attempts.length ? history.attempts[history.attempts.length - 1] : null;

  // Random thứ tự đáp án khi là câu live; khi xem lại giữ nguyên thứ tự đã hiện lúc đó
  // (lưu trong history để tránh đáp án nhảy lộn xộn khi quay lại xem)
  let optionIndices;
  if (isLive) {
    optionIndices = shuffle(q.options.map((_, i) => i));
    if (!App.examHistory[qIndex]) {
      App.examHistory[qIndex] = { attempts: [], firstTryCorrect: null, optionOrder: optionIndices };
    } else {
      App.examHistory[qIndex].optionOrder = optionIndices;
    }
  } else {
    optionIndices = (history && history.optionOrder) || q.options.map((_, i) => i);
  }

  optionIndices.forEach((optIdx) => {
    const btn = document.createElement("button");
    btn.className = "quiz-opt";
    btn.textContent = q.options[optIdx];

    if (!isLive && lastAttempt) {
      // Đang xem lại: tô sẵn đáp án đã chọn lần gần nhất + đáp án đúng, không cho bấm tiếp
      btn.classList.add("disabled");
      if (optIdx === q.dap_an_dung) btn.classList.add("correct");
      if (optIdx === lastAttempt.chosenIdx && !lastAttempt.correct) btn.classList.add("wrong");
      if (optIdx === lastAttempt.chosenIdx) btn.classList.add("was-chosen");
    } else if (isLive) {
      btn.addEventListener("click", () => handleExamAnswer(btn, optIdx, qIndex, q));
    }

    optsDiv.appendChild(btn);
  });

  // Hiện ghi chú lịch sử nếu câu này đã từng bị sai trước đây (kể cả khi xem live lại sau khi đã trả lời)
  const histNote = document.getElementById("examHistoryNote");
  if (history && history.attempts.length > 0) {
    const wrongCount = history.attempts.filter((a) => !a.correct).length;
    if (wrongCount > 0) {
      histNote.classList.remove("hidden");
      histNote.textContent = `⚠ Câu này đã sai ${wrongCount} lần trong đề này`;
    } else {
      histNote.classList.add("hidden");
    }
  } else {
    histNote.classList.add("hidden");
  }
}

function handleExamAnswer(btn, chosenIdx, qIndex, q) {
  if (App.examAnswering) return; // chặn double-click
  App.examAnswering = true;

  clearInterval(App.examPerQTimerHandle);

  document.querySelectorAll("#examOptions .quiz-opt").forEach((b) => b.classList.add("disabled"));
  const correct = chosenIdx === q.dap_an_dung;
  btn.classList.add(correct ? "correct" : "wrong");

  let secondsUsed = null;
  if (App.examSpeedMode && App.examPerQStartedAt) {
    secondsUsed = (Date.now() - App.examPerQStartedAt) / 1000;
    const isRetry = App.examAnswered.size > 0 && App.examHistory[qIndex] && App.examHistory[qIndex].attempts.length > 0;
    App.examQuestionTimeLog.push({ qIndex, seconds: secondsUsed, overTime: secondsUsed > 30, isRetry });
  }

  // Ghi vào lịch sử CHI TIẾT của câu này (mọi lượt trả lời, không chỉ lượt cuối)
  if (!App.examHistory[qIndex]) {
    App.examHistory[qIndex] = { attempts: [], firstTryCorrect: null, optionOrder: null };
  }
  const hist = App.examHistory[qIndex];
  hist.attempts.push({ chosenIdx, correct, atMs: Date.now() });
  if (hist.firstTryCorrect === null) {
    hist.firstTryCorrect = correct;
  }

  if (correct) {
    playCorrectSound();
  } else {
    playWrongSound();
    document.querySelectorAll("#examOptions .quiz-opt").forEach((b) => {
      if (b.textContent === q.options[q.dap_an_dung]) b.classList.add("correct");
    });
  }

  const examWeaknessKey = `${App.currentExamId}::q${qIndex}`;
  recordWeaknessResult("__exam__", examWeaknessKey, correct, q.de_bai.slice(0, 60));

  setTimeout(() => {
    App.examQueue.shift();

    if (correct) {
      if (!App.examAnswered.has(qIndex)) {
        App.examScore++;
        App.examAnswered.add(qIndex);
        document.getElementById("examScore").textContent = App.examScore;
      }
    } else {
      App.examQueue.push(qIndex);
    }

    renderExamQuestion();
  }, 850);
}

// ----- Điều hướng xem lại câu trước / câu sau -----
function examGoPrev() {
  if (!App.examSeenOrder.length) return;
  if (App.examNavPos === -1) {
    // Đang ở câu live -> lùi về câu liền trước trong lịch sử đã thấy
    App.examNavPos = App.examSeenOrder.length - 2;
  } else {
    App.examNavPos = Math.max(0, App.examNavPos - 1);
  }
  if (App.examNavPos < 0) {
    App.examNavPos = 0;
  }
  showExamReviewAt(App.examNavPos);
}

function examGoNext() {
  if (App.examNavPos === -1) return; // đã ở câu live, không có gì để "tiến" thêm
  if (App.examNavPos >= App.examSeenOrder.length - 1) {
    // Đã ở câu cuối cùng đã xem -> quay về câu live thật
    backToLiveExamQuestion();
    return;
  }
  App.examNavPos++;
  showExamReviewAt(App.examNavPos);
}

function showExamReviewAt(pos) {
  const qIndex = App.examSeenOrder[pos];
  if (qIndex === undefined) return;
  const exam = App.exams.find((e) => e.id === App.currentExamId);
  const q = exam.questions[qIndex];

  App.examReviewMode = true;
  clearInterval(App.examPerQTimerHandle);
  document.getElementById("examPerQuestionTimerWrap").classList.add("hidden");
  document.getElementById("examReviewBanner").classList.remove("hidden");
  document.getElementById("examPos").textContent = pos + 1;

  renderExamQuestionContent(q, qIndex, false);
}

function backToLiveExamQuestion() {
  App.examReviewMode = false;
  App.examNavPos = -1;
  document.getElementById("examReviewBanner").classList.add("hidden");

  if (App.examQueue.length === 0) {
    finishExam();
    return;
  }
  const exam = App.exams.find((e) => e.id === App.currentExamId);
  const qIndex = App.examQueue[0];
  const q = exam.questions[qIndex];
  document.getElementById("examPos").textContent = App.examAnswered.size + 1;
  renderExamQuestionContent(q, qIndex, true);
  startExamPerQuestionTimer();
}

function finishExam() {
  clearInterval(App.examPerQTimerHandle);
  clearInterval(App.examTotalTimerHandle);

  if (!App.examFirstPassDone) {
    App.examFirstPassDone = true;
    App.examFirstPassEndTime = Date.now();
  }

  document.getElementById("examBody").classList.add("hidden");
  document.getElementById("examResult").classList.remove("hidden");
  document.getElementById("examFinalScore").textContent =
    `${App.examScore}/${App.examOriginalTotal} điểm — đã hoàn thành toàn bộ đề (kể cả làm lại câu sai)`;

  // Lưu vào lịch sử lâu dài (riêng biệt khỏi state phiên hiện tại, không mất khi rời trang)
  const totalSeconds = App.examTotalStartTime ? (Date.now() - App.examTotalStartTime) / 1000 : 0;
  const firstTryWrongCount = Object.values(App.examHistory).filter((h) => h.firstTryCorrect === false).length;
  recordExamCompletion(App.currentExamId, {
    score: App.examScore,
    total: App.examOriginalTotal,
    seconds: totalSeconds,
    firstTryWrongCount,
  });

  renderExamTimeSummary();
  renderExamSpeedSummary();
  renderExamMistakesSection();
  renderExamWeaknessSection();
}

// 2 mốc thời gian theo yêu cầu:
// Mốc 1 = từ lúc bắt đầu đề tới khi đi hết LƯỢT ĐẦU (mỗi câu gốc đã được hỏi đúng 1 lần
//         theo thứ tự, chưa tính làm lại câu sai) -> cho biết số câu đúng/sai ngay từ đầu.
// Mốc 2 = từ lúc bắt đầu pha "sửa lại câu sai" cho tới khi mọi câu đều đã đúng (xong hẳn đề).
function renderExamTimeSummary() {
  const wrap = document.getElementById("examTimeSummary");
  if (!App.examTotalStartTime || !App.examFirstPassEndTime) {
    wrap.innerHTML = "";
    return;
  }

  const firstPassSec = (App.examFirstPassEndTime - App.examTotalStartTime) / 1000;
  const firstPassCorrect = Object.values(App.examHistory).filter((h) => h.firstTryCorrect === true).length;
  const firstPassWrong = Object.values(App.examHistory).filter((h) => h.firstTryCorrect === false).length;

  let retrySecLabel = "—";
  if (App.examRetryStartTime) {
    const retrySec = (Date.now() - App.examRetryStartTime) / 1000;
    retrySecLabel = fmtTime(retrySec);
  } else {
    retrySecLabel = "0 giây (không có câu sai)";
  }

  wrap.innerHTML = `
    <div class="exam-time-summary-block">
      <div class="exam-time-summary-title">Mốc 1 — Lượt đầu (${App.examOriginalTotal} câu theo thứ tự gốc)</div>
      <div class="exam-time-stats-row">
        <div class="exam-speed-stat"><div class="exam-speed-stat-num">${fmtTime(firstPassSec)}</div><div class="exam-speed-stat-label">thời gian</div></div>
        <div class="exam-speed-stat"><div class="exam-speed-stat-num" style="color:var(--good)">${firstPassCorrect}</div><div class="exam-speed-stat-label">đúng ngay lần 1</div></div>
        <div class="exam-speed-stat ${firstPassWrong > 0 ? "is-warning" : ""}"><div class="exam-speed-stat-num">${firstPassWrong}</div><div class="exam-speed-stat-label">sai lần 1</div></div>
      </div>
    </div>
    <div class="exam-time-summary-block">
      <div class="exam-time-summary-title">Mốc 2 — Sửa lại câu sai</div>
      <div class="exam-time-stats-row">
        <div class="exam-speed-stat"><div class="exam-speed-stat-num">${retrySecLabel}</div><div class="exam-speed-stat-label">thời gian sửa lại</div></div>
      </div>
    </div>
  `;
}

function renderExamSpeedSummary() {
  const summaryDiv = document.getElementById("examSpeedSummary");
  if (!App.examSpeedMode || App.examQuestionTimeLog.length === 0) {
    summaryDiv.classList.add("hidden");
    summaryDiv.innerHTML = "";
    return;
  }

  const totalSec = App.examQuestionTimeLog.reduce((sum, e) => sum + e.seconds, 0);
  const avgSec = totalSec / App.examQuestionTimeLog.length;
  const overTimeCount = App.examQuestionTimeLog.filter((e) => e.overTime).length;

  summaryDiv.classList.remove("hidden");
  summaryDiv.innerHTML = `
    <div class="exam-speed-summary-title">⚡ Kết quả luyện tốc độ (mọi lượt trả lời, kể cả làm lại)</div>
    <div class="exam-speed-stats-row">
      <div class="exam-speed-stat"><div class="exam-speed-stat-num">${fmtTime(totalSec)}</div><div class="exam-speed-stat-label">tổng thời gian trả lời</div></div>
      <div class="exam-speed-stat"><div class="exam-speed-stat-num">${avgSec.toFixed(1)}s</div><div class="exam-speed-stat-label">trung bình/lượt</div></div>
      <div class="exam-speed-stat ${overTimeCount > 0 ? "is-warning" : ""}"><div class="exam-speed-stat-num">${overTimeCount}</div><div class="exam-speed-stat-label">lượt quá 30s</div></div>
    </div>
  `;
}

// Liệt kê chi tiết câu nào sai ở lần 1, câu nào sai nhiều lần — theo đúng yêu cầu
// "câu nào sai ở lần 1 và câu nào sai nhiều lần cho biết luôn".
function renderExamMistakesSection() {
  const section = document.getElementById("examMistakesSection");
  const exam = App.exams.find((e) => e.id === App.currentExamId);

  const entries = Object.keys(App.examHistory)
    .map((qIndexStr) => {
      const qIndex = parseInt(qIndexStr, 10);
      const h = App.examHistory[qIndex];
      const wrongCount = h.attempts.filter((a) => !a.correct).length;
      return { qIndex, wrongCount, firstTryCorrect: h.firstTryCorrect };
    })
    .filter((e) => e.wrongCount > 0)
    .sort((a, b) => b.wrongCount - a.wrongCount);

  if (entries.length === 0) {
    section.innerHTML = `<div class="exam-mistakes-title">🎉 Không có câu nào sai trong đề này!</div>`;
    return;
  }

  const rows = entries
    .map((e) => {
      const q = exam.questions[e.qIndex];
      const text = q.de_bai.slice(0, 70);
      const tag = e.wrongCount >= 2 ? "sai nhiều lần" : "sai ở lần 1";
      const tagClass = e.wrongCount >= 2 ? "tag-multi-wrong" : "tag-first-wrong";
      return `<div class="weakness-row">
        <div class="weakness-row-main"><div class="weakness-row-title">Câu ${e.qIndex + 1}: ${text}…</div></div>
        <div class="weakness-row-stats">
          <span class="exam-mistake-tag ${tagClass}">${tag}</span>
          <span class="weakness-wrong-count">✕ ${e.wrongCount} lần</span>
        </div>
      </div>`;
    })
    .join("");

  section.innerHTML = `
    <div class="exam-mistakes-title">Chi tiết các câu đã sai (${entries.length} câu)</div>
    <div class="weakness-list">${rows}</div>
  `;
}

function renderExamWeaknessSection() {
  const weakList = getWeaknessListForDeck("__exam__")
    .filter((e) => e.itemId.startsWith(`${App.currentExamId}::`));

  const section = document.getElementById("examWeaknessSection");
  if (weakList.length === 0) {
    section.innerHTML = "";
    return;
  }

  const rows = weakList
    .map((e) => {
      const text = e.lastLabel || e.itemId;
      return `<div class="weakness-row">
        <div class="weakness-row-main"><div class="weakness-row-title">${text}…</div></div>
        <div class="weakness-row-stats">
          <span class="weakness-wrong-count">✕ ${e.wrongCount} lần sai</span>
        </div>
      </div>`;
    })
    .join("");

  section.innerHTML = `
    <div class="exam-weakness-title">Câu bạn hay sai nhất trong đề này (lịch sử nhiều đề)</div>
    <div class="weakness-list">${rows}</div>
  `;
}

function restartCurrentExam() {
  if (App.currentExamId) startExam(App.currentExamId);
}

/* ===================================================================
   INIT — gắn toàn bộ event listener và khởi động app khi load trang
=================================================================== */

document.addEventListener("DOMContentLoaded", async () => {
  loadFieldConfig();
  loadEditPatches();
  loadStarredItems();
  loadShuffleConfig();
  ensureVoicesLoaded();

  App.decks = await loadDecks();
  App.exams = await loadExams();

  if (App.decks.length === 0) {
    document.getElementById("deckName").textContent = "Không tải được bộ học nào";
    return;
  }

  populateDeckPicker();
  populateExamPicker();

  // ----- Focus mode (phóng to toàn màn hình) -----
  document.querySelectorAll(".focus-toggle-btn").forEach((btn) => {
    btn.addEventListener("click", enterFocusMode);
  });
  document.getElementById("btnExitFocus").addEventListener("click", exitFocusMode);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && document.getElementById("app").classList.contains("focus-mode")) {
      exitFocusMode();
    }
  });

  // ----- Sidebar dạng drawer trên mobile (≤860px) -----
  function openMobileSidebar() {
    document.querySelector(".sidebar").classList.add("is-open");
    document.getElementById("sidebarBackdrop").classList.add("is-visible");
  }
  function closeMobileSidebar() {
    document.querySelector(".sidebar").classList.remove("is-open");
    document.getElementById("sidebarBackdrop").classList.remove("is-visible");
  }
  document.getElementById("btnMobileMenu").addEventListener("click", openMobileSidebar);

  // "Unlock" speechSynthesis trên iOS: phải gọi speak() ít nhất 1 lần ngay trong
  // user-gesture đầu tiên (bất kỳ tap nào trên trang), nếu không các lệnh speak()
  // gọi sau đó (kể cả trong gesture khác) có thể bị im lặng không phát ra tiếng.
  // Dùng utterance với volume=0 để không phát tiếng thật, chỉ "mở khóa" engine.
  let speechUnlocked = false;
  function unlockSpeechOnce() {
    if (speechUnlocked || !("speechSynthesis" in window)) return;
    speechUnlocked = true;
    try {
      const unlockUtter = new SpeechSynthesisUtterance(" ");
      unlockUtter.volume = 0;
      window.speechSynthesis.speak(unlockUtter);
    } catch (e) { /* ignore */ }
    document.removeEventListener("touchstart", unlockSpeechOnce);
    document.removeEventListener("click", unlockSpeechOnce);
  }
  document.addEventListener("touchstart", unlockSpeechOnce, { once: true });
  document.addEventListener("click", unlockSpeechOnce, { once: true });
  document.getElementById("sidebarBackdrop").addEventListener("click", closeMobileSidebar);
  // Tự đóng sidebar sau khi chọn 1 mục trong nav, để vào ngay nội dung học (chỉ có
  // tác dụng trên mobile vì trên desktop sidebar luôn cố định hiện, không có class is-open)
  document.getElementById("navList").addEventListener("click", (e) => {
    if (e.target.closest(".nav-item")) closeMobileSidebar();
  });

  // ----- Flashcard mode -----
  document.getElementById("flashCard").addEventListener("click", () => {
    flipFlashCard();
  });
  document.getElementById("btnFlip").addEventListener("click", (e) => {
    e.stopPropagation();
    flipFlashCard();
  });
  document.querySelectorAll("#flashRateRow [data-flash-result]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      flashMarkResult(btn.dataset.flashResult);
    });
  });
  document.getElementById("btnFieldConfig").addEventListener("click", () => {
    document.getElementById("fieldConfigPanel").classList.toggle("hidden");
  });
  document.getElementById("btnEditCurrentFlash").addEventListener("click", (e) => {
    e.stopPropagation();
    const w = getCurrentFlashWord();
    if (w) openEditModal(w._id);
  });
  document.querySelectorAll(".flash-star-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const w = getCurrentFlashWord();
      if (!w) return;
      toggleStar(App.currentDeckId, w._id);
      renderFlashStarButtons(w);
      renderTable();
    });
  });
  document.getElementById("btnFlashRestartFull").addEventListener("click", flashRestartFull);
  document.getElementById("btnFlashRestartStarredOnly").addEventListener("click", flashRestartStarredOnly);

  document.getElementById("btnFlashStarOnly").addEventListener("click", () => {
    const isCurrentlyStarOnly = document.getElementById("btnFlashStarOnly").classList.contains("is-active");

    if (isCurrentlyStarOnly) {
      // Đang ở chế độ chỉ học ★ -> bấm lại để TẮT, quay về học toàn bộ bộ
      setFlashStarOnlyState(false);
      initFlashMode(null);
      return;
    }

    const starredIds = getStarredIdsForDeck(App.currentDeckId);
    if (!starredIds.length) {
      alert("Chưa có từ nào được đánh dấu ★ trong bộ này. Bấm ☆ trên góc thẻ để đánh dấu.");
      return;
    }
    setFlashStarOnlyState(true);
    initFlashMode(starredIds);
  });
  document.getElementById("btnSrsStarOnly").addEventListener("click", () => {
    const isCurrentlyStarOnly = document.getElementById("btnSrsStarOnly").classList.contains("is-active");

    if (isCurrentlyStarOnly) {
      // Đang ở chế độ chỉ ôn ★ -> bấm lại để TẮT, quay về ôn toàn bộ bộ
      setSrsStarOnlyState(false);
      initSrsMode(null);
      return;
    }

    const starredIds = getStarredIdsForDeck(App.currentDeckId);
    if (!starredIds.length) {
      alert("Chưa có từ nào được đánh dấu ★ trong bộ này.");
      return;
    }
    setSrsStarOnlyState(true);
    initSrsMode(starredIds);
  });

  // Phím tắt ← ↑ ↓ → dùng chung cho Flashcard và SRS (Ôn tập):
  // Flashcard: ← Chưa nhớ, ↑ Khó, ↓ Lật thẻ, → Đã nhớ
  // SRS:       ← Quên,    ↑ Khó, ↓ Lật thẻ, → Dễ
  document.addEventListener("keydown", (e) => {
    const isEditModalOpen = !document.getElementById("editModalOverlay").classList.contains("hidden");
    if (isEditModalOpen) return;
    const tag = document.activeElement.tagName;
    if (tag === "INPUT" || tag === "TEXTAREA") return;

    const flashView = document.getElementById("view-flash");
    const isFlashVisible = flashView && !flashView.classList.contains("hidden");
    const learnAreaVisible = !document.getElementById("flashLearnArea").classList.contains("hidden");

    const srsView = document.getElementById("view-srs");
    const isSrsVisible = srsView && !srsView.classList.contains("hidden");
    const srsStageVisible = !document.getElementById("srsStage").classList.contains("hidden");

    if (isFlashVisible && learnAreaVisible) {
      if (e.key === "ArrowLeft") { e.preventDefault(); flashMarkResult("not_remembered"); }
      else if (e.key === "ArrowUp") { e.preventDefault(); flashMarkResult("hard"); }
      else if (e.key === "ArrowDown") { e.preventDefault(); flipFlashCard(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); flashMarkResult("remembered"); }
    } else if (isSrsVisible && srsStageVisible) {
      if (e.key === "ArrowLeft") { e.preventDefault(); rateCurrentSrsWord("again"); }
      else if (e.key === "ArrowUp") { e.preventDefault(); rateCurrentSrsWord("hard"); }
      else if (e.key === "ArrowDown") { e.preventDefault(); flipSrsCard(); }
      else if (e.key === "ArrowRight") { e.preventDefault(); rateCurrentSrsWord("easy"); }
    }
  });

  // ----- Edit modal (dùng chung cho flashcard + bảng) -----
  document.getElementById("btnEditModalClose").addEventListener("click", closeEditModal);
  document.getElementById("btnEditCancel").addEventListener("click", closeEditModal);
  document.getElementById("btnEditSave").addEventListener("click", saveEditModal);
  document.getElementById("editModalOverlay").addEventListener("click", (e) => {
    if (e.target.id === "editModalOverlay") closeEditModal();
  });

  // ----- Weakness mode -----
  document.getElementById("btnReviewWeakness").addEventListener("click", startWeaknessReview);

  // ----- Sound toggle -----
  const soundBtn = document.getElementById("btnToggleSound");
  function refreshSoundBtnUI() {
    soundBtn.textContent = App.soundEnabled ? "🔊" : "🔇";
    soundBtn.classList.toggle("is-muted", !App.soundEnabled);
  }
  refreshSoundBtnUI();
  soundBtn.addEventListener("click", () => {
    App.soundEnabled = !App.soundEnabled;
    saveSoundConfig();
    refreshSoundBtnUI();
    if (App.soundEnabled) playCorrectSound();
  });

  // ----- Speech (phát âm) toggle -----
  const speechBtn = document.getElementById("btnToggleSpeech");
  function refreshSpeechBtnUI() {
    speechBtn.classList.toggle("is-muted", !App.speechEnabled);
  }
  refreshSpeechBtnUI();
  speechBtn.addEventListener("click", () => {
    App.speechEnabled = !App.speechEnabled;
    saveSpeechConfig();
    refreshSpeechBtnUI();
    if (App.speechEnabled) speakJapanese("発音オン");
  });

  // ----- Table mode -----
  document.getElementById("tableSearch").addEventListener("input", renderTable);
  document.getElementById("tableFilter").addEventListener("change", renderTable);
  document.getElementById("btnColConfig").addEventListener("click", () => {
    document.getElementById("colConfigPanel").classList.toggle("hidden");
  });

  // ----- SRS mode -----
  document.getElementById("srsCard").addEventListener("click", () => {
    flipSrsCard();
  });
  document.getElementById("btnSrsFlip").addEventListener("click", (e) => {
    e.stopPropagation();
    flipSrsCard();
  });
  document.querySelectorAll("#srsRateRow [data-srs-rate]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      rateCurrentSrsWord(btn.dataset.srsRate);
    });
  });

  // ----- Toggle "Học ngẫu nhiên" (dùng chung pattern cho Flashcard + SRS) -----
  document.getElementById("flashShuffleToggle").checked = App.shuffleEnabled.flash;
  document.getElementById("srsShuffleToggle").checked = App.shuffleEnabled.srs;

  document.getElementById("flashShuffleToggle").addEventListener("change", (e) => {
    App.shuffleEnabled.flash = e.target.checked;
    saveShuffleConfig();
    // Áp dụng ngay: nếu đang học flashcard, xáo trộn phần còn lại của queue
    // (hoặc sắp lại theo thứ tự gốc) mà không reset tiến độ (flashRememberedCount giữ nguyên).
    if (App.flashQueue.length > 0) {
      if (App.shuffleEnabled.flash) {
        App.flashQueue = shuffle(App.flashQueue);
      } else {
        // Sắp xếp lại theo thứ tự gốc của currentWords, chỉ giữ các _id còn trong queue
        const queueSet = new Set(App.flashQueue);
        App.flashQueue = App.currentWords
          .map((w) => w._id)
          .filter((id) => queueSet.has(id));
      }
      renderFlashCard();
    }
  });
  document.getElementById("srsShuffleToggle").addEventListener("change", (e) => {
    App.shuffleEnabled.srs = e.target.checked;
    saveShuffleConfig();
    // Áp dụng ngay: xáo trộn phần còn lại của srsQueue từ vị trí hiện tại trở đi
    if (App.srsQueue.length > App.srsIndex + 1) {
      const done = App.srsQueue.slice(0, App.srsIndex + 1);
      const remaining = App.srsQueue.slice(App.srsIndex + 1);
      App.srsQueue = done.concat(App.shuffleEnabled.srs ? shuffle(remaining) : remaining.sort((a, b) => {
        const ia = App.currentWords.findIndex(w => w._id === a._id);
        const ib = App.currentWords.findIndex(w => w._id === b._id);
        return ia - ib;
      }));
    }
  });

  // ----- Typing mode -----
  document.getElementById("typingFreeInput").addEventListener("keydown", typingHandleKeydown);
  document.getElementById("btnTypingCheck").addEventListener("click", typingCheckAnswer);
  document.getElementById("btnTypingHint").addEventListener("click", typingShowHint);
  document.getElementById("btnTypingShowAnswer").addEventListener("click", typingShowAnswer);

  // ----- Quiz mode -----
  document.getElementById("btnQuizRestart").addEventListener("click", initQuizMode);

  // ----- Match mode -----
  document.getElementById("btnMatchRestart").addEventListener("click", initMatchMode);

  // ----- Exam mode -----
  document.getElementById("examPicker").addEventListener("change", (e) => {
    if (e.target.value) startExam(e.target.value);
  });
  document.getElementById("btnExamRestart").addEventListener("click", restartCurrentExam);
  document.getElementById("examSpeedMode").addEventListener("change", (e) => {
    toggleExamSpeedMode(e.target.checked);
  });
  document.getElementById("btnExamPrev").addEventListener("click", examGoPrev);
  document.getElementById("btnExamNext").addEventListener("click", examGoNext);

  // ----- Deck picker -----
  document.getElementById("deckPicker").addEventListener("change", (e) => {
    switchDeck(e.target.value);
    closeMobileSidebar();
  });

  // ----- Export / Import progress (toàn bộ lịch sử học + cấu hình + sửa tạm) -----
  document.getElementById("btnExport").addEventListener("click", () => {
    const exportPayload = {
      exportedAt: new Date().toISOString(),
      version: 6,
      srsProgress: SRS.exportAll(),
      fieldConfig: App.fieldConfig,
      visibleCols: App.visibleCols,
      peekCols: App.peekCols,
      editPatches: App.editPatches,
      starredItems: App.starredItems,
      weaknessStats: loadWeaknessStats(),
      examHistory: loadExamHistoryStats(),
      shuffleEnabled: App.shuffleEnabled,
      soundEnabled: App.soundEnabled,
      speechEnabled: App.speechEnabled,
    };
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `n2vocab-progress-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });
  document.getElementById("btnImport").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);

        // Hỗ trợ cả file export cũ (chỉ có srsProgress trực tiếp, không có wrapper)
        const srsData = data.srsProgress || data;
        SRS.importAll(srsData);

        if (data.fieldConfig) {
          Object.assign(App.fieldConfig, data.fieldConfig);
          saveFieldConfig();
        }
        if (data.visibleCols) {
          Object.assign(App.visibleCols, data.visibleCols);
          saveColConfig();
        }
        if (data.peekCols) {
          Object.assign(App.peekCols, data.peekCols);
          savePeekConfig();
        }
        if (data.editPatches) {
          // Gộp patch nhập vào với patch hiện có (patch nhập đè lên nếu trùng key)
          Object.keys(data.editPatches).forEach((deckId) => {
            App.editPatches[deckId] = { ...App.editPatches[deckId], ...data.editPatches[deckId] };
          });
          saveEditPatches();
          // Áp lại patch lên toàn bộ deck đang có trong session
          App.decks.forEach((deck) => {
            deck.words = applyPatchesToWords(deck.id, deck.words);
          });
          const curDeck = App.decks.find((d) => d.id === App.currentDeckId);
          if (curDeck) App.currentWords = curDeck.words;
        }
        if (data.starredItems) {
          // Gộp danh sách ★ đã đánh dấu (không trùng lặp) theo từng bộ
          Object.keys(data.starredItems).forEach((deckId) => {
            const merged = new Set([...(App.starredItems[deckId] || []), ...data.starredItems[deckId]]);
            App.starredItems[deckId] = Array.from(merged);
          });
          saveStarredItems();
        }
        if (data.weaknessStats) {
          // Gộp số liệu đúng/sai (CỘNG DỒN, không đè) — vì đây là số liệu tích lũy theo
          // thời gian, đè thẳng sẽ làm mất lịch sử đã có sẵn trên máy hiện tại.
          const currentStats = loadWeaknessStats();
          Object.keys(data.weaknessStats).forEach((deckId) => {
            if (!currentStats[deckId]) currentStats[deckId] = {};
            Object.keys(data.weaknessStats[deckId]).forEach((itemId) => {
              const incoming = data.weaknessStats[deckId][itemId];
              const existing = currentStats[deckId][itemId];
              if (!existing) {
                currentStats[deckId][itemId] = { ...incoming };
              } else {
                existing.correctCount += incoming.correctCount || 0;
                existing.wrongCount += incoming.wrongCount || 0;
                if (incoming.lastResultAt > existing.lastResultAt) {
                  existing.lastLabel = incoming.lastLabel || existing.lastLabel;
                  existing.lastResultAt = incoming.lastResultAt;
                }
              }
            });
          });
          saveWeaknessStats(currentStats);
        }
        if (data.examHistory) {
          // totalCompletions CỘNG DỒN (giống weaknessStats — đếm tích lũy, mỗi máy
          // có thể đã làm thêm số lần riêng, không máy nào "đúng hơn" máy nào).
          // Các field "lần gần nhất" lấy theo bản có lastCompletedAt LỚN HƠN (mới hơn),
          // vì đây là trạng thái snapshot của 1 lần làm cụ thể, không phải số đếm.
          const currentExamStats = loadExamHistoryStats();
          Object.keys(data.examHistory).forEach((examId) => {
            const incoming = data.examHistory[examId];
            const existing = currentExamStats[examId];
            if (!existing) {
              currentExamStats[examId] = { ...incoming };
            } else {
              existing.totalCompletions = (existing.totalCompletions || 0) + (incoming.totalCompletions || 0);
              if ((incoming.lastCompletedAt || 0) > (existing.lastCompletedAt || 0)) {
                existing.lastScore = incoming.lastScore;
                existing.lastTotal = incoming.lastTotal;
                existing.lastSeconds = incoming.lastSeconds;
                existing.lastFirstTryWrongCount = incoming.lastFirstTryWrongCount;
                existing.lastCompletedAt = incoming.lastCompletedAt;
              }
            }
          });
          saveExamHistoryStats(currentExamStats);
        }
        if (data.shuffleEnabled) {
          Object.assign(App.shuffleEnabled, data.shuffleEnabled);
          saveShuffleConfig();
          document.getElementById("flashShuffleToggle").checked = App.shuffleEnabled.flash;
          document.getElementById("srsShuffleToggle").checked = App.shuffleEnabled.srs;
        }
        if (data.soundEnabled !== undefined) {
          App.soundEnabled = data.soundEnabled;
          saveSoundConfig();
        }
        if (data.speechEnabled !== undefined) {
          App.speechEnabled = data.speechEnabled;
          saveSpeechConfig();
        }

        App.progress = SRS.loadProgress(App.currentDeckId);
        buildColConfigPanel();
        buildFieldConfigPanel();
        renderTable();
        initSrsMode();
        renderFlashCard();
        alert("Đã nhập tiến độ, cấu hình và các sửa tạm thành công.");
      } catch (err) {
        alert("File không hợp lệ.");
      }
    };
    reader.readAsText(file);
  });

  document.getElementById("btnClearPatches").addEventListener("click", () => {
    const confirmed = confirm(
      "Xóa toàn bộ các sửa tạm đã lưu trên máy này? Hành động này không ảnh hưởng tiến độ học (SRS), chỉ xóa các chỉnh sửa từ vựng/ngữ pháp bạn đã sửa qua nút ✎ Sửa."
    );
    if (!confirmed) return;
    clearAllEditPatches();
    // Tải lại deck từ file gốc (không còn patch) để phản ánh ngay
    loadDecks().then((decks) => {
      App.decks = decks;
      const stillExists = decks.find((d) => d.id === App.currentDeckId);
      switchDeck(stillExists ? App.currentDeckId : decks[0].id);
      alert("Đã xóa toàn bộ các sửa tạm.");
    });
  });

  // ----- Bắt đầu với bộ đầu tiên -----
  switchDeck(App.decks[0].id);
});
