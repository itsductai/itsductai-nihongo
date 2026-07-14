/* =========================================================================
   ĐỘ BAO PHỦ TỪ VỰNG — biểu đồ Euler (vòng tròn chồng lấn theo số từ trùng)
   =========================================================================
   Ý tưởng: mỗi bộ (hoặc mỗi cấp độ) = 1 hình tròn.
     - DIỆN TÍCH vòng tròn tỉ lệ với SỐ TỪ của bộ đó (nên bán kính = k*√n,
       KHÔNG phải k*n — nếu lấy bán kính tỉ lệ thẳng với số từ thì mắt người
       sẽ thấy sai lệch rất nặng vì diện tích tăng theo bình phương).
     - KHOẢNG CÁCH giữa 2 tâm được tìm sao cho DIỆN TÍCH GIAO của 2 hình tròn
       ≈ đúng tỉ lệ số từ trùng nhau thật sự giữa 2 bộ.

   Vì sao không vẽ Venn "chuẩn" mà phải xấp xỉ:
     Với >3 tập hợp, TOÁN HỌC ĐÃ CHỨNG MINH là không tồn tại cách vẽ bằng hình
     tròn sao cho MỌI vùng giao đều đúng diện tích. Ta có tới 6 bộ. Nên đây là
     phép XẤP XỈ TỐT NHẤT (force-directed): mỗi cặp bộ kéo/đẩy nhau cho tới khi
     khoảng cách giữa chúng gần nhất có thể với khoảng cách "lý tưởng".
     => Con số hiển thị (bảng + ma trận + danh sách từ) LUÔN CHÍNH XÁC 100%;
        chỉ có hình vẽ là xấp xỉ. Đừng đọc số bằng cách "ước lượng" diện tích.

   Tự động co giãn: thêm bộ mới vào tailieu/ là biểu đồ tự thêm vòng tròn, tự
   tính lại layout — không phải sửa code.
   ========================================================================= */

const Coverage = (() => {
  const SERIES_LABELS = {
    mimi: "Mimikara oboeru",
    tango: "Tango N2",
    n2vocab: "JLPT N2",
    n1vocab: "JLPT N1",
    n3vocab: "JLPT N3",
    khac: "Tài liệu khác",
  };
  const SERIES_COLORS = {
    mimi: "#48c98c",     // xanh lá
    tango: "#ff6b6b",    // đỏ
    n2vocab: "#a98bff",  // tím
    n1vocab: "#ff9f43",  // cam  (KHÔNG dùng tím nữa: 3 sắc tím cạnh nhau nhìn không phân biệt được)
    n3vocab: "#4dabf7",  // xanh dương
    khac: "#94a3b8",     // xám
  };
  const LEVEL_COLORS = { N1: "#ff9f43", N2: "#a98bff", N3: "#4dabf7", KHAC: "#94a3b8" };
  const ORDER = ["mimi", "tango", "n2vocab", "n1vocab", "n3vocab", "khac"];

  let state = { scope: "series", hideSmall: true, sets: [], selection: null };

  /* ---------- 1. GOM DỮ LIỆU ----------
     Dùng App.decks (đã nạp từ manifest-thin) — manifest-thin CÓ sẵn `kanji`,
     nên KHÔNG cần tải deck dày => trang thống kê mở là vẽ được ngay. */
  function collectSets(scope) {
    const map = new Map(); // key -> Set(kanji)
    (App.decks || []).forEach((deck) => {
      if (deck.type !== "TUVUNG") return;
      let key;
      if (scope === "level") {
        key = deck.level || "KHAC";
      } else {
        key = deck.series || "khac";
      }
      if (!map.has(key)) map.set(key, new Set());
      const set = map.get(key);
      (deck.words || []).forEach((w) => {
        const k = (w.kanji || "").trim();
        if (k) set.add(k);
      });
    });

    let sets = [...map.entries()].map(([key, words]) => ({
      key,
      label: scope === "level" ? (key === "KHAC" ? "Khác" : key) : (SERIES_LABELS[key] || key),
      color: scope === "level" ? (LEVEL_COLORS[key] || "#94a3b8") : (SERIES_COLORS[key] || "#94a3b8"),
      words,
      size: words.size,
    }));

    if (state.hideSmall) sets = sets.filter((s) => s.size >= 50);

    // thứ tự cố định (Mimi -> Tango -> JLPT -> khác), bộ to vẽ trước (nằm dưới)
    sets.sort((a, b) => {
      if (scope === "series") {
        const d = ORDER.indexOf(a.key) - ORDER.indexOf(b.key);
        if (d !== 0) return d;
      }
      return b.size - a.size;
    });
    return sets;
  }

  /* ---------- 2. HÌNH HỌC ----------
     Diện tích giao của 2 đường tròn bán kính r1,r2, khoảng cách tâm d
     (công thức "circular lens" chuẩn). */
  function lensArea(r1, r2, d) {
    if (d >= r1 + r2) return 0;                    // rời nhau
    if (d <= Math.abs(r1 - r2)) return Math.PI * Math.min(r1, r2) ** 2; // lồng hẳn vào nhau
    const a1 = r1 * r1 * Math.acos((d * d + r1 * r1 - r2 * r2) / (2 * d * r1));
    const a2 = r2 * r2 * Math.acos((d * d + r2 * r2 - r1 * r1) / (2 * d * r2));
    const a3 = 0.5 * Math.sqrt((-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2));
    return a1 + a2 - a3;
  }

  // Tìm ngược: cần khoảng cách tâm bao nhiêu để diện tích giao ĐÚNG bằng target.
  // lensArea giảm đơn điệu theo d => chặt nhị phân là đủ và luôn hội tụ.
  function distanceForOverlap(r1, r2, targetArea) {
    if (targetArea <= 0) return r1 + r2;                 // không trùng từ nào -> chỉ chạm nhau
    const maxOverlap = Math.PI * Math.min(r1, r2) ** 2;
    if (targetArea >= maxOverlap) return Math.abs(r1 - r2); // trùng hoàn toàn -> lồng vào nhau
    let lo = Math.abs(r1 - r2), hi = r1 + r2;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (lensArea(r1, r2, mid) > targetArea) lo = mid; else hi = mid;
    }
    return (lo + hi) / 2;
  }

  /* ---------- 3. LAYOUT (force-directed) ----------
     Mỗi cặp có 1 khoảng cách "lý tưởng" (từ distanceForOverlap). Ta đẩy/kéo các
     tâm dần dần về phía thoả mãn đồng thời nhiều cặp nhất có thể. */
  function layout(sets, W, H) {
    const n = sets.length;
    if (!n) return [];
    const totalWords = sets.reduce((s, x) => s + x.size, 0) || 1;

    // Bán kính: tỉ lệ CĂN BẬC HAI của số từ (để DIỆN TÍCH mới tỉ lệ với số từ).
    // scale chọn sao cho tổng diện tích chiếm ~1 phần khung vẽ, tránh tràn.
    const maxR = Math.min(W, H) * 0.30;
    const kR = maxR / Math.sqrt(Math.max(...sets.map((s) => s.size)));
    const nodes = sets.map((s, i) => ({
      ...s,
      r: Math.max(18, kR * Math.sqrt(s.size)),
      // xếp vòng tròn ban đầu cho đỡ chồng dính 1 chỗ
      x: W / 2 + Math.cos((i / n) * 2 * Math.PI) * (Math.min(W, H) * 0.18),
      y: H / 2 + Math.sin((i / n) * 2 * Math.PI) * (Math.min(W, H) * 0.18),
    }));

    // khoảng cách mong muốn cho từng cặp
    const pairs = [];
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const shared = intersect(nodes[i].words, nodes[j].words).size;
        // diện tích giao MONG MUỐN = (tỉ lệ từ trùng) quy đổi sang diện tích.
        // Lấy theo bộ nhỏ hơn để tỉ lệ có ý nghĩa trực quan.
        const rSmall = Math.min(nodes[i].r, nodes[j].r);
        const sizeSmall = Math.min(nodes[i].size, nodes[j].size);
        const frac = sizeSmall ? shared / sizeSmall : 0;
        const targetArea = frac * Math.PI * rSmall * rSmall;
        pairs.push({ i, j, shared, target: distanceForOverlap(nodes[i].r, nodes[j].r, targetArea) });
      }
    }

    for (let iter = 0; iter < 600; iter++) {
      const damp = 0.10 * (1 - iter / 600) + 0.02;
      pairs.forEach((p) => {
        const a = nodes[p.i], b = nodes[p.j];
        let dx = b.x - a.x, dy = b.y - a.y;
        let d = Math.hypot(dx, dy) || 0.01;
        const diff = (d - p.target) / d;
        const mx = dx * diff * damp * 0.5;
        const my = dy * diff * damp * 0.5;
        a.x += mx; a.y += my;
        b.x -= mx; b.y -= my;
      });
      // giữ trong khung
      nodes.forEach((nd) => {
        nd.x = Math.max(nd.r + 6, Math.min(W - nd.r - 6, nd.x));
        nd.y = Math.max(nd.r + 6, Math.min(H - nd.r - 6, nd.y));
      });
    }
    // căn giữa lại cụm
    const cx = nodes.reduce((s, d) => s + d.x, 0) / n;
    const cy = nodes.reduce((s, d) => s + d.y, 0) / n;
    nodes.forEach((nd) => { nd.x += W / 2 - cx; nd.y += H / 2 - cy; });
    return nodes;
  }

  function intersect(a, b) {
    const [small, big] = a.size <= b.size ? [a, b] : [b, a];
    const out = new Set();
    small.forEach((v) => { if (big.has(v)) out.add(v); });
    return out;
  }

  /* ---------- 4. VẼ ---------- */
  function render() {
    const svg = document.getElementById("covVenn");
    if (!svg) return;
    const W = 640, H = 460;
    state.sets = collectSets(state.scope);
    const nodes = layout(state.sets, W, H);

    if (!nodes.length) {
      svg.innerHTML = `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="var(--text-2)">Chưa có bộ từ vựng nào.</text>`;
      renderLegend([]); renderMatrix([]); return;
    }

    // Vòng to vẽ trước (nằm dưới) để vòng nhỏ không bị che
    const drawOrder = [...nodes].sort((a, b) => b.r - a.r);
    let html = "";
    drawOrder.forEach((nd) => {
      const sel = state.selection && state.selection.type === "set" && state.selection.key === nd.key;
      html += `<circle class="cov-circle${sel ? " selected" : ""}" data-key="${nd.key}"
                 cx="${nd.x.toFixed(1)}" cy="${nd.y.toFixed(1)}" r="${nd.r.toFixed(1)}"
                 fill="${nd.color}" stroke="${nd.color}"></circle>`;
    });

    // --- NHÃN ---
    // Đặt nhãn ở tâm vòng thì các vòng nhỏ nằm chen giữa sẽ đè chữ lên nhau
    // (Mimi / Tài liệu khác dính chùm ở giữa). Nên: bắt đầu từ tâm, rồi đẩy các
    // hộp nhãn ra khỏi nhau; nhãn nào bị đẩy đi xa thì kẻ 1 đường dẫn về tâm vòng.
    const LW = 96, LH = 30; // kích thước hộp nhãn ước lượng
    const labels = nodes.map((nd) => ({ nd, x: nd.x, y: nd.y }));
    for (let it = 0; it < 200; it++) {
      for (let i = 0; i < labels.length; i++) {
        for (let j = i + 1; j < labels.length; j++) {
          const a = labels[i], b = labels[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const ox = LW - Math.abs(dx);   // độ chồng lấn ngang
          const oy = LH - Math.abs(dy);   // độ chồng lấn dọc
          if (ox > 0 && oy > 0) {
            // đẩy theo trục nào chồng ít hơn -> dịch chuyển nhỏ nhất
            if (oy < ox) {
              const s = (dy >= 0 ? 1 : -1) * oy * 0.5;
              a.y -= s; b.y += s;
            } else {
              const s = (dx >= 0 ? 1 : -1) * ox * 0.5;
              a.x -= s; b.x += s;
            }
          }
        }
      }
      labels.forEach((l) => {
        l.x = Math.max(LW / 2, Math.min(W - LW / 2, l.x));
        l.y = Math.max(14, Math.min(H - 10, l.y));
      });
    }
    labels.forEach((l) => {
      const moved = Math.hypot(l.x - l.nd.x, l.y - l.nd.y);
      if (moved > 12) {
        html += `<line class="cov-leader" x1="${l.nd.x.toFixed(1)}" y1="${l.nd.y.toFixed(1)}"
                   x2="${l.x.toFixed(1)}" y2="${(l.y - 4).toFixed(1)}" stroke="${l.nd.color}"></line>
                 <circle class="cov-leader-dot" cx="${l.nd.x.toFixed(1)}" cy="${l.nd.y.toFixed(1)}" r="2.5" fill="${l.nd.color}"></circle>`;
      }
      html += `<text class="cov-circle-label" x="${l.x.toFixed(1)}" y="${(l.y - 4).toFixed(1)}" text-anchor="middle">${l.nd.label}</text>
               <text class="cov-circle-count" x="${l.x.toFixed(1)}" y="${(l.y + 10).toFixed(1)}" text-anchor="middle">${l.nd.size} từ</text>`;
    });
    svg.innerHTML = html;

    svg.querySelectorAll(".cov-circle").forEach((c) => {
      c.addEventListener("click", () => selectSet(c.dataset.key));
    });

    renderLegend(nodes);
    renderMatrix(nodes);
    renderDetail();
  }

  function renderLegend(nodes) {
    const el = document.getElementById("covLegend");
    if (!el) return;
    if (!nodes.length) { el.innerHTML = ""; return; }
    const total = new Set();
    nodes.forEach((n) => n.words.forEach((w) => total.add(w)));
    el.innerHTML =
      nodes.map((n) => {
        const sel = state.selection && state.selection.type === "set" && state.selection.key === n.key;
        return `<button class="cov-legend-item${sel ? " active" : ""}" data-key="${n.key}">
                  <span class="cov-dot" style="background:${n.color}"></span>
                  <span class="cov-legend-name">${n.label}</span>
                  <span class="cov-legend-num">${n.size}</span>
                </button>`;
      }).join("") +
      `<div class="cov-total">Tổng từ vựng <b>không trùng lặp</b>: <b>${total.size}</b>
         <span class="cov-total-sub">(cộng dồn thô: ${nodes.reduce((s, n) => s + n.size, 0)})</span></div>`;
    el.querySelectorAll("[data-key]").forEach((b) =>
      b.addEventListener("click", () => selectSet(b.dataset.key))
    );
  }

  function renderMatrix(nodes) {
    const table = document.getElementById("covMatrix");
    if (!table) return;
    if (nodes.length < 2) { table.innerHTML = ""; return; }
    let html = "<thead><tr><th></th>" + nodes.map((n) =>
      `<th><span class="cov-dot" style="background:${n.color}"></span>${n.label}</th>`).join("") + "</tr></thead><tbody>";
    nodes.forEach((a) => {
      html += `<tr><th><span class="cov-dot" style="background:${a.color}"></span>${a.label}</th>`;
      nodes.forEach((b) => {
        if (a.key === b.key) {
          html += `<td class="cov-cell-self">${a.size}</td>`;
        } else {
          const shared = intersect(a.words, b.words).size;
          const pct = a.size ? Math.round((shared / a.size) * 100) : 0;
          // đậm dần theo % trùng để nhìn phát biết cặp nào dính nhau nhiều
          const alpha = shared ? Math.min(0.65, 0.08 + pct / 100) : 0;
          html += `<td class="cov-cell${shared ? " clickable" : ""}" data-a="${a.key}" data-b="${b.key}"
                       style="background:rgba(124,92,255,${alpha})">
                     ${shared ? `<b>${shared}</b><span class="cov-cell-pct">${pct}%</span>` : "—"}
                   </td>`;
        }
      });
      html += "</tr>";
    });
    table.innerHTML = html + "</tbody>";
    table.querySelectorAll(".cov-cell.clickable").forEach((td) =>
      td.addEventListener("click", () => selectPair(td.dataset.a, td.dataset.b))
    );
  }

  /* ---------- 5. CHỌN VÙNG + DANH SÁCH TỪ ---------- */
  function selectSet(key) {
    state.selection = state.selection && state.selection.type === "set" && state.selection.key === key
      ? null : { type: "set", key };
    render();
  }
  function selectPair(a, b) {
    state.selection = { type: "pair", a, b };
    render();
  }

  function wordChips(words, limit = 400) {
    const arr = [...words].sort();
    const shown = arr.slice(0, limit);
    return `<div class="cov-words">${shown.map((w) => `<span class="cov-word">${w}</span>`).join("")}</div>` +
      (arr.length > limit ? `<div class="cov-more">…và ${arr.length - limit} từ nữa</div>` : "");
  }

  function renderDetail() {
    const el = document.getElementById("covDetail");
    if (!el) return;
    const sel = state.selection;
    if (!sel) {
      el.innerHTML = `<div class="cov-detail-empty">Bấm vào một vòng tròn hoặc một ô trong ma trận để xem chi tiết từ vựng.</div>`;
      return;
    }
    const find = (k) => state.sets.find((s) => s.key === k);

    if (sel.type === "set") {
      const s = find(sel.key);
      if (!s) { el.innerHTML = ""; return; }
      // từ CHỈ có ở bộ này (không xuất hiện ở bất kỳ bộ nào khác đang hiện)
      const others = state.sets.filter((x) => x.key !== s.key);
      const onlyHere = new Set();
      s.words.forEach((w) => { if (!others.some((o) => o.words.has(w))) onlyHere.add(w); });
      const sharedCount = s.size - onlyHere.size;
      el.innerHTML = `
        <div class="cov-detail-head" style="border-color:${s.color}">
          <b>${s.label}</b> — ${s.size} từ
        </div>
        <div class="cov-stat-row">
          <div class="cov-stat"><span>Chỉ có ở bộ này</span><b>${onlyHere.size}</b></div>
          <div class="cov-stat"><span>Trùng với bộ khác</span><b>${sharedCount}</b></div>
          <div class="cov-stat"><span>Tỉ lệ độc quyền</span><b>${s.size ? Math.round((onlyHere.size / s.size) * 100) : 0}%</b></div>
        </div>
        <div class="cov-detail-sub">Từ <b>chỉ xuất hiện</b> ở bộ này (học bộ khác sẽ KHÔNG gặp):</div>
        ${wordChips(onlyHere)}`;
      return;
    }

    // pair
    const A = find(sel.a), B = find(sel.b);
    if (!A || !B) { el.innerHTML = ""; return; }
    const both = intersect(A.words, B.words);
    const onlyA = new Set(); A.words.forEach((w) => { if (!B.words.has(w)) onlyA.add(w); });
    const onlyB = new Set(); B.words.forEach((w) => { if (!A.words.has(w)) onlyB.add(w); });
    el.innerHTML = `
      <div class="cov-detail-head">
        <span class="cov-dot" style="background:${A.color}"></span><b>${A.label}</b>
        <span class="cov-vs">∩</span>
        <span class="cov-dot" style="background:${B.color}"></span><b>${B.label}</b>
      </div>
      <div class="cov-stat-row">
        <div class="cov-stat"><span>Trùng nhau</span><b>${both.size}</b></div>
        <div class="cov-stat"><span>Chỉ ${A.label}</span><b>${onlyA.size}</b></div>
        <div class="cov-stat"><span>Chỉ ${B.label}</span><b>${onlyB.size}</b></div>
      </div>
      <div class="cov-detail-sub">Từ có ở <b>CẢ HAI</b> (${both.size} từ) — học 1 bộ là được luôn bên kia:</div>
      ${both.size ? wordChips(both) : `<div class="cov-detail-empty">Không có từ nào trùng.</div>`}
      <div class="cov-detail-sub">Chỉ có ở <b>${A.label}</b> (${onlyA.size} từ):</div>
      ${wordChips(onlyA, 200)}
      <div class="cov-detail-sub">Chỉ có ở <b>${B.label}</b> (${onlyB.size} từ):</div>
      ${wordChips(onlyB, 200)}`;
  }

  /* ---------- 6. KHỞI TẠO ---------- */
  function init() {
    const tabs = document.getElementById("covScopeTabs");
    if (tabs && !tabs.dataset.bound) {
      tabs.dataset.bound = "1";
      tabs.querySelectorAll(".cov-tab").forEach((btn) => {
        btn.addEventListener("click", () => {
          tabs.querySelectorAll(".cov-tab").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          state.scope = btn.dataset.scope;
          state.selection = null;
          render();
        });
      });
    }
    const chk = document.getElementById("covHideSmall");
    if (chk && !chk.dataset.bound) {
      chk.dataset.bound = "1";
      chk.addEventListener("change", () => {
        state.hideSmall = chk.checked;
        state.selection = null;
        render();
      });
    }
    render();
  }

  return { init, render };
})();
