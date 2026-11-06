"use strict";

/*
 * UI for Kayles. The game lives in kayles-core.js; this file draws the ring
 * and runs the turns.
 *
 * As in the applet, you knock down one skittle by clicking it, or two
 * neighbours by clicking just between them, here a focusable dot that only
 * appears when both are standing. "Computer starts" is the applet's "You
 * start" button, which hands the opening move to the computer. Copied from the Dawson's Kayles
 * page, which shares the ring.
 */
(() => {
  const D = KaylesCore;

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
      if (dots[i] && !over) {
        const hit = document.createElementNS(SVG, "circle");
        hit.setAttribute("cx", x.toFixed(2));
        hit.setAttribute("cy", y.toFixed(2));
        hit.setAttribute("r", rHit.toFixed(2));
        hit.setAttribute("class", "pin-hit");
        hit.setAttribute("role", "button");
        hit.setAttribute("tabindex", "0");
        hit.setAttribute("aria-label", `Knock down skittle ${i + 1}`);
        const act = (e) => { e.preventDefault(); humanMove({ at: i, pair: false }); };
        hit.addEventListener("click", act);
        hit.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") act(e); });
        svg.appendChild(hit);
      }
      const c = document.createElementNS(SVG, "circle");
      c.setAttribute("cx", x.toFixed(2));
      c.setAttribute("cy", y.toFixed(2));
      c.setAttribute("r", (dots[i] ? rPin : rPin * 0.72).toFixed(2));
      c.setAttribute("class", dots[i] ? "pin" : "pin down");
      svg.appendChild(c);
    }

    if (over) return;
    for (let i = 0; i < n; i++) {
      if (!dots[i] || !dots[(i + 1) % n]) continue;
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
      const act = (e) => { e.preventDefault(); humanMove({ at: i, pair: true }); };
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
    countEl.textContent = `${standing} standing`;
    moveBtn.disabled = busy || over;
    draw();
  }

  /* ---------------------------------------------------------------- play */

  function finish(humanMovedLast) {
    over = true;
    setStatus(humanMovedLast ? "You won — nothing left to knock down." : "I won — I knocked down the last skittle.",
      humanMovedLast ? "win" : "lose");
  }

  function humanMove(m) {
    if (busy || over || !D.legal(dots, m)) return;
    dots = D.applyMove(dots, m);
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
      if (!mv) { busy = false; render(); return; }
      dots = D.applyMove(dots, mv);
      busy = false;
      if (D.isFinished(dots)) {
        render();
        finish(false);
        render();
        return;
      }
      setStatus(mv.pair ? `I knocked down skittles ${mv.at + 1} and ${((mv.at + 1) % dots.length) + 1}. Your turn.` : `I knocked down skittle ${mv.at + 1}. Your turn.`);
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
