"use strict";

/*
 * The page for Merlin's Magic Squares: drawing and input only. The big board
 * is nine buttons (it shows the hint, the number of presses for each, while the
 * Hint box is ticked), the small one is the target (click a square to change
 * it). The rules are in merlin-core.js.
 */

(function () {
  const Core = MerlinCore;
  const boardEl = document.getElementById("board");
  const targetEl = document.getElementById("targetGrid");
  const boardTitle = document.getElementById("boardTitle");
  const statusEl = document.getElementById("status");
  const hintBox = document.getElementById("hintBox");
  const undoBtn = document.getElementById("undoBtn");
  const modulusEl = document.getElementById("modulus");
  const geometryEl = document.getElementById("geometry");

  let state = Core.start();
  let wasSolved = false;
  let geometryLabels = Core.NAMES.slice();

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function makeGrid(parent, onClick) {
    const cells = [];
    for (let i = 0; i < Core.NUM; i++) {
      const b = document.createElement("button");
      b.type = "button"; b.className = "b";
      b.addEventListener("click", () => onClick(i));
      parent.appendChild(b); cells.push(b);
    }
    return cells;
  }

  const board = makeGrid(boardEl, (i) => { const s = Core.press(state, i); if (s) { state = s; update(true); } });
  const target = makeGrid(targetEl, (i) => { const s = Core.editTarget(state, i); if (s) { state = s; update(false); } });

  function radios(parent, name, items, checked, onChange) {
    items.forEach((it) => {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = "radio"; input.name = name; input.value = it.value; input.checked = it.value === checked;
      input.addEventListener("change", () => onChange(it.value));
      const span = document.createElement("span"); span.textContent = it.label;
      label.append(input, span); parent.appendChild(label);
    });
  }
  radios(modulusEl, "mod", [2, 3, 4].map((n) => ({ value: n, label: String(n) })), 3, (n) => { const s = Core.setModulus(state, n); if (s) { state = s; update(false); } });
  radios(geometryEl, "geo", Core.NAMES.map((t, i) => ({ value: i, label: t })), 0, (g) => {
    const s = Core.setGeometry(state, g); if (!s) return;
    state = s;
    if (g === Core.MYSTERY) geometryLabels[Core.MYSTERY] = "Unknown";
    update(false);
  });

  function update(moved) {
    const n = state.n;
    const show = state.hintOn ? state.hint : state.values;
    board.forEach((b, i) => {
      b.textContent = show[i]; b.className = "b s" + show[i];
      b.setAttribute("aria-label", state.hintOn ? `Button ${i + 1}: press it ${show[i]} time${show[i] === 1 ? "" : "s"} (hint). Press to change.` : `Button ${i + 1}: state ${show[i]} of ${n}. Press to play.`);
    });
    target.forEach((b, i) => { b.textContent = state.target[i]; b.className = "b s" + state.target[i]; b.setAttribute("aria-label", `Target ${i + 1}: state ${state.target[i]}. Press to change.`); });
    boardEl.classList.toggle("hinting", state.hintOn);
    boardTitle.textContent = state.hintOn ? "Hint: presses" : "Board";
    hintBox.checked = state.hintOn;
    undoBtn.disabled = state.stack.length === 0;
    modulusEl.querySelectorAll("input").forEach((inp) => { inp.checked = Number(inp.value) === n; inp.disabled = state.geometry === Core.TORUS && Number(inp.value) !== 3; });
    geometryEl.querySelectorAll("input").forEach((inp) => { inp.checked = Number(inp.value) === state.geometry; inp.nextSibling.textContent = geometryLabels[Number(inp.value)]; });
    const solved = Core.solved(state);
    if (solved && moved) say("Solved! The board matches the target.", "win");
    else if (!moved) say("");
    else say("");
    wasSolved = solved;
    if (window.Track) window.Track.state({ n, geometry: state.geometry, values: state.values, target: state.target, hint: state.hint, hintOn: state.hintOn, presses: state.stack.length });
  }

  hintBox.addEventListener("change", () => { state = Core.setHint(state, hintBox.checked); update(false); });
  undoBtn.addEventListener("click", () => { const s = Core.undo(state); if (s) { state = s; update(false); } });
  document.getElementById("resetBtn").addEventListener("click", () => { state = Core.reset(state); update(false); });
  update(false);
})();
