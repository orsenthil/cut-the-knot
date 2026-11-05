"use strict";

/*
 * Stones in Cups - the UI. All the rules live in cups-core.js; this file only
 * draws the circle of cups and drives the clock.
 *
 * The circle is an SVG rebuilt whenever a setting changes, which is what the
 * applet's Reset() did. Index 0 sits at the top and the indices increase
 * counterclockwise, because that is the direction the stones are dropped in.
 *
 * A run stops on one of two things: all the stones land in a single cup (the
 * applet's IsFinished), or the position comes back to the one it started from.
 * The second is the port's own addition - the applet simply spun for ever -
 * and it is sound because a move is invertible, so a position that returns
 * once will keep returning and can never gather. It is also the whole point
 * of the page, which is about a setup that does exactly that.
 */

(function () {
  const svg = document.getElementById("ring");
  const statusEl = document.getElementById("status");
  const progressEl = document.getElementById("progress");
  const cupsIn = document.getElementById("cupsIn");
  const stonesIn = document.getElementById("stonesIn");
  const emptiesIn = document.getElementById("emptiesIn");
  const startIn = document.getElementById("startIn");
  const speedIn = document.getElementById("speedIn");
  const moveBtn = document.getElementById("moveBtn");
  const runBtn = document.getElementById("runBtn");
  const resetBtn = document.getElementById("resetBtn");

  const SVG_NS = "http://www.w3.org/2000/svg";
  const CENTER = 200;
  const SAFE_LIMIT = 500000; // a run this long is not going to be watched to the end
  const BUDGET_MS = 12; // how long "Fastest" may compute before drawing a frame

  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const plural = (count, word) => count + " " + word + (count === 1 ? "" : "s");

  let state = null;
  let startKey = "";
  let cupEls = [];
  let geom = null;
  let handEl = null;
  let centreEl = null;
  let timer = null;
  let mode = "idle"; // idle | move | run
  let fresh = -1; // the cup that just received a stone

  /* ------------------------------------------------------------- settings */

  function readSettings() {
    const n = clampInput(cupsIn, 1, 50);
    // The applet caps #Empties at #Cups-1 and Start @ at #Cups (VarifyEmpties).
    emptiesIn.max = String(n - 1);
    startIn.max = String(n);
    const empties = clampInput(emptiesIn, 0, n - 1);
    const start = clampInput(startIn, 1, n);
    return { cups: n, stones: clampInput(stonesIn, 1, 50), empties: empties, start: start - 1 };
  }

  function clampInput(el, lo, hi) {
    let v = parseInt(el.value, 10);
    if (!Number.isFinite(v)) v = lo;
    v = Math.min(hi, Math.max(lo, v));
    if (String(v) !== el.value) el.value = String(v);
    return v;
  }

  /* -------------------------------------------------------------- drawing */

  function el(name, attrs) {
    const node = document.createElementNS(SVG_NS, name);
    for (const k in attrs) node.setAttribute(k, String(attrs[k]));
    return node;
  }

  /** Cup radius and ring radius, sized so the cups never overlap. */
  function layout(n) {
    const spacing = n === 1 ? 999 : 2 * 140 * Math.sin(Math.PI / n);
    const cupR = Math.max(6, Math.min(26, 0.46 * spacing));
    return { cupR: cupR, ringR: 160 - cupR, labels: n <= 24, font: Math.min(15, cupR * 0.92) };
  }

  function position(i, n, radius) {
    const theta = Math.PI / 2 + (i * 2 * Math.PI) / n;
    return { x: CENTER + radius * Math.cos(theta), y: CENTER - radius * Math.sin(theta) };
  }

  function build() {
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    const n = state.n;
    geom = layout(n);
    cupEls = [];

    for (let i = 0; i < n; i++) {
      const p = position(i, n, geom.ringR);
      const g = el("g", { class: "cup" });
      g.appendChild(el("circle", { class: "bowl", cx: p.x, cy: p.y, r: geom.cupR }));
      const t = el("text", { class: "count", x: p.x, y: p.y, "font-size": geom.font });
      g.appendChild(t);
      if (geom.labels) {
        // Inside the ring: the outside belongs to the hand marker.
        const lp = position(i, n, geom.ringR - geom.cupR - 11);
        const lab = el("text", { class: "label", x: lp.x, y: lp.y, "font-size": 10 });
        lab.textContent = String(i + 1);
        g.appendChild(lab);
      }
      svg.appendChild(g);
      cupEls.push({ group: g, count: t });
    }

    handEl = el("polygon", { class: "hand", points: "0,0 0,0 0,0" });
    svg.appendChild(handEl);

    centreEl = el("text", { class: "centre", x: CENTER, y: CENTER });
    svg.appendChild(centreEl);

    svg.setAttribute("aria-label", "A circle of " + n + " cups holding stones, with a hand beside one of them");
  }

  function render() {
    const n = state.n;
    for (let i = 0; i < n; i++) {
      const c = state.counts[i];
      cupEls[i].count.textContent = c > 0 ? String(c) : "";
      const g = cupEls[i].group;
      g.classList.toggle("hand-cup", i === state.hand);
      g.classList.toggle("empty", c === 0);
      g.classList.toggle("fresh", i === fresh);
    }

    const hp = position(state.hand, n, geom.ringR + geom.cupR + 24);
    const inward = position(state.hand, n, geom.ringR + geom.cupR + 12);
    const dx = inward.x - hp.x;
    const dy = inward.y - hp.y;
    const len = Math.hypot(dx, dy) || 1;
    // A triangle pointing at the cup: the tip inward, the base across it.
    const px = -dy / len;
    const py = dx / len;
    handEl.setAttribute(
      "points",
      [
        inward.x + "," + inward.y,
        hp.x + px * 7 + "," + (hp.y + py * 7),
        hp.x - px * 7 + "," + (hp.y - py * 7),
      ].join(" "),
    );

    centreEl.textContent = state.held > 0
      ? state.held + (state.held === 1 ? " stone in hand" : " stones in hand")
      : CupsCore.total(state) + " stones";

    progressEl.textContent = "Moves: " + state.moves;
  }

  function say(text, cls) {
    statusEl.className = cls || "";
    statusEl.textContent = text;
  }

  /* ------------------------------------------------------------- the clock */

  function stepsPerTick() {
    // "Fastest", and anything under reduced motion, advances whole moves.
    return speedIn.value === "instant" || reduceMotion.matches ? "move" : "stone";
  }

  function interval() {
    if (speedIn.value === "instant") return 0;
    return speedIn.value === "slow" ? 170 : 35;
  }

  function stop(message, cls) {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
    mode = "idle";
    runBtn.textContent = "Run";
    fresh = -1;
    if (state) render(); // reset() stops the clock before there is any state
    if (message) say(message, cls);
    setEnabled();
  }

  /** Did the run reach an end? Returns a message, or null to keep going. */
  function verdict() {
    if (CupsCore.gathered(state)) {
      const cup = CupsCore.loneCup(state) + 1;
      return {
        text: "All " + CupsCore.total(state) + " stones are in cup " + cup + ", after " +
          plural(state.moves, "move") + ".",
        cls: "win",
      };
    }
    // Only after a move has been made: at move 0 the position is trivially the
    // one it started from.
    if (state.moves > 0 && state.held === 0 && CupsCore.key(state) === startKey) {
      return {
        text: "Back to the opening position after " + plural(state.moves, "move") +
          ", without the stones ever landing in one cup. This setup never finishes \u2014 " +
          "it just goes round and round.",
        cls: "lose",
      };
    }
    if (state.moves >= SAFE_LIMIT) {
      return {
        text: "Still going after " + state.moves.toLocaleString() + " moves: not gathered, and not back where it " +
          "started either. Some settings take astronomically long \u2014 try fewer stones in each cup.",
        cls: "",
      };
    }
    return null;
  }

  /** One tick of the clock. Returns false when the run has ended. */
  function advance() {
    if (stepsPerTick() === "move") {
      // Whole moves rather than single stones. "Fastest" packs as many as it
      // can into one frame, because gathering can take hundreds of thousands
      // of moves; the other speeds do one per tick so the circle stays
      // readable with the animation turned off.
      const burst = mode === "run" && speedIn.value === "instant";
      const until = Date.now() + BUDGET_MS;
      do {
        if (!CupsCore.move(state)) return false;
        const v = verdict();
        if (v) { stop(v.text, v.cls); return false; }
      } while (burst && Date.now() < until);
      fresh = state.hand;
      if (mode === "move") { stop(null, null); return false; }
      return true;
    }

    if (state.held === 0 && !CupsCore.pickUp(state)) return false;
    CupsCore.dropOne(state);
    fresh = state.hand;
    if (state.held === 0) {
      const v = verdict();
      if (v) { stop(v.text, v.cls); return false; }
      if (mode === "move") { stop(null, null); return false; }
    }
    return true;
  }

  function tick() {
    timer = null;
    if (!advance()) return;
    render();
    timer = setTimeout(tick, interval());
  }

  function begin(newMode) {
    if (state.counts[state.hand] === 0 && state.held === 0) {
      say(
        "The hand is beside an empty cup, so there is nothing to pick up. Start it somewhere else, " +
          "or use fewer empty cups.",
        "",
      );
      return;
    }
    const v = verdict();
    if (v) { stop(v.text, v.cls); return; }
    mode = newMode;
    if (newMode === "run") {
      runBtn.textContent = "Stop";
      say("Running…", "");
    }
    setEnabled();
    tick();
  }

  function setEnabled() {
    const busy = mode !== "idle";
    moveBtn.disabled = busy;
    for (const input of [cupsIn, stonesIn, emptiesIn, startIn]) input.disabled = busy;
  }

  /* ------------------------------------------------------------- the reset */

  function reset() {
    stop(null, null);
    state = CupsCore.create(readSettings());
    startKey = CupsCore.key(state);
    fresh = -1;
    build();
    render();

    if (CupsCore.gathered(state)) {
      say("All the stones are in one cup already. Use fewer empty cups to make this interesting.", "win");
    } else if (state.counts[state.hand] === 0) {
      say("The hand is beside an empty cup, so nothing can happen. Move the start, or use fewer empty cups.", "");
    } else {
      const each = state.k === 1 ? "1 stone in each" : state.k + " stones in each";
      const where = state.empties === 0
        ? state.n + " cups, " + each + "."
        : state.n + " cups, " + each + " of the first " + (state.n - state.empties) + ".";
      say(where + " Press One Move to scoop up the stones under the hand.", "");
    }
  }

  /* -------------------------------------------------------------- bindings */

  moveBtn.addEventListener("click", function () {
    if (mode === "idle") begin("move");
  });

  runBtn.addEventListener("click", function () {
    if (mode === "run") stop("Stopped after " + plural(state.moves, "move") + ".", "");
    else if (mode === "idle") begin("run");
  });

  resetBtn.addEventListener("click", reset);

  for (const input of [cupsIn, stonesIn, emptiesIn, startIn]) {
    input.addEventListener("change", reset);
  }

  reset();
})();
