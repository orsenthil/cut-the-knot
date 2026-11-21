"use strict";

/*
 * The page for the Farey Series: drawing and input only; the series is in farey-core.js.
 * A canvas shows an N by N board: the point (q, p) is drawn for every fraction p/q in lowest
 * terms (the points you can "see" from the origin), with a ray to each. Press a point under the
 * diagonal, or use the arrow keys, to pick a Farey fraction and see its neighbours, the
 * determinants m2 n1 - m1 n2 = 1 and the mediant.
 */

(function () {
  const Core = FareyCore;
  const canvas = document.getElementById("board");
  const ctx = canvas.getContext("2d");
  const statusEl = document.getElementById("status");
  const nIn = document.getElementById("nIn");
  const lessBtn = document.getElementById("lessBtn");
  const moreBtn = document.getElementById("moreBtn");
  const linesBox = document.getElementById("linesBox");
  const halfBox = document.getElementById("halfBox");
  const infoEl = document.getElementById("info");
  const listEl = document.getElementById("series");
  const resetBtn = document.getElementById("resetBtn");
  const W = canvas.width, H = canvas.height, PAD = 26;

  let state = Core.start({});

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    kind = kind || Core.result(state);
    if (kind) statusEl.classList.add(kind);
  }
  const tok = (st, n, f) => st.getPropertyValue(n).trim() || f;

  const cell = () => (Math.min(W, H) - 2 * PAD) / state.n;
  const px = (q) => PAD + q * cell();
  const py = (p) => H - PAD - p * cell();

  function draw() {
    const st = getComputedStyle(document.documentElement);
    const stage = tok(st, "--stage", "#f3f5f8"), ink = tok(st, "--ink", "#1f2430"), muted = tok(st, "--muted", "#5d6472"), accent = tok(st, "--accent", "#5b4ee8"), good = tok(st, "--good", "#1a8f4d"), hl = tok(st, "--highlight", "#ffe08a");
    const n = state.n, c = cell();
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = stage; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = muted; ctx.globalAlpha = 0.3; ctx.lineWidth = 1;
    for (let i = 0; i <= n; i++) { ctx.beginPath(); ctx.moveTo(px(i), py(0)); ctx.lineTo(px(i), py(n)); ctx.stroke(); ctx.beginPath(); ctx.moveTo(px(0), py(i)); ctx.lineTo(px(n), py(i)); ctx.stroke(); }
    ctx.globalAlpha = 1;
    const pts = Core.points(n);
    const drawn = [];
    for (const [p, q] of pts) { drawn.push([q, p]); if (!state.oneHalf) drawn.push([p, q]); }
    if (state.lines) {
      ctx.strokeStyle = muted; ctx.globalAlpha = 0.55; ctx.lineWidth = 1;
      for (const [x, y] of drawn) { ctx.beginPath(); ctx.moveTo(px(0), py(0)); ctx.lineTo(px(x), py(y)); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
    // the selected fraction, its neighbours and the triangles of area 1/2
    if (state.selected >= 0) {
      const a = Core.around(n, state.selected);
      const tri = (u, v) => { ctx.fillStyle = hl; ctx.globalAlpha = 0.7; ctx.beginPath(); ctx.moveTo(px(0), py(0)); ctx.lineTo(px(u[1]), py(u[0])); ctx.lineTo(px(v[1]), py(v[0])); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; };
      if (a.prev) tri(a.prev, a.term);
      if (a.next) tri(a.term, a.next);
    }
    ctx.fillStyle = ink;
    const r = Math.max(2, Math.min(5, c / 3));
    for (const [x, y] of drawn) { ctx.beginPath(); ctx.arc(px(x), py(y), r, 0, 2 * Math.PI); ctx.fill(); }
    if (state.selected >= 0) {
      const a = Core.around(n, state.selected);
      for (const [t, col] of [[a.prev, accent], [a.next, accent], [a.term, good]]) {
        if (!t) continue;
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(px(t[1]), py(t[0]), r + 2.5, 0, 2 * Math.PI); ctx.fill();
      }
    }
    // axis numbers
    ctx.fillStyle = muted; ctx.font = "11px system-ui, sans-serif"; ctx.textAlign = "center";
    const every = n > 40 ? 10 : n > 20 ? 5 : n > 10 ? 2 : 1;
    for (let i = every; i <= n; i += every) { ctx.fillText(String(i), px(i), py(0) + 14); ctx.textAlign = "right"; ctx.fillText(String(i), px(0) - 5, py(i) + 4); ctx.textAlign = "center"; }
    ctx.fillText("denominator q →", W / 2, H - 4);
  }

  function describe() {
    if (state.selected < 0) {
      const f = Core.farey(state.n);
      return `F(${state.n}) has ${f.length} fractions. Press a point under the diagonal, or use the arrow keys, to see a fraction's neighbours.`;
    }
    const a = Core.around(state.n, state.selected), t = (x) => (x ? `${x[0]}/${x[1]}` : "—");
    let s = `${t(a.term)}, term ${a.index + 1} of ${a.count}.`;
    if (a.prev) s += ` Left neighbour ${t(a.prev)}: ${a.term[0]}·${a.prev[1]} − ${a.prev[0]}·${a.term[1]} = ${a.detPrev}.`;
    if (a.next) s += ` Right neighbour ${t(a.next)}: ${a.next[0]}·${a.term[1]} − ${a.term[0]}·${a.next[1]} = ${a.detNext}.`;
    if (a.isMediant) s += ` It is the mediant of its neighbours: (${a.prev[0]} + ${a.next[0]})/(${a.prev[1]} + ${a.next[1]}) = ${a.mediantOfNeighbours[0]}/${a.mediantOfNeighbours[1]}, which reduces to ${t(a.term)}.`;
    return s;
  }

  function render() {
    draw();
    nIn.value = String(state.n);
    lessBtn.disabled = state.n <= Core.MIN_N; moreBtn.disabled = state.n >= Core.MAX_N;
    linesBox.checked = state.lines; halfBox.checked = state.oneHalf;
    infoEl.textContent = describe();
    const f = Core.farey(state.n);
    listEl.textContent = f.length > 60 ? f.slice(0, 30).map((x) => `${x[0]}/${x[1]}`).join("  ") + "  …  " + f.slice(-8).map((x) => `${x[0]}/${x[1]}`).join("  ") : f.map((x) => `${x[0]}/${x[1]}`).join("  ");
    if (window.Track) window.Track.state(state);
  }

  function apply(m, note) {
    const next = Core.move(state, m);
    if (!next) return false;
    state = next; render(); if (note !== undefined) say(note);
    return true;
  }

  canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) * W) / rect.width, y = ((e.clientY - rect.top) * H) / rect.height;
    const f = Core.farey(state.n);
    let best = -1, bestD = Infinity;
    f.forEach(([p, q], i) => { const d = Math.hypot(px(q) - x, py(p) - y); if (d < bestD) { bestD = d; best = i; } });
    if (best >= 0 && bestD < Math.max(12, cell() * 0.8)) apply({ type: "select", index: best }, "");
    else say("Press one of the points under the diagonal to pick a fraction.");
  });
  canvas.addEventListener("keydown", (e) => {
    const len = Core.farey(state.n).length;
    let i = state.selected;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") i = Math.min(len - 1, i + 1);
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") i = Math.max(0, i < 0 ? 0 : i - 1);
    else if (e.key === "Escape") i = -1;
    else if (e.key === "Home") i = 0;
    else if (e.key === "End") i = len - 1;
    else return;
    e.preventDefault();
    apply({ type: "select", index: i }, "");
  });

  lessBtn.addEventListener("click", () => apply({ type: "step", dir: -1 }, `N = ${state.n - 1 >= Core.MIN_N ? state.n : state.n}`));
  moreBtn.addEventListener("click", () => apply({ type: "step", dir: 1 }, ""));
  nIn.addEventListener("change", () => { if (!apply({ type: "n", value: nIn.value }, "")) { say(`N is a whole number from ${Core.MIN_N} to ${Core.MAX_N}.`); nIn.value = String(state.n); } });
  linesBox.addEventListener("change", () => apply({ type: "lines", value: linesBox.checked }, ""));
  halfBox.addEventListener("change", () => apply({ type: "oneHalf", value: halfBox.checked }, halfBox.checked ? "" : "Each point is drawn again with its two coordinates swapped."));
  resetBtn.addEventListener("click", () => { state = Core.move(state, { type: "reset" }); render(); say("Back to N = 5."); });
  window.addEventListener("themechange", render);

  render();
})();
