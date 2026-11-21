"use strict";

/* Browser UI: run the LCM algorithm by raising the smallest number. */
(() => {
  const C = LcmAlgorithmCore;
  const stage = document.getElementById("stage");
  const status = document.getElementById("status");
  const readout = document.getElementById("readout");
  const stepBtn = document.getElementById("stepBtn");
  const runBtn = document.getElementById("runBtn");
  const resetBtn = document.getElementById("resetBtn");
  let state = null;
  let focusKey = null;

  function render() {
    if (!focusKey) {
      const el = document.activeElement;
      if (el && el.dataset && el.dataset.part) focusKey = { part: el.dataset.part, index: el.dataset.index };
    }
    stage.replaceChildren();
    const r = C.analyze(state);
    const smallest = r.finished ? -1 : C.smallestIndex(state.values);

    state.originals.forEach((original, i) => {
      const box = document.createElement("div");
      box.className = "number-box" + (i === smallest ? " smallest" : "");
      const input = document.createElement("input");
      input.type = "number";
      input.min = "1";
      input.value = String(original);
      input.dataset.part = "original";
      input.dataset.index = String(i);
      input.setAttribute("aria-label", `Starting number ${i + 1}, ${original}`);
      input.addEventListener("change", () => {
        focusKey = { part: "original", index: String(i) };
        state = C.setNumber(state, i, Number(input.value));
        render();
      });
      const arrow = document.createElement("span");
      arrow.className = "arrow";
      arrow.textContent = i === smallest ? "↑" : "·";
      const value = document.createElement("strong");
      value.textContent = String(state.values[i]);
      box.append(input, arrow, value);
      stage.appendChild(box);
    });

    stepBtn.disabled = r.finished;
    runBtn.disabled = r.finished;
    readout.textContent = `${state.steps} steps · target ${r.lcm} · values ${r.values.join(", ")}`;
    status.textContent = r.finished
      ? `All values reached ${r.current}, the least common multiple of ${r.originals.join(", ")}.`
      : r.last
        ? `Step ${state.steps}: raised the ${r.last.index + 1}${["st", "nd", "rd"][r.last.index] || "th"} value from ${r.last.before} to ${r.last.after}.`
        : "The smallest value is increased by its starting number each step.";
    status.className = r.finished ? "win" : "done";
    if (window.Track) window.Track.state({
      originals: r.originals.slice(), values: r.values.slice(), steps: r.steps,
      finished: r.finished, lcm: r.lcm,
    });
    if (focusKey) {
      const target = stage.querySelector(`[data-part="${focusKey.part}"][data-index="${focusKey.index}"]`);
      if (target) { focusKey = null; target.focus(); }
    }
  }

  stepBtn.addEventListener("click", () => { state = C.step(state); render(); });
  runBtn.addEventListener("click", () => { state = C.run(state); render(); });
  resetBtn.addEventListener("click", () => {
    focusKey = null;
    state = C.start(state.originals);
    render();
  });

  state = C.start();
  render();
})();
