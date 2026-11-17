"use strict";

/*
 * Deficient Squares - the page: drawing and input only.
 *
 * The rules live in deficient-squares-core.js. This file draws the board as an
 * SVG, turns pointer and keyboard clicks into the core's three-click rule, and
 * keeps the status line. The applet's two display styles are kept: Wire joins
 * the centres of the three squares, Blocks fills the L; both colour a piece by
 * the corner its 2x2 box leaves empty. The board is one focusable SVG, so
 * arrow keys move a cursor and Enter clicks the square under it.
 *
 * One addition to the applet: when the chosen board cannot be tiled at all -
 * a side that is a multiple of 3, or a 5x5 gap that is not a corner or the
 * centre - the status line says so plainly, because the applet leaves the
 * player to discover it.
 */

(() => {
  const C = DeficientSquaresCore;
  const SVG = "http://www.w3.org/2000/svg";

  const svg = document.getElementById("board");
  const lineEl = document.getElementById("line");
  const statusEl = document.getElementById("status");
  const nInput = document.getElementById("nInput");
  const modeBtns = [document.getElementById("playBtn"), document.getElementById("blankBtn")];
  const styleBtns = [document.getElementById("wireBtn"), document.getElementById("blocksBtn")];
  const undoBtn = document.getElementById("undoBtn");
  const resetBtn = document.getElementById("resetBtn");

  let state = null;
  let cursor = { row: 0, col: 0 };
  let style = "wire"; // the applet's default (ShowBlocks = false)

  // The L polygon of a unit piece, indexed by the corner it leaves empty.
  const L_POINTS = [
    "1,0 2,0 2,2 0,2 0,1 1,1", // missing upper-left
    "0,0 1,0 1,1 2,1 2,2 0,2", // missing upper-right
    "0,0 2,0 2,1 1,1 1,2 0,2", // missing lower-right
    "0,0 2,0 2,2 1,2 1,1 0,1", // missing lower-left
  ];

  function el(name, attrs) {
    const e = document.createElementNS(SVG, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  }

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function randomBlank(n) {
    return { row: Math.floor(Math.random() * n), col: Math.floor(Math.random() * n) };
  }

  /** A sentence for a board that cannot be tiled, or "" when it can. */
  function impossibleNote(s) {
    if (C.tileable(s.n, s.blank)) return "";
    if (s.n % 3 === 0) {
      return `A ${s.n} × ${s.n} board cannot be tiled: ${s.n * s.n - 1} squares are left, which is not a multiple of 3. Choose another size.`;
    }
    return `No tiling of a 5 × 5 board starts from this gap — only the four corners and the centre work. Use Set blank to move it.`;
  }

  function fresh(n, mode) {
    state = C.start({ n, blank: randomBlank(n), mode: mode || state?.mode || "play" });
    cursor = { row: state.blank.row, col: state.blank.col };
    render();
    const note = impossibleNote(state);
    if (state.mode === "blank") {
      say("Click any square to move the gap. The board is cleared; switch to Play to tile.");
    } else if (note) {
      say(note);
    } else {
      say("The dark square is the gap. Click three squares in an L — each next to the one before — to place a piece.");
    }
  }

  function render() {
    const n = state.n;
    svg.setAttribute("viewBox", `0 0 ${n} ${n}`);
    const parts = [el("rect", { x: 0, y: 0, width: n, height: n, class: "canvas" })];

    if (n <= 24) {
      const grid = el("g", { class: "grid" });
      for (let i = 1; i < n; i++) {
        grid.appendChild(el("line", { x1: i, y1: 0, x2: i, y2: n }));
        grid.appendChild(el("line", { x1: 0, y1: i, x2: n, y2: i }));
      }
      parts.push(grid);
    }

    // The applet's dots at the centre of every cell but the gap, to show the
    // squares the wires join. They are a blur on the biggest boards.
    if (n <= 16) {
      const dots = el("g", { class: "dots" });
      for (let r = 0; r < n; r++) {
        for (let col = 0; col < n; col++) {
          if (r === state.blank.row && col === state.blank.col) continue;
          dots.appendChild(el("circle", { cx: col + 0.5, cy: r + 0.5, r: 0.055 }));
        }
      }
      parts.push(dots);
    }

    const art = el("g", { class: style === "wire" ? "pieces wire" : "pieces blocks" });
    for (const p of state.pieces) {
      if (style === "wire") {
        const points = p.cells.map((c) => `${c.col + 0.5},${c.row + 0.5}`).join(" ");
        art.appendChild(el("polyline", { points, class: "wire c" + p.type }));
      } else {
        const minRow = Math.min(...p.cells.map((c) => c.row));
        const minCol = Math.min(...p.cells.map((c) => c.col));
        art.appendChild(el("polygon", {
          points: L_POINTS[p.type],
          transform: `translate(${minCol} ${minRow})`,
          class: "block c" + p.type,
        }));
      }
    }
    parts.push(art);

    // The unfinished piece: highlight its squares and, with two down, the line
    // to the second one, which the third click must touch.
    if (state.pending.length) {
      const pending = el("g", { class: "pending" });
      for (const c of state.pending) {
        pending.appendChild(el("rect", { x: c.col, y: c.row, width: 1, height: 1, class: "pending-cell" }));
      }
      if (state.pending.length === 2) {
        const a = state.pending[0], b = state.pending[1];
        pending.appendChild(el("line", {
          x1: a.col + 0.5, y1: a.row + 0.5, x2: b.col + 0.5, y2: b.row + 0.5, class: "pending-line",
        }));
      }
      parts.push(pending);
    }

    parts.push(el("rect", { x: state.blank.col, y: state.blank.row, width: 1, height: 1, class: "hole" }));
    parts.push(el("rect", { x: cursor.col, y: cursor.row, width: 1, height: 1, class: "cursor" }));
    parts.push(el("rect", { x: 0, y: 0, width: n, height: n, class: "hit" }));
    svg.replaceChildren(...parts);

    const needed = C.piecesNeeded(n);
    const left = n * n - 1 - C.coveredCount(state);
    lineEl.textContent = needed === null
      ? `Board ${n} × ${n} · ${state.pieces.length} L-pieces · ${left} squares to cover · this size cannot be tiled`
      : `Board ${n} × ${n} · ${state.pieces.length} of ${needed} L-pieces · ${left} square${left === 1 ? "" : "s"} to cover`;
    undoBtn.disabled = state.pieces.length === 0;
    for (const b of modeBtns) b.setAttribute("aria-pressed", String(b.dataset.mode === state.mode));
    for (const b of styleBtns) b.setAttribute("aria-pressed", String(b.dataset.style === style));

    // The position, for the player's record and the tutor (assets/progress.js).
    if (window.Track) {
      window.Track.state({
        n,
        blank: { row: state.blank.row, col: state.blank.col },
        mode: state.mode,
        pending: state.pending.map((c) => [c.row, c.col]),
        pieces: state.pieces.map((p) => p.cells.map((c) => [c.row, c.col])),
      });
    }
  }

  function clickCell(row, col) {
    if (row < 0 || row >= state.n || col < 0 || col >= state.n) return;
    const before = state;
    const r = C.click(state, row, col);
    state = r.state;
    cursor = { row, col };
    render();

    if (C.result(state) === "win") {
      say(`Every square is covered! ${state.pieces.length} L-trominoes fit round the gap. Remove last or Reset to go again.`, "win");
      svg.focus();
      return;
    }
    switch (r.effect) {
      case "started":
        say("First square. Click a square that shares an edge with it.");
        break;
      case "extended":
        say("Second square. Click a square next to the second one, turning the corner.");
        break;
      case "placed": {
        const left = state.n * state.n - 1 - C.coveredCount(state);
        const note = impossibleNote(state);
        if (!C.canPlace(state)) {
          say(`Piece placed, but there is no room for another L — ${left} square${left === 1 ? "" : "s"} are pocketed. Press Remove last.`);
        } else if (note) {
          say(note);
        } else {
          say(`Piece placed. ${left} square${left === 1 ? "" : "s"} to cover.`);
        }
        break;
      }
      case "cancelled":
        say("Those squares do not make an L, so the unfinished piece was dropped. Start again.");
        break;
      case "blank":
        say(impossibleNote(state) ||
          `Gap moved to row ${state.blank.row + 1}, column ${state.blank.col + 1}. Switch to Play to tile.`);
        break;
      case "ignored":
        if (before.pending.length === 0) {
          say("That square is already covered, or it is the gap.");
        }
        break;
    }
    svg.focus();
  }

  function undo() {
    const next = C.removeLast(state);
    if (!next) return;
    state = next;
    if (state.blank.row === cursor.row && state.blank.col === cursor.col) {
      cursor = { row: 0, col: 0 };
    }
    render();
    say(state.pieces.length ? `Took back the last piece. ${state.pieces.length} placed.` : "The board is empty again.");
    svg.focus();
  }

  function setMode(mode) {
    const next = C.setMode(state, mode);
    if (!next) return;
    state = next;
    render();
    if (mode === "blank") {
      say("Click any square to move the gap. The board is cleared; switch to Play to tile.");
    } else {
      say("Play: click three squares in an L — each next to the one before — to place a piece.");
    }
    svg.focus();
  }

  function reset() {
    fresh(Number(nInput.value), state.mode);
    svg.focus();
  }

  for (let n = C.MIN_N; n <= C.MAX_N; n++) {
    const o = document.createElement("option");
    o.value = String(n);
    o.textContent = `${n} × ${n}`;
    if (n === C.DEFAULT_N) o.selected = true;
    nInput.appendChild(o);
  }

  resetBtn.addEventListener("click", reset);
  undoBtn.addEventListener("click", undo);
  nInput.addEventListener("change", () => fresh(Number(nInput.value), state.mode));
  for (const b of modeBtns) b.addEventListener("click", () => setMode(b.dataset.mode));
  for (const b of styleBtns) {
    b.addEventListener("click", () => {
      style = b.dataset.style;
      render();
      svg.focus();
    });
  }

  // Map a pointer press through the board's box, so a shrunken board on a
  // phone still picks the square under the finger.
  svg.addEventListener("click", (e) => {
    const box = svg.getBoundingClientRect();
    const col = Math.floor(((e.clientX - box.left) / box.width) * state.n);
    const row = Math.floor(((e.clientY - box.top) / box.height) * state.n);
    clickCell(row, col);
  });

  svg.addEventListener("keydown", (e) => {
    let { row, col } = cursor;
    switch (e.key) {
      case "ArrowLeft": col = Math.max(0, col - 1); break;
      case "ArrowRight": col = Math.min(state.n - 1, col + 1); break;
      case "ArrowUp": row = Math.max(0, row - 1); break;
      case "ArrowDown": row = Math.min(state.n - 1, row + 1); break;
      case "Enter":
      case " ":
        e.preventDefault();
        clickCell(cursor.row, cursor.col);
        return;
      case "Escape":
        e.preventDefault();
        state = C.cancel(state);
        render();
        say("Unfinished piece dropped.");
        return;
      case "Backspace":
        e.preventDefault();
        undo();
        return;
      default:
        return;
    }
    e.preventDefault();
    cursor = { row, col };
    render();
  });

  fresh(C.DEFAULT_N, "play");
})();
