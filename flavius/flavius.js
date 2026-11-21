"use strict";

/*
 * The page for the Josephus Flavius game: drawing and input only; the counting is in flavius-core.js.
 * An SVG circle of smileys; the counting starts at the short mark at the top. Pick a place (press it, or
 * move with the arrow keys and press Enter), then press Slow or Fast and watch who is removed.
 */

(function () {
  const Core = FlaviusCore;
  const svg = document.getElementById("ring");
  const statusEl = document.getElementById("status");
  const nIn = document.getElementById("nIn");
  const kIn = document.getElementById("kIn");
  const nLess = document.getElementById("nLess"), nMore = document.getElementById("nMore");
  const kLess = document.getElementById("kLess"), kMore = document.getElementById("kMore");
  const slowBtn = document.getElementById("slowBtn"), fastBtn = document.getElementById("fastBtn"), resetBtn = document.getElementById("resetBtn");
  const SVGNS = "http://www.w3.org/2000/svg";
  const CX = 200, CY = 200, R = 160;
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  let state = Core.start({});
  let cur = 0, focusCur = false;
  let timer = null;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }
  const el = (name, attrs, text) => { const e = document.createElementNS(SVGNS, name); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text !== undefined) e.textContent = text; return e; };
  const running = () => timer !== null;

  function render() {
    const n = state.n;
    svg.textContent = "";
    const r = Math.max(8, Math.min(24, (Math.PI * R) / n - 2));
    svg.appendChild(el("line", { x1: CX, y1: CY - R - r - 14, x2: CX, y2: CY - R - r - 2, class: "mark" })); // the short line at the top where counting starts
    for (let i = 0; i < n; i++) {
      const a = (2 * Math.PI * i) / n - Math.PI / 2;
      const x = CX + R * Math.cos(a), y = CY + R * Math.sin(a);
      const st = state.status[i];
      const dead = st === 1 || st === 3, mine = st === 2 || st === 3, last = st === 5;
      const g = el("g", { class: "place" + (dead ? " dead" : "") + (mine ? " mine" : "") + (last ? " last" : "") + (i === state.counter && state.hits > 0 ? " now" : ""), tabindex: i === cur ? "0" : "-1", role: "button", "data-place": i });
      g.setAttribute("aria-label", `Place ${i + 1}: ` + (last ? "the survivor" : dead ? (mine ? "yours, removed" : "removed") : mine ? "yours" : "still in the circle") + (i === 0 ? " (the top, where the counting starts)" : ""));
      g.appendChild(el("circle", { cx: x, cy: y, r, class: "face" }));
      if (r >= 11) {
        const e = r * 0.35, ey = y - r * 0.2;
        if (dead) { for (const sx of [-1, 1]) { const ex = x + sx * e; g.appendChild(el("path", { d: `M${ex - 2.5},${ey - 2.5} L${ex + 2.5},${ey + 2.5} M${ex + 2.5},${ey - 2.5} L${ex - 2.5},${ey + 2.5}`, class: "eye" })); } g.appendChild(el("path", { d: `M${x - r * 0.4},${y + r * 0.45} L${x + r * 0.4},${y + r * 0.45}`, class: "mouth" })); }
        else { g.appendChild(el("circle", { cx: x - e, cy: ey, r: 1.8, class: "pupil" })); g.appendChild(el("circle", { cx: x + e, cy: ey, r: 1.8, class: "pupil" })); g.appendChild(el("path", { d: `M${x - r * 0.45},${y + r * 0.2} Q${x},${y + r * 0.75} ${x + r * 0.45},${y + r * 0.2}`, class: "mouth" })); }
      }
      if (n <= 20) g.appendChild(el("text", { x, y: y + r + 11, "text-anchor": "middle", class: "no" }, String(i + 1)));
      svg.appendChild(g);
    }
    nIn.value = String(state.n); kIn.value = String(state.k);
    const locked = running();
    for (const b of [nIn, kIn, nLess, nMore, kLess, kMore]) b.disabled = locked;
    nLess.disabled = locked || state.n <= Core.MIN_N; nMore.disabled = locked || state.n >= Core.MAX;
    kLess.disabled = locked || state.k <= 1; kMore.disabled = locked || state.k + 1 >= state.n;
    const ready = state.selected !== -1 && !state.finished && !locked;
    slowBtn.disabled = !ready; fastBtn.disabled = !ready;
    if (focusCur) { const g = svg.querySelector(`g.place[data-place="${cur}"]`); if (g) g.focus(); focusCur = false; }
    if (window.Track) window.Track.state(state);
  }

  function announce() {
    const r = Core.result(state);
    say(Core.message(state) + (r === "win" ? ` You were place ${state.selected + 1}.` : r === "lose" ? ` The ${state.hits}${state.hits === 1 ? "st" : state.hits === 2 ? "nd" : state.hits === 3 ? "rd" : "th"} person counted was you.` : ""), r);
  }

  function apply(m) { const next = Core.move(state, m); if (!next) return false; state = next; render(); announce(); return true; }

  function stop() { if (timer) { clearInterval(timer); timer = null; } }
  function go(ms) {
    if (!state || state.selected === -1) return;
    if (reduced) { apply({ type: "run" }); return; }
    stop();
    timer = setInterval(() => {
      const next = Core.move(state, { type: "step" });
      if (!next) { stop(); render(); return; }
      state = next;
      if (state.finished) stop();
      render(); announce();
    }, ms);
    render();
  }

  svg.addEventListener("click", (e) => { const g = e.target.closest("g.place"); if (!g || running()) return; cur = Number(g.dataset.place); focusCur = true; if (!apply({ type: "pick", place: cur })) say("The counting has started: press Reset to pick again."); });
  svg.addEventListener("keydown", (e) => {
    const g = e.target.closest("g.place"); if (!g) return;
    const i = Number(g.dataset.place), n = state.n;
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (!running()) { cur = i; focusCur = true; if (!apply({ type: "pick", place: i })) say("The counting has started: press Reset to pick again."); } }
    else if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); cur = (i + 1) % n; focusCur = true; render(); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); cur = (i + n - 1) % n; focusCur = true; render(); }
  });
  slowBtn.addEventListener("click", () => go(700));
  fastBtn.addEventListener("click", () => go(120));
  resetBtn.addEventListener("click", () => { stop(); state = Core.move(state, { type: "reset" }); cur = 0; render(); announce(); });
  const setN = (v) => { stop(); const ok = apply({ type: "n", value: v }); if (!ok) { say(`How many is a whole number from ${Core.MIN_N} to ${Core.MAX}.`); nIn.value = String(state.n); } else { cur = 0; say(`${state.n} people.`); } };
  const setK = (v) => { stop(); const ok = apply({ type: "k", value: v }); if (!ok) { say(`Every which is a whole number from 1 to ${Core.MAX}.`); kIn.value = String(state.k); } else say(`Every ${state.k === 1 ? "" : state.k + (state.k === 2 ? "nd" : state.k === 3 ? "rd" : "th") + " "}person goes.`.replace("Every person", "Every single person")); };
  nIn.addEventListener("change", () => setN(nIn.value));
  kIn.addEventListener("change", () => setK(kIn.value));
  nLess.addEventListener("click", () => setN(state.n - 1)); nMore.addEventListener("click", () => setN(state.n + 1));
  kLess.addEventListener("click", () => setK(state.k - 1)); kMore.addEventListener("click", () => setK(state.k + 1));
  document.addEventListener("visibilitychange", () => { if (document.hidden && running()) { stop(); const t = Core.move(state, { type: "run" }); if (t) state = t; render(); announce(); } });
  window.addEventListener("themechange", render);

  render();
  announce();
})();
