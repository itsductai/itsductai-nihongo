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
    business: "Business 会話",
    khac: "Tài liệu khác",
  };
  const SERIES_COLORS = {
    mimi: "#48c98c",     // xanh lá
    tango: "#ff6b6b",    // đỏ
    n2vocab: "#a98bff",  // tím
    n1vocab: "#ff9f43",  // cam  (KHÔNG dùng tím nữa: 3 sắc tím cạnh nhau nhìn không phân biệt được)
    n3vocab: "#4dabf7",  // xanh dương
    business: "#f0932b", // cam đất
    khac: "#94a3b8",     // xám
  };
  const LEVEL_COLORS = { N1: "#ff9f43", N2: "#a98bff", N3: "#4dabf7", BUSINESS: "#f0932b", KHAC: "#94a3b8" };
  const ORDER = ["mimi", "tango", "n2vocab", "n1vocab", "n3vocab", "business", "khac"];

  let state = {
    scope: "series", hideSmall: true, sets: [], selection: null,
    levelFilter: "N2",                        // dùng cho tab "Bộ trong từng cấp"
    custom: { keys: ["mimi", "tango", "n2vocab"], selection: null }, // sơ đồ tùy chọn ≤3 bộ
  };

  // Danh sách bộ có thể chọn ở sơ đồ tùy chọn (đủ 6 bộ theo giáo trình)
  function allSeriesOptions() {
    const seen = new Map(); // key -> size
    (App.decks || []).forEach((deck) => {
      if (deck.type !== "TUVUNG") return;
      const key = deck.series || "khac";
      const set = seen.get(key) || new Set();
      (deck.words || []).forEach((w) => { const k = (w.kanji || "").trim(); if (k) set.add(k); });
      seen.set(key, set);
    });
    return ORDER.filter((k) => seen.has(k)).map((k) => ({
      key: k, label: SERIES_LABELS[k] || k, color: SERIES_COLORS[k] || "#94a3b8", size: seen.get(k).size,
    }));
  }
  // Lấy Set(kanji) của 1 bộ theo series-key
  function seriesWordSet(key) {
    const out = new Set();
    (App.decks || []).forEach((deck) => {
      if (deck.type !== "TUVUNG") return;
      if ((deck.series || "khac") !== key) return;
      (deck.words || []).forEach((w) => { const k = (w.kanji || "").trim(); if (k) out.add(k); });
    });
    return out;
  }

  /* ---------- 1. GOM DỮ LIỆU ----------
     Dùng App.decks (đã nạp từ manifest-thin) — manifest-thin CÓ sẵn `kanji`,
     nên KHÔNG cần tải deck dày => trang thống kê mở là vẽ được ngay. */
  function collectSets(scope) {
    const map = new Map(); // key -> Set(kanji)
    (App.decks || []).forEach((deck) => {
      if (deck.type !== "TUVUNG") return;
      // tab "Bộ trong từng cấp": chỉ lấy các bộ thuộc cấp đang chọn, gom theo series
      if (scope === "levelSeries" && (deck.level || "KHAC") !== state.levelFilter) return;
      let key;
      if (scope === "level") {
        key = deck.level || "KHAC";
      } else {
        // "series" và "levelSeries" đều gom theo series
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
      if (scope === "series" || scope === "levelSeries") {
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
    // hiện bộ chọn cấp độ chỉ khi ở tab "Bộ trong từng cấp"
    const lp = document.getElementById("covLevelPick");
    if (lp) lp.style.display = state.scope === "levelSeries" ? "flex" : "none";

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

  /* =======================================================================
     SƠ ĐỒ TÙY CHỌN — chọn tối đa 3 bộ để so sánh CHÍNH XÁC
     -----------------------------------------------------------------------
     Vì sao phần này vẽ đúng còn biểu đồ tổng quan phía trên chỉ xấp xỉ:
       - Với 6 vòng, không tồn tại cách xếp hình tròn thoả MỌI vùng giao
         (đó là lý do Tango N2 và JLPT N1 nhìn như không chạm nhau dù bảng
         vẫn có số trùng — lực kéo của các cặp khác đã "ép" chúng ra xa).
       - Với ĐÚNG 2–3 bộ thì số ràng buộc ít, ta dựng được TAM GIÁC khoảng
         cách tâm khớp từng cặp => phần chồng lấn hiện đúng như số liệu.
     ===================================================================== */

  // Dựng vị trí tâm cho 2–3 vòng từ khoảng cách tâm mong muốn của từng cặp.
  function layoutCustom(nodes, W, H) {
    const n = nodes.length;
    if (n === 0) return;
    if (n === 1) { nodes[0].x = W / 2; nodes[0].y = H / 2; return; }

    const dist = (a, b) => {
      const shared = intersect(a.words, b.words).size;
      const rSmall = Math.min(a.r, b.r);
      const sizeSmall = Math.min(a.size, b.size);
      const frac = sizeSmall ? shared / sizeSmall : 0;
      return distanceForOverlap(a.r, b.r, frac * Math.PI * rSmall * rSmall);
    };

    if (n === 2) {
      const d = dist(nodes[0], nodes[1]);
      nodes[0].x = W / 2 - d / 2; nodes[0].y = H / 2;
      nodes[1].x = W / 2 + d / 2; nodes[1].y = H / 2;
    } else {
      // tam giác: cạnh AB, AC, BC đã biết -> toạ độ C
      const dAB = dist(nodes[0], nodes[1]);
      const dAC = dist(nodes[0], nodes[2]);
      const dBC = dist(nodes[1], nodes[2]);
      let ax = 0, ay = 0, bx = dAB, by = 0;
      let cx = dAB ? (dAC * dAC - dBC * dBC + dAB * dAB) / (2 * dAB) : 0;
      let cy2 = dAC * dAC - cx * cx;
      let cy = cy2 > 0 ? Math.sqrt(cy2) : 0; // nếu bất đẳng thức tam giác hỏng -> thẳng hàng
      nodes[0].x = ax; nodes[0].y = ay;
      nodes[1].x = bx; nodes[1].y = by;
      nodes[2].x = cx; nodes[2].y = cy;
    }
    // căn giữa + co cho vừa khung
    const xs = nodes.map((d) => d.x), ys = nodes.map((d) => d.y);
    const minX = Math.min(...nodes.map((d) => d.x - d.r)), maxX = Math.max(...nodes.map((d) => d.x + d.r));
    const minY = Math.min(...nodes.map((d) => d.y - d.r)), maxY = Math.max(...nodes.map((d) => d.y + d.r));
    const bw = maxX - minX || 1, bh = maxY - minY || 1;
    const pad = 26;
    const scale = Math.min((W - pad * 2) / bw, (H - pad * 2) / bh, 1.6);
    const gx = (minX + maxX) / 2, gy = (minY + maxY) / 2;
    nodes.forEach((d) => {
      d.x = W / 2 + (d.x - gx) * scale;
      d.y = H / 2 + (d.y - gy) * scale;
      d.r = d.r * scale;
    });
  }

  // Tính đủ các vùng (Euler) cho ≤3 tập, trả về mảng {id,label,count,words,anchor}
  function customRegions(nodes) {
    const has = (nd, w) => nd.words.has(w);
    const all = new Set(); nodes.forEach((nd) => nd.words.forEach((w) => all.add(w)));
    const regions = [];
    const centroid = (arr) => ({
      x: arr.reduce((s, i) => s + nodes[i].x, 0) / arr.length,
      y: arr.reduce((s, i) => s + nodes[i].y, 0) / arr.length,
    });
    const G = centroid(nodes.map((_, i) => i));
    const push = (idx, member) => {
      const words = new Set();
      all.forEach((w) => {
        const inAll = idx.every((i) => has(nodes[i], w));
        const inNone = nodes.every((nd, k) => idx.includes(k) ? true : !has(nd, w));
        if (inAll && inNone) words.add(w);
      });
      if (!words.size) return;
      let anchor;
      if (idx.length === 1) {
        const c = nodes[idx[0]];
        anchor = { x: c.x + (c.x - G.x) * 0.55, y: c.y + (c.y - G.y) * 0.55 };
      } else if (idx.length === nodes.length) {
        anchor = { x: G.x, y: G.y };
      } else {
        const m = centroid(idx);
        // đẩy nhẹ ra xa các vòng KHÔNG thuộc vùng này để tách khỏi vùng giao 3
        const out = nodes.map((_, i) => i).filter((i) => !idx.includes(i));
        const O = out.length ? centroid(out) : G;
        anchor = { x: m.x + (m.x - O.x) * 0.35, y: m.y + (m.y - O.y) * 0.35 };
      }
      regions.push({ id: idx.join("-"), idx, label: member, count: words.size, words, anchor });
    };
    const N = nodes.length;
    const names = nodes.map((n) => n.label);
    if (N >= 1) push([0], `Chỉ ${names[0]}`);
    if (N >= 2) { push([1], `Chỉ ${names[1]}`); push([0, 1], `${names[0]} ∩ ${names[1]}`); }
    if (N >= 3) {
      push([2], `Chỉ ${names[2]}`);
      push([0, 2], `${names[0]} ∩ ${names[2]}`);
      push([1, 2], `${names[1]} ∩ ${names[2]}`);
      push([0, 1, 2], `Cả 3 bộ`);
    }
    return regions;
  }

  function renderCustom() {
    const svg = document.getElementById("covCustomVenn");
    if (!svg) return;
    const opts = allSeriesOptions();
    const chosen = state.custom.keys.filter(Boolean);
    // build node list
    const W = 560, H = 420;
    let nodes = chosen.map((key) => {
      const o = opts.find((x) => x.key === key);
      const words = seriesWordSet(key);
      return { key, label: o ? o.label : key, color: o ? o.color : "#94a3b8", words, size: words.size };
    }).filter((nd) => nd.size > 0);

    if (!nodes.length) {
      svg.innerHTML = `<text x="${W / 2}" y="${H / 2}" text-anchor="middle" fill="var(--text-2)">Chọn 2–3 bộ ở trên để so sánh.</text>`;
      const d = document.getElementById("covCustomDetail");
      if (d) d.innerHTML = `<div class="cov-detail-empty">Chọn các bộ rồi bấm vào từng vùng để xem danh sách từ.</div>`;
      return;
    }

    // bán kính theo √số từ, chuẩn hoá theo bộ lớn nhất
    const maxR = Math.min(W, H) * 0.32;
    const kR = maxR / Math.sqrt(Math.max(...nodes.map((n) => n.size)));
    nodes.forEach((n) => { n.r = Math.max(26, kR * Math.sqrt(n.size)); });

    layoutCustom(nodes, W, H);
    const regions = customRegions(nodes);

    // vẽ vòng (to trước)
    const drawOrder = [...nodes].sort((a, b) => b.r - a.r);
    let html = "";
    drawOrder.forEach((nd) => {
      const sel = state.custom.selection && state.custom.selection.type === "set" && state.custom.selection.key === nd.key;
      html += `<circle class="cov-circle${sel ? " selected" : ""}" data-ckey="${nd.key}"
                 cx="${nd.x.toFixed(1)}" cy="${nd.y.toFixed(1)}" r="${nd.r.toFixed(1)}"
                 fill="${nd.color}" stroke="${nd.color}"></circle>`;
    });
    // nhãn tên bộ (đặt ở mép trên mỗi vòng)
    nodes.forEach((nd) => {
      html += `<text class="cov-circle-label" x="${nd.x.toFixed(1)}" y="${(nd.y - nd.r + 16).toFixed(1)}" text-anchor="middle">${nd.label}</text>
               <text class="cov-circle-count" x="${nd.x.toFixed(1)}" y="${(nd.y - nd.r + 30).toFixed(1)}" text-anchor="middle">${nd.size} từ</text>`;
    });
    // badge số ở mỗi vùng
    regions.forEach((rg) => {
      const selected = state.custom.selection && state.custom.selection.type === "region" && state.custom.selection.id === rg.id;
      html += `<g class="cov-region-badge${selected ? " selected" : ""}" data-region="${rg.id}" style="cursor:pointer">
                 <circle cx="${rg.anchor.x.toFixed(1)}" cy="${rg.anchor.y.toFixed(1)}" r="15"></circle>
                 <text x="${rg.anchor.x.toFixed(1)}" y="${(rg.anchor.y + 4).toFixed(1)}" text-anchor="middle">${rg.count}</text>
               </g>`;
    });
    svg.innerHTML = html;

    svg.querySelectorAll("[data-ckey]").forEach((c) =>
      c.addEventListener("click", () => selectCustom({ type: "set", key: c.dataset.ckey })));
    svg.querySelectorAll("[data-region]").forEach((g) =>
      g.addEventListener("click", () => selectCustom({ type: "region", id: g.dataset.region })));

    renderCustomDetail(nodes, regions);
  }

  function renderCustomDetail(nodes, regions) {
    const el = document.getElementById("covCustomDetail");
    if (!el) return;
    const total = new Set(); nodes.forEach((n) => n.words.forEach((w) => total.add(w)));

    // bảng liệt kê MỌI vùng (chính xác 100%) — bấm để xem từ
    let list = `<div class="cov-region-list">` + regions.map((rg) => {
      const sel = state.custom.selection && state.custom.selection.type === "region" && state.custom.selection.id === rg.id;
      return `<button class="cov-region-item${sel ? " active" : ""}" data-region="${rg.id}">
                <span class="cov-region-name">${rg.label}</span>
                <span class="cov-region-num">${rg.count}</span>
              </button>`;
    }).join("") + `</div>
      <div class="cov-total">Tổng từ <b>không trùng lặp</b> của ${nodes.length} bộ đã chọn: <b>${total.size}</b></div>`;

    // phần từ chi tiết theo lựa chọn
    let detail = "";
    const sel = state.custom.selection;
    if (sel && sel.type === "region") {
      const rg = regions.find((r) => r.id === sel.id);
      if (rg) detail = `<div class="cov-detail-sub"><b>${rg.label}</b> — ${rg.count} từ:</div>${wordChips(rg.words)}`;
    } else if (sel && sel.type === "set") {
      const nd = nodes.find((n) => n.key === sel.key);
      if (nd) detail = `<div class="cov-detail-sub">Toàn bộ <b>${nd.label}</b> — ${nd.size} từ:</div>${wordChips(nd.words)}`;
    } else {
      detail = `<div class="cov-detail-empty">Bấm 1 vùng (badge số trên hình) hoặc 1 dòng bên trên để xem danh sách từ.</div>`;
    }
    el.innerHTML = list + `<div class="cov-region-detail">${detail}</div>`;
    el.querySelectorAll("[data-region]").forEach((b) =>
      b.addEventListener("click", () => selectCustom({ type: "region", id: b.dataset.region })));
  }

  function selectCustom(sel) {
    const cur = state.custom.selection;
    const same = cur && sel.type === cur.type &&
      (sel.type === "region" ? sel.id === cur.id : sel.key === cur.key);
    state.custom.selection = same ? null : sel;
    renderCustom();
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

    // --- bộ chọn cấp độ cho tab "Bộ trong từng cấp" ---
    const lp = document.getElementById("covLevelPick");
    if (lp && !lp.dataset.bound) {
      lp.dataset.bound = "1";
      lp.querySelectorAll(".cov-level-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          lp.querySelectorAll(".cov-level-btn").forEach((b) => b.classList.remove("active"));
          btn.classList.add("active");
          state.levelFilter = btn.dataset.level;
          state.selection = null;
          render();
        });
      });
    }

    // --- sơ đồ tùy chọn: 3 dropdown ---
    const selEls = ["covPick0", "covPick1", "covPick2"].map((id) => document.getElementById(id));
    if (selEls[0] && !selEls[0].dataset.bound) {
      const opts = allSeriesOptions();
      const optionHtml = (selectedKey) =>
        `<option value="">— (không chọn) —</option>` +
        opts.map((o) => `<option value="${o.key}"${o.key === selectedKey ? " selected" : ""}>${o.label} (${o.size})</option>`).join("");
      selEls.forEach((sel, i) => {
        if (!sel) return;
        sel.dataset.bound = "1";
        sel.innerHTML = optionHtml(state.custom.keys[i] || "");
        sel.addEventListener("change", () => {
          state.custom.keys[i] = sel.value;
          state.custom.selection = null;
          renderCustom();
        });
      });
    }

    render();
    renderCustom();
  }

  return { init, render, renderCustom };
})();
