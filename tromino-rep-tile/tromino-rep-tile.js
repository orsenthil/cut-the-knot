"use strict";

/*
 * Tromino as a Rep-tile - the page: drawing and input only.
 *
 * The logic lives in tromino-rep-tile-core.js. This file draws the board as an
 * SVG: each L-tromino is one polygon in its colour, and the missing square is
 * a dark cell. "One step" replaces the biggest Ls with four smaller copies.
 * The board is one focusable SVG; arrow keys move a cursor and Enter places
 * the missing square, so the whole proof can be explored with the keyboard.
 */

(() => {
  const T = TrominoRepTileCore;
  const SVG = "http://www.w3.org/2000/svg";

  const svg = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const expInput = document.getElementById("expInput");
  const stepBtn = document.getElementById("stepBtn");
  const resetBtn = document.getElementById("resetBtn");
  const lineEl = document.getElementById("line");

  let s = null;
  let cursor = { col: 0, row: 0 };

  // The L-shape of a 2x2 block, indexed by the corner it leaves empty.
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

  /** A fresh colour for each nested L, as Trominoing picks them at random. */
  function randomColors(exp) {
    return Array.from({ length: exp }, () => Math.floor(Math.random() * T.NUM_COLORS));
  }

  /** A fresh proof, as Reset() gives: random hole and random colours. */
  function fresh(exp, col, row) {
    const n = 2 ** exp;
    if (col == null) col = Math.floor(Math.random() * n);
    if (row == null) row = Math.floor(Math.random() * n);
    s = T.start({ exp, col, row, colors: randomColors(exp) });
    cursor = { col: s.hole.col, row: s.hole.row };
    render();
    if (T.result(s) === "done") {
      say("A 2 × 2 board with one square gone is exactly one L-tromino. Press One step to begin again.", "done");
    } else {
      say("Click a square to move the missing square, then press One step to split the biggest Ls.");
    }
  }

  function render() {
    const n = s.n;
    svg.setAttribute("viewBox", `0 0 ${n} ${n}`);
    const parts = [el("rect", { x: 0, y: 0, width: n, height: n, class: "canvas" })];

    // Grid lines help on small boards; on a 128x128 board they are only a blur.
    if (n <= 32) {
      const grid = el("g", { class: "grid" });
      for (let i = 1; i < n; i++) {
        grid.appendChild(el("line", { x1: i, y1: 0, x2: i, y2: n }));
        grid.appendChild(el("line", { x1: 0, y1: i, x2: n, y2: i }));
      }
      parts.push(grid);
    }

    // One polygon per L. A piece of side s sits in a 2s by 2s box at (x, y).
    const art = el("g", { class: "pieces" });
    for (const p of s.pieces) {
      art.appendChild(el("polygon", {
        points: L_POINTS[p.which],
        transform: `translate(${p.x} ${p.y}) scale(${p.side})`,
        class: "piece c" + p.color,
      }));
    }
    parts.push(art);

    parts.push(el("rect", { x: s.hole.col, y: s.hole.row, width: 1, height: 1, class: "hole" }));
    // The keyboard cursor is always drawn; CSS makes it stand out on focus.
    parts.push(el("rect", { x: cursor.col, y: cursor.row, width: 1, height: 1, class: "cursor" }));
    // A transparent target over the whole board catches pointer presses. The
    // listener is on the SVG root, which survives each render.
    parts.push(el("rect", { x: 0, y: 0, width: n, height: n, class: "hit" }));
    svg.replaceChildren(...parts);

    const biggest = Math.max(...s.pieces.map((p) => p.side));
    const total = Math.max(0, s.exp - 1);
    lineEl.textContent = `Board ${n} × ${n} · ${s.pieces.length} L-piece${s.pieces.length === 1 ? "" : "s"} · biggest ${biggest} × ${biggest}` +
      (total ? ` · step ${s.level} of ${total}` : "");

    // The position, for the player's record and the tutor (assets/progress.js).
    if (window.Track) {
      window.Track.state({
        exp: s.exp,
        n: s.n,
        hole: { col: s.hole.col, row: s.hole.row },
        level: s.level,
        pieces: s.pieces.length,
      });
    }
  }

  function placeHole(col, row) {
    const next = T.move(s, { type: "hole", col, row });
    if (!next) return;
    s = next;
    cursor = { col, row };
    render();
    if (T.result(s) === "done") {
      say("A 2 × 2 board with one square gone is exactly one L-tromino. Press One step to begin again.", "done");
    } else {
      say(`Missing square moved to column ${col + 1}, row ${row + 1}. Press One step to follow the proof.`);
    }
    svg.focus();
  }

  function oneStep() {
    const before = s.level;
    s = T.move(s, { type: "step" });
    render();
    if (before >= s.exp - 1) {
      // Go called Reset(false): the same hole, the opening picture again.
      say("Back at the start with the same missing square. Press One step to go round again.");
      return;
    }
    if (T.result(s) === "done") {
      say(`The whole board is covered by ${s.pieces.length} unit L-trominoes. Press One step to begin again.`, "done");
    } else {
      const next = s.pieces.length;
      say(`Step ${s.level} of ${s.exp - 1}: every L bigger than ${s.step} × ${s.step} became four smaller ones. ${next} pieces.`);
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

  // Map a press through the board's box, so the board can shrink on a phone
  // and the cell under the finger is still the one picked.
  svg.addEventListener("click", (e) => {
    const box = svg.getBoundingClientRect();
    const col = Math.floor(((e.clientX - box.left) / box.width) * s.n);
    const row = Math.floor(((e.clientY - box.top) / box.height) * s.n);
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
