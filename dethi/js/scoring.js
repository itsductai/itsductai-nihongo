/* ===== MODULE: scoring.js — Mô phỏng cách chấm điểm JLPT N2 (Linear Score + Simulated IRT
   Score, công thức tham khảo từ tài liệu đặc tả "JLPT N2 Scoring Engine") — áp dụng LINH ĐỘNG
   theo đúng cấu trúc Mondai THẬT của từng đề (không hardcode tổng số câu/full-format), vì đề
   trong app có thể chỉ là 1 phần của bài thi đầy đủ (vd chỉ Mondai 1-6, hoặc chỉ Mondai 1-9).

   QUAN TRỌNG: trọng số (weight) mỗi Mondai theo SỐ THỨ TỰ Mondai là KHÔNG ĐỔI giữa
   FORMAT_OLD và FORMAT_NEW (chỉ SỐ CÂU của vài Mondai khác nhau giữa 2 format — xem tài
   liệu đặc tả mục 2). Vì vậy không cần phân biệt OLD/NEW khi tính: chỉ cần biết Mondai
   nào có bao nhiêu câu TRONG ĐỀ NÀY (đọc từ `mondai_breakdown` của đề thi chữ, hoặc đếm
   trực tiếp từ cấu trúc `test.mondai[]` có sẵn của đề nghe) rồi áp đúng trọng số theo số
   Mondai — ra điểm chính xác cho ĐÚNG PHẦN đề đó đang test, "tùy đề tùy mondai" như yêu cầu.
=================================================================== */

// Trọng số CỐ ĐỊNH theo số thứ tự Mondai (giống nhau cho cả FORMAT_OLD/FORMAT_NEW).
const SCORING_WEIGHTS = {
  // Kiến thức ngôn ngữ (Moji-Goi-Bunpou) — Mondai 1-9 của đề thi chữ trong app
  lang: { 1: 1, 2: 1, 3: 1, 4: 1, 5: 1, 6: 1, 7: 1, 8: 2, 9: 2 },
  // Đọc hiểu (Dokkai) — Mondai 10-14 — CHƯA có đề nào trong app dùng tới, để sẵn cho sau
  reading: { 10: 3, 11: 3, 12: 3, 13: 3, 14: 3 },
  // Nghe hiểu (Choukai) — Mondai 1-5 của đề nghe
  listening: { 1: 2, 2: 2.5, 3: 3, 4: 1, 5: 3 },
};

function calculateRawScore(correctCountByMondai, weightTable) {
  let raw = 0;
  for (const mondaiNum in correctCountByMondai) {
    const w = weightTable[mondaiNum] ?? 0;
    raw += correctCountByMondai[mondaiNum] * w;
  }
  return raw;
}

function calculateMaxRawScore(totalCountByMondai, weightTable) {
  let max = 0;
  for (const mondaiNum in totalCountByMondai) {
    const w = weightTable[mondaiNum] ?? 0;
    max += totalCountByMondai[mondaiNum] * w;
  }
  return max;
}

// Điểm tuyến tính — chia tỉ lệ cơ học, quy về thang 60 (thang điểm chuẩn JLPT mỗi phần).
function calculateLinearScore(rawScore, maxRawScore) {
  if (!maxRawScore) return 0;
  return Math.round((rawScore / maxRawScore) * 60);
}

// Điểm IRT mô phỏng — dùng hàm lũy thừa số mũ 1.15 để "phạt nặng hơn" các mức điểm thô
// thấp (mô phỏng việc IRT thật của JLPT trừng phạt khoanh lụi mạnh hơn ở vùng điểm thấp).
function calculateIRTScore(rawScore, maxRawScore) {
  if (!maxRawScore) return 0;
  const p = rawScore / maxRawScore;
  return Math.round(60 * Math.pow(p, 1.15));
}

// Trả về { rawScore, maxRawScore, linearScore, irtScore, byMondai: [{mondai, correct, total, weight}] }
function computeJlptScoring(correctCountByMondai, totalCountByMondai, weightTable) {
  const rawScore = calculateRawScore(correctCountByMondai, weightTable);
  const maxRawScore = calculateMaxRawScore(totalCountByMondai, weightTable);
  const byMondai = Object.keys(totalCountByMondai).map(Number).sort((a, b) => a - b).map((m) => ({
    mondai: m,
    correct: correctCountByMondai[m] || 0,
    total: totalCountByMondai[m],
    weight: weightTable[m] ?? 0,
  }));
  return {
    rawScore, maxRawScore,
    linearScore: calculateLinearScore(rawScore, maxRawScore),
    irtScore: calculateIRTScore(rawScore, maxRawScore),
    byMondai,
  };
}

/* ---------- Áp dụng cho ĐỀ THI CHỮ (dethi) ---------- */
// Đọc `exam.mondai_breakdown` (mảng {mondai, ten, so_cau} liên tiếp) để biết câu qIndex nào
// thuộc Mondai nào, rồi đối chiếu với App.examHistory (đã có firstTryCorrect từng câu).
function computeExamJlptScoring(examId, examHistorySource) {
  const exam = App.exams.find((e) => e.id === examId);
  if (!exam || !exam.mondai_breakdown) return null;

  const totalCountByMondai = {};
  const correctCountByMondai = {};
  let qIndex = 0;
  for (const seg of exam.mondai_breakdown) {
    totalCountByMondai[seg.mondai] = seg.so_cau;
    let correct = 0;
    for (let i = 0; i < seg.so_cau; i++) {
      const hist = examHistorySource[qIndex];
      if (hist && hist.firstTryCorrect) correct++;
      qIndex++;
    }
    correctCountByMondai[seg.mondai] = correct;
  }
  return computeJlptScoring(correctCountByMondai, totalCountByMondai, SCORING_WEIGHTS.lang);
}

/* ---------- Áp dụng cho ĐỀ NGHE (choukai) ---------- */
// Đề nghe đã có sẵn cấu trúc test.mondai[] với .number — đếm trực tiếp số câu thật + số câu
// đúng (từ App.choukaiAnswers) theo từng Mondai, không cần thêm field gì vào file JSON.
function computeChoukaiJlptScoring(test, answersSource, mondaiFilter) {
  if (!test || !test.mondai) return null;
  const totalCountByMondai = {};
  const correctCountByMondai = {};
  test.mondai.forEach((m) => {
    if (mondaiFilter && mondaiFilter !== "all" && m.number !== mondaiFilter) return; // chỉ tính đúng Mondai đã luyện
    m.questions.forEach((q) => {
      const subCount = q.isDualQuestion ? q.subQuestions.length : 1;
      totalCountByMondai[m.number] = (totalCountByMondai[m.number] || 0) + subCount;
      correctCountByMondai[m.number] = correctCountByMondai[m.number] || 0;
      if (q.isDualQuestion) {
        q.subQuestions.forEach((sub, subIdx) => {
          const key = choukaiKeyFor(m.number, q.qnum, subIdx);
          const ans = answersSource[key];
          if (ans && ans.correct) correctCountByMondai[m.number]++;
        });
      } else {
        const key = choukaiKeyFor(m.number, q.qnum, null);
        const ans = answersSource[key];
        if (ans && ans.correct) correctCountByMondai[m.number]++;
      }
    });
  });
  return computeJlptScoring(correctCountByMondai, totalCountByMondai, SCORING_WEIGHTS.listening);
}

/* ---------- Render HTML hiển thị kết quả — dùng chung cho cả 2 loại đề ---------- */
function renderJlptScoreBox(scoring, label) {
  if (!scoring) return "";
  const rows = scoring.byMondai.map((b) => `
    <div class="jlpt-mondai-row">
      <span class="jlpt-mondai-no">Mondai ${b.mondai}</span>
      <span class="jlpt-mondai-frac">${b.correct}/${b.total} câu</span>
      <span class="jlpt-mondai-weight">×${b.weight}đ</span>
    </div>
  `).join("");
  return `
    <div class="jlpt-score-box">
      <div class="jlpt-score-title">📊 Mô phỏng điểm JLPT — ${label} (thang 0-60)</div>
      <div class="jlpt-score-main">
        <div class="jlpt-score-item">
          <div class="jlpt-score-num">${scoring.linearScore}</div>
          <div class="jlpt-score-label">Điểm tuyến tính<br><span class="jlpt-score-sub">(chia tỉ lệ đều)</span></div>
        </div>
        <div class="jlpt-score-item is-irt">
          <div class="jlpt-score-num">${scoring.irtScore}</div>
          <div class="jlpt-score-label">Điểm IRT mô phỏng<br><span class="jlpt-score-sub">(phạt nặng điểm thấp)</span></div>
        </div>
      </div>
      <div class="jlpt-score-raw">Điểm thô: ${scoring.rawScore}/${scoring.maxRawScore}</div>
      <details class="jlpt-mondai-detail">
        <summary>Xem chi tiết theo từng Mondai</summary>
        ${rows}
      </details>
      <div class="jlpt-score-disclaimer">⚠️ Đây là điểm MÔ PHỎNG để tham khảo xu hướng, KHÔNG phải điểm thi thật (JLPT dùng IRT thật phức tạp hơn nhiều, không công khai công thức chính xác).</div>
    </div>
  `;
}
