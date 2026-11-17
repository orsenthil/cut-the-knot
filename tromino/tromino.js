"use strict";

/*
 * Golomb's Tromino Theorem - the page: drawing and input only.
 *
 * The induction lives in tromino-core.js. This file draws the board as an SVG:
 * the missing square is a dark cell, and each step paints one more generation
 * of L-trominoes round the centre of every unfinished square board. The board
 * is one focusable SVG; arrow keys move a cursor and Enter sets the missing
 * square, so the whole proof can be explored with the keyboard alone.
 */

(() => {
  const T = TrominoCore;
  const SVG = "http://www.w3.org/2000/svg";

  const svg = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const expInput = document.getElementById("expInput");
  const stepBtn = document.getElementById("stepBtn");
  const resetBtn = document.getElementById("resetBtn");
  const lineEl = document.getElementById("line");

  let s = null;
  let cursor = { col: 0, row: 0 };

  // The L-shape of a 2x2 block, as points in a unit square, indexed by the
  // corner it is missing (the quadrant of the hole). See PIECE_CELLS in core.
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

  /** A fresh proof with a random missing square, as the applet opens with. */
  function fresh(exp, col, row) {
    const n = 2 ** exp;
    if (col == null) col = Math.floor(Math.random() * n);
    if (row == null) row = Math.floor(Math.random() * n);
    s = T.start({ exp, col, row });
    cursor = { col: s.hole.col, row: s.hole.row };
    render();
    say(`Step 0 of ${s.exp}. Click a square to move the missing square, then press One step.`);
  }

  function render() {
    const n = s.n;
    svg.setAttribute("viewBox", `0 0 ${n} ${n}`);
    const parts = [el("rect", { x: 0, y: 0, width: n, height: n, class: "canvas" })];

    // Grid lines are helpful on small boards; on a 128x128 board they would
    // just be a grey blur, so leave them out.
    if (n <= 32) {
      const grid = el("g", { class: "grid" });
      for (let i = 1; i < n; i++) {
        grid.appendChild(el("line", { x1: i, y1: 0, x2: i, y2: n }));
        grid.appendChild(el("line", { x1: 0, y1: i, x2: n, y2: i }));
      }
      parts.push(grid);
    }

    // One L-tromino per piece, as a single path in the colour of its level.
    const art = el("g", { class: "pieces" });
    for (const p of s.trominoes) {
      const poly = el("polygon", {
        points: L_POINTS[p.type],
        transform: `translate(${p.bx} ${p.by})`,
        class: "piece c" + p.color,
      });
      art.appendChild(poly);
    }
    parts.push(art);

    parts.push(el("rect", { x: s.hole.col, y: s.hole.row, width: 1, height: 1, class: "hole" }));
    // The keyboard cursor is always drawn; CSS makes it stand out on focus.
    parts.push(el("rect", { x: cursor.col, y: cursor.row, width: 1, height: 1, class: "cursor" }));
    // A transparent target over the whole board catches pointer presses.
    // The listener lives on the SVG root, not this rect: a render replaces the
    // children, but the root survives and keeps the listener.
    parts.push(el("rect", { x: 0, y: 0, width: n, height: n, class: "hit" }));
    svg.replaceChildren(...parts);

    lineEl.textContent = `Board ${n} × ${n} · ${s.level} of ${s.exp} step${s.exp === 1 ? "" : "s"} shown · ${s.trominoes.length} L-piece${s.trominoes.length === 1 ? "" : "s"}`;
    stepBtn.disabled = false; // pressing past the end starts the proof again

    // The position, for the player's record and the tutor (assets/progress.js).
    if (window.Track) {
      window.Track.state({
        exp: s.exp,
        n: s.n,
        hole: { col: s.hole.col, row: s.hole.row },
        level: s.level,
        pieces: s.trominoes.length,
      });
    }
  }

  function placeHole(col, row) {
    const next = T.move(s, { type: "hole", col, row });
    if (!next) return;
    s = next;
    cursor = { col, row };
    render();
    say(`Missing square moved to column ${col + 1}, row ${row + 1}. Press One step to follow the proof.`);
    svg.focus();
  }

  function oneStep() {
    const before = s.level;
    s = T.move(s, { type: "step" });
    render();
    if (before === s.exp) {
      say(`Back at the start with the same missing square. Press One step again.`);
      return;
    }
    if (T.result(s) === "done") {
      say(`The whole board is covered! ${s.trominoes.length} L-trominoes fit with one square missing. Press One step to begin again.`, "done");
    } else {
      say(`Step ${s.level} of ${s.exp}: one more L in every unfinished quarter.`);
    }
  }

  for (let e = T.MIN_EXP; e <= T.MAX_EXP; e++) {
    const o = document.createElement("option");
    o.value = String(e);
    o.textContent = `${e}  (${2 ** e} × ${2 ** e})`;
    if (e === T.DEFAULT_EXP) o.selected = true;
    expInput.appendChild(o);
  }

  stepBtn.addEventListener("click", oneStep);
  resetBtn.addEventListener("click", () => fresh(Number(expInput.value)));
  expInput.addEventListener("change", () => fresh(Number(expInput.value)));

  // Map a pointer press through the board's bounding box, so the board can
  // shrink on a phone and the cell under the finger is still the one picked.
  svg.addEventListener("click", (e) => {
    const box = svg.getBoundingClientRect();
    const col = Math.floor((e.clientX - box.left) / box.width * s.n);
    const row = Math.floor((e.clientY - box.top) / box.height * s.n);
    if (col < 0 || col >= s.n || row < 0 || row >= s.n) return;
    placeHole(col, row);
  });
  svg.addEventListener("keydown", (e) => {
    let { col, row } = cursor;
    switch (e.key) {
      case "ArrowLeft": col = Math.max(0, col - 1); break;
      case "ArrowRight": col = Math.min(s.n - 1, col + 1); break;
      case "ArrowUp": row = Math.max(0, row - 1); break;
      case "ArrowDown": row = Math.min(s.n - 1, row + 1); break;
      case "Enter":
      case " ":
        e.preventDefault();
        placeHole(cursor.col, cursor.row);
        return;
      default: return;
    }
    e.preventDefault();
    cursor = { col, row };
    render(); // move the outline; the missing square changes only on Enter
  });

  fresh(Number(expInput.value));
})();
