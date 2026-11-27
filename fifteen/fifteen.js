"use strict";

/*
 * The page for Sam Loyd's Fifteen: drawing and input only. The rules, the
 * slides, the wrap variants, Cheat and the parity tests are in fifteen-core.js.
 * The stage is one SVG board: persistent counter shapes are moved and relabelled
 * on every render, and a focusable Geom handle is the keyboard cursor, so a
 * theme flip or a slide never destroys the node that has focus.
 */

(function () {
  const Core = FifteenCore;
  const statusEl = document.getElementById("status");
  const cyclesOut = document.getElementById("cyclesOut");
  const modeSel = document.getElementById("mode");
  const sizeOut = document.getElementById("size");
  const lessBtn = document.getElementById("lessBtn");
  const moreBtn = document.getElementById("moreBtn");
  const shuffleBtn = document.getElementById("shuffleBtn");
  const cheatBtn = document.getElementById("cheatBtn");
  const cyclesBox = document.getElementById("cyclesBox");
  const resetBtn = document.getElementById("newBtn");

  const board = Geom.board(document.getElementById("board"));
  const SIZE = 400; // viewBox units; every cell is SIZE / n wide
  const MAX_CELLS = Core.MAX_N * Core.MAX_N;

  const gridLayer = board.layer("grid");
  const faceLayer = board.layer("faces");
  const numberLayer = board.layer("numbers");
  const hitLayer = board.layer("hits");
  const cursorLayer = board.layer("cursor");

  let state = Core.start({});
  let cursorCell = { col: state.n - 1, row: state.n - 1 };
  let lastCell = null;
  let finished = false;
  let message = "Board reset. ";

  const cellSize = () => SIZE / state.n;
  const center = (col, row) => ({ x: (col + 0.5) * cellSize(), y: (row + 0.5) * cellSize() });

  board.el("rect", { x: 0, y: 0, width: SIZE, height: SIZE, rx: 10 }, "board-bg", gridLayer);
  const gridLines = [];
  for (let k = 0; k <= Core.MAX_N; k++) {
    gridLines.push({
      vertical: board.segment({ x: 0, y: 0 }, { x: 0, y: SIZE }, "grid-line", gridLayer),
      horizontal: board.segment({ x: 0, y: 0 }, { x: SIZE, y: 0 }, "grid-line", gridLayer),
    });
  }

  const faces = [];
  const numbers = [];
  const hits = [];
  for (let k = 0; k < MAX_CELLS; k++) {
    faces.push(board.el("rect", { rx: 4 }, "counter", faceLayer));
    numbers.push(board.label({ x: 0, y: 0 }, "", "counter-num", 0, 0, numberLayer));
    const hit = board.el("rect", null, "counter-hit", hitLayer);
    hit.setAttribute("aria-hidden", "true");
    hit.addEventListener("click", () => slideAt(Math.floor(k / state.n), k % state.n));
    hits.push(hit);
  }
  const ring = board.circle(center(cursorCell.col, cursorCell.row), 10, "cursor-ring", cursorLayer);

  /** Snap a Geom handle movement to a cell. A one-unit arrow step moves one cell. */
  function snap(p) {
    const current = center(cursorCell.col, cursorCell.row);
    const dx = p.x - current.x;
    const dy = p.y - current.y;
    let col, row;
    if (Math.abs(dx) <= 1.01 && Math.abs(dy) <= 1.01) {
      col = cursorCell.col + (dx < -0.5 ? -1 : dx > 0.5 ? 1 : 0);
      row = cursorCell.row + (dy < -0.5 ? -1 : dy > 0.5 ? 1 : 0);
    } else {
      col = Math.floor(p.x / cellSize());
      row = Math.floor(p.y / cellSize());
    }
    cursorCell = {
      col: Geom.clamp(col, 0, state.n - 1),
      row: Geom.clamp(row, 0, state.n - 1),
    };
    return center(cursorCell.col, cursorCell.row);
  }

  const cursorHandle = board.handle("cursor", center(cursorCell.col, cursorCell.row), {
    r: 5, step: 1, shift: 1, cls: "cursor-dot", layer: cursorLayer,
    label: "Board cursor. Move with the arrow keys to a counter, then press Enter to slide it.",
    clamp: snap,
    onMove: () => render(),
  });
  cursorHandle.node.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      slideAt(cursorCell.col, cursorCell.row);
    }
  });

  /** The line under the board. "done" is the applet's finished state, not a win. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const { n, tiles, mode } = state;
    const cell = cellSize();

    for (let k = 0; k <= Core.MAX_N; k++) {
      const at = k * cell;
      gridLines[k].vertical.show(k <= n);
      gridLines[k].horizontal.show(k <= n);
      if (k <= n) {
        gridLines[k].vertical.set({ x: at, y: 0 }, { x: at, y: SIZE });
        gridLines[k].horizontal.set({ x: 0, y: at }, { x: SIZE, y: at });
      }
    }

    for (let k = 0; k < MAX_CELLS; k++) {
      const face = faces[k];
      const num = numbers[k];
      const hit = hits[k];
      if (k >= n * n) {
        face.style.display = "none";
        num.show(false);
        hit.style.display = "none";
        continue;
      }
      const col = Math.floor(k / n);
      const row = k % n;
      const v = tiles[k];
      const x = col * cell;
      const y = row * cell;
      face.style.display = "";
      face.setAttribute("x", x + 1);
      face.setAttribute("y", y + 1);
      face.setAttribute("width", cell - 2);
      face.setAttribute("height", cell - 2);
      face.setAttribute("class", "counter" + (v === n * n ? " blank" : "") +
        (lastCell && lastCell.col === col && lastCell.row === row ? " just-moved" : ""));
      num.show(v !== n * n);
      num.set(center(col, row), v === n * n ? "" : String(v));
      num.node.setAttribute("font-size", String(Math.round(cell * 0.42)));
      hit.style.display = "";
      hit.setAttribute("x", x);
      hit.setAttribute("y", y);
      hit.setAttribute("width", cell);
      hit.setAttribute("height", cell);
    }

    const cursorPoint = center(cursorCell.col, cursorCell.row);
    cursorHandle.set(cursorPoint);
    ring.set(cursorPoint, cell * 0.46);

    modeSel.value = String(mode);
    sizeOut.textContent = `${n} × ${n}`;
    lessBtn.disabled = n <= Core.MIN_N;
    moreBtn.disabled = n >= Core.MAX_N;
    cyclesBox.disabled = n > 5;
    if (cyclesBox.disabled) cyclesBox.checked = false;
    cyclesOut.hidden = !cyclesBox.checked;
    if (cyclesBox.checked) cyclesOut.textContent = "Cycles: " + Core.cycles(state);

    const selected = state.tiles[cursorCell.col * n + cursorCell.row];
    const label = selected === n * n
      ? "the empty square"
      : `counter ${selected}, row ${cursorCell.row + 1}, column ${cursorCell.col + 1}`;
    say(message + `Board ${n} × ${n}, ${Core.MODES[mode]}. Cursor on ${label}.`,
      finished ? "done" : null);

    // The position, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        n, mode, tiles: tiles.slice(), cursor: { ...cursorCell }, solved: Core.isSolved(state),
      });
    }
  }

  function slideAt(col, row) {
    const next = Core.move(state, col * state.n + row);
    if (!next) return;
    const blank = Core.blankIndex(state);
    const moved = state.tiles[col * state.n + row];
    lastCell = { col: Math.floor(blank / state.n), row: blank % state.n };
    cursorCell = { ...lastCell };
    state = next;
    finished = Core.isSolved(state);
    message = `Moved counter ${moved} into the empty square. `;
    render();
    cursorHandle.node.focus();
  }

  function resetBoard(prefix) {
    state = Core.start({ n: state.n, mode: state.mode });
    cursorCell = { col: state.n - 1, row: state.n - 1 };
    lastCell = null;
    finished = false;
    message = prefix;
    render();
  }

  function reset() {
    resetBoard("Board reset. ");
  }

  function setSize(delta) {
    const n = Geom.clamp(state.n + delta, Core.MIN_N, Core.MAX_N);
    if (n === state.n) return;
    state = Core.start({ n, mode: state.mode });
    cursorCell = { col: n - 1, row: n - 1 };
    lastCell = null;
    finished = false;
    message = `New ${n} × ${n} board. `;
    render();
  }

  resetBtn.addEventListener("click", reset);
  lessBtn.addEventListener("click", () => setSize(-1));
  moreBtn.addEventListener("click", () => setSize(1));
  shuffleBtn.addEventListener("click", () => {
    state = Core.shuffle(state);
    cursorCell = {
      col: Math.floor(Core.blankIndex(state) / state.n),
      row: Core.blankIndex(state) % state.n,
    };
    lastCell = null;
    finished = false;
    message = "Counters shuffled. ";
    render();
    cursorHandle.node.focus();
  });
  cheatBtn.addEventListener("click", () => {
    const tiles = state.tiles;
    const n = state.n;
    let col = n - 1;
    if (tiles[(n - 3) * n + n - 1] === n * n || tiles[(n - 2) * n + n - 1] === n * n) col = n - 2;
    const swapped = [tiles[(n - 3) * n + col], tiles[(n - 2) * n + col]];
    state = Core.cheat(state);
    lastCell = null;
    finished = false;
    message = `Cheat swapped counters ${swapped[0]} and ${swapped[1]}. `;
    render();
  });
  modeSel.addEventListener("change", () => {
    state = Core.start({ n: state.n, mode: Number(modeSel.value) });
    cursorCell = { col: state.n - 1, row: state.n - 1 };
    lastCell = null;
    finished = false;
    message = `${Core.MODES[state.mode]} board. `;
    render();
  });
  // The applet's item listener resets the board for the Cycles checkbox too.
  cyclesBox.addEventListener("change", () =>
    resetBoard(cyclesBox.checked ? "Cycles on; board reset. " : "Cycles off; board reset. "));

  board.onTheme(render);
  render();
})();
