/* ===== MODULE: core.js — App state, utils, render helpers, audio/speech (KHÔNG đổi nội dung, chỉ tách từ app.js cũ) ===== */

/* ===== N2 Vocab Lab v2 — main app logic ===== */

const App = {
  decks: [],
  exams: [],
  grammarIndex: {}, // tra cứu cautruc -> cả entry NGUPHAP, build lại bằng buildGrammarIndex()
  grammarGroupsData: null, // data/grammar-groups.json — nhóm nghĩa + họ dễ nhầm
  grammarGroupsTab: "nhomnghia",
  srsComboActive: false, // true khi đang học SRS gộp nhiều bộ ngữ pháp cùng lúc (xem startComboSrs())
  choukaiDraftIndex: null, // đáp án đang chọn NHÁP (chưa xác nhận) của câu đề nghe hiện tại
  choukaiFlagged: new Set(), // các câu đề nghe đã đánh dấu cờ để xem lại (key choukaiKeyFor)
  choukaiUnsure: new Set(), // các câu đề nghe đã đánh dấu phân vân
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
  quizDirection: "kanji_nghia", // "kanji_nghia" | "kanji_hira" | "hira_nghia" (chỉ TUVUNG)
  weaknessTab: "deck", // "deck" | "exam" — tab đang xem ở trang Điểm yếu
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
  examScoreMode: "instant", // "instant" (chấm ngay) | "review" (chấm sửa cuối bài)
  examPendingExamId: null,  // examId đang chờ chọn chế độ chấm qua modal, trước khi thực sự startExam

  // ===== CHOUKAI (luyện nghe) =====
  choukaiTests: [],
  currentChoukaiId: null,
  choukaiMondaiFilter: "all", // "all" | 1 | 2 | 3 | 4 | 5
  choukaiQueue: [],          // [{mIndex, qIndex, subIndex|null}]
  choukaiPos: 0,
  choukaiScoreMode: "instant",
  choukaiAnswers: {},        // key "m{M}q{Q}" hoặc "m{M}q{Q}s{S}" -> {chosenIndex, correct}
  choukaiScore: 0,
  choukaiHintEnabled: false,
  choukaiReviewTab: "script",
  choukaiPendingTestId: null,
  choukaiCurrentAudioSrc: null, // theo dõi file audio đang load, tránh load lại không cần thiết
  choukaiAnswering: false,      // chặn bấm thêm lựa chọn sau khi đã trả lời câu hiện tại
  // Các listener "timeupdate" karaoke đang gắn, theo từng nơi dùng (key: "shadow",
  // "reviewScript", "reviewVi", "detailScript"...) — gỡ đúng cái CŨ trước khi gắn
  // MỚI để tránh nhiều listener cộng dồn trên cùng 1 thẻ <audio> qua mỗi lần đổi câu.
  karaokeHandlers: {},
  examLastAnswerCorrect: null, // kết quả lượt vừa chấm (chế độ instant), dùng khi bấm "Tiếp tục"
  examLastAnsweredQIndex: null,
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

// Index TRA CỨU NHANH mọi cấu trúc ngữ pháp (gộp TẤT CẢ bộ NGUPHAP đang có) —
// dùng để: (1) làm giàu hiển thị "đồng nghĩa" (vốn nhiều file chỉ lưu chuỗi
// thô chưa kèm nghĩa — tra ra đây để hiện kèm nghĩa cho dễ học), (2) cho popup
// "Xem ngữ pháp liên quan". Gọi lại buildGrammarIndex() mỗi khi App.decks đổi
// (sau loadDecks() hoặc sau khi xóa sửa tạm) để không bị cũ dữ liệu.
function buildGrammarIndex() {
  const index = {};
  App.decks.forEach((deck) => {
    if (deck.type !== "NGUPHAP") return;
    deck.words.forEach((w) => {
      if (w.cautruc) index[w.cautruc] = w;
    });
  });
  App.grammarIndex = index;
}

function findGrammarByCautruc(cautruc) {
  return (App.grammarIndex && App.grammarIndex[cautruc]) || null;
}

// Chuẩn hóa 1 mục dong_nghia CHO NGỮ PHÁP về dạng có nghĩa kèm theo — nếu mục
// đó vốn chỉ là chuỗi thô (format cũ, đa số file hiện tại), tự tra cứu qua
// buildGrammarIndex() để LẤY THÊM nghĩa thật, không cần sửa lại từng file JSON.
// Nếu không tra được (cấu trúc đó chưa có trong dữ liệu) thì vẫn hiện chuỗi
// thô, không vỡ trang.
function enrichGrammarSynonym(item) {
  if (typeof item !== "string") return item; // đã là format mới {kanji/cautruc, doc, nghia} -> giữ nguyên
  const found = findGrammarByCautruc(item);
  return found ? { kanji: item, nghia: found.nghia } : { kanji: item };
}

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
        ? `<div class="cf-block-label">Đồng nghĩa</div><div class="cf-synonyms">${renderSynonymList(w.dong_nghia.map(enrichGrammarSynonym))}</div>` : ""),
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

