"use strict";

/*
 * The page for Happy 8: drawing and input only. Two overlapping circles hold
 * the counters; six small dots just outside the circles are the controls.
 * Pressing a control turns that circle (or the whole set) one place. All the
 * rules, the move permutations and the Home test live in happy-8-core.js.
 */

(function () {
  const Core = Happy8Core;
  const board = Geom.board("board");
  const statusEl = document.getElementById("status");
  const lessBtn = document.getElementById("lessBtn");
  const moreBtn = document.getElementById("moreBtn");
  const shuffleBtn = document.getElementById("shuffleBtn");
  const cheatBtn = document.getElementById("cheatBtn");
  const resetBtn = document.getElementById("resetBtn");
  const cyclesBox = document.getElementById("cyclesBox");
  const countEl = document.getElementById("countLabel");

  const circles = board.layer("circles");
  const counters = board.layer("counters");
  const controls = board.layer("controls");
  const RADIUS = 76;
  const CENTER_Y = 110;

  const leftCircle = board.circle({ x: 0, y: CENTER_Y }, RADIUS, "h8-circle", circles);
  const rightCircle = board.circle({ x: 0, y: CENTER_Y }, RADIUS, "h8-circle", circles);
  const dots = [];
  const numbers = [];
  for (let i = 0; i < Core.MAX_N; i++) {
    dots.push(board.point({ x: -20, y: -20 }, "h8-counter", 13, counters));
    numbers.push(board.label({ x: -20, y: -20 }, "", "h8-number", 0, 5, counters));
  }
  /** Seat i on circle n, in SVG coordinates (y grows downwards). */
  function seatPoint(i, n, leftX, rightX) {
    const M = Core.halfCount(n);
    const alpha = 2 * Math.PI / M;
    const left = i < M;
    const angle = left
      ? alpha / 2 + i * alpha
      : Math.PI + alpha / 2 + (i - M + 1) * alpha;
    const cx = left ? leftX : rightX;
    return { x: cx + RADIUS * Math.cos(angle), y: CENTER_Y - RADIUS * Math.sin(angle) };
  }

  function circleCenters(n) {
    const shift = RADIUS * Math.cos(Math.PI / Core.halfCount(n));
    return { leftX: 180 - shift, rightX: 180 + shift };
  }

  /** The six focusable controls, one per move. Offsets keep duplicates apart. */
  const handles = {};
  for (const m of Core.MOVES) {
    const h = board.handle(m, { x: -20, y: -20 }, {
      r: 9,
      step: 4,
      cls: "h8-handle",
      layer: controls,
      label: Core.NAMES[m] + ". Press to turn; arrow keys also press it.",
      onMove: function () { /* a drag is not a move; the click or key is */ },
    });
    // A control is a button, not a draggable point: keep Geom's global
    // pointer-drag handler from swallowing the native click (its pointerdown
    // calls preventDefault), while keeping Geom's focus and arrow-key support.
    h.node.addEventListener("pointerdown", (e) => e.stopPropagation());
    h.node.addEventListener("click", () => press(m));
    h.node.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        press(m);
      } else if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].indexOf(e.key) >= 0) {
        // Geom moved the dot; the move follows, and render() snaps it back.
        press(m);
      }
    });
    handles[m] = h;
  }
  board.root.addEventListener("pointerup", render);

  let state = null;
  let lastMove = null;

  /** Shows a line under the game. "done" is how the record sees the play end. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const n = state.n;
    const { leftX, rightX } = circleCenters(n);
    leftCircle.set({ x: leftX, y: CENTER_Y }, RADIUS);
    rightCircle.set({ x: rightX, y: CENTER_Y }, RADIUS);

    for (let i = 0; i < dots.length; i++) {
      const on = i < n;
      dots[i].show(on);
      numbers[i].show(on);
      if (!on) continue;
      const p = seatPoint(i, n, leftX, rightX);
      dots[i].set(p, 13);
      numbers[i].set(p, state.values[i], 0, 5);
      dots[i].node.classList.toggle("home-seat", state.values[i] === (i === 0 ? n : i));
    }

    // Two moves at n=4 share a seat: put the second one on an outer ring.
    const seats = Core.controlSeats(n);
    const used = {};
    for (const m of Core.MOVES) {
      const index = seats[m];
      const onCircle = index < Core.halfCount(n) ? leftX : rightX;
      const base = seatPoint(index, n, leftX, rightX);
      const k = used[index] || 0;
      used[index] = k + 1;
      const dx = base.x - onCircle, dy = base.y - CENTER_Y;
      const d = Math.hypot(dx, dy) || 1;
      const out = 18 + 14 * k;
      handles[m].set({ x: base.x + (dx / d) * out, y: base.y + (dy / d) * out });
      handles[m].node.classList.toggle("finished-turn", state.solved && m === lastMove);
    }

    countEl.textContent = String(n) + " counters";
    lessBtn.disabled = n === Core.MIN_N;
    moreBtn.disabled = n === Core.MAX_N;
    let line = n + " counters in seats: " + state.values.join(" ") + ".";
    if (lastMove) line += " Last turn: " + Core.NAMES[lastMove].toLowerCase() + ".";
    if (cyclesBox.checked) line += " Cycles: " + Core.cycles(state) + ".";
    if (state.solved) {
      say("Home again — every counter is back where it started." +
        (cyclesBox.checked ? " Cycles: " + Core.cycles(state) + "." : ""), "done");
    } else {
      say(line + " Moves since the shuffle: " + state.moves + ".", null);
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function press(m) {
    const next = Core.move(state, m);
    if (!next) return;
    state = next;
    lastMove = m;
    render();
  }

  function setSize(n) {
    state = Core.start({ n });
    lastMove = null;
    render();
  }

  lessBtn.addEventListener("click", () => setSize(state.n - 2));
  moreBtn.addEventListener("click", () => setSize(state.n + 2));
  shuffleBtn.addEventListener("click", () => {
    state = Core.shuffle(state);
    lastMove = null;
    render();
  });
  cheatBtn.addEventListener("click", () => {
    state = Core.cheat(state);
    lastMove = null;
    render();
  });
  resetBtn.addEventListener("click", () => setSize(state.n));
  cyclesBox.addEventListener("change", render);

  // Colours come from CSS tokens, but a theme flip still gets a redraw.
  board.onTheme(render);
  state = Core.start({ n: 8 });
  render();
})();
