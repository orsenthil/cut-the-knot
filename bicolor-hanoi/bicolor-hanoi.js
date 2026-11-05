"use strict";

/*
<<<<<<< HEAD
 * Bicolor Towers of Hanoi - the page.
 *
 * All the rules live in bicolor-hanoi-core.js; this file only draws the three
 * pegs and turns clicks, taps and keys into core moves.
 *
 * Each peg is a real <button> holding its own <svg>, so the board scales down
 * to a phone with no measuring and works from the keyboard for free. The
 * applet dragged disks with the mouse; here you tap a peg to lift its top disk
 * and tap another to drop it, which is the same two gestures on a touchscreen.
 */

(function () {
  const H = BicolorHanoi;

  // The svg is 100 units wide; these set how tall a peg is in the same units,
  // so the board keeps its shape at any width and looks right on a phone.
  const UNIT = 15; // height of one slot
  const DISK_H = 12;
  const PLINTH = 5;

  const pegsEl = document.getElementById("pegs");
  const sizeInput = document.getElementById("sizeInput");
  const undoBtn = document.getElementById("undoBtn");
  const resetBtn = document.getElementById("resetBtn");
  const statusEl = document.getElementById("status");
  const scoreEl = document.getElementById("scoreLine");

  let state = null;
  let held = -1;     // peg whose top disk is lifted, or -1
  let heldDisk = -1; // the lifted disk itself, out of the stacks while it floats
  let flashTimer = 0;

  const PEG_NAMES = ["left", "middle", "right"];
  const COLOUR_NAMES = ["gold", "red"];

  const buttons = [0, 1, 2].map((i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "peg";
    b.dataset.peg = String(i);
    b.addEventListener("click", () => tap(i));
    pegsEl.appendChild(b);
    return b;
  });

  /** Width of a disk of this size, in the svg's 100-wide coordinate system. */
  function diskWidth(size, n) {
    if (n <= 1) return 86;
    return 26 + (60 * (size - 1)) / (n - 1);
  }

  function diskRect(d, n, y) {
    const w = diskWidth(H.sizeOf(d), n);
    const cls = "disk " + COLOUR_NAMES[H.colourOf(d)];
    return (
      '<rect class="' + cls + '" x="' + (50 - w / 2).toFixed(2) + '" y="' + y +
      '" width="' + w.toFixed(2) + '" height="' + DISK_H + '" rx="' + DISK_H / 2 + '"/>'
    );
  }

  function render() {
    const n = state.n;
    const capacity = 2 * n;
    const height = UNIT + capacity * UNIT + PLINTH + 2;
    const baseY = height - PLINTH;
    const rodTop = baseY - capacity * UNIT - 2;

    for (let p = 0; p < 3; p++) {
      const stack = state.pegs[p];
      let art =
        '<rect class="rod" x="48.4" y="' + rodTop + '" width="3.2" height="' +
        (baseY - rodTop) + '" rx="1.6"/>' +
        '<rect class="plinth" x="6" y="' + baseY + '" width="88" height="' + PLINTH + '" rx="2"/>';
      for (let i = 0; i < stack.length; i++) {
        art += diskRect(stack[i], n, baseY - (i + 1) * UNIT + (UNIT - DISK_H));
      }
      if (held === p) art += diskRect(heldDisk, n, 1);

      const btn = buttons[p];
      btn.innerHTML =
        '<svg class="pegArt" viewBox="0 0 100 ' + height + '" aria-hidden="true">' + art + "</svg>";
      btn.classList.toggle("holding", held === p);
      btn.classList.toggle("target", held >= 0 && held !== p && H.legal(state, held, p));
      btn.setAttribute("aria-label", describe(p));
    }

    const target = H.minimum(n);
    scoreEl.textContent =
      "Moves: " + state.moves + (target === null ? "" : " · Fewest possible: " + target);
    undoBtn.disabled = state.history.length === 0 || held >= 0;
  }

  /** What a screen reader says about a peg. */
  function describe(p) {
    const stack = state.pegs[p];
    const top = stack.length ? stack[stack.length - 1] : -1;
    const what =
      stack.length === 0
        ? "empty"
        : stack.length + (stack.length === 1 ? " disk" : " disks") + ", top is size " +
          H.sizeOf(top) + " " + COLOUR_NAMES[H.colourOf(top)];
    const peg = PEG_NAMES[p] + " peg: " + what;
    if (held < 0) return peg + (stack.length ? ". Lift the top disk." : ".");
    if (held === p) return peg + ". Holding its top disk; click to put it back.";
    return peg + (H.legal(state, held, p) ? ". Drop here." : ". Cannot drop here.");
  }

  function tap(p) {
    if (held < 0) {
      if (!state.pegs[p].length) {
        say("That peg is empty.", "");
        return;
      }
      held = p;
      heldDisk = state.pegs[p].pop();
      say("", "");
      render();
      return;
    }
    // put the lifted disk back where it came from, then move it for real
    state.pegs[held].push(heldDisk);
    const from = held;
    held = -1;
    heldDisk = -1;
    if (from === p) {
      render();
      return;
    }
    if (!H.move(state, from, p)) {
      flash(p);
      say("A disk can only go on a bigger one, or on one its own size.", "");
      render();
      return;
    }
    if (H.won(state)) {
      const target = H.minimum(state.n);
      if (target !== null && state.moves > target) {
        say("Solved in " + state.moves + " moves. Now try it in " + target + ".", "win");
      } else {
        say("Solved in " + state.moves + " moves — nobody can do it faster.", "win");
      }
    } else {
      say("", "");
    }
    render();
  }

  function say(text, cls) {
    statusEl.textContent = text;
    statusEl.className = cls;
  }

  function flash(p) {
    buttons[p].classList.add("illegal");
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => buttons[p].classList.remove("illegal"), 350);
  }

  function reset(n) {
    state = H.start(n);
    held = -1;
    heldDisk = -1;
    say("", "");
    render();
  }

  for (let n = H.MIN_SIZES; n <= H.MAX_SIZES; n++) {
    const opt = document.createElement("option");
    opt.value = String(n);
    opt.textContent = n + " (" + 2 * n + " disks)";
    if (n === 3) opt.selected = true;
    sizeInput.appendChild(opt);
  }

  sizeInput.addEventListener("change", () => reset(Number(sizeInput.value)));
  resetBtn.addEventListener("click", () => reset(state.n));
  undoBtn.addEventListener("click", () => {
    if (held >= 0) return;
    if (H.undo(state)) {
      say("", "");
      render();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLSelectElement) return;
    if (e.key === "1" || e.key === "2" || e.key === "3") {
      tap(Number(e.key) - 1);
      buttons[Number(e.key) - 1].focus();
    } else if (e.key === "Escape" && held >= 0) {
      tap(held);
    }
  });

  reset(3);
=======
 * UI for Bicolor Towers of Hanoi. The rules and the table of shortest
 * solutions live in hanoi-core.js; this file draws the three pegs and handles
 * picking a ring up and putting it down.
 *
 * The applet's panel is kept: < and > for the number of rings (1..8, starting
 * at 3), Reset, and a "Moves so far" readout. The applet drags rings with the
 * mouse; clicking a peg to lift and another to drop works with touch and the
 * keyboard too, so that is what this does. The applet's Approve() compares
 * the player's moves against 2^N - 1, which is the count for one classic
 * tower and far below what this puzzle can be done in, so the comparison here
 * is against the real minimum from the core's table instead.
 */
(() => {
  const H = HanoiCore;

  const pegsEl = document.getElementById("pegs");
  const floating = document.getElementById("floating");
  const statusEl = document.getElementById("status");
  const movesLine = document.getElementById("movesLine");
  const sizeLabel = document.getElementById("sizeLabel");
  const fewerBtn = document.getElementById("fewerBtn");
  const moreBtn = document.getElementById("moreBtn");
  const undoBtn = document.getElementById("undoBtn");
  const resetBtn = document.getElementById("resetBtn");

  const PEG_NAMES = ["left", "middle", "right"];

  let n = H.N_DEFAULT;
  let pegs = H.start(n);
  let held = null; // the peg a ring has been lifted from, or null
  let moves = 0;
  let past = []; // [from, to] of each move, for undo
  let message = "";
  let pegButtons = [];

  /* ----------------------------------------------------------------- build */

  function build() {
    pegsEl.textContent = "";
    pegButtons = [];
    // Leave room for the tallest a peg can get: every ring on one peg.
    const rh = Math.min(34, Math.max(9, Math.round(150 / n)));
    pegsEl.style.setProperty("--rh", `${rh}px`);
    pegsEl.style.height = `${2 * n * (rh + 2) + 16}px`;
    floating.style.setProperty("--rh", `${rh}px`);
    for (let p = 0; p < H.PEGS; p++) {
      const el = document.createElement("button");
      el.type = "button";
      el.className = "peg";
      el.addEventListener("click", () => tap(p));
      pegsEl.appendChild(el);
      pegButtons.push(el);
    }
  }

  /** A ring's width as a share of its peg, so sizes are easy to tell apart. */
  const ringWidth = (size) => `${Math.round((30 + (62 * size) / n) * 100) / 100}%`;

  function ringEl(ring) {
    const el = document.createElement("div");
    el.className = `ring c${ring.color}`;
    el.style.width = ringWidth(ring.size);
    return el;
  }

  /* ---------------------------------------------------------------- render */

  function render() {
    for (let p = 0; p < H.PEGS; p++) {
      const el = pegButtons[p];
      el.textContent = "";
      for (const ring of pegs[p]) el.appendChild(ringEl(ring));
      el.classList.toggle("lifted", held === p);
      el.classList.toggle("target", held !== null && held !== p && H.canMove(pegs, held, p));
      const top = H.top(pegs, p);
      el.setAttribute("aria-label",
        `${PEG_NAMES[p]} peg, ${pegs[p].length} rings` +
        (top ? `, top ring size ${top.size}` : ", empty") +
        (held === null ? (top ? ": lift it" : "") : held === p ? ": put it back" : ": drop here"));
    }

    floating.textContent = "";
    if (held !== null) {
      const el = ringEl(H.top(pegs, held));
      el.classList.add("held");
      floating.appendChild(el);
    }

    const won = H.isWon(pegs);
    if (won) {
      const best = H.OPTIMUM[n];
      message = moves <= best
        ? `Congratulations! ${moves} moves — that is the fewest possible.`
        : `Congratulations! ${moves} moves. It can be done in ${best}.`;
    }
    statusEl.textContent = message;
    statusEl.classList.toggle("win", won);
    movesLine.innerHTML = `Moves so far: <strong>${moves}</strong> &nbsp;&middot;&nbsp; fewest possible: <strong>${H.OPTIMUM[n]}</strong>`;
    sizeLabel.textContent = String(n);
    fewerBtn.disabled = n <= H.N_MIN;
    moreBtn.disabled = n >= H.N_MAX;
    undoBtn.disabled = past.length === 0;
  }

  /* ------------------------------------------------------------------- play */

  function tap(p) {
    if (H.isWon(pegs)) return;
    if (held === null) {
      if (!pegs[p].length) {
        message = "That peg is empty — there is nothing to pick up.";
      } else {
        held = p;
        message = `Holding the size ${H.top(pegs, p).size} ring. Click a peg to drop it.`;
      }
      render();
      return;
    }
    if (p === held) {
      held = null;
      message = "Put back.";
      render();
      return;
    }
    const problem = H.moveProblem(pegs, held, p);
    if (problem === "bigger") {
      message = "That ring is too big to go on top of a smaller one.";
      render();
      return;
    }
    past.push([held, p]);
    pegs = H.move(pegs, held, p);
    held = null;
    moves++;
    message = "";
    render();
  }

  /* --------------------------------------------------------------- controls */

  function reset() {
    pegs = H.start(n);
    held = null;
    moves = 0;
    past = [];
    message = "";
    render();
  }

  function resize(delta) {
    const next = Math.min(H.N_MAX, Math.max(H.N_MIN, n + delta));
    if (next === n) return;
    n = next;
    build();
    reset();
  }

  resetBtn.addEventListener("click", reset);
  undoBtn.addEventListener("click", () => {
    if (!past.length) return;
    const [from, to] = past.pop();
    // Always legal: the ring sat on top of `from` a moment ago, so everything
    // still under it there is at least as big.
    const back = H.move(pegs, to, from);
    if (!back) return;
    pegs = back;
    held = null;
    moves--;
    message = "";
    render();
  });
  fewerBtn.addEventListener("click", () => resize(-1));
  moreBtn.addEventListener("click", () => resize(+1));

  build();
  reset();
>>>>>>> 7870066 (Add Bicolor Towers of Hanoi puzzle)
})();
