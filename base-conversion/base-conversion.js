"use strict";

/*
 * Browser UI for the Base Converter demo. The stage has four rows: each has
 * a base spinner (− / + buttons around a number box) and a text box holding
 * the number written in that base. Typing in a box and pressing Enter, or
 * pressing Convert, reads that box in its own base and writes the same value
 * into all four boxes. Turning a base rewrites just that row. All arithmetic
 * lives in base-conversion-core.js; this file only draws and takes input.
 *
 * The rows are built once and only their values are updated, so keyboard
 * focus survives a conversion. There is no canvas: colours come from the
 * design-system tokens in assets/site.css, so a theme change needs no redraw.
 */

(() => {
  const C = BaseConversionCore;
  const stageEl = document.getElementById("stage");
  const statusEl = document.getElementById("status");
  const convertBtn = document.getElementById("convertBtn");
  const resetBtn = document.getElementById("resetBtn");

  let state = null;
  let activeRow = 0;
  const baseInputs = [];
  const textInputs = [];

  /** Show a line under the game. "done" is how the record sees a demo play. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function buildRow(i) {
    const row = document.createElement("div");
    row.className = "conv-row";

    const baseGroup = document.createElement("div");
    baseGroup.className = "base-group";

    const minus = document.createElement("button");
    minus.type = "button";
    minus.className = "step";
    minus.id = `minus${i}`;
    minus.textContent = "−";
    minus.setAttribute("aria-label", `Decrease base of box ${i + 1}`);
    minus.addEventListener("click", () => stepBase(i, -1));

    const base = document.createElement("input");
    base.type = "number";
    base.id = `base${i}`;
    base.className = "base-input";
    base.min = String(C.MIN_BASE);
    base.max = String(C.MAX_BASE);
    base.step = "1";
    base.value = String(state.bases[i]);
    base.addEventListener("focus", () => { activeRow = i; });
    base.addEventListener("change", () => changeBase(i, base.value));
    base.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); convert(i); }
    });

    const plus = document.createElement("button");
    plus.type = "button";
    plus.className = "step";
    plus.id = `plus${i}`;
    plus.textContent = "+";
    plus.setAttribute("aria-label", `Increase base of box ${i + 1}`);
    plus.addEventListener("click", () => stepBase(i, 1));

    baseGroup.append(minus, base, plus);

    const text = document.createElement("input");
    text.type = "text";
    text.id = `text${i}`;
    text.className = "num-input";
    text.value = state.texts[i];
    text.spellcheck = false;
    text.autocomplete = "off";
    text.addEventListener("focus", () => { activeRow = i; });
    text.addEventListener("keydown", (e) => {
      if (e.key === "Enter") { e.preventDefault(); convert(i); }
    });

    baseInputs.push(base);
    textInputs.push(text);
    row.append(baseGroup, text);
    stageEl.appendChild(row);
  }

  function render() {
    baseInputs.forEach((input, i) => {
      input.value = String(state.bases[i]);
      input.setAttribute("aria-label", `Base of box ${i + 1}, between ${C.MIN_BASE} and ${C.MAX_BASE}`);
    });
    textInputs.forEach((input, i) => {
      input.value = state.texts[i];
      input.setAttribute("aria-label", `Number in box ${i + 1}, written in base ${state.bases[i]}`);
    });
    say(state.message, state.explored ? "done" : null);

    // The position, for the player's record and the tutor: plain JSON only.
    if (window.Track) {
      window.Track.state({
        bases: state.bases.slice(),
        texts: state.texts.slice(),
        activeRow,
        explored: state.explored,
      });
    }
  }

  /* The applet reads the boxes themselves when you press Enter or turn a
   * spinner, so take whatever is typed before calling the core. */
  function syncInputs() {
    state = { ...state, texts: textInputs.map((input) => input.value) };
  }

  function convert(row) {
    activeRow = row;
    syncInputs();
    state = C.convert(state, row);
    render();
  }

  function changeBase(row, value) {
    activeRow = row;
    syncInputs();
    state = C.changeBase(state, row, value);
    render();
  }

  function stepBase(row, direction) {
    changeBase(row, state.bases[row] + direction);
  }

  convertBtn.addEventListener("click", () => convert(activeRow));
  resetBtn.addEventListener("click", () => {
    state = C.start();
    activeRow = 0;
    render();
    say("Back to the start: bases 10, 2, 8 and 16, every box at zero. Try a number to explore again.");
  });

  state = C.start();
  for (let i = 0; i < C.NROWS; i++) buildRow(i);
  render();
})();
