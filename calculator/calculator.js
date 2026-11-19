"use strict";

/*
 * Broken Calculator — the page's drawing and input only.
 *
 * The stage holds a progress line, the display and a keypad of real buttons.
 * Every key the applet has is present; the ones broken this round are disabled.
 * All of the game's rules live in calculator-core.js; this file only sends the
 * label of a pressed key to Core.press and shows what changed in plain words.
 * The CSS tokens are read on each render so a theme flip repaints immediately.
 */

(function () {
  const Core = CalculatorCore;

  const stageEl = document.getElementById("stage");
  const displayEl = document.getElementById("display");
  const progressEl = document.getElementById("progress");
  const keypadEl = document.getElementById("keypad");
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const newBtn = document.getElementById("newBtn");
  const memoryBox = document.getElementById("useMemory");
  const memEl = document.getElementById("memIndicator");

  // The applet's button grid, including the four keys that never work.
  const ROWS = [
    ["Back", "CE", "C", "MC", "MR"],
    ["7", "8", "9", "/", "sqrt"],
    ["4", "5", "6", "*", "%"],
    ["1", "2", "3", "-", "1/x"],
    ["0", "+/-", ".", "+", "MS"],
    ["M+", "="],
  ];
  const LABELS = {
    Back: "Backspace", CE: "Clear entry", C: "Clear all", MC: "Memory clear",
    MR: "Memory recall", MS: "Memory store", "M+": "Memory add", sqrt: "Square root",
    "%": "Percent", "1/x": "One over x", "+/-": "Change sign", ".": "Decimal point",
    "+": "Plus", "-": "Minus", "*": "Multiply", "/": "Divide", "=": "Equals",
  };
  const WORDS = {
    CE: "You cleared the entry, so the display is empty.",
    C: "You cleared everything, including the numbers you had found.",
    "+/-": "You changed the sign of the number on the display.",
    MC: "You cleared the memory.",
    MS: "You stored the display in the memory.",
    MR: "You recalled the number from the memory.",
    "M+": "You added the display to the memory.",
    "+": "You chose plus; the calculator is waiting for the next number.",
    "-": "You chose minus; the calculator is waiting for the next number.",
    "*": "You chose multiply; the calculator is waiting for the next number.",
    "/": "You chose divide; the calculator is waiting for the next number.",
    "=": "You pressed equals and the calculator worked out the answer.",
  };

  const buttons = new Map();
  let state = null;

  function newSeed() {
    // A ?seed= in the address makes a round reproducible for the play test.
    const fixed = new URLSearchParams(window.location.search).get("seed");
    if (fixed !== null && fixed !== "") return Number(fixed) >>> 0;
    return Math.floor(Math.random() * 2147483647);
  }

  /** Show a line under the game. "done" tells the record the demo was explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function describe(label, before) {
    if (WORDS[label]) return WORDS[label];
    if (/^[0-9]$/.test(label) || label === ".") {
      return `You pressed ${label === "." ? "the decimal point" : label}; the display now reads ${state.display || "nothing"}.`;
    }
    return "The display changed.";
  }

  function render(message, kind) {
    const shown = state.display === "" ? "0" : state.display;
    displayEl.textContent = shown;
    displayEl.classList.toggle("empty", state.display === "");
    progressEl.textContent = state.progress === "" ? "none yet" : state.progress;
    memEl.textContent = state.memIndicator === "M" ? "M" : "";

    const on = Core.enabledButtons(state);
    buttons.forEach((btn, label) => {
      const works = on.indexOf(label) >= 0;
      btn.disabled = !works;
      btn.setAttribute("aria-label", LABELS[label] || `Digit ${label}`);
      btn.classList.toggle("broken", !works);
    });

    // Read the design tokens at draw time and redraw when the theme flips.
    const cs = getComputedStyle(document.documentElement);
    stageEl.style.setProperty("--calc-accent", cs.getPropertyValue("--accent").trim() || "#4f46e5");
    stageEl.style.setProperty("--calc-ink", cs.getPropertyValue("--ink").trim() || "#111111");

    if (window.Track) window.Track.state(state); // plain JSON for the tutor
    if (message !== undefined) say(message, kind);
  }

  function press(label) {
    const before = state;
    const next = Core.press(state, label);
    if (next === state) {
      say(`The ${LABELS[label] || label} key is broken in this round, so nothing changed.`);
      return;
    }
    state = next;
    let message = describe(label, before);
    if (state.display !== before.display) message += ` The display shows ${state.display === "" ? "nothing" : state.display}.`;
    let kind = null;
    if (state.lastFound > 0) {
      message += ` You made ${state.lastFound}, a new number to tick off!`;
      kind = "done";
    }
    if (Core.result(state) === "done") {
      message += " You found every number from 1 to 15!";
      kind = "done";
    }
    render(message, kind);
  }

  // Build the keypad once; render() only updates its disabled state.
  ROWS.forEach((row) => {
    const rowEl = document.createElement("div");
    rowEl.className = "calc-row";
    row.forEach((label) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = label;
      btn.className = "calc-key";
      btn.dataset.key = label;
      btn.setAttribute("aria-label", LABELS[label] || `Digit ${label}`);
      btn.addEventListener("click", () => press(label));
      buttons.set(label, btn);
      rowEl.appendChild(btn);
    });
    keypadEl.appendChild(rowEl);
  });

  // Keyboard play: type on the focused stage (or on any key; Enter activates a
  // focused button normally, so it is not stolen when a button has the focus).
  stageEl.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const key = event.key;
    let label = null;
    if (/^[0-9]$/.test(key) || key === "." || "+-*/".indexOf(key) >= 0 || key === "=") label = key;
    else if (key === "Enter" && !(event.target instanceof HTMLButtonElement)) label = "=";
    else if (key === "Escape") label = "C";
    else if (key === "Backspace" || key === "Delete") label = "CE";
    if (label === null) return;
    event.preventDefault();
    press(label);
  });

  resetBtn.addEventListener("click", () => {
    state = Core.reset(state);
    render("You reset this calculator. The same keys are broken, and the numbers you found are cleared.");
  });

  newBtn.addEventListener("click", () => {
    state = Core.start({ seed: newSeed(), useMemory: memoryBox.checked });
    render("You got a new broken calculator: a different set of keys works this time.");
  });

  memoryBox.addEventListener("change", () => {
    state = Core.setUseMemory(state, memoryBox.checked);
    render(memoryBox.checked
      ? "You switched memory on; the M, MC, MS and M+ keys now work."
      : "You switched memory off; the four memory keys are disabled.");
  });

  window.addEventListener("themechange", () => render());

  state = Core.start({ seed: newSeed(), useMemory: memoryBox.checked });
  render("Find the numbers 1 through 15 with the keys that still work. You may find them in any order.");
})();
