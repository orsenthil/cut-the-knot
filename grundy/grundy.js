"use strict";

/*
 * UI for Grundy's Game. The rules and the computer live in grundy-core.js;
 * this file draws the bars and runs the turns.
 *
 * Each bar is drawn where the applet drew it: every heap keeps its row and
 * its place in that row, so a broken bar stays where it was with a gap at
 * the break. As in the applet you click between two squares to break there;
 * here each break point is a focusable hit area as wide as a square, so it
 * can be tapped on a phone and reached with Tab and Enter.
 */
(() => {
  const G = GrundyCore;

  const svg = document.getElementById("board");
  const heapsLine = document.getElementById("heapsLine");
  const statusEl = document.getElementById("status");
  const sizeInput = document.getElementById("sizeInput");
  const heapsInput = document.getElementById("heapsInput");
  const randomInput = document.getElementById("randomInput");
  const newBtn = document.getElementById("newBtn");

  const SVG = "http://www.w3.org/2000/svg";
  const SQ = 22; // one square, in viewBox units
  const ROW = 34; // one row of bars
  const PAD = 6;
  const INSET = 2; // half the gap left between two pieces of a broken bar
  const THINK_MS = 600;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let state = null;
  let width = 0; // squares across: the longest row
  let busy = false;
  let timer = null;

  function el(name, attrs) {
    const e = document.createElementNS(SVG, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  }

  function setStatus(text, cls) {
    statusEl.textContent = text || "";
    statusEl.className = cls || "";
  }

  /* ------------------------------------------------------------- drawing */

  function draw() {
    const rows = Math.max(...state.heaps.map((h) => h.row)) + 1;
    const w = width * SQ + 2 * PAD;
    const h = rows * ROW + 2 * PAD - (ROW - SQ);
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    svg.style.maxWidth = Math.max(w * 1.25, 200) + "px";
    svg.replaceChildren();
    svg.classList.toggle("busy", busy || state.over);

    const ordered = state.heaps.slice().sort((a, b) => a.row - b.row || a.at - b.at);
    for (const heap of ordered) {
      const x = PAD + heap.at * SQ;
      const y = PAD + heap.row * ROW;
      const dead = heap.size <= 2;
      svg.appendChild(el("rect", {
        x: x + INSET, y, width: heap.size * SQ - 2 * INSET, height: SQ, rx: 4,
        class: dead ? "heap dead" : "heap",
      }));
      const grooves = el("g", { class: "grooves" });
      for (let k = 1; k < heap.size; k++) {
        grooves.appendChild(el("line", { x1: x + k * SQ, y1: y + 3, x2: x + k * SQ, y2: y + SQ - 3, class: "groove" }));
      }
      svg.appendChild(grooves);

      if (dead || state.over) continue;
      for (let k = 1; k < heap.size; k++) {
        const cx = x + k * SQ;
        const equal = k === heap.size - k;
        const hit = el("rect", {
          x: cx - SQ / 2, y: y - 4, width: SQ, height: SQ + 8,
          class: equal ? "cut-hit equal" : "cut-hit",
          tabindex: busy ? "-1" : "0",
          role: "button",
          "aria-label": `Break the bar of ${heap.size} into ${k} and ${heap.size - k}` + (equal ? " (not allowed)" : ""),
        });
        hit.addEventListener("click", () => cut(heap.id, k));
        hit.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            cut(heap.id, k);
          }
        });
        svg.appendChild(hit);
        svg.appendChild(el("line", { x1: cx, y1: y - 3, x2: cx, y2: y + SQ + 3, class: "cut-line" }));
      }
    }

    if (state.last) {
      const cx = PAD + state.last.at * SQ;
      const y = PAD + state.last.row * ROW;
      svg.appendChild(el("line", { x1: cx, y1: y - 2, x2: cx, y2: y + SQ + 2, class: "last-cut" }));
    }

    const sizes = ordered.filter((h) => h.size > 2).map((h) => h.size);
    heapsLine.textContent = sizes.length ? "Bars that can still break: " + sizes.join(", ") : "No bar can break any more.";
  }

  /* ---------------------------------------------------------------- turns */

  function cut(id, k) {
    if (busy || state.over) return;
    const result = G.playerMove(state, id, k);
    if (result === "equal") {
      setStatus("This move is not allowed! The two pieces must be different sizes.", "lose");
      return;
    }
    if (result !== "ok") return;
    const refocus = svg.contains(document.activeElement);
    if (state.over) {
      setStatus("You won! You made the last break.", "win");
      draw();
      return;
    }
    busy = true;
    setStatus("Thinking ...", "");
    draw();
    timer = window.setTimeout(() => {
      timer = null;
      G.computerMove(state);
      busy = false;
      if (state.over) setStatus("I won! I made the last break.", "lose");
      else setStatus("Your move.", "");
      draw();
      const first = svg.querySelector(".cut-hit");
      if (refocus && first) first.focus({ preventScroll: true });
    }, reduceMotion.matches ? 120 : THINK_MS);
  }

  function newGame() {
    if (timer) window.clearTimeout(timer);
    timer = null;
    busy = false;
    const max = Number(sizeInput.value);
    const heaps = Number(heapsInput.value);
    randomInput.disabled = heaps < 2;
    state = G.start(max, heaps, randomInput.checked && heaps > 1);
    width = Math.max(...state.heaps.map((h) => h.size));
    if (G.finished(state)) setStatus("No bar can be broken. Make the bars longer.", "");
    else setStatus("Your move.", "");
    draw();
  }

  function fill(select, from, to, value) {
    for (let n = from; n <= to; n++) {
      const opt = document.createElement("option");
      opt.value = String(n);
      opt.textContent = String(n);
      if (n === value) opt.selected = true;
      select.appendChild(opt);
    }
  }

  fill(sizeInput, 1, G.MAX_SIZE, G.DEFAULT_SIZE);
  fill(heapsInput, 1, G.MAX_HEAPS, G.DEFAULT_HEAPS);
  sizeInput.addEventListener("change", newGame);
  heapsInput.addEventListener("change", newGame);
  randomInput.addEventListener("change", newGame);
  newBtn.addEventListener("click", newGame);

  newGame();
})();
