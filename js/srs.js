/* ===== SRS kiểu Anki (SM-2 đơn giản hóa) =====
   3 nút: Quên (Again) / Khó (Hard) / Dễ (Easy)
   - Quên: luôn về lại 1 phút, ease factor giảm nhẹ
   - Khó: interval hiện tại x1.2 (tối thiểu 6 phút)
   - Dễ: interval hiện tại x2.5 (lần đầu: 10 phút), nếu đã qua "graduate" (>=1 ngày) thì x4

   Trạng thái mỗi từ lưu trong localStorage theo key riêng từng bộ:
   { intervalMin: số phút tới lần ôn tiếp theo,
     ease: hệ số dễ (mặc định 2.5),
     due: timestamp (ms) của lần ôn tiếp theo,
     reps: số lần đã ôn,
     seen: đã từng học chưa,
     lastRating: 'again' | 'hard' | 'easy' }
*/

const SRS = (() => {
  const STORAGE_PREFIX = "n2vocab_progress_";
  const MIN_INTERVAL = 1;       // phút, mốc khởi đầu khi "Quên"
  const FIRST_EASY = 10;        // phút, lần đầu bấm "Dễ"
  const FIRST_HARD = 6;         // phút, lần đầu bấm "Khó"
  const GRADUATE_THRESHOLD = 1440; // 1 ngày (phút) — sau ngưỡng này coi là đã "trưởng thành"
  const DEFAULT_EASE = 2.5;

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

  function getEntry(progress, wordId) {
    if (!progress[wordId]) {
      progress[wordId] = {
        intervalMin: 0,
        ease: DEFAULT_EASE,
        due: now(),
        reps: 0,
        seen: false,
        lastRating: null,
      };
    }
    return progress[wordId];
  }

  function isDue(entry) {
    return entry.due <= now();
  }

  // rating: 'again' | 'hard' | 'easy'
  function rate(progress, wordId, rating) {
    const entry = getEntry(progress, wordId);
    entry.seen = true;
    entry.reps += 1;
    entry.lastRating = rating;

    if (rating === "again") {
      entry.intervalMin = MIN_INTERVAL;
      entry.ease = Math.max(1.3, entry.ease - 0.2);
    } else if (rating === "hard") {
      if (entry.intervalMin === 0) {
        entry.intervalMin = FIRST_HARD;
      } else {
        entry.intervalMin = Math.max(FIRST_HARD, Math.round(entry.intervalMin * 1.2));
      }
      entry.ease = Math.max(1.3, entry.ease - 0.05);
    } else if (rating === "easy") {
      if (entry.intervalMin === 0) {
        entry.intervalMin = FIRST_EASY;
      } else if (entry.intervalMin < GRADUATE_THRESHOLD) {
        entry.intervalMin = Math.round(entry.intervalMin * entry.ease);
      } else {
        entry.intervalMin = Math.round(entry.intervalMin * (entry.ease + 1.5));
      }
      entry.ease = Math.min(3.5, entry.ease + 0.1);
    }

    entry.due = now() + entry.intervalMin * 60 * 1000;
    return entry;
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

  // Dự đoán nhãn thời gian sẽ hiện trên 3 nút, để người học biết trước khi bấm
  function previewLabel(progress, wordId, rating) {
    const entry = getEntry(progress, wordId);
    const clone = { ...entry };
    rate({ [wordId]: clone }, wordId, rating);
    return fmtInterval(clone.intervalMin);
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
