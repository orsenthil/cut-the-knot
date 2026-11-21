"use strict";

/* Browser UI: a circle with red arcs and two hands thrown at random. */
(() => {
  const C = IndyClockHandsCore;
  const svg = document.getElementById("board");
  const status = document.getElementById("status");
  const statsEl = document.getElementById("stats");
  const alphaInput = document.getElementById("alphaInput");
  const redInput = document.getElementById("redInput");
  const throwBtn = document.getElementById("throwBtn");
  const runBtn = document.getElementById("runBtn");
  const stopBtn = document.getElementById("stopBtn");
  const SVG_NS = "http://www.w3.org/2000/svg";
  let state = null;
  let timer = null;
  let theta = 0;

  function render() {
    svg.replaceChildren();
    const cx = 150;
    const cy = 150;
    const r = 110;
    const arcs = state.redArcs;
    const circ = 2 * Math.PI * r;
    arcs.forEach((arc) => {
      const circle = document.createElementNS(SVG_NS, "circle");
      circle.setAttribute("cx", cx);
      circle.setAttribute("cy", cy);
      circle.setAttribute("r", r);
      circle.setAttribute("class", "redarc");
      circle.setAttribute("stroke-dasharray", `${arc.length * r} ${circ - arc.length * r}`);
      circle.setAttribute("stroke-dashoffset", -arc.start * r);
      svg.appendChild(circle);
    });
    svg.appendChild(Object.assign(document.createElementNS(SVG_NS, "circle"), {}));
    const rim = svg.lastChild;
    rim.setAttribute("cx", cx);
    rim.setAttribute("cy", cy);
    rim.setAttribute("r", r);
    rim.setAttribute("class", "rim");
    const point = (angle, cls) => {
      const x = cx + r * Math.cos(angle - Math.PI / 2);
      const y = cy + r * Math.sin(angle - Math.PI / 2);
      const line = document.createElementNS(SVG_NS, "line");
      line.setAttribute("x1", cx);
      line.setAttribute("y1", cy);
      line.setAttribute("x2", x);
      line.setAttribute("y2", y);
      line.setAttribute("class", cls);
      svg.appendChild(line);
    };
    point(theta, "hand first");
    point(theta + state.alpha, "hand second");
    alphaInput.value = String(Math.round(state.alpha * 180 / Math.PI));
    redInput.value = String(Math.round(state.redArcs[0].length * 180 / Math.PI));
    const p = C.redFraction(state.redArcs);
    const first = state.trials ? state.firstHits / state.trials : 0;
    const second = state.trials ? state.secondHits / state.trials : 0;
    statsEl.textContent = `${state.trials.toLocaleString()} throws · red fraction ${p.toFixed(3)} · first hit rate ${first.toFixed(3)} · second hit rate ${second.toFixed(3)}`;
    status.textContent = "Both hands hit red equally often — shifting a red arc around the circle does not change its size.";
    if (window.Track) window.Track.state({ alpha: state.alpha, red: state.redArcs[0].length, trials: state.trials, firstHits: state.firstHits, secondHits: state.secondHits });
  }

  function throwOnce() {
    theta = Math.random() * C.TAU;
    state = C.trial(state, theta);
    render();
  }

  throwBtn.addEventListener("click", throwOnce);
  runBtn.addEventListener("click", () => {
    if (timer) return;
    timer = setInterval(throwOnce, 30);
    runBtn.disabled = true;
    stopBtn.disabled = false;
  });
  stopBtn.addEventListener("click", () => {
    if (timer) clearInterval(timer);
    timer = null;
    runBtn.disabled = false;
    stopBtn.disabled = true;
  });
  alphaInput.addEventListener("change", () => {
    state = { ...state, alpha: Number(alphaInput.value) * Math.PI / 180 };
    render();
  });
  redInput.addEventListener("change", () => {
    state = { ...state, redArcs: [{ start: 0, length: Number(redInput.value) * Math.PI / 180 }] };
    render();
  });
  stopBtn.disabled = true;
  state = C.start();
  render();
})();
