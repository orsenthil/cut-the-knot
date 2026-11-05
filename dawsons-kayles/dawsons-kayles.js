"use strict";

/*
 * UI for Dawson's Kayles. The game lives in dk-core.js; this file draws the
 * ring and runs the turns.
 *
 * The applet put a clickable hot spot between every pair of neighbouring
 * positions - "to remove a pair of adjacent skittles just click somewhere
 * between the two" - and this does the same, as a focusable dot that only
 * appears when both of its neighbours are still standing. "Make Move" is the
 * applet's own button for handing the opening to the computer.
 */
(() => {
  const D = DawsonKaylesCore;

  const svg = document.getElementById("ring");
  const countEl = document.getElementById("count");
  const statusEl = document.getElementById("status");
  const nInput = document.getElementById("nInput");
  const fullBox = document.getElementById("fullBox");
  const newBtn = document.getElementById("newBtn");
  const moveBtn = document.getElementById("moveBtn");

  const SVG = "http://www.w3.org/2000/svg";
  const CX = 200;
  const CY = 200;
  const R = 158;
  const THINK_MS = 550;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  let dots = [];
  let busy = false;
  let over = false;
  let timer = null;

  const angle = (i, n) => (i / n) * 2 * Math.PI - Math.PI / 2;
  const at = (a, r) => [CX + r * Math.cos(a), CY + r * Math.sin(a)];

  function setStatus(text, cls) {
    statusEl.textContent = text || "";
    statusEl.className = cls || "";
  }

  /* ------------------------------------------------------------- drawing */

  function draw() {
    const n = dots.length;
    const spacing = (2 * Math.PI * R) / n;
    const rPin = Math.min(14, spacing * 0.32);
    const rDot = Math.min(8, spacing * 0.14);
    const rHit = Math.min(16, spacing * 0.42);

    svg.replaceChildren();

    const ring = document.createElementNS(SVG, "circle");
    ring.setAttribute("cx", CX);
    ring.setAttribute("cy", CY);
    ring.setAttribute("r", R);
    ring.setAttribute("class", "track");
    svg.appendChild(ring);

    for (let i = 0; i < n; i++) {
      const [x, y] = at(angle(i, n), R);
      const c = document.createElementNS(SVG, "circle");
      c.setAttribute("cx", x.toFixed(2));
      c.setAttribute("cy", y.toFixed(2));
      c.setAttribute("r", (dots[i] ? rPin : rPin * 0.72).toFixed(2));
      c.setAttribute("class", dots[i] ? "pin" : "pin down");
      svg.appendChild(c);
    }

    if (over) return;
    for (const i of D.legalMoves(dots)) {
      const j = (i + 1) % n;
      const [x, y] = at(angle(i, n) + Math.PI / n, R);
      const hit = document.createElementNS(SVG, "circle");
      hit.setAttribute("cx", x.toFixed(2));
      hit.setAttribute("cy", y.toFixed(2));
      hit.setAttribute("r", rHit.toFixed(2));
      hit.setAttribute("class", "gap-hit");
      hit.setAttribute("role", "button");
      hit.setAttribute("tabindex", "0");
      hit.setAttribute("aria-label", `Knock down skittles ${i + 1} and ${j + 1}`);
      const act = (e) => { e.preventDefault(); humanMove(i); };
      hit.addEventListener("click", act);
      hit.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") act(e);
      });
      svg.appendChild(hit);

      const dot = document.createElementNS(SVG, "circle");
      dot.setAttribute("cx", x.toFixed(2));
      dot.setAttribute("cy", y.toFixed(2));
      dot.setAttribute("r", rDot.toFixed(2));
      dot.setAttribute("class", "gap-dot");
      svg.appendChild(dot);
    }
  }

  function render() {
    svg.classList.toggle("busy", busy);
    const standing = dots.filter((d) => d).length;
    const moves = D.legalMoves(dots).length;
    countEl.textContent = `${standing} standing · ${moves} pair${moves === 1 ? "" : "s"} left to take`;
    moveBtn.disabled = busy || over;
    draw();
  }

  /* ---------------------------------------------------------------- play */

  function finish(humanMovedLast) {
    over = true;
    setStatus(humanMovedLast ? "You won — nothing left to knock down." : "I won — you have no move left.",
      humanMovedLast ? "win" : "lose");
  }

  function humanMove(i) {
    if (busy || over || !D.legalMoves(dots).includes(i)) return;
    dots = D.applyMove(dots, i);
    if (D.isFinished(dots)) {
      render();
      finish(true);
      render();
      return;
    }
    computerTurn();
  }

  function computerTurn() {
    busy = true;
    setStatus("Thinking…");
    render();
    timer = window.setTimeout(() => {
      timer = null;
      const mv = D.play(dots, Math.random);
      if (mv < 0) { busy = false; render(); return; }
      dots = D.applyMove(dots, mv);
      busy = false;
      if (D.isFinished(dots)) {
        render();
        finish(false);
        render();
        return;
      }
      setStatus(`I took skittles ${mv + 1} and ${((mv + 1) % dots.length) + 1}. Your turn.`);
      render();
    }, reduceMotion.matches ? 120 : THINK_MS);
  }

  function newGame() {
    if (timer !== null) { window.clearTimeout(timer); timer = null; }
    const typed = parseInt(nInput.value, 10);
    const n = Number.isFinite(typed) ? Math.min(D.MAX_N, Math.max(D.MIN_N, typed)) : D.DEFAULT_N;
    nInput.value = String(n);
    dots = D.newBoard(n, fullBox.checked, Math.random);
    busy = false;
    over = D.isFinished(dots);
    setStatus(over ? "Nothing to play — start a new game." : "");
    render();
  }

  /* ------------------------------------------------------------- wiring */

  newBtn.addEventListener("click", newGame);
  nInput.addEventListener("change", newGame);
  fullBox.addEventListener("change", newGame);
  moveBtn.addEventListener("click", () => {
    if (busy || over) return;
    computerTurn();
  });
  window.addEventListener("themechange", render);

  newGame();
})();
