"use strict";

/*
 * Browser UI for the Simple Automaton demo. Click cells to draw a population,
 * choose one of the five rules, then Step or Run. Live cells use the accent
 * colour; the grid slides sideways if it is wider than the phone. The rule
 * arithmetic is in simple-automaton-core.js and the SVG-free grid uses CSS
 * classes, so a theme change needs no redraw.
 */

(() => {
  const C = SimpleAutomatonCore;
  const gridEl = document.getElementById("grid");
  const statusEl = document.getElementById("status");
  const countEl = document.getElementById("count");
  const sideInput = document.getElementById("sideInput");
  const runBtn = document.getElementById("runBtn");
  let state = C.start();
  let timer = null;

  /** Show a line under the game. "done" is how the record sees a demo play. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function stopRunning() {
    if (timer !== null) {
      clearInterval(timer);
      timer = null;
    }
    runBtn.textContent = "Run";
  }

  function buildGrid() {
    gridEl.replaceChildren();
    for (let i = 0; i < state.side; i++) {
      for (let j = 0; j < state.side; j++) {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "cell";
        button.dataset.i = String(i);
        button.dataset.j = String(j);
        button.addEventListener("click", () => {
          stopRunning();
          state = C.toggleCell(state, i, j);
          render();
          gridEl.querySelector(`[data-i="${i}"][data-j="${j}"]`)?.focus();
        });
        gridEl.appendChild(button);
      }
    }
  }

  function render() {
    if (gridEl.children.length !== state.side * state.side) buildGrid();
    for (const button of gridEl.children) {
      const i = Number(button.dataset.i);
      const j = Number(button.dataset.j);
      const live = state.grid[i][j] === 1;
      button.classList.toggle("live", live);
      button.setAttribute("aria-label", `Row ${i + 1}, column ${j + 1}: ${live ? "alive" : "dead"}. Click to toggle.`);
    }
    gridEl.style.setProperty("--side", String(state.side));
    for (const rule of C.RULES) {
      document.getElementById(`rule-${rule}`).checked = state.rule === rule;
    }
    sideInput.value = String(state.side);
    document.getElementById("ruleHint").textContent = C.LABELS[state.rule];
    const count = C.population(state.grid);
    countEl.textContent = `${count} ${count === 1 ? "cell" : "cells"} alive after ${state.steps} ${state.steps === 1 ? "step" : "steps"}.`;
    say(state.message, C.result(state));
    if (count === 0) stopRunning();

    // The position, for the player's record and the tutor: plain JSON only.
    if (window.Track) {
      window.Track.state({
        side: state.side,
        rule: state.rule,
        grid: state.grid.map((row) => row.slice()),
        steps: state.steps,
        alive: count,
      });
    }
  }

  function step() {
    state = C.advance(state);
    render();
  }

  document.getElementById("stepBtn").addEventListener("click", () => {
    stopRunning();
    step();
  });
  runBtn.addEventListener("click", () => {
    if (timer !== null) {
      stopRunning();
      say("Stopped. " + state.message, C.result(state));
      return;
    }
    runBtn.textContent = "Stop";
    timer = setInterval(step, 350);
  });
  document.getElementById("clearBtn").addEventListener("click", () => {
    stopRunning();
    state = C.clear(state);
    render();
  });
  document.getElementById("randomBtn").addEventListener("click", () => {
    stopRunning();
    state = C.randomize(state);
    render();
  });
  for (const rule of C.RULES) {
    document.getElementById(`rule-${rule}`).addEventListener("change", () => {
      stopRunning();
      state = C.setRule(state, rule);
      render();
    });
  }
  sideInput.addEventListener("change", () => {
    stopRunning();
    state = C.setSide(state, Number(sideInput.value));
    render();
  });

  render();
})();
