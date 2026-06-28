/* ===== MODULE: grammar-groups.js — Trang "Nhóm ngữ pháp": xem theo nhóm nghĩa + họ dễ nhầm,
   học Flashcard chọn lọc theo nhóm, và Quiz chuyên biệt luyện phân biệt cấu trúc dễ nhầm.
   Dữ liệu: data/grammar-groups.json (sinh từ toàn bộ tailieu/nguphap*.json, đã dedup + phân
   loại — xem README mục 12d để biết quy trình tạo lại file này khi thêm bộ ngữ pháp mới). ===== */

async function loadGrammarGroups() {
  try {
    const res = await fetch("data/grammar-groups.json");
    App.grammarGroupsData = await res.json();
  } catch (e) {
    App.grammarGroupsData = null;
  }
}

function renderGrammarGroupsMode() {
  const body = document.getElementById("grammarGroupsBody");
  if (!App.grammarGroupsData) {
    body.innerHTML = `<div class="examnotes-empty">Không tải được dữ liệu nhóm ngữ pháp (data/grammar-groups.json).</div>`;
    return;
  }
  document.querySelectorAll(".gg-tab-btn").forEach((b) => b.classList.toggle("is-active", b.dataset.tab === App.grammarGroupsTab));
  renderGrammarGroupsTab(App.grammarGroupsTab);
}

function setGrammarGroupsTab(tab) {
  App.grammarGroupsTab = tab;
  renderGrammarGroupsMode();
}

function renderGrammarGroupsTab(tab) {
  const body = document.getElementById("grammarGroupsBody");

  if (tab === "nhomnghia") {
    body.innerHTML = App.grammarGroupsData.nhom_nghia.map((g, gi) => `
      <div class="gg-group">
        <div class="gg-group-head" data-ggidx="${gi}">
          <span class="gg-group-title">${g.so}. ${g.ten}</span>
          <span class="gg-group-count">${g.items.length} mục</span>
          <button class="gg-flash-btn" data-flash-group="${gi}">▶ Học Flashcard nhóm này</button>
        </div>
        <div class="gg-group-items hidden" id="gg-items-${gi}">
          ${g.items.map((it) => `
            <div class="gg-item">
              <div class="gg-item-cautruc">${it.cautruc}</div>
              <div class="gg-item-nghia">${it.nghia}</div>
              ${it.cau_truc_ngu_phap ? `<div class="gg-item-structure">${it.cau_truc_ngu_phap}</div>` : ""}
              ${it.vi_du ? `<div class="gg-item-vidu">${renderExampleSentences(it.vi_du)}</div>` : ""}
              ${it.dong_nghia && it.dong_nghia.length ? `<div class="gg-item-dongnghia">Đồng nghĩa: ${it.dong_nghia.join("; ")}</div>` : ""}
            </div>
          `).join("")}
        </div>
      </div>
    `).join("");

    body.querySelectorAll(".gg-group-head").forEach((h) => {
      h.addEventListener("click", (e) => {
        if (e.target.closest(".gg-flash-btn")) return;
        document.getElementById(`gg-items-${h.dataset.ggidx}`).classList.toggle("hidden");
      });
    });
    body.querySelectorAll(".gg-flash-btn").forEach((b) => {
      b.addEventListener("click", (e) => {
        e.stopPropagation();
        startGroupFlashcard(parseInt(b.dataset.flashGroup, 10));
      });
    });
  } else {
    body.innerHTML = App.grammarGroupsData.ho_de_nham.map((fam, fi) => `
      <div class="gg-family">
        <div class="gg-family-head">
          <span class="gg-family-title">⚠️ Họ: ${fam.ten}</span>
          <button class="gg-quiz-btn" data-quiz-family="${fi}">🔀 Luyện phân biệt (${fam.members.length} cấu trúc)</button>
        </div>
        <div class="gg-family-members">
          ${fam.members.map((m) => `
            <div class="gg-member ${m.co_the_chinh_thuc ? "" : "is-refonly"}">
              <div class="gg-member-cautruc">${m.cautruc}</div>
              <div class="gg-member-nghia">${m.nghia_ngan}</div>
              <div class="gg-member-khacbiet">${m.khac_biet}</div>
              ${m.vi_du ? `<div class="gg-member-vidu">${renderExampleSentences(m.vi_du)}</div>` : ""}
              ${!m.co_the_chinh_thuc ? `<div class="gg-member-tag">⚠ chỉ tham khảo — chưa có thẻ riêng</div>` : ""}
            </div>
          `).join("")}
        </div>
      </div>
    `).join("");

    body.querySelectorAll(".gg-quiz-btn").forEach((b) => {
      b.addEventListener("click", () => startFamilyQuiz(parseInt(b.dataset.quizFamily, 10)));
    });
  }
}

/* ===================================================================
   FLASHCARD CHỌN LỌC THEO NHÓM NGHĨA — lật thẻ đơn giản, xáo trộn thứ tự,
   KHÔNG dùng chung hệ thống flashcard chính (vốn gắn với 1 deck cụ thể) vì
   1 nhóm nghĩa gộp cấu trúc từ NHIỀU bộ NGUPHAP khác nhau cùng lúc.
=================================================================== */
let ggFlashState = { items: [], idx: 0, flipped: false, title: "" };

function startGroupFlashcard(groupIdx) {
  const group = App.grammarGroupsData.nhom_nghia[groupIdx];
  ggFlashState = { items: shuffle(group.items), idx: 0, flipped: false, title: `${group.so}. ${group.ten}` };
  document.getElementById("ggFlashModalOverlay").classList.remove("hidden");
  renderGgFlashCard();
}

function renderGgFlashCard() {
  const { items, idx, flipped, title } = ggFlashState;
  const it = items[idx];
  document.getElementById("ggFlashTitle").textContent = `${title} — ${idx + 1}/${items.length}`;
  const inner = document.getElementById("ggFlashCardInner");
  if (!flipped) {
    inner.innerHTML = `<div class="cf-cautruc gg-flash-front-cautruc">${it.cautruc}</div><div class="gg-flash-hint">(bấm để xem nghĩa)</div>`;
  } else {
    inner.innerHTML = `
      <div class="cf-cautruc">${it.cautruc}</div>
      <div class="cf-nghia">${it.nghia}</div>
      ${it.cau_truc_ngu_phap ? `<div class="cf-ngphap-structure">${it.cau_truc_ngu_phap}</div>` : ""}
      ${it.vi_du ? `<div class="cf-vidu">${renderExampleSentences(it.vi_du)}</div>` : ""}
    `;
  }
  inner.classList.toggle("is-back", flipped);
}

function ggFlashFlip() {
  ggFlashState.flipped = !ggFlashState.flipped;
  renderGgFlashCard();
}
function ggFlashNext() {
  ggFlashState.idx = (ggFlashState.idx + 1) % ggFlashState.items.length;
  ggFlashState.flipped = false;
  renderGgFlashCard();
}
function ggFlashPrev() {
  ggFlashState.idx = (ggFlashState.idx - 1 + ggFlashState.items.length) % ggFlashState.items.length;
  ggFlashState.flipped = false;
  renderGgFlashCard();
}
function closeGgFlashModal() {
  document.getElementById("ggFlashModalOverlay").classList.add("hidden");
}

/* ===================================================================
   QUIZ "LUYỆN PHÂN BIỆT" — cho 1 họ dễ nhầm: hiện nghĩa, chọn ĐÚNG cấu trúc
   tương ứng trong số các thành viên cùng họ (trắc nghiệm đối chiếu trực tiếp
   các cấu trúc DỄ NHẦM với nhau — đúng mục tiêu "phân biệt", không phải học
   nghĩa đơn lẻ như flashcard thường).
=================================================================== */
let ggQuizState = { fam: null, order: [], idx: 0, score: 0, answered: false };

function startFamilyQuiz(famIdx) {
  const fam = App.grammarGroupsData.ho_de_nham[famIdx];
  if (fam.members.length < 2) return;
  ggQuizState = { fam, order: shuffle(fam.members.map((_, i) => i)), idx: 0, score: 0, answered: false };
  document.getElementById("ggQuizModalOverlay").classList.remove("hidden");
  document.getElementById("ggQuizBody").innerHTML = `
    <div class="gg-quiz-prompt" id="ggQuizPrompt"></div>
    <div class="quiz-options" id="ggQuizOptions"></div>
    <div class="gg-quiz-explain hidden" id="ggQuizExplain"></div>
    <button class="gg-quiz-next-btn hidden" id="btnGgQuizNext">Câu tiếp →</button>
  `;
  document.getElementById("btnGgQuizNext").addEventListener("click", ggQuizNext);
  renderGgQuizQuestion();
}

function renderGgQuizQuestion() {
  const { fam, order, idx } = ggQuizState;
  const correctIdx = order[idx];
  const correct = fam.members[correctIdx];
  ggQuizState.answered = false;
  document.getElementById("ggQuizTitle").textContent = `⚠️ ${fam.ten} — Câu ${idx + 1}/${order.length} (Điểm: ${ggQuizState.score})`;
  document.getElementById("ggQuizPrompt").innerHTML = `Cấu trúc nào có nghĩa:<br><b>"${correct.nghia_ngan}"</b>?`;
  document.getElementById("ggQuizOptions").innerHTML = fam.members.map((m, i) =>
    `<button class="quiz-opt" data-idx="${i}">${m.cautruc}</button>`
  ).join("");
  document.getElementById("ggQuizExplain").classList.add("hidden");
  document.getElementById("btnGgQuizNext").classList.add("hidden");
  document.querySelectorAll("#ggQuizOptions .quiz-opt").forEach((btn) => {
    btn.addEventListener("click", () => handleGgQuizAnswer(parseInt(btn.dataset.idx, 10), correctIdx));
  });
}

function handleGgQuizAnswer(chosenIdx, correctIdx) {
  if (ggQuizState.answered) return;
  ggQuizState.answered = true;
  const { fam } = ggQuizState;
  const isCorrect = chosenIdx === correctIdx;
  if (isCorrect) ggQuizState.score++;
  document.querySelectorAll("#ggQuizOptions .quiz-opt").forEach((btn, i) => {
    btn.disabled = true;
    if (i === correctIdx) btn.classList.add("correct");
    else if (i === chosenIdx) btn.classList.add("wrong");
  });
  const correct = fam.members[correctIdx];
  document.getElementById("ggQuizExplain").innerHTML = `
    <div class="cf-block-label">${isCorrect ? "✓ Đúng!" : "✕ Sai — đáp án đúng là " + correct.cautruc}</div>
    <div class="gg-member-khacbiet">${correct.khac_biet}</div>
    ${correct.vi_du ? `<div class="cf-vidu">${renderExampleSentences(correct.vi_du)}</div>` : ""}
  `;
  document.getElementById("ggQuizExplain").classList.remove("hidden");
  document.getElementById("btnGgQuizNext").classList.remove("hidden");
}

function ggQuizNext() {
  ggQuizState.idx++;
  if (ggQuizState.idx >= ggQuizState.order.length) {
    document.getElementById("ggQuizBody").innerHTML = `
      <div class="gg-quiz-result">🎉 Hoàn thành họ "${ggQuizState.fam.ten}"!<br>Điểm: ${ggQuizState.score}/${ggQuizState.order.length}</div>
      <button class="gg-quiz-next-btn" id="btnGgQuizRetry">↻ Làm lại họ này</button>
    `;
    document.getElementById("ggQuizTitle").textContent = `⚠️ ${ggQuizState.fam.ten} — Hoàn thành`;
    document.getElementById("btnGgQuizRetry").addEventListener("click", () => {
      const famIdx = App.grammarGroupsData.ho_de_nham.indexOf(ggQuizState.fam);
      startFamilyQuiz(famIdx);
    });
  } else {
    renderGgQuizQuestion();
  }
}

function closeGgQuizModal() {
  document.getElementById("ggQuizModalOverlay").classList.add("hidden");
}
