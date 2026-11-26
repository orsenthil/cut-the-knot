"use strict";

/*
 * The page for Order and Chaos in Multiple Pendulums: drawing and input only.
 * An animation frame moves the step by the core's speed (2/N per 20 ms tick);
 * the dots are SVG circles. The formula is in pendula-chaos-core.js.
 */

(function () {
  const Core = PendulaCore;
  const svg = document.getElementById("board");
  const statusEl = document.getElementById("status");
  const backBtn = document.getElementById("backBtn"), stopBtn = document.getElementById("stopBtn"), fwdBtn = document.getElementById("fwdBtn");
  const nIn = document.getElementById("nIn"), tIn = document.getElementById("tIn");
  const NS = "http://www.w3.org/2000/svg";
  const W = 400, H = 250, MARGIN = 20, TICK_MS = 20;

  let state = Core.start({});
  let dots = [], last = 0, raf = 0, lastLevels = -1;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function build() {
    svg.textContent = "";
    dots = [];
    const n = state.n, dx = (W - 2 * MARGIN) / (n + 1), r = Math.max(2.5, dx / 3);
    const rest = document.createElementNS(NS, "line");
    rest.setAttribute("x1", MARGIN); rest.setAttribute("x2", W - MARGIN);
    rest.setAttribute("y1", H / 2); rest.setAttribute("y2", H / 2);
    rest.setAttribute("class", "rest");
    svg.appendChild(rest);
    for (let i = 0; i < n; i++) {
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", (MARGIN + dx * (i + 1)).toFixed(2));
      c.setAttribute("r", r.toFixed(2));
      c.setAttribute("fill", `hsl(${Math.round((i * 360) / Math.max(10, Math.min(n, 20))) % 360}, 65%, 55%)`);
      svg.appendChild(c);
      dots.push(c);
    }
  }

  function draw() {
    const a = H / 4, m = H / 2;
    for (let i = 0; i < dots.length; i++) dots[i].setAttribute("cy", (m - a * Math.cos((state.step * (i + state.t)) / 20)).toFixed(2));
    const lv = Core.levels(state.n, state.t, state.step, 0.02);
    if (lv !== lastLevels) {
      lastLevels = lv;
      if (lv === 1) say("All in line: the order is back.", "done");
      else if (lv <= 3) say(`The dots sit on ${lv} levels: a pattern.`);
      else say("");
    }
  }

  function save() { if (window.Track) window.Track.state({ n: state.n, t: state.t, dir: state.dir, step: Math.round(state.step * 100) / 100 }); }

  function frame(now) {
    state = Core.advance(state, Math.min(5, (now - last) / TICK_MS));
    last = now;
    draw();
    raf = state.dir ? requestAnimationFrame(frame) : 0;
  }

  function run(dir) {
    state = Object.assign({}, state, { dir });
    stopBtn.disabled = dir === 0;
    save();
    if (dir && !raf) { last = performance.now(); raf = requestAnimationFrame(frame); }
  }

  function reset() {
    state = Core.start({ n: nIn.value, t: tIn.value });
    nIn.value = String(state.n); tIn.value = String(state.t);
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    stopBtn.disabled = true;
    lastLevels = -1;
    build(); draw(); save();
  }

  backBtn.addEventListener("click", () => run(-1));
  fwdBtn.addEventListener("click", () => run(1));
  stopBtn.addEventListener("click", () => { run(0); });
  nIn.addEventListener("change", reset);
  tIn.addEventListener("change", reset);
  reset();
})();
