"use strict";

/*
 * The page for Filling a Grid with Good Neighbors: drawing and input only; the rules are in
 * fill-the-board-core.js. A grid of buttons: in Set up a press puts a chip on a square (or takes it
 * off); in Play, One step adds every free square with two occupied neighbours and writes the step
 * number on it. The arrow keys move between squares (one square is in the tab order).
 */

(function () {
  const Core = FillTheBoardCore;
  const gridEl = document.getElementById("grid");
  const statusEl = document.getElementById("status");
  const infoEl = document.getElementById("info");
  const setupRadio = document.getElementById("setupRadio");
  const playRadio = document.getElementById("playRadio");
  const stepBtn = document.getElementById("stepBtn");
  const resetBtn = document.getElementById("resetBtn");
  const nIn = document.getElementById("nIn");

  let state = Core.start({});
  let cur = [0, 0];
  let focusCur = false;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    kind = kind || Core.result(state);
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const n = state.n;
    gridEl.style.setProperty("--n", n);
    gridEl.textContent = "";
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = state.grid[x][y];
      const b = document.createElement("button");
      b.type = "button"; b.className = "sq" + (v === 0 ? " chip" : v > 0 ? " added" : "");
      b.dataset.x = x; b.dataset.y = y;
      b.style.setProperty("--hue", String(v > 0 ? (v * 47) % 360 : 0));
      b.textContent = v === -1 ? "" : String(v);
      b.tabIndex = x === cur[0] && y === cur[1] ? 0 : -1;
      b.setAttribute("aria-label", `Row ${y + 1}, column ${x + 1}: ` + (v === -1 ? "free" : v === 0 ? "a chip placed at the start" : `filled at step ${v}`));
      b.disabled = false;
      gridEl.appendChild(b);
    }
    setupRadio.checked = !state.playing; playRadio.checked = state.playing;
    const over = Core.result(state) !== null || Core.full(state);
    stepBtn.disabled = !state.playing || over;
    nIn.value = String(n);
    infoEl.textContent = state.playing ? `Step ${state.step}: ${Core.count(state)} of ${n * n} squares are filled.` : `${Core.chips(state)} chip${Core.chips(state) === 1 ? "" : "s"} placed. At least ${n} are needed to fill the board.`;
    if (focusCur) { const b = gridEl.querySelector(`button[data-x="${cur[0]}"][data-y="${cur[1]}"]`); if (b) b.focus(); focusCur = false; }
    if (window.Track) window.Track.state(state);
  }

  function describe() {
    const r = Core.result(state);
    if (r === "win") return `The board is full after ${state.step} step${state.step === 1 ? "" : "s"}, starting with ${Core.chips(state)} chip${Core.chips(state) === 1 ? "" : "s"}.` + (Core.chips(state) === state.n ? ` That is the fewest possible.` : "");
    if (r === "lose") return "No square has two filled neighbours any more, and the board is not full. Go back to Set up and place the chips differently.";
    return "";
  }

  function apply(m) { const next = Core.move(state, m); if (!next) return false; state = next; render(); say(describe()); return true; }

  gridEl.addEventListener("click", (e) => {
    const b = e.target.closest("button.sq"); if (!b) return;
    cur = [Number(b.dataset.x), Number(b.dataset.y)]; focusCur = true;
    if (state.playing) { render(); say("Press One step in Play, or go back to Set up to change the chips."); return; }
    apply({ type: "toggle", x: cur[0], y: cur[1] });
  });
  gridEl.addEventListener("keydown", (e) => {
    const n = state.n;
    let [x, y] = cur;
    if (e.key === "ArrowRight") x = Math.min(n - 1, x + 1);
    else if (e.key === "ArrowLeft") x = Math.max(0, x - 1);
    else if (e.key === "ArrowDown") y = Math.min(n - 1, y + 1);
    else if (e.key === "ArrowUp") y = Math.max(0, y - 1);
    else return;
    e.preventDefault(); cur = [x, y]; focusCur = true; render();
  });
  setupRadio.addEventListener("change", () => { if (setupRadio.checked) apply({ type: "mode", value: "setup" }); say("Set up: press squares to put chips on them."); });
  playRadio.addEventListener("change", () => { if (playRadio.checked) { apply({ type: "mode", value: "play" }); say("Play: press One step."); } });
  stepBtn.addEventListener("click", () => { apply({ type: "step" }); stepBtn.focus(); });
  resetBtn.addEventListener("click", () => { state = Core.move(state, { type: "reset" }); cur = [0, 0]; render(); say("The board is empty again."); });
  nIn.addEventListener("change", () => { if (!apply({ type: "size", value: nIn.value })) { say(`N is a whole number from ${Core.MIN_N} to ${Core.MAX_N}.`); nIn.value = String(state.n); } else { cur = [0, 0]; say(`A ${state.n} by ${state.n} board.`); } });

  render();
})();
