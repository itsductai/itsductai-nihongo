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
  const GRADUATED_EASY_BONUS = 1.5; // cộng thêm vào ease khi tính Dễ sau khi đã "trưởng thành"

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

    if (rating === "again") {
      next.intervalMin = MIN_INTERVAL;
      next.ease = Math.max(MIN_EASE, entry.ease - 0.2);
    } else if (rating === "hard") {
      next.intervalMin =
        entry.intervalMin === 0 ? FIRST_HARD : Math.round(entry.intervalMin * HARD_MULTIPLIER);
      next.ease = Math.max(MIN_EASE, entry.ease - 0.05);
    } else if (rating === "easy") {
      if (entry.intervalMin === 0) {
        next.intervalMin = FIRST_EASY;
      } else if (entry.intervalMin < GRADUATE_THRESHOLD) {
        next.intervalMin = Math.round(entry.intervalMin * entry.ease);
      } else {
        next.intervalMin = Math.round(entry.intervalMin * (entry.ease + GRADUATED_EASY_BONUS));
      }
      next.ease = Math.min(MAX_EASE, entry.ease + 0.1);
    }

    next.due = now() + next.intervalMin * 60 * 1000;
    return next;
  }

  // rating: 'again' | 'hard' | 'easy' — ghi nhận thật, có side-effect vào progress
  function rate(progress, wordId, rating) {
    const entry = getEntry(progress, wordId);
    const next = computeNextEntry(entry, rating);
    progress[wordId] = next;
    return next;
  }

  // Trạng thái hiển thị: new / learning (chưa qua 1 ngày) / known (đã "trưởng thành")
  function status(entry) {
    if (!entry || !entry.seen) return "new";
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
    return fmtInterval(next.intervalMin);
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
  };
})();
