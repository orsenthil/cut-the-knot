"use strict";

/*
 * Browser UI for the Right Replacement demo. The top row holds the starting
 * numbers; click the left half of one to lower it, the right half to raise it
 * (arrow keys work too). Compute fills the panel below with one row per
 * replacement, exactly as the applet does. All logic lives in
 * right-replacement-core.js; colours come from assets/site.css, so a theme
 * change needs no redraw.
 */

(() => {
  const C = RightReplacementCore;
  const valuesEl = document.getElementById("values");
  const rowsEl = document.getElementById("rows");
  const statusEl = document.getElementById("status");
  const lengthInput = document.getElementById("lengthInput");
  const valueButtons = [];

  let state = C.start();

  /** Show a line under the game. "done" is how the record sees a demo play. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /** Build buttons only when the length changes, so keyboard focus survives. */
  function buildValues(count) {
    valuesEl.replaceChildren();
    valueButtons.length = 0;
    for (let i = 0; i < count; i++) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "num";
      button.dataset.index = String(i);
      button.addEventListener("click", (event) => {
        const rect = button.getBoundingClientRect();
        const x = event.clientX ? event.clientX - rect.left : rect.width / 2;
        press(i, x >= rect.width / 2 ? 1 : -1);
      });
      button.addEventListener("keydown", (event) => {
        if (["ArrowUp", "ArrowRight", "+"].includes(event.key)) {
          event.preventDefault();
          press(i, 1);
        } else if (["ArrowDown", "ArrowLeft", "-"].includes(event.key)) {
          event.preventDefault();
          press(i, -1);
        }
      });
      valuesEl.appendChild(button);
      valueButtons.push(button);
    }
  }

  function renderRows() {
    rowsEl.replaceChildren();
    if (!state.computed) {
      const empty = document.createElement("p");
      empty.className = "hint";
      empty.textContent = "Press Compute to see what happens.";
      rowsEl.appendChild(empty);
      return;
    }
    state.rows.forEach((row, i) => {
      const line = document.createElement("div");
      line.className = "calc-row";
      if (i === state.rows.length - 1) line.classList.add("last-row");
      const label = document.createElement("span");
      label.className = "calc-label";
      label.textContent = `Step ${i + 1}`;
      const cells = document.createElement("span");
      cells.className = "cells";
      cells.textContent = row.join("  ");
      line.append(label, cells);
      rowsEl.appendChild(line);
    });
  }

  function render() {
    if (valueButtons.length !== state.length) buildValues(state.length);
    valueButtons.forEach((button, i) => {
      const value = state.values[i];
      button.textContent = String(value);
      button.setAttribute("aria-label", `Number ${i + 1} of ${state.length}: ${value}. ` +
        "Click the left half to lower it, the right half to raise it. Arrow keys work too.");
    });
    lengthInput.value = String(state.length);
    for (const type of C.TYPES) {
      document.getElementById(`type-${type}`).checked = state.type === type;
    }
    renderRows();
    say(state.message, C.result(state));

    // The position, for the player's record and the tutor: plain JSON only.
    if (window.Track) {
      window.Track.state({
        length: state.length,
        type: state.type,
        values: state.values.slice(),
        computed: state.computed,
        reason: state.reason,
        rows: state.rows.length,
        lastRow: state.rows.length ? state.rows[state.rows.length - 1].slice() : null,
      });
    }
  }

  function press(index, delta) {
    state = C.setValue(state, index, state.values[index] + delta);
    render();
  }

  document.getElementById("computeBtn").addEventListener("click", () => {
    state = C.compute(state);
    render();
  });
  document.getElementById("resetBtn").addEventListener("click", () => {
    state = C.reset(state);
    render();
  });
  for (const type of C.TYPES) {
    document.getElementById(`type-${type}`).addEventListener("change", () => {
      state = C.setType(state, type);
      render();
    });
  }
  function changeLength(value) {
    state = C.setLength(state, Number(value));
    render();
  }
  document.getElementById("lengthDown").addEventListener("click", () => changeLength(state.length - 1));
  document.getElementById("lengthUp").addEventListener("click", () => changeLength(state.length + 1));
  lengthInput.addEventListener("change", () => changeLength(lengthInput.value));

  render();
})();
