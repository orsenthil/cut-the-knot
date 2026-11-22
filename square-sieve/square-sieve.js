"use strict";

/*
 * The page for Square Sieve: drawing and input only. The numbers sit in a
 * grid; the step button flips every multiple of the next k, and those
 * multiples are tinted for a moment so the flip can be followed.
 */

(function () {
  const Core = SquareSieveCore;
  const statusEl = document.getElementById("status");
  const gridEl = document.getElementById("grid");
  const stepBtn = document.getElementById("stepBtn");
  const finishBtn = document.getElementById("finishBtn");
  const resetBtn = document.getElementById("resetBtn");
  const nEl = document.getElementById("n");

  let state = Core.start({});
  let lastStep = 0;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    gridEl.textContent = "";
    for (let m = 1; m <= state.n; m++) {
      const c = document.createElement("span");
      const red = state.red[m - 1];
      c.className = "num " + (red ? "red" : "blue") + (lastStep && Core.flips(lastStep, m) ? " flipped" : "");
      c.textContent = m;
      c.setAttribute("aria-label", `${m}: ${red ? "red, circled" : "blue"}`);
      gridEl.appendChild(c);
    }
    const more = Core.canStep(state);
    stepBtn.textContent = more ? `Step ${state.next}` : "All steps done";
    stepBtn.disabled = !more;
    finishBtn.disabled = !more;
    if (window.Track) window.Track.state({ n: state.n, next: state.next, red: Core.redNumbers(state) });
  }

  function doStep() {
    lastStep = state.next;
    state = Core.step(state);
    render();
    if (Core.result(state) === "done") {
      say(`Done. The red numbers are ${Core.redNumbers(state).join(", ")}: the perfect squares.`, "done");
    } else {
      say(`Step ${lastStep}: every multiple of ${lastStep} changed colour.`);
    }
  }

  function doFinish() {
    lastStep = 0;
    state = Core.finish(state);
    render();
    say(`Done. The red numbers are ${Core.redNumbers(state).join(", ")}: the perfect squares.`, "done");
  }

  function reset() {
    state = Core.start({ n: nEl.value });
    nEl.value = state.n;
    lastStep = 0;
    say("Press the step button to flip the multiples of 1.");
    render();
  }

  stepBtn.addEventListener("click", doStep);
  finishBtn.addEventListener("click", doFinish);
  resetBtn.addEventListener("click", reset);
  nEl.addEventListener("change", reset);
  reset();
})();
