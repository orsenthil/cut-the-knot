"use strict";

/*
 * The page for Moving Chips in Pairs: drawing and input only. An N by N grid in
 * which a chip is a button; the bottom row has a green edge. The rules and the
 * strategy are in moving-chips-in-pairs-core.js.
 */

(function () {
  const Core = ChipsCore;
  const board = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const nEl = document.getElementById("n");
  const el = (id) => document.getElementById(id);

  let state = Core.start();
  let hinted = null;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render(focusCol) {
    const n = state.n;
    el("nOut").textContent = n; nEl.value = n;
    board.style.gridTemplateColumns = `repeat(${n}, 2.2rem)`;
    board.textContent = "";
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const here = state.rows[c] === r;
      const cls = "sq" + ((r + c) % 2 ? " alt" : "") + (r === n - 1 ? " bottom" : "");
      if (!here) { const d = document.createElement("div"); d.className = cls; board.appendChild(d); continue; }
      const b = document.createElement("button");
      b.type = "button";
      b.className = cls + (state.selected[c] ? " sel" : "") + (r === n - 1 ? " done" : "") + (hinted && hinted.includes(c) && !state.selected[c] ? " sel" : "");
      b.disabled = r === n - 1;
      b.setAttribute("aria-label", `Chip in column ${c + 1}, ${n - 1 - r === 0 ? "on the bottom row" : (n - 1 - r) + " above the bottom row"}${state.selected[c] ? ", picked" : ""}`);
      b.setAttribute("aria-pressed", state.selected[c] ? "true" : "false");
      b.dataset.c = c;
      const chip = document.createElement("span"); chip.className = "chip"; b.appendChild(chip);
      b.addEventListener("click", () => { const s = Core.toggle(state, c); if (s) { state = s; hinted = null; render(c); } });
      board.appendChild(b);
    }
    if (focusCol !== undefined) { const f = board.querySelector(`button[data-c="${focusCol}"]`); if (f) f.focus(); }
    el("moveBtn").disabled = !Core.canMove(state);
    el("undoBtn").disabled = state.history.length === 0;
    const res = Core.result(state);
    el("hintBtn").disabled = res !== null || Core.bestPair(state) === null;
    if (res === "win") say("All the chips are on the bottom row!", "win");
    else if (res === "lose") say("Blocked: one chip is left and a move needs two chips.", "lose");
    else say(`${Core.height(state)} step${Core.height(state) === 1 ? "" : "s"} in all to go down. ${Core.pickedCount(state)} picked.`);
    if (window.Track) window.Track.state({ n, rows: state.rows, selected: state.selected, moves: state.history.length, height: Core.height(state) });
  }

  el("moveBtn").addEventListener("click", () => { const s = Core.move(state); if (s) { state = s; hinted = null; render(); } });
  el("undoBtn").addEventListener("click", () => { const s = Core.undo(state); if (s) { state = s; hinted = null; render(); } });
  el("hintBtn").addEventListener("click", () => { hinted = Core.bestPair(state); render(); if (hinted) say(`The two chips farthest from the bottom are in columns ${hinted[0] + 1} and ${hinted[1] + 1}. Pick them and press Make move.`); });
  el("resetBtn").addEventListener("click", () => { state = Core.reset(state); hinted = null; render(); });
  nEl.addEventListener("input", () => { state = Core.resize(state, Number(nEl.value)); hinted = null; render(); });
  render();
})();
