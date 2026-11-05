"use strict";

/*
 * Integer Iterations on a Circle - the page.
 *
 * The step lives in ducci-core.js; this file draws the circle and runs the
 * controls, as the applet did: One Step, Undo (a stack that also undoes your
 * own edits), Reset to zeros or random numbers, and 3 to 20 numbers. Each step
 * the numbers are drawn half a place round from the last, so a new number sits
 * between the two it came from, which is how the applet showed it.
 *
 * One change: "Random numbers" starts ticked, so the page opens on a circle to
 * step rather than on all zeros, which the applet showed first.
 *
 * The status line says when the circle reaches zeros, or when it repeats a
 * circle seen since the last Reset or edit, which means it is in a loop.
 */

(() => {
  const D = DucciCore;

  const svg = document.getElementById("circle");
  const nInput = document.getElementById("nInput");
  const randomInput = document.getElementById("randomInput");
  const stepBtn = document.getElementById("stepBtn");
  const undoBtn = document.getElementById("undoBtn");
  const resetBtn = document.getElementById("resetBtn");
  const statusEl = document.getElementById("status");
  const stepLine = document.getElementById("stepLine");

  const SVG = "http://www.w3.org/2000/svg";
  const C = 200;
  const RING = 150;

  let values = [];
  let half = 0; // 0 or 1: which ring of positions, flipped each step
  let steps = 0;
  let undo = [];
  let seen = new Map(); // circle -> step number, since the last reset or edit

  function el(name, attrs) {
    const e = document.createElementNS(SVG, name);
    for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  }

  function say(text, cls) {
    statusEl.textContent = text;
    statusEl.className = cls || "";
  }

  function draw() {
    const n = values.length;
    const r = Math.max(14, Math.min(30, (Math.PI * RING) / n - 4));
    svg.replaceChildren(el("circle", { cx: C, cy: C, r: RING, class: "ring" }));
    values.forEach((v, i) => {
      const a = (2 * Math.PI * (i + half / 2)) / n - Math.PI / 2;
      const x = C + RING * Math.cos(a);
      const y = C + RING * Math.sin(a);
      const g = el("g", { class: "num" + (v === 0 ? " zero" : ""), tabindex: "0", role: "button",
        "aria-label": `number ${i + 1}: ${v}. Right half or up arrow adds 1, left half or down arrow takes 1 away` });
      g.appendChild(el("circle", { cx: x, cy: y, r, class: "disc" }));
      const t = el("text", { x, y });
      t.textContent = String(v);
      t.style.fontSize = Math.round(r * 0.75) + "px";
      g.appendChild(t);
      const left = el("rect", { x: x - r, y: y - r, width: r, height: 2 * r, class: "half" });
      const right = el("rect", { x, y: y - r, width: r, height: 2 * r, class: "half" });
      left.addEventListener("click", () => edit(i, -1));
      right.addEventListener("click", () => edit(i, 1));
      g.appendChild(left);
      g.appendChild(right);
      if (r >= 20) {
        const minus = el("text", { x: x - r * 0.62, y, class: "sign" });
        minus.textContent = "−";
        const plus = el("text", { x: x + r * 0.62, y, class: "sign" });
        plus.textContent = "+";
        g.appendChild(minus);
        g.appendChild(plus);
      }
      g.addEventListener("keydown", (e) => {
        if (e.key === "ArrowUp" || e.key === "ArrowRight" || e.key === "+") { e.preventDefault(); edit(i, 1); }
        else if (e.key === "ArrowDown" || e.key === "ArrowLeft" || e.key === "-") { e.preventDefault(); edit(i, -1); }
      });
      svg.appendChild(g);
    });
    stepLine.textContent = `Step ${steps}`;
    undoBtn.disabled = undo.length === 0;
  }

  function judge() {
    if (D.isZero(values)) {
      say(steps ? `All zeros after ${steps} step${steps === 1 ? "" : "s"}!` : "All zeros. Change some numbers, or Reset with random numbers.", steps ? "win" : "");
      return;
    }
    const key = values.join(",");
    if (seen.has(key) && seen.get(key) !== steps) {
      const back = steps - seen.get(key);
      say(`This circle came up ${back} step${back === 1 ? "" : "s"} ago: it is stuck in a loop and will never reach zeros.`, "lose");
      return;
    }
    say("", "");
  }

  function push() {
    undo.push({ values: values.slice(), half, steps, seen: new Map(seen) });
  }

  function edit(i, delta) {
    push();
    values[i] += delta;
    steps = 0;
    seen = new Map([[values.join(","), 0]]);
    draw();
    judge();
    svg.querySelectorAll(".num")[i].focus();
  }

  function oneStep() {
    push();
    values = D.step(values);
    half = 1 - half;
    steps++;
    const key = values.join(",");
    judge();
    if (!seen.has(key)) seen.set(key, steps);
    draw();
  }

  function reset() {
    values = D.fill(Number(nInput.value), randomInput.checked);
    half = 0;
    steps = 0;
    undo = [];
    seen = new Map([[values.join(","), 0]]);
    draw();
    judge();
  }

  for (let n = D.MIN_N; n <= D.MAX_N; n++) {
    const o = document.createElement("option");
    o.value = String(n);
    o.textContent = String(n);
    if (n === D.DEFAULT_N) o.selected = true;
    nInput.appendChild(o);
  }
  stepBtn.addEventListener("click", oneStep);
  undoBtn.addEventListener("click", () => {
    const u = undo.pop();
    if (!u) return;
    ({ values, half, steps, seen } = u);
    draw();
    judge();
  });
  resetBtn.addEventListener("click", reset);
  nInput.addEventListener("change", reset);
  randomInput.addEventListener("change", reset);

  reset();
})();
