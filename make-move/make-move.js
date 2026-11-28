"use strict";

/*
 * The page for Make Your Move, Kid!: drawing and input only; all rules live in
 * make-move-core.js. The stage holds a 4x4 SVG board. Counters are drawn in
 * their squares; one small focusable cursor (a Geom handle) chooses a square
 * with the arrow keys, and Enter or the Slide button slides that square's row
 * or column into the gap. A pointer press on a tile and release on another
 * tile makes the same slide the applet made; a tap slides the tapped tile.
 */

(function () {
  const Core = MakeMoveCore;
  const board = Geom.board(document.getElementById("board"));
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const slideBtn = document.getElementById("slideBtn");

  const ORIGIN = 20;
  const CELL = 80;
  const center = (x, y) => ({ x: ORIGIN + CELL * x + CELL / 2, y: ORIGIN + CELL * y + CELL / 2 });
  const cellAt = (p) => ({ x: Math.floor((p.x - ORIGIN) / CELL), y: Math.floor((p.y - ORIGIN) / CELL) });
  const onBoard = (c) => c.x >= 0 && c.x < Core.N && c.y >= 0 && c.y < Core.N;
  const snap = (p) => {
    const c = cellAt(p);
    return center(Geom.clamp(c.x, 0, Core.N - 1), Geom.clamp(c.y, 0, Core.N - 1));
  };

  let state = Core.start({});
  let cursor = { x: 3, y: 0 };
  let pressed = null;
  let message = "The message is already spelled. Press Reset to swap the last two counters, then slide it back.";

  /* Paint order: the empty square, the counters, then the cursor handle. */
  const marks = board.layer("marks");
  const tilesLayer = board.layer("tiles");
  const hits = board.layer("hits");
  marks.setAttribute("aria-hidden", "true");
  tilesLayer.setAttribute("aria-hidden", "true");

  const gapRect = board.el("rect", { width: CELL - 10, height: CELL - 10, rx: 8 }, "gap", marks);
  const gapDot = board.point({ x: 0, y: 0 }, "gap-dot", 5, marks);

  const tiles = [];
  for (let y = 0; y < Core.N; y++) {
    for (let x = 0; x < Core.N; x++) {
      const group = board.el("g", { "data-cell": `${x},${y}` }, "tile-group", tilesLayer);
      const rect = board.el("rect", { width: CELL - 6, height: CELL - 6, rx: 8 }, "tile", group);
      const letter = board.label({ x: 0, y: 0 }, "", "tile-letter", 0, 0, group);
      tiles.push({ group, rect, letter });
    }
  }

  const cursorHandle = board.handle("cursor", center(cursor.x, cursor.y), {
    r: 9, step: CELL, shift: CELL, cls: "cursor-handle", layer: hits,
    label: "Square cursor. Move it with the arrow keys, then press Enter to slide that square into the gap.",
    describe: () => `column ${cursor.x + 1}, row ${cursor.y + 1}`,
    clamp: snap,
    onMove: () => {
      cursor = cellAt(cursorHandle.point);
      message = `Chosen square: column ${cursor.x + 1}, row ${cursor.y + 1}. Press Enter or Slide to move it.`;
      render();
    },
  });
  cursorHandle.node.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    slideAt(cursor);
  });

  /** The line under the board. "done" is how the record sees a finished play. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const gap = Core.emptyCell(state);
    for (let y = 0; y < Core.N; y++) {
      for (let x = 0; x < Core.N; x++) {
        const view = tiles[y * Core.N + x];
        const value = state.values[x][y];
        if (value === Core.SQUARE) {
          view.group.style.display = "none";
          continue;
        }
        const p = center(x, y);
        view.group.style.display = "";
        view.rect.setAttribute("x", p.x - (CELL - 6) / 2);
        view.rect.setAttribute("y", p.y - (CELL - 6) / 2);
        view.letter.set(p, Core.label(value), 0, 0);
        view.group.classList.toggle("tile-selected", cursor.x === x && cursor.y === y);
        view.group.classList.toggle("tile-just-moved", !!state.last && state.last.x === x && state.last.y === y);
      }
    }
    const atGap = center(gap.x, gap.y);
    gapRect.setAttribute("x", atGap.x - (CELL - 10) / 2);
    gapRect.setAttribute("y", atGap.y - (CELL - 10) / 2);
    gapDot.set(atGap);
    cursorHandle.set(center(cursor.x, cursor.y));

    const finished = Core.result(state) === "done";
    say(finished
      ? "The message is spelled out again: MAKE YOUR MOVE, KID! Press Reset to try the swapped board."
      : message, finished ? "done" : null);

    // The position, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({ values: state.values, cursor: { x: cursor.x, y: cursor.y }, moves: state.moves });
    }
  }

  /** Slide the square at cell towards the gap, if the applet allows it. */
  function slideAt(cell) {
    const next = Core.move(state, cell);
    if (!next) {
      message = `Column ${cell.x + 1}, row ${cell.y + 1} is not in the gap's row or column. Choose a square on the same line as the gap.`;
      render();
      return;
    }
    const moved = Core.changed(state.values, next.values, state.n);
    const gap = Core.emptyCell(next);
    state = next;
    message = `Slid ${moved.join(", ")} one square. The gap is now at column ${gap.x + 1}, row ${gap.y + 1}.`;
    render();
  }

  resetBtn.addEventListener("click", () => {
    state = Core.reset({});
    cursor = { x: 3, y: 0 };
    message = "Reset swapped the last two counters: R and E, traded places. Slide the letters back into the message.";
    render();
  });
  slideBtn.addEventListener("click", () => slideAt(cursor));

  board.root.addEventListener("pointerdown", (e) => {
    if (e.target === cursorHandle.node) { pressed = null; return; }
    const c = cellAt(board.toLocal(e.clientX, e.clientY));
    if (!onBoard(c)) return;
    pressed = c;
    cursor = c;
    cursorHandle.set(center(c.x, c.y));
  });
  board.root.addEventListener("pointerup", (e) => {
    if (!pressed) return;
    const released = cellAt(board.toLocal(e.clientX, e.clientY));
    const target = onBoard(released) ? released : pressed;
    pressed = null;
    slideAt(target);
  });
  board.root.addEventListener("pointercancel", () => { pressed = null; });

  board.onTheme(render);
  render();
})();
