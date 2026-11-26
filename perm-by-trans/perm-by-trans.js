"use strict";

/*
 * The page for Permutations as a Product of Transpositions: drawing and input
 * only. N poles with a number on top; a grid of dots (one per pole and
 * height). Press a dot, then a dot at the same height on another pole to put
 * a shuttle there. Press a number to follow its slide down. The maths is in
 * perm-by-trans-core.js.
 */

(function () {
  const Core = PermTransCore;
  const svg = document.getElementById("board");
  const facts = document.getElementById("facts");
  const statusEl = document.getElementById("status");
  const nIn = document.getElementById("nIn"), removeBtn = document.getElementById("removeBtn"), resetBtn = document.getElementById("resetBtn");
  const NS = "http://www.w3.org/2000/svg";
  const DX = 40, TOP = 40, ROW = 28, LEVELS = Core.LEVELS;

  let state = Core.start({ n: Core.DEFAULT_N });
  let first = null, trace = null, message = "";

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function el(name, attrs) {
    const e = document.createElementNS(NS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    svg.appendChild(e);
    return e;
  }

  const px = (p) => DX * (p - 0.5);
  const py = (h) => TOP + ROW * h;

  function press(pole, h) {
    if (first && first.h === h && first.pole !== pole) {
      const r = Core.add(state, h, first.pole, pole);
      first = null;
      if (r.error) message = r.error;
      else { state = r.state; message = ""; }
    } else if (first && first.h === h && first.pole === pole) {
      first = null; message = "";
    } else {
      first = { pole, h };
      message = state.bars.some((b) => b.h === h) ? "This height is occupied! Select another." : "Now press a dot at the same height on another pole.";
      if (state.bars.some((b) => b.h === h)) first = null;
    }
    render();
  }

  function render() {
    svg.textContent = "";
    const n = state.n, W = DX * n, H = py(LEVELS) + 50;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    svg.style.width = `max(100%, ${(n * 2.5).toFixed(1)}rem)`;
    svg.style.maxWidth = `${n * 60}px`;
    for (let p = 1; p <= n; p++) el("line", { x1: px(p), y1: py(0.2), x2: px(p), y2: py(LEVELS + 0.6), class: "pole" });
    state.bars.forEach((b) => el("line", { x1: px(b.a), y1: py(b.h), x2: px(b.b), y2: py(b.h), class: "bar" }));
    for (let h = 1; h <= LEVELS; h++) for (let p = 1; p <= n; p++) {
      if (state.bars.some((b) => b.h === h && (b.a === p || b.b === p))) continue;
      const sel = first && first.pole === p && first.h === h;
      const c = el("circle", { cx: px(p), cy: py(h), r: 7, class: "slot" + (sel ? " sel" : ""), tabindex: "0", role: "button", "aria-label": `Pole ${p}, height ${h}` });
      c.addEventListener("click", () => press(p, h));
      c.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); press(p, h); } });
    }
    if (trace) {
      const it = Core.itinerary(state, trace);
      const pts = [[px(trace), py(0.2)]];
      it.stops.slice(1).forEach((s, i) => { pts.push([px(it.stops[i].pole), py(s.h)]); pts.push([px(s.pole), py(s.h)]); });
      pts.push([px(it.end), py(LEVELS + 0.6)]);
      el("polyline", { points: pts.map((q) => q.join(",")).join(" "), class: "path" });
    }
    const f = Core.permutation(state);
    for (let p = 1; p <= n; p++) {
      const c = el("circle", { cx: px(p), cy: py(0) - 4, r: 13, class: "num" + (trace === p ? " on" : ""), tabindex: "0", role: "button", "aria-pressed": trace === p ? "true" : "false", "aria-label": `Number ${p}: it ends at pole ${f[p - 1]}` });
      const t = el("text", { x: px(p), y: py(0) - 4 }); t.textContent = String(p);
      const go = () => { trace = trace === p ? null : p; message = ""; render(); };
      c.addEventListener("click", go);
      c.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
      // where the slide from p ends: the number sits at the bottom of that pole
    }
    if (trace) {
      const t = el("text", { x: px(f[trace - 1]), y: py(LEVELS) + 44 }); t.textContent = String(trace);
    }
    facts.textContent = "";
    const line = (label, text) => {
      const b = document.createElement("b"); b.textContent = label + " ";
      facts.append(b, document.createTextNode(text), document.createElement("br"));
    };
    line("Transpositions:", state.bars.length ? Core.transpositions(state).join(" ") : "none yet");
    line("Cycles:", Core.cycleText(f));
    line("Shuttles:", `${state.bars.length}, so the permutation is ${state.bars.length % 2 === 0 ? "even" : "odd"}.`);
    removeBtn.disabled = state.bars.length === 0;
    nIn.value = String(n);
    say(message || (trace ? `${trace} slides down to pole ${f[trace - 1]}.` : "Press a dot, then another dot at the same height."), message.startsWith("This") ? "lose" : undefined);
    if (window.Track) window.Track.state({ n, bars: state.bars.map((b) => ({ h: b.h, a: b.a, b: b.b })) });
  }

  function fresh() { first = null; trace = null; message = ""; state = Core.start({ n: nIn.value }); render(); }
  resetBtn.addEventListener("click", fresh);
  nIn.addEventListener("change", fresh);
  removeBtn.addEventListener("click", () => { state = Core.removeLast(state); first = null; message = ""; render(); });
  render();
})();
