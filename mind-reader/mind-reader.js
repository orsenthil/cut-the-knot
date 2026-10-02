"use strict";

/*
 * The Mind Reader: think of a 2-digit number, subtract its digit sum, find the
 * result in the table and concentrate on its shape. The table (from
 * mind-reader-core.js) puts the same shape on every multiple of 9, and the
 * result is always one, so the "mind reading" is arithmetic. This file draws
 * the table as one SVG, fades in the shape when asked, and reshuffles the
 * shapes for each new round, as the applet did.
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const CELL = 40; // SVG units per cell
const SHAPE_BOX = { w: 29, h: 27 }; // shape sits top-left, number bottom-right

const tableEl = document.getElementById("table");
const revealEl = document.getElementById("reveal");
const bigShape = document.getElementById("bigShape");
const revealCaption = document.getElementById("revealCaption");
const checkBtn = document.getElementById("checkBtn");
const againBtn = document.getElementById("againBtn");
const newBtn = document.getElementById("newBtn");
const secretBtn = document.getElementById("secretBtn");
const statusEl = document.getElementById("status");

let table = MindReader.newTable();
let showSecret = false;
let revealTimer = null;

function svg(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs || {})) node.setAttribute(k, v);
  return node;
}

function drawTable() {
  const { COLS, ROWS, CELLS } = MindReader;
  tableEl.setAttribute("viewBox", `-1 -1 ${COLS * CELL + 2} ${ROWS * CELL + 2}`);
  tableEl.innerHTML = "";
  const magic = new Set(MindReader.magicCells());

  for (let i = 0; i < CELLS; i++) {
    const row = Math.floor(i / COLS);
    const col = i % COLS;
    const x = col * CELL;
    const y = row * CELL;
    const g = svg("g", { class: "cell" + (showSecret && magic.has(i) ? " magic" : "") });
    const label = svg("title");
    label.textContent = `${i}: ${MindReader.SHAPES[table.figs[i]]}`;
    g.append(
      label,
      svg("rect", { class: "bg", x, y, width: CELL, height: CELL }),
      svg("path", { class: "shape", d: MindReader.shapePath(table.figs[i], x, y, SHAPE_BOX.w, SHAPE_BOX.h) })
    );
    const num = svg("text", { class: "num", x: x + CELL - 2.5, y: y + CELL - 3.5, "text-anchor": "end" });
    num.textContent = i;
    g.appendChild(num);
    tableEl.appendChild(g);
  }
  // the grid on top, one path so the lines stay crisp
  let d = "";
  for (let c = 0; c <= COLS; c++) d += `M${c * CELL} 0V${ROWS * CELL}`;
  for (let r = 0; r <= ROWS; r++) d += `M0 ${r * CELL}H${COLS * CELL}`;
  tableEl.appendChild(svg("path", { class: "gridlines", d }));
}

function setRevealing(on) {
  document.getElementById("stage").classList.toggle("revealing", on);
  checkBtn.disabled = on;
  newBtn.disabled = on;
  revealEl.hidden = !on;
  againBtn.hidden = true;
}

// "Check it!": the table goes away and the special shape fades in.
function readMind() {
  setRevealing(true);
  bigShape.setAttribute("d", MindReader.shapePath(table.special, 0, 0, SHAPE_BOX.w, SHAPE_BOX.h));
  revealCaption.textContent = "";
  revealEl.classList.remove("shown");
  void revealEl.offsetWidth; // restart the fade
  revealEl.classList.add("shown");
  statusEl.textContent = "";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  revealTimer = setTimeout(() => {
    const name = MindReader.SHAPES[table.special];
    revealCaption.textContent = `Is this your shape? ${/^[aeiou]/.test(name) ? "An" : "A"} ${name}!`;
    againBtn.hidden = false;
    againBtn.focus();
  }, reduce ? 0 : 1800);
}

// A new round: reshuffle every shape, like the applet's Reset().
function newTable() {
  clearTimeout(revealTimer);
  table = MindReader.newTable();
  setRevealing(false);
  drawTable();
}

checkBtn.addEventListener("click", readMind);
againBtn.addEventListener("click", () => {
  newTable();
  statusEl.textContent = "New shapes, same magic. Try again and again!";
  checkBtn.focus();
});
newBtn.addEventListener("click", () => {
  newTable();
  statusEl.textContent = "";
});
secretBtn.addEventListener("click", () => {
  showSecret = !showSecret;
  secretBtn.setAttribute("aria-pressed", String(showSecret));
  statusEl.textContent = showSecret
    ? "Every multiple of 9 has the same shape. Whatever number you pick, your answer is always one of them."
    : "";
  drawTable();
});

drawTable();
