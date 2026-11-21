"use strict";

/* Browser UI: plot the chaos-game orbit of a predefined IFS on a canvas. */
(() => {
  const C = IteratedFunctionSystemsCore;
  const canvas = document.getElementById("board");
  const status = document.getElementById("status");
  const systemSel = document.getElementById("systemSel");
  const startBtn = document.getElementById("startBtn");
  const stopBtn = document.getElementById("stopBtn");
  const clearBtn = document.getElementById("clearBtn");
  let state = null;
  let timer = null;
  let points = [];

  function plot() {
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--stage").trim() || "#f3f5f8";
    ctx.fillRect(0, 0, W, H);
    const names = Object.keys(C.SYSTEMS);
    const scale = state.system === "Fern" ? 90 : 260;
    const ox = state.system === "Fern" ? W / 2 : 20;
    const oy = state.system === "Fern" ? H - 20 : H - 20;
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#5b4ee8";
    for (const p of points) {
      const x = state.system === "Fern" ? ox + p.x * scale : ox + p.x * scale;
      const y = state.system === "Fern" ? oy - p.y * scale : oy - p.y * scale;
      ctx.fillRect(x, y, 2, 2);
    }
  }

  function iterate() {
    const transforms = C.SYSTEMS[state.system];
    for (let k = 0; k < 200; k++) {
      state = C.step(state, Math.floor(Math.random() * transforms.length));
      if (state.iterations > 20) points.push({ ...state.point });
    }
    if (points.length > 12000) points = points.slice(-12000);
    plot();
    status.textContent = `${state.system}: ${points.length.toLocaleString()} plotted points. The orbit approaches the attractor.`;
    if (window.Track) window.Track.state({ system: state.system, iterations: state.iterations, plotted: points.length });
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    stopBtn.disabled = true;
    startBtn.disabled = false;
  }

  systemSel.addEventListener("change", () => {
    stop();
    state = { ...C.start(), system: systemSel.value };
    points = [];
    plot();
    status.textContent = `${state.system} selected. Press Start to draw its attractor.`;
    if (window.Track) window.Track.state({ system: state.system, iterations: 0, plotted: 0 });
  });
  startBtn.addEventListener("click", () => {
    if (timer) return;
    startBtn.disabled = true;
    stopBtn.disabled = false;
    timer = setInterval(iterate, 30);
  });
  stopBtn.addEventListener("click", stop);
  clearBtn.addEventListener("click", () => {
    points = [];
    plot();
    status.textContent = "Canvas cleared. Press Start to draw again.";
  });

  for (const name of Object.keys(C.SYSTEMS)) {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    systemSel.appendChild(option);
  }
  state = C.start();
  systemSel.value = state.system;
  stopBtn.disabled = true;
  plot();
})();
