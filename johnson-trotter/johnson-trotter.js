"use strict";

/* Browser UI: step through the Johnson–Trotter permutation sequence. */
(() => {
  const C = JohnsonTrotterCore;
  const row = document.getElementById("row");
  const status = document.getElementById("status");
  const nInput = document.getElementById("nInput");
  const stepBtn = document.getElementById("stepBtn");
  const runBtn = document.getElementById("runBtn");
  const stopBtn = document.getElementById("stopBtn");
  const resetBtn = document.getElementById("resetBtn");
  let state = null;
  let timer = null;

  function render() {
    row.replaceChildren();
    const r = C.analyze(state);
    state.items.forEach((item, i) => {
      const cell = document.createElement("span");
      cell.className = "item" + (i === r.largestMobile ? " mobile" : "");
      cell.textContent = item.dir < 0 ? `<${item.value}` : `${item.value}>`;
      cell.setAttribute("aria-label", `Number ${item.value} looking ${item.dir < 0 ? "left" : "right"}${i === r.largestMobile ? ", the largest mobile number" : ""}`);
      row.appendChild(cell);
    });

    const factorial = Array.from({ length: state.n }, (_, i) => i + 1).reduce((a, b) => a * b, 1);
    nInput.value = String(state.n);
    stepBtn.disabled = r.finished;
    runBtn.disabled = r.finished || !!timer;
    stopBtn.disabled = !timer;
    status.textContent = r.finished
      ? `Finished after ${r.steps} steps. No number is mobile, so all ${factorial} permutations have been listed.`
      : `Step ${r.steps + 1} of ${factorial}. The largest mobile number is ${r.permutation[r.largestMobile]}; swap it with its neighbour.`;
    status.classList.remove("win", "done");
    status.classList.add(r.finished ? "win" : "done");
    if (window.Track) window.Track.state({
      n: state.n, permutation: r.permutation, directions: r.directions,
      steps: r.steps, finished: r.finished, total: factorial,
    });
  }

  function stop() {
    if (timer) clearInterval(timer);
    timer = null;
    stopBtn.disabled = true;
    runBtn.disabled = C.analyze(state).finished;
  }

  stepBtn.addEventListener("click", () => { state = C.step(state); render(); });
  runBtn.addEventListener("click", () => {
    if (timer) return;
    runBtn.disabled = true;
    stopBtn.disabled = false;
    timer = setInterval(() => {
      state = C.step(state);
      render();
      if (C.analyze(state).finished) stop();
    }, 120);
  });
  stopBtn.addEventListener("click", stop);
  resetBtn.addEventListener("click", () => { stop(); state = C.start(state.n); render(); });
  nInput.addEventListener("input", () => { stop(); state = C.setN(state, Number(nInput.value)); render(); });

  state = C.start();
  stopBtn.disabled = true;
  render();
})();
