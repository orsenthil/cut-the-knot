"use strict";

/*
 * Tower of Hanoi, the Hard Way - the page.
 *
 * The rules, the long solution and the position numbering live in
 * long-hanoi-core.js; this file draws the three pegs and turns clicks, taps
 * and keys into core moves.
 *
 * Each peg is a real <button> holding its own <svg>, so the board scales to
 * a phone and works from the keyboard (keys 1, 2, 3). The applet dragged
 * disks; here you tap a peg to lift its top disk and tap another to drop it.
 * As in the applet, the disk count and the Slow and Fast solutions are only
 * available before your first move, and Reset brings them back; Reset also
 * stops a solution part way through.
 *
 * The one thing the applet did not do is watch for repeated positions, which
 * is the whole point of the variation its page describes, so a move that
 * would bring one back is refused and the peg flashes.
 */

(function () {
  const H = LongHanoiCore;

  const UNIT = 13; // height of one disk slot, in the svg's 100-wide units
  const DISK_H = 10;
  const PLINTH = 5;
  const SLOW_MS = 500; // the applet's Thread.sleep() between moves
  const FAST_MS = 100;

  const pegsEl = document.getElementById("pegs");
  const nInput = document.getElementById("nInput");
  const slowBtn = document.getElementById("slowBtn");
  const fastBtn = document.getElementById("fastBtn");
  const hintBtn = document.getElementById("hintBtn");
  const resetBtn = document.getElementById("resetBtn");
  const statusEl = document.getElementById("status");
  const scoreEl = document.getElementById("scoreLine");

  let state = null;
  let held = -1; // peg whose top disk is lifted, or -1
  let heldDisk = 0;
  let playing = null; // timer while Slow or Fast plays the long solution
  let flashTimer = 0;

  const PEG_NAMES = ["left", "middle", "right"];

  const buttons = [0, 1, 2].map((i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "peg";
    b.addEventListener("click", () => tap(i));
    pegsEl.appendChild(b);
    return b;
  });

  function diskWidth(size, n) {
    if (n <= 1) return 80;
    return 24 + (62 * (size - 1)) / (n - 1);
  }

  function diskRect(size, n, y) {
    const w = diskWidth(size, n);
    return (
      '<rect class="disk" x="' + (50 - w / 2).toFixed(2) + '" y="' + y + '" width="' + w.toFixed(2) +
      '" height="' + DISK_H + '" rx="' + DISK_H / 2 + '"/>'
    );
  }

  function render() {
    const n = state.n;
    const height = UNIT + n * UNIT + PLINTH + 2;
    const baseY = height - PLINTH;
    const rodTop = baseY - n * UNIT - 4;
    for (let p = 0; p < 3; p++) {
      const stack = state.pegs[p];
      let art =
        '<rect class="rod" x="48.4" y="' + rodTop + '" width="3.2" height="' + (baseY - rodTop) + '" rx="1.6"/>' +
        '<rect class="plinth" x="4" y="' + baseY + '" width="92" height="' + PLINTH + '" rx="2"/>';
      stack.forEach((size, i) => {
        art += diskRect(size, n, baseY - (i + 1) * UNIT + (UNIT - DISK_H));
      });
      if (held === p) art += diskRect(heldDisk, n, 1);
      const btn = buttons[p];
      btn.innerHTML = '<svg class="pegArt" viewBox="0 0 100 ' + height + '" aria-hidden="true">' + art + "</svg>";
      btn.classList.toggle("holding", held === p);
      btn.classList.toggle("target", held >= 0 && held !== p && canDrop(p));
      btn.disabled = !!playing;
      btn.setAttribute("aria-label", describe(p));
    }
    scoreEl.textContent =
      "Moves so far: " + state.moves + " \u00b7 Longest possible: " + H.longest(n);
    const fresh = !state.touched && !playing;
    nInput.disabled = !fresh;
    slowBtn.disabled = !fresh;
    fastBtn.disabled = !fresh;
    hintBtn.disabled = !!playing || H.won(state) || H.stuck(state);
  }

  /** Can the lifted disk go on peg p? */
  function canDrop(p) {
    const stack = state.pegs[p];
    return stack.length === 0 || stack[stack.length - 1] > heldDisk;
  }

  function describe(p) {
    const stack = state.pegs[p];
    const what = stack.length === 0 ? "empty" : stack.length + (stack.length === 1 ? " disk" : " disks") + ", top is size " + stack[stack.length - 1];
    const peg = PEG_NAMES[p] + " peg: " + what;
    if (held < 0) return peg + (stack.length ? ". Lift the top disk." : ".");
    if (held === p) return peg + ". Holding its top disk; click to put it back.";
    return peg + (canDrop(p) ? ". Drop here." : ". Cannot drop here.");
  }

  function afterMove() {
    if (H.won(state)) say(H.verdict(state), "win");
    else if (H.stuck(state)) say("Dead end: every move from here goes back to a position you have already had. Press Reset.", "lose");
    else say("", "");
    render();
  }

  function tap(p) {
    if (playing) return;
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
    // Put the lifted disk back, then make the move for real (dropping it
    // where it came from is not a move).
    state.pegs[held].push(heldDisk);
    const from = held;
    held = -1;
    if (from === p) {
      render();
      return;
    }
    const repeat = H.repeats(state, from, p);
    if (!H.move(state, from, p)) {
      flash(p, "illegal");
      say(repeat ? "You have had that position before. The whole point is never to repeat one." : "A disk can only go on a bigger one.", "");
      render();
      return;
    }
    afterMove();
  }

  function suggest() {
    if (playing) return;
    if (held >= 0) {
      state.pegs[held].push(heldDisk);
      held = -1;
    }
    const m = H.suggest(state);
    if (!m) {
      say("The long route from here would go back to a position you have already used. Press Reset to start again.", "");
      render();
      return;
    }
    H.move(state, m[0], m[1]);
    flash(m[1], "hinted");
    afterMove();
  }

  function play(ms) {
    if (state.touched || playing) return;
    const moves = H.solution(state.n);
    let i = 0;
    say("", "");
    const step = () => {
      if (i >= moves.length) {
        playing = null;
        afterMove();
        return;
      }
      H.move(state, moves[i][0], moves[i][1]);
      i++;
      render();
      playing = setTimeout(step, ms);
    };
    playing = setTimeout(step, ms);
    render();
  }

  function say(text, cls) {
    statusEl.textContent = text;
    statusEl.className = cls;
  }

  function flash(p, cls) {
    // One flash at a time: a new one cancels the last one's timer, so clear every peg first.
    clearTimeout(flashTimer);
    for (const b of buttons) b.classList.remove("illegal", "hinted");
    buttons[p].classList.add(cls);
    flashTimer = setTimeout(() => buttons[p].classList.remove(cls), 350);
  }

  function reset(n) {
    if (playing) clearTimeout(playing);
    playing = null;
    state = H.start(n);
    held = -1;
    say("", "");
    render();
  }

  for (let n = H.MIN_DISKS; n <= H.MAX_DISKS; n++) {
    const opt = document.createElement("option");
    opt.value = String(n);
    opt.textContent = String(n);
    if (n === H.DEFAULT_DISKS) opt.selected = true;
    nInput.appendChild(opt);
  }

  nInput.addEventListener("change", () => reset(Number(nInput.value)));
  resetBtn.addEventListener("click", () => reset(Number(nInput.value)));
  slowBtn.addEventListener("click", () => play(SLOW_MS));
  fastBtn.addEventListener("click", () => play(FAST_MS));
  hintBtn.addEventListener("click", suggest);

  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) return;
    if (e.key === "1" || e.key === "2" || e.key === "3") {
      tap(Number(e.key) - 1);
      buttons[Number(e.key) - 1].focus();
    } else if (e.key === "Escape" && held >= 0) {
      tap(held);
    }
  });

  reset(H.DEFAULT_DISKS);
})();
