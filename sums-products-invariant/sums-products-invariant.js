"use strict";

/* Browser UI: pick pairs of numbers and watch the invariant stay fixed. */
(() => {
  const C = SumsProductsInvariantCore;
  const numbers = document.getElementById("numbers");
  const prediction = document.getElementById("prediction");
  const status = document.getElementById("status");
  const countInput = document.getElementById("countInput");
  const maxInput = document.getElementById("maxInput");
  const resetBtn = document.getElementById("resetBtn");
  const repeatBtn = document.getElementById("repeatBtn");
  let state = null;
  let selected = null;

  function render() {
    numbers.replaceChildren();
    state.values.forEach((value, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "number" + (selected === i ? " selected" : "");
      btn.textContent = String(value);
      btn.setAttribute("aria-label", `Number ${value}${selected === i ? ", selected" : ""}. Click two numbers to combine them.`);
      btn.addEventListener("click", () => {
        if (selected === null) {
          selected = i;
        } else if (selected === i) {
          selected = null;
        } else {
          state = C.combine(state, selected, i);
          selected = null;
        }
        render();
      });
      numbers.appendChild(btn);
    });

    const r = C.analyze(state);
    countInput.value = String(state.count);
    maxInput.value = String(state.max);
    prediction.textContent = `Predicted final number: ${r.initialInvariant} · current invariant: ${r.invariant} · ${r.remaining} number${r.remaining === 1 ? "" : "s"} left`;
    if (r.finished) {
      status.textContent = `Finished: ${state.values[0]}. The invariant predicted it from the very start.`;
      status.className = "win";
    } else if (selected !== null) {
      status.textContent = `Selected ${state.values[selected]}. Choose a second number to combine it with.`;
      status.className = "done";
    } else {
      status.textContent = r.last
        ? `${r.last}. The invariant is still ${r.invariant}.`
        : "Click two numbers to combine them. The final number is already determined.";
      status.className = "done";
    }
    if (window.Track) window.Track.state({
      values: state.values.slice(), count: state.count, max: state.max,
      invariant: r.invariant, remaining: r.remaining, finished: r.finished,
    });
  }

  countInput.addEventListener("input", () => {
    state = C.setCount(state, Number(countInput.value));
    selected = null;
    render();
  });
  maxInput.addEventListener("input", () => {
    state = C.setMax(state, Number(maxInput.value));
    render();
  });
  resetBtn.addEventListener("click", () => {
    state = C.start({ count: state.count, max: state.max });
    selected = null;
    render();
  });
  repeatBtn.addEventListener("click", () => {
    state = C.repeat(state);
    selected = null;
    render();
  });

  state = C.start();
  render();
})();
