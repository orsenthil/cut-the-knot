"use strict";

/*
 * 3-Colour Tower of Hanoi - the page.
 *
 * The rules and Anderson's solver live in hanoi-3c-core.js; this file draws
 * the pegs and runs the controls. As in the applet: Slow, Fast and One step
 * play the solution from the start (500 ms and 100 ms a move); Stop pauses
 * it, and any of the three carries on from there; once you move a disk
 * yourself the solver is switched off until Reset.
 */

(function () {
  const H = Hanoi3cCore;

  const DISK_H = 7; // in the svg's 100-wide units
  const UNIT = 8;
  const PLINTH = 5;
  const SLOW_MS = 500;
  const FAST_MS = 100;
  const FEWEST = { 1: 5, 2: 22, 3: 62 }; // by breadth-first search, see porting/check-hanoi-3c.mjs

  const pegsEl = document.getElementById("pegs");
  const nInput = document.getElementById("nInput");
  const slowBtn = document.getElementById("slowBtn");
  const fastBtn = document.getElementById("fastBtn");
  const stepBtn = document.getElementById("stepBtn");
  const stopBtn = document.getElementById("stopBtn");
  const resetBtn = document.getElementById("resetBtn");
  const statusEl = document.getElementById("status");
  const scoreEl = document.getElementById("scoreLine");

  let state = null;
  let held = -1;
  let heldDisk = null;
  let plan = null; // the solution's moves, once the solver has started
  let next = 0; // index of the next solution move
  let timer = null;
  let userMoved = false;
  let flashTimer = 0;

  const PEG_NAMES = ["left", "middle", "right"];
  const COLOUR_NAMES = ["red", "gold", "blue"];

  const buttons = [0, 1, 2].map((i) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "peg";
    b.addEventListener("click", () => tap(i));
    pegsEl.appendChild(b);
    return b;
  });

  function diskWidth(size, n) {
    if (n <= 1) return 70;
    return 22 + (64 * (size - 1)) / (n - 1);
  }

  function diskRect(d, n, y) {
    const w = diskWidth(d.size, n);
    return (
      '<rect class="disk c' + d.colour + '" x="' + (50 - w / 2).toFixed(2) + '" y="' + y + '" width="' +
      w.toFixed(2) + '" height="' + DISK_H + '" rx="' + DISK_H / 2 + '"/>'
    );
  }

  function render() {
    const n = state.n;
    const slots = 3 * n; // GATHER piles every disk on one peg
    const height = UNIT + slots * UNIT + PLINTH + 2;
    const baseY = height - PLINTH;
    const rodTop = baseY - slots * UNIT - 3;
    for (let p = 0; p < 3; p++) {
      const stack = state.pegs[p];
      let art =
        '<rect class="rod" x="48.6" y="' + rodTop + '" width="2.8" height="' + (baseY - rodTop) + '" rx="1.4"/>' +
        '<rect class="plinth" x="4" y="' + baseY + '" width="92" height="' + PLINTH + '" rx="2"/>';
      stack.forEach((d, i) => {
        art += diskRect(d, n, baseY - (i + 1) * UNIT + (UNIT - DISK_H));
      });
      if (held === p) art += diskRect(heldDisk, n, 1);
      const btn = buttons[p];
      btn.innerHTML = '<svg class="pegArt" viewBox="0 0 100 ' + height + '" aria-hidden="true">' + art + "</svg>";
      btn.classList.toggle("holding", held === p);
      btn.classList.toggle("target", held >= 0 && held !== p && canDrop(p));
      btn.disabled = !!timer;
      btn.setAttribute("aria-label", describe(p));
    }
    scoreEl.textContent = "Moves so far: " + state.moves;
    const done = H.won(state);
    const solverOk = !userMoved && !done && !timer;
    slowBtn.disabled = !solverOk;
    fastBtn.disabled = !solverOk;
    stepBtn.disabled = !solverOk;
    stopBtn.disabled = !timer;
    nInput.disabled = !!timer || userMoved || state.moves > 0;
  }

  function canDrop(p) {
    const stack = state.pegs[p];
    return stack.length === 0 || stack[stack.length - 1].size >= heldDisk.size;
  }

  function describe(p) {
    const stack = state.pegs[p];
    const top = stack[stack.length - 1];
    const what = stack.length === 0 ? "empty" : stack.length + (stack.length === 1 ? " disk" : " disks") +
      ", top is " + COLOUR_NAMES[top.colour] + " size " + top.size;
    const peg = PEG_NAMES[p] + " peg: " + what;
    if (held < 0) return peg + (stack.length ? ". Lift the top disk." : ".");
    if (held === p) return peg + ". Holding its top disk; click to put it back.";
    return peg + (canDrop(p) ? ". Drop here." : ". Cannot drop here.");
  }

  function judge() {
    if (!H.won(state)) {
      say("", "");
      return;
    }
    const best = FEWEST[state.n];
    let text = "Congratulations! Solved in " + state.moves + " moves.";
    if (best !== undefined) {
      text += state.moves <= best ? " Nobody can do it faster." : " The fewest possible is " + best + ".";
    } else if (!userMoved) {
      text += " That is Anderson's algorithm.";
    }
    say(text, "win");
  }

  function tap(p) {
    if (timer) return;
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
    state.pegs[held].push(heldDisk);
    const from = held;
    held = -1;
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
    userMoved = true;
    judge();
    render();
  }

  /** One move of the solution; returns false when it is finished. */
  function step() {
    if (!plan) plan = H.solution(state.n);
    if (next >= plan.length) return false;
    H.move(state, plan[next][0], plan[next][1]);
    next++;
    return next < plan.length;
  }

  function play(ms) {
    if (userMoved || timer) return;
    if (held >= 0) {
      state.pegs[held].push(heldDisk);
      held = -1;
    }
    const tick = () => {
      const more = step();
      timer = more ? setTimeout(tick, ms) : null;
      judge();
      render();
    };
    timer = setTimeout(tick, ms);
    say("", "");
    render();
  }

  function halt() {
    if (timer) clearTimeout(timer);
    timer = null;
  }

  function stop() {
    halt();
    render();
  }

  function say(text, cls) {
    statusEl.textContent = text;
    statusEl.className = cls;
  }

  function flash(p) {
    clearTimeout(flashTimer);
    for (const b of buttons) b.classList.remove("illegal");
    buttons[p].classList.add("illegal");
    flashTimer = setTimeout(() => buttons[p].classList.remove("illegal"), 350);
  }

  function reset(n) {
    halt();
    state = H.start(n);
    held = -1;
    plan = null;
    next = 0;
    userMoved = false;
    say("", "");
    render();
  }

  for (let n = H.MIN_N; n <= H.MAX_N; n++) {
    const opt = document.createElement("option");
    opt.value = String(n);
    opt.textContent = String(n);
    if (n === H.DEFAULT_N) opt.selected = true;
    nInput.appendChild(opt);
  }

  nInput.addEventListener("change", () => reset(Number(nInput.value)));
  resetBtn.addEventListener("click", () => reset(Number(nInput.value)));
  slowBtn.addEventListener("click", () => play(SLOW_MS));
  fastBtn.addEventListener("click", () => play(FAST_MS));
  stopBtn.addEventListener("click", stop);
  stepBtn.addEventListener("click", () => {
    if (userMoved || timer) return;
    step();
    judge();
    render();
  });

  document.addEventListener("keydown", (e) => {
    if (e.target instanceof HTMLSelectElement || e.target instanceof HTMLInputElement) return;
    if (e.key === "1" || e.key === "2" || e.key === "3") {
      tap(Number(e.key) - 1);
      buttons[Number(e.key) - 1].focus();
    } else if (e.key === "Escape" && held >= 0) {
      tap(held);
    }
  });

  reset(H.DEFAULT_N);
})();
