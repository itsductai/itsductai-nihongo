/* ===== SRS kiểu Anki (SM-2 đơn giản hóa) =====
   3 nút: Quên (Again) / Khó (Hard) / Dễ (Easy)

   Nguyên tắc bắt buộc: tại CÙNG một thời điểm (cùng base interval hiện tại),
   khoảng thời gian Quên < Khó < Dễ LUÔN đúng. Đây là lý do dùng công thức dưới:
   - Quên: luôn về lại mốc tối thiểu 1 phút, ease factor giảm.
   - Khó: interval hiện tại × HARD_MULTIPLIER (1.2, hệ số CỐ ĐỊNH, không phụ thuộc ease).
   - Dễ: interval hiện tại × ease (ease luôn ≥ MIN_EASE = 1.3 > HARD_MULTIPLIER = 1.2,
     nên Dễ luôn ≥ Khó tại cùng base interval).
   Cả Khó và Dễ đều có sàn riêng theo cấp tương ứng (FIRST_HARD < FIRST_EASY) chỉ áp
   dụng cho LẦN ĐẦU (intervalMin === 0), không áp dụng sàn cố định cho các lần sau —
   đây chính là điểm đã sửa so với bản cũ (bản cũ áp sàn FIRST_HARD=6 cho MỌI lần Khó,
   khiến Khó có thể lớn hơn Dễ khi base interval nhỏ).

   Trạng thái mỗi từ lưu trong localStorage theo key riêng từng bộ:
   { intervalMin: số phút tới lần ôn tiếp theo,
     ease: hệ số dễ (mặc định 2.5, tối thiểu 1.3, tối đa 3.5),
     due: timestamp (ms) của lần ôn tiếp theo,
     reps: số lần đã ôn,
     seen: đã từng học chưa,
     lastRating: 'again' | 'hard' | 'easy' }
*/

const SRS = (() => {
  const STORAGE_PREFIX = "n2vocab_progress_";
  const MIN_INTERVAL = 1;          // phút, mốc khi "Quên"
  const FIRST_HARD = 6;            // phút, CHỈ áp dụng lần đầu (intervalMin === 0)
  const FIRST_EASY = 10;           // phút, CHỈ áp dụng lần đầu (intervalMin === 0)
  const HARD_MULTIPLIER = 1.2;     // hệ số cố định cho "Khó" — luôn nhỏ hơn MIN_EASE
  const MIN_EASE = 1.3;
  const MAX_EASE = 3.5;
  const DEFAULT_EASE = 2.5;
  const GRADUATE_THRESHOLD = 1440; // 1 ngày (phút) — sau ngưỡng này coi là đã "trưởng thành"
  // Khi QUÊN một từ ĐÃ CHÍN (intervalMin đã >= GRADUATE_THRESHOLD, tức đã tích lũy
  // tới hàng chục ngày): KHÔNG xóa sạch về 1 phút. Giữ lại phần này của quãng cũ
  // làm "mốc đã học" để lần nhớ lại kế tiếp mọc lên TỪ ĐÓ (không phải từ 0). 0.5 =
  // trừ đi một nửa (vừa phải): 90 ngày -> còn 45, 40 ngày -> còn 20. Chỉnh số này
  // để phạt nặng/nhẹ hơn (thấp hơn = trừ nhiều hơn).
  const LAPSE_RETAIN = 0.5;
  // "Đã thuộc" — dành cho từ ĐÃ học trước ở nơi khác (Anki/Quizlet/sách giấy...),
  // không muốn đi từng bước Quên→Khó→Dễ như từ hoàn toàn mới. Đẩy thẳng lên mốc
  // RẤT XA (60 ngày) để gần như không xuất hiện lại, nhưng vẫn nằm trong hệ thống
  // (không xóa khỏi vòng ôn hẳn — nếu lâu quá quên thật thì vẫn sẽ gặp lại).
  const MASTERED_INTERVAL = 60 * 1440; // 60 ngày, tính theo phút (chỉ dùng khi ĐÁNH DẤU THỦ CÔNG "Đã thuộc", không phải kết quả tăng dần tự nhiên)
  // FIX BUG THUẬT TOÁN: trước đây có thêm GRADUATED_EASY_BONUS (+1.5) cộng
  // thẳng vào ease sau khi "trưởng thành" (qua 1 ngày), khiến hệ số nhân lên
  // tới 3.5-5.0 lần MỖI LẦN đánh "Dễ" — tăng theo cấp số nhân quá nhanh (1
  // ngày → 4 → 16 → 64 → 256 ngày...), không giống Anki thật (Anki chuẩn chỉ
  // nhân theo ease đơn thuần ~1.3-3.5, không có bonus cộng thêm kiểu này).
  // Bỏ hẳn bonus, dùng ĐÚNG 1 công thức "interval × ease" cho MỌI lần đánh
  // Dễ (dù đã trưởng thành hay chưa) — sát với thuật toán SM-2 gốc hơn.
  const MAX_REVIEW_INTERVAL = 90 * 1440; // TRẦN 90 ngày cho chu kỳ tăng dần TỰ NHIÊN — đảm bảo từ vựng ngôn ngữ (khác dữ kiện thuần túy) vẫn được chạm lại tối thiểu theo quý, không bao giờ giãn tới nửa năm+ dù ease cao.

  function now() {
    return Date.now();
  }

  function loadProgress(deckId) {
    try {
      const raw = localStorage.getItem(STORAGE_PREFIX + deckId);
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      console.error("SRS load error", e);
      return {};
    }
  }

  function saveProgress(deckId, progress) {
    try {
      localStorage.setItem(STORAGE_PREFIX + deckId, JSON.stringify(progress));
    } catch (e) {
      console.error("SRS save error", e);
    }
  }

  // Đọc 1 entry mà KHÔNG ghi side-effect vào progress thật — dùng cho preview.
  function peekEntry(progress, wordId) {
    return (
      progress[wordId] || {
        intervalMin: 0,
        ease: DEFAULT_EASE,
        due: now(),
        reps: 0,
        seen: false,
        lastRating: null,
      }
    );
  }

  // Đọc 1 entry, và nếu chưa tồn tại thì TẠO MỚI và GHI vào progress thật.
  // Chỉ dùng khi thực sự muốn ghi nhận (rate thật), không dùng cho preview.
  function getEntry(progress, wordId) {
    if (!progress[wordId]) {
      progress[wordId] = peekEntry(progress, wordId);
    }
    return progress[wordId];
  }

  function isDue(entry) {
    return entry.due <= now();
  }

  // Tính ra entry MỚI dựa trên entry hiện tại + rating, KHÔNG ghi đè entry cũ.
  // Đây là phần lõi thuần (pure function) để cả rate() và previewLabel() dùng chung,
  // tránh hai nơi viết hai công thức dễ lệch nhau theo thời gian.
  function computeNextEntry(entry, rating) {
    const next = { ...entry };
    next.reps = (entry.reps || 0) + 1;
    next.lastRating = rating;
    next.seen = true;
    // "mastered" chỉ có ý nghĩa cho tới lần rate THẬT tiếp theo — nếu sau đó người
    // học rate lại bằng Quên/Khó/Dễ (ví dụ 60 ngày sau từ đó quay lại due), coi như
    // đang ôn THẬT lại, không còn ở trạng thái "đã thuộc, bỏ qua bước" nữa.
    next.mastered = false;
    // dueMin = số phút TỚI KHI thẻ xuất hiện lại. Thường bằng intervalMin, NHƯNG khi
    // "quên" từ đã chín thì tách ra: intervalMin (mốc mọc tiếp) vẫn cao, còn dueMin
    // vẫn ngắn để được ôn lại ngay.
    let dueMin;

    if (rating === "again") {
      next.ease = Math.max(MIN_EASE, entry.ease - 0.2);
      if (entry.intervalMin >= GRADUATE_THRESHOLD) {
        // Từ ĐÃ CHÍN mà nay quên -> chỉ TRỪ BỚT một phần vừa phải (giữ LAPSE_RETAIN),
        // không reset về 1 phút. intervalMin mới = mốc "đã học" đã giảm, để lần nhớ
        // lại kế tiếp (Khó/Dễ) nhân LÊN TỪ ĐÓ chứ không từ 0. Vẫn cho gặp lại NGAY
        // (dueMin = MIN_INTERVAL) để drill lại liền.
        next.intervalMin = Math.max(GRADUATE_THRESHOLD, Math.round(entry.intervalMin * LAPSE_RETAIN));
        next.relearning = true;
        dueMin = MIN_INTERVAL;
      } else {
        // Từ còn non (chưa qua 1 ngày) -> quên thì học lại từ đầu như cũ.
        next.intervalMin = MIN_INTERVAL;
        next.relearning = false;
        dueMin = MIN_INTERVAL;
      }
    } else if (rating === "hard") {
      next.intervalMin =
        entry.intervalMin === 0 ? FIRST_HARD : Math.round(entry.intervalMin * HARD_MULTIPLIER);
      next.ease = Math.max(MIN_EASE, entry.ease - 0.05);
      next.relearning = false;
      dueMin = next.intervalMin;
    } else if (rating === "easy") {
      if (entry.intervalMin === 0) {
        next.intervalMin = FIRST_EASY;
      } else {
        // ĐÚNG 1 công thức duy nhất cho mọi lần Dễ (bỏ hẳn bonus sau "trưởng
        // thành" từng gây tăng phi mã) + áp trần MAX_REVIEW_INTERVAL để
        // không bao giờ giãn quá xa dù ease đã lên cao.
        next.intervalMin = Math.min(MAX_REVIEW_INTERVAL, Math.round(entry.intervalMin * entry.ease));
      }
      next.ease = Math.min(MAX_EASE, entry.ease + 0.1);
      next.relearning = false;
      dueMin = next.intervalMin;
    } else if (rating === "mastered") {
      // Bỏ qua hoàn toàn các bước tăng dần — đẩy thẳng lên mốc rất xa, không đụng
      // tới ease (giữ nguyên, vì đây không phải kết quả của 1 lần ôn thật).
      next.intervalMin = MASTERED_INTERVAL;
      next.mastered = true;
      next.relearning = false;
      dueMin = next.intervalMin;
    }

    next.due = now() + dueMin * 60 * 1000;
    return next;
  }

  // rating: 'again' | 'hard' | 'easy' — ghi nhận thật, có side-effect vào progress
  function rate(progress, wordId, rating) {
    const entry = getEntry(progress, wordId);
    const next = computeNextEntry(entry, rating);
    progress[wordId] = next;
    return next;
  }

  // Trạng thái hiển thị: new / learning (chưa qua 1 ngày) / known (đã "trưởng thành") /
  // mastered (được đánh dấu "Đã thuộc" thủ công, bỏ qua các bước tăng dần)
  // Chủ động đưa 1 từ "đã thuộc"/bất kỳ trạng thái nào về lại "cần ôn NGAY" —
  // không đợi due tự nhiên đến hạn. Giữ nguyên ease (không phải đang "quên thật",
  // chỉ là người học chủ động muốn ôn lại sớm), chỉ reset due về hiện tại và tắt
  // cờ mastered để status() không còn trả về "mastered" nữa.
  function forceBackToReview(progress, wordId) {
    const entry = getEntry(progress, wordId);
    entry.due = now();
    entry.mastered = false;
    if (entry.intervalMin >= GRADUATE_THRESHOLD) entry.intervalMin = GRADUATE_THRESHOLD - 1;
    return entry;
  }

  function status(entry) {
    if (!entry || !entry.seen) return "new";
    if (entry.mastered) return "mastered";
    if (entry.intervalMin >= GRADUATE_THRESHOLD) return "known";
    return "learning";
  }

  function fmtInterval(min) {
    if (min < 60) return `${Math.round(min)} phút`;
    if (min < 1440) return `${Math.round(min / 60)} giờ`;
    return `${Math.round(min / 1440)} ngày`;
  }

  // Dự đoán nhãn thời gian sẽ hiện trên 3 nút, để người học biết trước khi bấm.
  // Dùng peekEntry (KHÔNG side-effect) + computeNextEntry (pure) — đảm bảo preview
  // không bao giờ làm thay đổi dữ liệu thật, và luôn dùng đúng công thức với rate().
  function previewLabel(progress, wordId, rating) {
    const entry = peekEntry(progress, wordId);
    const next = computeNextEntry(entry, rating);
    // Hiện ĐÚNG thời điểm thẻ xuất hiện lại (dựa trên due), không phải intervalMin —
    // vì khi "quên" từ đã chín, intervalMin (mốc mọc tiếp) vẫn cao nhưng thẻ được
    // cho gặp lại ngay, nên nút Quên vẫn hiển thị ~1 phút cho đúng thực tế.
    const dueMin = Math.max(0, Math.round((next.due - now()) / 60000));
    return fmtInterval(dueMin);
  }

  function exportAll() {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) {
        out[key] = JSON.parse(localStorage.getItem(key));
      }
    }
    return out;
  }

  function importAll(obj) {
    Object.keys(obj).forEach((key) => {
      if (key.startsWith(STORAGE_PREFIX)) {
        localStorage.setItem(key, JSON.stringify(obj[key]));
      }
    });
  }

  return {
    loadProgress,
    saveProgress,
    getEntry,
    isDue,
    rate,
    status,
    fmtInterval,
    previewLabel,
    exportAll,
    importAll,
    forceBackToReview,
  };
})();
