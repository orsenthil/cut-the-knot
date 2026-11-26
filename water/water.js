"use strict";

/*
 * Browser page for the three-jugs puzzle. water-core.js holds all the rules;
 * this file only draws the three glasses, reads the controls and calls the
 * core. A glass is a <button>: the first press picks it up, the second pours
 * into it (the applet's two clicks). The six small arrow buttons do the same
 * pours in one press, so a keyboard player can play without a selection step.
 */

(function () {
  const Core = WaterCore;
  const el = (id) => document.getElementById(id);

  const jugsEl = el("jugs");
  const statusEl = document.getElementById("status");
  const capInputs = [el("capA"), el("capB"), el("capC")];
  const levelFields = el("levelFields");
  const levelInputs = [el("lvlA"), el("lvlB"), el("lvlC")];
  const targetInput = el("targetIn");
  const modeInputs = [...document.querySelectorAll('input[name="mode"]')];
  const jugButtons = [...document.querySelectorAll(".jug")];
  const pourButtons = [...document.querySelectorAll(".pour")];
  const backBtn = el("backBtn");
  const resetBtn = el("resetBtn");
  const hintBtn = el("hintBtn");
  const hintEl = el("hint");
  const movesEl = el("moves");

  let state = null;
  let selected = null;
  let mode = "play";

  /** The line under the game. The three classes are the record's end signals. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function readMode() {
    const checked = modeInputs.find((input) => input.checked);
    mode = checked ? checked.value : "play";
    levelFields.hidden = mode !== "water";
  }

  function readCaps() {
    return capInputs.map((input) => Number(input.value));
  }

  function readLevels() {
    return levelInputs.map((input) => Number(input.value));
  }

  function jugSvg(index) {
    return `
      <svg viewBox="0 0 80 120" aria-hidden="true" focusable="false">
        <defs><clipPath id="jugClip${index}"><path d="M14 14 H66 L60 108 H20 Z"/></clipPath></defs>
        <path class="glass" d="M14 14 H66 L60 108 H20 Z"/>
        <rect class="water" x="12" y="108" width="56" height="0" clip-path="url(#jugClip${index})"/>
        <path class="rim" d="M11 12 H69"/>
      </svg>`;
  }

  function buildJugs() {
    for (let i = 0; i < 3; i++) {
      const wrap = el(["colA", "colB", "colC"][i]);
      const button = wrap.querySelector(".jug");
      button.innerHTML = jugSvg(i);
      button.setAttribute("aria-label", `Jug ${Core.NAMES[i]}. Choose it to pour from.`);
    }
  }

  function render() {
    for (let i = 0; i < 3; i++) {
      const cap = state.caps[i];
      const value = state.values[i];
      const button = jugButtons[i];
      const water = button.querySelector(".water");
      const height = cap > 0 ? (94 * value) / cap : 0;
      water.setAttribute("height", String(height));
      water.setAttribute("y", String(108 - height));
      button.classList.toggle("selected", selected === i);
      el(["amtA", "amtB", "amtC"][i]).textContent = `${value} / ${cap}`;
      button.setAttribute(
        "aria-label",
        `Jug ${Core.NAMES[i]}: ${value} of ${cap}. ` +
          (selected === i ? "Chosen. Choose another jug to pour into." : "Choose it to pour from."),
      );
      capInputs[i].value = String(cap);
      levelInputs[i].value = String(value);
      levelInputs[i].max = String(cap);
      capInputs[i].disabled = mode !== "capacity";
      levelInputs[i].disabled = mode !== "water";
    }
    targetInput.max = String(state.caps[2]);
    if (Number(targetInput.value) !== state.target) targetInput.value = String(state.target);
    movesEl.textContent = String(state.moves);
    for (const button of pourButtons) {
      const from = Number(button.dataset.from);
      const to = Number(button.dataset.to);
      const amount = Math.min(state.values[from], state.caps[to] - state.values[to]);
      button.disabled = amount <= 0;
      button.setAttribute(
        "aria-label",
        `Pour from jug ${Core.NAMES[from]} into jug ${Core.NAMES[to]} (${amount} could move).`,
      );
    }
    backBtn.disabled = state.history.length === 0;
    resetBtn.disabled = state.history.length === 0;
    // The position, for the player's record and the tutor (assets/progress.js).
    if (window.Track) window.Track.state(state);
  }

  function afterChange(text) {
    selected = null;
    hintEl.hidden = true;
    render();
    say(text);
  }

  function pickJug(index) {
    if (selected === null) {
      selected = index;
      render();
      say(`Picked up jug ${Core.NAMES[index]} with ${state.values[index]}. Choose where to pour it.`);
      return;
    }
    if (selected === index) {
      selected = null;
      render();
      say("Put the jug down.");
      return;
    }
    doPour(selected, index);
  }

  function doPour(from, to) {
    const next = Core.pour(state, from, to);
    if (!next) return;
    state = next;
    selected = null;
    hintEl.hidden = true;
    render();
    const amount = state.amount;
    if (Core.result(state) === "done") {
      const jug = state.values.findIndex((v) => v === state.target);
      say(`Measured ${state.target} in jug ${Core.NAMES[jug]} — well done!`, "done");
    } else if (Core.impossible(state)) {
      const g = Core.gcd(Core.gcd(state.caps[0], state.caps[1]), state.caps[2]);
      say(`Poured ${amount} from ${Core.NAMES[from]} into ${Core.NAMES[to]}. With sizes ${state.caps.join(", ")} only multiples of ${g} can be measured.`);
    } else {
      say(`Poured ${amount} from jug ${Core.NAMES[from]} into jug ${Core.NAMES[to]}.`);
    }
  }

  function showHint() {
    const solution = Core.solve(state.caps, state.target);
    hintEl.innerHTML = "";
    if (!solution) {
      const li = document.createElement("li");
      li.textContent = "No way to measure that amount with these jug sizes.";
      hintEl.appendChild(li);
    } else {
      for (const step of solution.steps) {
        const li = document.createElement("li");
        li.textContent = Core.describe(step);
        hintEl.appendChild(li);
      }
      if (!solution.steps.length) {
        const li = document.createElement("li");
        li.textContent = `Jug ${Core.NAMES[state.values.findIndex((v) => v === state.target)]} already holds ${state.target}.`;
        hintEl.appendChild(li);
      }
    }
    hintEl.hidden = false;
  }

  function newGame() {
    state = Core.start({
      capacities: readCaps(),
      values: [0, 0, readCaps()[2]],
      target: Number(targetInput.value),
    });
    afterChange("Fresh water: the big jug is full, the other two are empty.");
  }

  buildJugs();
  for (const button of jugButtons) {
    button.addEventListener("click", () => pickJug(Number(button.dataset.jug)));
  }
  for (const button of pourButtons) {
    button.addEventListener("click", () => doPour(Number(button.dataset.from), Number(button.dataset.to)));
  }
  // Left/right move between glasses; Escape puts a chosen glass down.
  jugsEl.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && selected !== null) {
      pickJug(selected);
      jugButtons[selected].focus();
      event.preventDefault();
    } else if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
      const i = jugButtons.indexOf(document.activeElement);
      if (i < 0) return;
      const next = (i + (event.key === "ArrowRight" ? 1 : 2)) % 3;
      jugButtons[next].focus();
      event.preventDefault();
    }
  });

  for (const input of modeInputs) {
    input.addEventListener("change", () => {
      readMode();
      if (mode === "capacity") state = Core.setCapacities(state, readCaps());
      if (mode === "water") state = Core.setValues(state, readLevels());
      afterChange(
        mode === "capacity"
          ? "Change the jug sizes, then choose Pour water."
          : mode === "water"
            ? "Change how much water each jug holds, then choose Pour water."
            : "Pour water from one jug into another.",
      );
    });
  }
  for (const input of capInputs) {
    input.addEventListener("change", () => {
      state = Core.setCapacities(state, readCaps());
      afterChange(`Jug sizes are now ${state.caps.join(", ")}.`);
    });
  }
  for (const input of levelInputs) {
    input.addEventListener("change", () => {
      state = Core.setValues(state, readLevels());
      afterChange("Water levels changed. Now pour!");
    });
  }
  targetInput.addEventListener("change", () => {
    state = Core.setTarget(state, Number(targetInput.value));
    afterChange(`Try to measure ${state.target}.`);
  });

  el("newBtn").addEventListener("click", newGame);
  backBtn.addEventListener("click", () => {
    const prev = Core.undo(state);
    if (!prev) return;
    state = prev;
    afterChange("One pour undone.");
  });
  resetBtn.addEventListener("click", () => {
    const first = Core.reset(state);
    if (!first) return;
    state = first;
    afterChange("Back to the starting water.");
  });
  hintBtn.addEventListener("click", showHint);

  readMode();
  state = Core.start({});
  render();
  say("Pick a jug, then pick another to pour into.");
})();
