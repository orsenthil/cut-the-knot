"use strict";

/*
 * Browser UI for the SelfDescriptive demo. The sentence shows one clickable
 * count for each digit of the chosen base. Iterate replaces them with the
 * digit counts they produce; Auto repeats until a true sentence appears (or
 * Stop is pressed). All the counting lives in self-descriptive-core.js.
 */

(() => {
  const C = SelfDescriptiveCore;
  const sentenceEl = document.getElementById("sentence");
  const historyEl = document.getElementById("history");
  const statusEl = document.getElementById("status");
  const baseInput = document.getElementById("baseInput");
  const autoBtn = document.getElementById("autoBtn");
  const countButtons = [];
  let state = C.start();
  let timer = null;

  /** Show a line under the game. "done" is how the record sees a demo play. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function stopAuto() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    autoBtn.textContent = "Auto";
  }

  function buildCounts() {
    sentenceEl.replaceChildren();
    countButtons.length = 0;
    state.counts.forEach((_, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "count";
      button.dataset.index = String(index);
      button.addEventListener("click", (event) => {
        const rect = button.getBoundingClientRect();
        const x = event.clientX ? event.clientX - rect.left : rect.width / 2;
        bump(index, x >= rect.width / 2 ? 1 : -1);
      });
      button.addEventListener("keydown", (event) => {
        if (["ArrowUp", "ArrowRight", "+"].includes(event.key)) {
          event.preventDefault();
          bump(index, 1);
        } else if (["ArrowDown", "ArrowLeft", "-"].includes(event.key)) {
          event.preventDefault();
          bump(index, -1);
        }
      });
      sentenceEl.appendChild(button);
      countButtons.push(button);
    });
  }

  function render() {
    if (countButtons.length !== state.counts.length) buildCounts();
    countButtons.forEach((button, i) => {
      const value = state.counts[i];
      button.textContent = C.write(value, state.base);
      button.setAttribute("aria-label", `Count of digit ${i}: ${value}. ` +
        "Click the left half to lower it, the right half to raise it. Arrow keys work too.");
    });
    document.getElementById("digitLabels").textContent = state.counts
      .map((_, i) => C.write(i, state.base)).join(" ");
    baseInput.value = String(state.base);
    historyEl.replaceChildren();
    state.history.forEach((line, i) => {
      const row = document.createElement("div");
      row.className = "history-row";
      row.textContent = `${i + 1}. ${line}`;
      historyEl.appendChild(row);
    });
    historyEl.scrollTop = historyEl.scrollHeight;
    say(state.message, C.result(state));

    // The position, for the player's record and the tutor: plain JSON only.
    if (window.Track) {
      window.Track.state({
        base: state.base,
        counts: state.counts.slice(),
        written: state.counts.map((v) => C.write(v, state.base)),
        iterations: state.iterations,
        true: C.trueCounts(state.counts, state.base),
      });
    }
  }

  function bump(index, delta) {
    stopAuto();
    state = C.setCount(state, index, delta);
    render();
  }

  function step() {
    state = C.iterate(state);
    render();
    if (C.result(state) === "done") stopAuto();
  }

  document.getElementById("iterateBtn").addEventListener("click", () => {
    stopAuto();
    step();
  });
  autoBtn.addEventListener("click", () => {
    if (timer !== null) {
      stopAuto();
      say("Stopped. " + state.message, C.result(state));
      return;
    }
    autoBtn.textContent = "Stop";
    timer = setInterval(step, 600);
  });
  document.getElementById("clearBtn").addEventListener("click", () => {
    stopAuto();
    state = C.clearHistory(state);
    render();
  });
  function changeBase(value) {
    stopAuto();
    state = C.setBase(state, Number(value));
    render();
  }
  document.getElementById("baseDown").addEventListener("click", () => changeBase(state.base - 1));
  document.getElementById("baseUp").addEventListener("click", () => changeBase(state.base + 1));
  baseInput.addEventListener("change", () => changeBase(baseInput.value));

  render();
})();
