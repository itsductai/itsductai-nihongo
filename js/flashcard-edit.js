/* ===== MODULE: flashcard-edit.js — Panel cấu hình field/cột, render mặt thẻ, modal sửa từ, mode Flashcard ===== */

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

/* ===================================================================
   POPUP "NGỮ PHÁP LIÊN QUAN" — bấm nút 🔗 trên thẻ flashcard/SRS NGUPHAP để
   xem TẤT CẢ cấu trúc đồng nghĩa (cùng nhóm nghĩa, sắc thái khác chút nhưng
   thi ít phân biệt) + cấu trúc DỄ NHẦM (giống cấu trúc/chữ nhưng nghĩa khác)
   của 1 cấu trúc, kèm nghĩa thật (tra qua App.grammarIndex) để học tối ưu.
=================================================================== */
function openGrammarRelatedPopup(cautruc) {
  const word = findGrammarByCautruc(cautruc);
  if (!word) return;

  const dongNghiaItems = (word.dong_nghia || []).map((item) => {
    const str = typeof item === "string" ? item : item.kanji;
    const found = findGrammarByCautruc(str);
    return { cautruc: str, nghia: found ? found.nghia : (typeof item === "object" ? item.nghia : null) };
  });
  const deNhamItems = (word.so_sanh_de_nham || []).map((item) => {
    const found = findGrammarByCautruc(item.cautruc);
    return { cautruc: item.cautruc, khac_biet: item.khac_biet, nghia: found ? found.nghia : null };
  });

  let html = `<div class="grammar-related-current"><div class="cf-cautruc">${word.cautruc}</div><div class="cf-nghia">${word.nghia}</div></div>`;

  if (dongNghiaItems.length) {
    html += `<div class="cf-block-label">🟢 Đồng nghĩa — cùng nhóm nghĩa/lập trường, sắc thái có thể khác chút nhưng đề thi ít phân biệt</div>`;
    html += dongNghiaItems.map((it) => `
      <div class="grammar-related-item is-dongnghia">
        <div class="grammar-related-cautruc">${it.cautruc}</div>
        ${it.nghia
          ? `<div class="grammar-related-nghia">${it.nghia}</div>`
          : `<div class="grammar-related-nghia is-unknown">(chưa tra được nghĩa — cấu trúc này chưa có trong dữ liệu hiện tại)</div>`}
      </div>
    `).join("");
  }

  if (deNhamItems.length) {
    html += `<div class="cf-block-label">⚠️ Dễ nhầm — cấu trúc/chữ tương tự nhưng nghĩa khác, chú ý phân biệt</div>`;
    html += deNhamItems.map((it) => `
      <div class="grammar-related-item is-denham">
        <div class="grammar-related-cautruc">${it.cautruc}${it.nghia ? ` <span class="grammar-related-nghia-inline">— ${it.nghia}</span>` : ""}</div>
        <div class="grammar-related-khacbiet">${it.khac_biet}</div>
      </div>
    `).join("");
  }

  if (!dongNghiaItems.length && !deNhamItems.length) {
    html += `<div class="examnotes-empty">Cấu trúc này chưa có dữ liệu đồng nghĩa/dễ nhầm.</div>`;
  }

  document.getElementById("grammarRelatedTitle").textContent = `🔗 Ngữ pháp liên quan với "${word.cautruc}"`;
  document.getElementById("grammarRelatedBody").innerHTML = html;
  document.getElementById("grammarRelatedModalOverlay").classList.remove("hidden");
}

function closeGrammarRelatedPopup() {
  document.getElementById("grammarRelatedModalOverlay").classList.add("hidden");
}

function renderCardFace(containerEl, word, fieldKeys) {
  const type = App.currentDeckType;
  const meta = FIELD_META[type];
  const html = fieldKeys
    .map((key) => (meta[key] ? meta[key].render(word) : ""))
    .filter(Boolean)
    .join("");
  // Nút "Xem ngữ pháp liên quan/dễ nhầm" — chỉ hiện cho NGUPHAP, CHỈ khi mặt
  // thẻ đang render này có cấu hình hiện field dong_nghia/so_sanh_de_nham
  // (tôn trọng đúng cấu hình ẩn/hiện field người dùng đã chọn), VÀ từ này
  // thực sự có dữ liệu liên quan để xem (không hiện nút vô nghĩa).
  let extra = "";
  if (type === "NGUPHAP" && (fieldKeys.includes("dong_nghia") || fieldKeys.includes("so_sanh_de_nham"))) {
    const hasRelated = (word.dong_nghia && word.dong_nghia.length) || (word.so_sanh_de_nham && word.so_sanh_de_nham.length);
    if (hasRelated) {
      extra = `<button class="grammar-related-btn" data-cautruc="${String(word.cautruc).replace(/"/g, "&quot;")}">🔗 Xem ngữ pháp liên quan / dễ nhầm</button>`;
    }
  }
  containerEl.innerHTML = (html || '<div class="cf-nghia">(chưa chọn field hiển thị)</div>') + extra;
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
  if (App.currentDeckType === "NGUPHAP") buildGrammarIndex();

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

  // Luôn cuộn về đầu nội dung mỗi khi đổi sang thẻ mới — tránh tình trạng thẻ
  // mới hiện ra nhưng còn giữ nguyên vị trí cuộn cũ của thẻ trước (gây mất chữ
  // đầu dòng vì người học chưa cuộn lên mà đã thấy giữa/cuối nội dung).
  document.getElementById("flashFront").scrollTop = 0;
  document.getElementById("flashBack").scrollTop = 0;

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

