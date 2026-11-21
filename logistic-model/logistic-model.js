"use strict";

/* Browser UI: plot the orbit of the logistic map for chosen r and p0. */
(() => {
  const C = LogisticModelCore;
  const canvas = document.getElementById("board");
  const status = document.getElementById("status");
  const readout = document.getElementById("readout");
  const rInput = document.getElementById("rInput");
  const p0Input = document.getElementById("p0Input");
  const iterInput = document.getElementById("iterInput");
  const sweepBtn = document.getElementById("sweepBtn");
  let state = null;
  let timer = null;

  function draw() {
    const ctx = canvas.getContext("2d");
    const W = canvas.width;
    const H = canvas.height;
    const bg = getComputedStyle(document.documentElement).getPropertyValue("--stage").trim() || "#f3f5f8";
    const accent = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#5b4ee8";
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    const r = C.analyze(state);

    ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--border").trim() || "#ccc";
    for (let k = 0; k <= 4; k++) {
      ctx.beginPath();
      ctx.moveTo(0, k * H / 4);
      ctx.lineTo(W, k * H / 4);
      ctx.stroke();
    }

    ctx.strokeStyle = accent;
    ctx.lineWidth = 2;
    ctx.beginPath();
    r.values.forEach((v, i) => {
      const x = i / (r.values.length - 1) * W;
      const y = H - v * H;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    const startAt = Math.floor(r.values.length * 0.8);
    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--good").trim() || "#15803d";
    for (let i = startAt; i < r.values.length; i++) {
      const x = i / (r.values.length - 1) * W;
      ctx.fillRect(x - 1, H - r.values[i] * H - 1, 3, 3);
    }
  }

  function render() {
    draw();
    const r = C.analyze(state);
    rInput.value = String(state.r);
    p0Input.value = String(state.p0);
    iterInput.value = String(state.iterations);
    readout.textContent = `r = ${state.r.toFixed(2)} · p₀ = ${state.p0.toFixed(2)} · last value ${r.last.toFixed(4)}`;
    status.textContent = r.period === 1
      ? `The orbit settles to a single value near ${r.last.toFixed(4)}.`
      : r.period
        ? `The orbit repeats with period ${r.period}.`
        : `No short cycle yet; the Lyapunov estimate is ${r.lyapunov.toFixed(3)}.`;
    status.className = "done";
    if (window.Track) window.Track.state({
      r: state.r, p0: state.p0, iterations: state.iterations,
      last: r.last, period: r.period, lyapunov: r.lyapunov,
    });
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    sweepBtn.textContent = "Sweep r";
  }

  rInput.addEventListener("input", () => { stop(); state = C.setR(state, Number(rInput.value)); render(); });
  p0Input.addEventListener("input", () => { state = C.setP0(state, Number(p0Input.value)); render(); });
  iterInput.addEventListener("input", () => { state = C.setIterations(state, Number(iterInput.value)); render(); });
  sweepBtn.addEventListener("click", () => {
    if (timer) { stop(); return; }
    sweepBtn.textContent = "Stop sweep";
    timer = setInterval(() => {
      let r = state.r + 0.01;
      if (r > 4) r = 2.5;
      state = C.setR(state, Number(r.toFixed(2)));
      render();
    }, 120);
  });
  window.addEventListener("themechange", draw);

  state = C.start();
  render();
})();
