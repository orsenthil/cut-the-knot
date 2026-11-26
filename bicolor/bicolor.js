"use strict";

/*
 * The page for bicolor: drawing and input only; the rules and the bitwise
 * computation live in bicolor-core.js.
 *
 * Sixteen focusable square handles form the 4x4 grid. Dragging a numbered
 * square onto another applies the chosen operation, just as the Java applet's
 * mouseReleased did; with the keyboard, Enter picks a source and Enter on a
 * second square drops it, arrow keys move between squares, Escape cancels.
 * A floating copy follows the pointer while dragging.
 */

(function () {
  const Core = BicolorCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const opButtons = [...document.querySelectorAll("button[data-op]")];

  const N = Core.N;
  const ORIGIN = 22, CELL = 58, PITCH = 66;
  const center = (i) => ({
    x: ORIGIN + (i % 4) * PITCH + CELL / 2,
    y: ORIGIN + Math.floor(i / 4) * PITCH + CELL / 2,
  });
  const cellAt = (p) => {
    const col = Math.round((p.x - ORIGIN - CELL / 2) / PITCH);
    const row = Math.round((p.y - ORIGIN - CELL / 2) / PITCH);
    if (col < 0 || col > 3 || row < 0 || row > 3) return -1;
    const c = center(row * 4 + col);
    return Math.abs(p.x - c.x) <= CELL / 2 + 4 && Math.abs(p.y - c.y) <= CELL / 2 + 4
      ? row * 4 + col : -1;
  };

  let state = Core.start();
  let pending = null;      // keyboard-chosen source square
  let dragFrom = null;     // pointer-dragged source square
  let hoverTarget = -1;
  let dropPoint = null;
  let lastMove = "";

  const cellLayer = board.layer("cells");
  const ghostLayer = board.layer("ghost");
  const handleLayer = board.layer("handles");

  const cells = [], numbers = [], handles = [];
  for (let i = 0; i < N; i++) {
    const p = center(i);
    cells[i] = board.el("rect", {
      x: p.x - CELL / 2, y: p.y - CELL / 2, width: CELL, height: CELL, rx: 7,
    }, "cell", cellLayer);
    numbers[i] = board.label(p, "", "number", 0, 1, cellLayer);
    handles[i] = board.handle(String(i), p, {
      r: 31, step: 1, layer: handleLayer,
      label: `Square ${i + 1}. Drag a numbered square onto another to combine them, or focus and press Enter.`,
      onMove: (point, name) => dragMove(Number(name), point),
    });
    handles[i].node.setAttribute("data-cell", String(i));
  }
  const ghost = board.el("rect", { width: CELL, height: CELL, rx: 7 }, "ghost", ghostLayer);
  ghost.style.display = "none";

  /** Describe a completed drop the way the page describes bitwise operations. */
  function describeDrop(to, sourceValue, targetValue) {
    const op = Core.OPS[state.op];
    const result = state.values[to];
    lastMove = state.op === 3
      ? `NOT: ~ ${sourceValue} = ${result} in square ${to + 1}.`
      : `${op.label}: ${sourceValue} ${op.symbol} ${targetValue === Core.UNASSIGNED ? "empty" : targetValue} = ${result} in square ${to + 1}.`;
  }

  /** Show a message and let the shared tracker see a finished illustration. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    for (let i = 0; i < N; i++) {
      const v = state.values[i];
      const blank = v === Core.UNASSIGNED;
      cells[i].setAttribute("class", "cell" + (blank ? " blank" : "") +
        (pending === i ? " selected" : "") + (hoverTarget === i ? " target" : ""));
      cells[i].style.fill = blank ? "var(--stage)" : Core.css(Core.COLORS[v]);
      numbers[i].set(center(i), blank ? "·" : String(v));
      numbers[i].node.style.fill = blank ? "var(--muted)" : Core.css(Core.INK[v]);
      handles[i].node.setAttribute("aria-label",
        `Square ${i + 1} at row ${Math.floor(i / 4) + 1}, column ${i % 4 + 1}, ` +
        (blank ? "empty" : `number ${v}`) +
        ". Drag a numbered square onto another, or focus and press Enter to pick it.");
      if (dragFrom !== i) handles[i].set(center(i));
    }

    if (Core.isSolved(state)) {
      say("All sixteen squares show 0 to 15 in order. The grid is complete.", "done");
    } else if (pending !== null) {
      say(`Square ${pending + 1} holds ${state.values[pending]}. Choose another square, or press Escape to cancel.`, null);
    } else {
      say(`${lastMove} ${Core.filledCount(state)} of 16 squares have numbers. Choose an operation, then drag a numbered square onto another square.`.trim(), null);
    }
    if (window.Track) window.Track.state(state);
  }

  /* ------------------------------------------------------- pointer dragging */

  function dragMove(from, point) {
    if (dragFrom !== from) return;
    ghost.setAttribute("x", point.x - CELL / 2);
    ghost.setAttribute("y", point.y - CELL / 2);
    ghost.style.fill = Core.css(Core.COLORS[state.values[from]]);
    ghost.style.display = "";
    dropPoint = { x: point.x, y: point.y };
    const target = cellAt(point);
    if (target !== hoverTarget) {
      hoverTarget = target;
      render();
    }
  }

  function endDrag(apply) {
    if (dragFrom === null) return;
    const from = dragFrom;
    const target = apply && dropPoint ? cellAt(dropPoint) : -1;
    dragFrom = null;
    dropPoint = null;
    ghost.style.display = "none";
    handles[from].set(center(from));
    if (target >= 0) {
      const sourceValue = state.values[from];
      const targetValue = state.values[target];
      state = Core.drag(state, from, target);
      describeDrop(target, sourceValue, targetValue);
      pending = null;
    }
    hoverTarget = -1;
    render();
  }

  // Capture first: Geom's own pointerdown only starts a drag of a real handle.
  board.root.addEventListener("pointerdown", (e) => {
    const i = Number(e.target.getAttribute && e.target.getAttribute("data-cell"));
    if (!Number.isInteger(i) || i < 0 || i >= N) return;
    if (state.values[i] === Core.UNASSIGNED) {
      e.stopPropagation();                 // an empty square cannot be picked up
      e.preventDefault();
      e.target.focus();
      pending = null;
      state = Core.click(state, i);
      render();
      return;
    }
    // mousePressed creates a moving square even when the mouse is not moved,
    // so mouseReleased executes the op on this same square.
    dragFrom = i;
    dropPoint = board.toLocal(e.clientX, e.clientY);
    pending = null;
  }, true);

  board.root.addEventListener("pointerup", () => endDrag(true));
  board.root.addEventListener("pointercancel", () => endDrag(false));
  board.root.addEventListener("lostpointercapture", () => endDrag(false));

  /* ------------------------------------------------------------ the keyboard */

  const byNode = new Map(handles.map((h, i) => [h.node, i]));
  const moves = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };

  board.root.addEventListener("keydown", (e) => {
    const i = byNode.get(e.target);
    if (i === undefined) return;
    if (moves[e.key]) {
      e.preventDefault();
      e.stopPropagation();                 // Geom would move the dot itself
      const col = Math.max(0, Math.min(3, i % 4 + moves[e.key][0]));
      const row = Math.max(0, Math.min(3, Math.floor(i / 4) + moves[e.key][1]));
      handles[row * 4 + col].node.focus();
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      e.stopPropagation();
      if (pending === null) {
        if (state.values[i] === Core.UNASSIGNED) {
          say("That square is empty. Pick a square with a number.", null);
          return;
        }
        pending = i;
      } else {
        const sourceValue = state.values[pending];
        const targetValue = state.values[i];
        state = Core.drag(state, pending, i);
        describeDrop(i, sourceValue, targetValue);
        pending = null;
      }
      render();
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      pending = null;
      render();
    }
  }, true);

  /* --------------------------------------------------------------- controls */

  function newPuzzle() {
    // The applet's NewGame leaves the operation Choice where the player put it.
    state = Core.start({ op: state.op });
    pending = null;
    lastMove = "";
    hoverTarget = -1;
    endDrag(false);
    render();
    handles[0].node.focus();
  }

  function chooseOp(e) {
    const op = Number(e.currentTarget.getAttribute("data-op"));
    state = Core.setOp(state, op);
    lastMove = "";
    for (const b of opButtons) {
      b.setAttribute("aria-pressed", String(Number(b.getAttribute("data-op")) === state.op));
    }
    render();
  }

  newBtn.addEventListener("click", newPuzzle);
  for (const b of opButtons) b.addEventListener("click", chooseOp);
  document.addEventListener("keydown", (e) => {
    if ((e.key === "r" || e.key === "R") && e.target.tagName !== "INPUT") newPuzzle();
  });

  board.onTheme(render);
  render();
})();
