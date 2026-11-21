"use strict";

/* Browser UI: Conway's Life on a clickable canvas with classic patterns. */
(() => {
  const C = GameOfLifeCore;
  const canvas = document.getElementById("board");
  const status = document.getElementById("status");
  const readout = document.getElementById("readout");
  const sideInput = document.getElementById("sideInput");
  const popInput = document.getElementById("popInput");
  const delayInput = document.getElementById("delayInput");
  const patternSel = document.getElementById("patternSel");
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");
  const stepBtn = document.getElementById("stepBtn");
  const reverseBtn = document.getElementById("reverseBtn");
  const randomBtn = document.getElementById("randomBtn");
  const resetBtn = document.getElementById("resetBtn");
  const gridCheck = document.getElementById("gridCheck");
  let state = null;
  let timer = null;

  function draw() {
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const cell = W / state.size;
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--stage").trim() || "#f3f5f8";
    ctx.fillRect(0, 0, W, W);
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#5b4ee8";
    ctx.fillStyle = accent;
    state.cells.forEach((row, y) => row.forEach((alive, x) => {
      if (alive) ctx.fillRect(x * cell + 1, y * cell + 1, Math.max(1, cell - 2), Math.max(1, cell - 2));
    }));
    if (gridCheck.checked) {
      ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--border").trim() || "#ccc";
      ctx.lineWidth = 1;
      for (let i = 0; i <= state.size; i++) {
        ctx.beginPath();
        ctx.moveTo(i * cell, 0);
        ctx.lineTo(i * cell, W);
        ctx.moveTo(0, i * cell);
        ctx.lineTo(W, i * cell);
        ctx.stroke();
      }
    }
  }

  function render() {
    draw();
    const r = C.analyze(state);
    sideInput.value = String(state.size);
    popInput.value = String(Math.min(Number(popInput.value) || 40, state.size ** 2));
    delayInput.value = String(delayInput.value || 150);
    readout.textContent = `Generation ${r.generation} · ${r.population} live cells · ${r.historyLength} earlier states`;
    status.textContent = r.population === 0
      ? "The board is empty. Click cells, choose a pattern or randomize."
      : `Generation ${r.generation}: ${r.population} cells alive.`;
    status.className = "done";
    stepBtn.disabled = !!timer;
    reverseBtn.disabled = !!timer || r.historyLength === 0;
    if (window.Track) window.Track.state({
      size: state.size, generation: r.generation,
      population: r.population, encoded: r.encoded,
    });
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    stopBtn.disabled = true;
    startBtn.disabled = false;
    stepBtn.disabled = false;
  }

  canvas.addEventListener("click", (ev) => {
    const box = canvas.getBoundingClientRect();
    const x = Math.floor((ev.clientX - box.left) * state.size / box.width);
    const y = Math.floor((ev.clientY - box.top) * state.size / box.height);
    state = C.toggle(state, x, y);
    render();
  });
  startBtn.addEventListener("click", () => {
    if (timer) return;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    timer = setInterval(() => { state = C.step(state); render(); }, Number(delayInput.value) || 150);
  });
  stopBtn.addEventListener("click", stop);
  stepBtn.addEventListener("click", () => { state = C.step(state); render(); });
  reverseBtn.addEventListener("click", () => { state = C.reverse(state); render(); });
  randomBtn.addEventListener("click", () => { state = C.randomize(state, Number(popInput.value) || 40); render(); });
  resetBtn.addEventListener("click", () => { stop(); state = C.start({ size: state.size }); render(); });
  sideInput.addEventListener("input", () => {
    stop();
    state = C.start({ size: Number(sideInput.value) });
    render();
  });
  delayInput.addEventListener("input", () => {
    if (timer) { stop(); startBtn.click(); }
  });
  gridCheck.addEventListener("change", draw);
  patternSel.addEventListener("change", () => {
    stop();
    state = C.start({ size: state.size });
    if (patternSel.value) state = C.place(state, patternSel.value, Math.floor(state.size / 3), Math.floor(state.size / 3));
    render();
  });
  window.addEventListener("themechange", draw);

  for (const name of Object.keys(C.PATTERNS)) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name.charAt(0).toUpperCase() + name.slice(1);
    patternSel.appendChild(option);
  }
  state = C.start();
  stopBtn.disabled = true;
  render();
})();
