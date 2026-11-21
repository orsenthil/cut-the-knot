"use strict";

/*
 * The page for Ambassadors at a Round Table: drawing and input only; the rules are
 * in enemy-ambassadors-core.js. An SVG circle of places, each holding a numbered
 * ambassador; red chords join enemies, and a chord along the table's edge (two enemies
 * side by side) is drawn heavy. Press one place and then another to turn the arc between
 * them over. Keyboard: left and right arrows move round the table, Enter or Space picks.
 */

(function () {
  const Core = EnemyAmbassadorsCore;
  const svg = document.getElementById("table");
  const statusEl = document.getElementById("status");
  const countEl = document.getElementById("count");
  const nIn = document.getElementById("nIn");
  const hintBtn = document.getElementById("hintBtn");
  const newBtn = document.getElementById("newBtn");
  const SVGNS = "http://www.w3.org/2000/svg";
  const C = 200, R = 150;

  let state = Core.start({ seed: (Date.now() % 100000) + 1 });
  let cursor = 0;
  let history = 0; // how many turns the player has made, for the message

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    kind = kind || Core.result(state);
    if (kind) statusEl.classList.add(kind);
  }

  const el = (name, attrs, text) => { const e = document.createElementNS(SVGNS, name); for (const k in attrs) e.setAttribute(k, attrs[k]); if (text !== undefined) e.textContent = text; return e; };
  const angle = (i) => (2 * Math.PI * i) / state.n + (state.n < 3 || state.n === 6 ? 0 : Math.PI / state.n);
  const pt = (i) => [C + R * Math.cos(angle(i)), C - R * Math.sin(angle(i))];

  function render() {
    svg.textContent = "";
    const where = new Array(state.n);
    state.seat.forEach((a, p) => { where[a] = p; });
    const bad = new Set(Core.mishaps(state));
    // enemy chords first
    for (const [a, b] of state.enemies) {
      const [x1, y1] = pt(where[a]), [x2, y2] = pt(where[b]);
      const adj = Math.abs(where[a] - where[b]) === 1 || Math.abs(where[a] - where[b]) === state.n - 1;
      svg.appendChild(el("line", { x1, y1, x2, y2, class: adj ? "chord side" : "chord" }));
    }
    const r = Math.min(18, (Math.PI * R) / (state.n + 10));
    state.seat.forEach((a, p) => {
      const [x, y] = pt(p);
      const g = el("g", { class: "place" + (state.selected === p ? " sel" : "") + (p === cursor ? " cur" : ""), tabindex: p === cursor ? "0" : "-1", role: "button", "data-place": p });
      const enemiesOf = state.enemies.filter((e) => e[0] === a || e[1] === a).length;
      g.setAttribute("aria-label", `Place ${p + 1}: ambassador ${a + 1}, ${enemiesOf} enem${enemiesOf === 1 ? "y" : "ies"}${bad.has(p) || bad.has((p + state.n - 1) % state.n) ? ", sitting next to an enemy" : ""}${state.selected === p ? ", selected" : ""}`);
      g.appendChild(el("circle", { cx: x, cy: y, r: r + 4, class: "hit" }));
      g.appendChild(el("circle", { cx: x, cy: y, r, class: "dot" }));
      g.appendChild(el("text", { x, y: y + r * 0.35, "text-anchor": "middle", class: "num", "font-size": Math.max(8, r * 1.05) }, String(a + 1)));
      svg.appendChild(g);
    });
    const m = Core.mishaps(state).length;
    countEl.textContent = m === 0 ? "No two enemies sit side by side." : `${m} pair${m === 1 ? "" : "s"} of neighbours ${m === 1 ? "is" : "are"} enemies.`;
    nIn.value = String(state.n);
    hintBtn.disabled = Core.result(state) !== null;
    if (window.Track) window.Track.state(state);
  }

  function apply(m, note) {
    const next = Core.move(state, m);
    if (!next) return false;
    state = next; render();
    if (Core.result(state) === "win") say(`Everyone sits next to a friend after ${state.moves} turn${state.moves === 1 ? "" : "s"}!`, "win");
    else say(note);
    return true;
  }

  function pick(p) {
    cursor = p;
    if (state.selected === -1) apply({ type: "pick", place: p }, "Now press the other end of the arc to turn it over.");
    else if (state.selected === p) apply({ type: "pick", place: p }, "Selection cancelled.");
    else apply({ type: "pick", place: p }, "Arc turned over.");
    focusCursor();
  }
  function focusCursor() { const g = svg.querySelector(`g.place[data-place="${cursor}"]`); if (g) g.focus(); }

  svg.addEventListener("click", (e) => { const g = e.target.closest("g.place"); if (g) pick(Number(g.dataset.place)); });
  svg.addEventListener("keydown", (e) => {
    const g = e.target.closest("g.place"); if (!g) return;
    const p = Number(g.dataset.place);
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); pick(p); }
    else if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); cursor = (p + 1) % state.n; render(); focusCursor(); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); cursor = (p + state.n - 1) % state.n; render(); focusCursor(); }
  });

  nIn.addEventListener("change", () => { if (!apply({ type: "size", value: nIn.value, seed: Date.now() % 100000 + 1 }, `${state.n} ambassadors.`)) { say(`N runs from ${Core.MIN_N} to ${Core.MAX_N}.`); nIn.value = String(state.n); } else cursor = 0; });
  newBtn.addEventListener("click", () => { state = Core.move(state, { type: "reset", seed: Date.now() % 100000 + 1 }); cursor = 0; render(); say("New enemies."); });
  hintBtn.addEventListener("click", () => {
    const l = Core.lucky(state);
    if (!l) { say(Core.meetsCondition(state) ? "No hostile pair to fix." : "The page's method needs everyone to have at most n−1 enemies among 2n ambassadors, and here that fails, so it cannot always help."); return; }
    apply({ type: "hint" }, `Ambassador ${l.a + 1} sat next to enemy ${l.b + 1}. The arc from ${l.b + 1} to ${l.b2 + 1} was turned over: now ${l.a + 1} sits next to ${l.b2 + 1}, and ${l.b + 1} next to ${l.a2 + 1}.`);
  });
  window.addEventListener("themechange", render);

  render();
})();
