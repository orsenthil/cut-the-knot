"use strict";

/*
 * Browser UI for the S1089 demo. The stage shows the five numbers the applet
 * prints: the starting number, its backward version, their difference, the
 * difference written backward, and the final sum. The top number's digits are
 * buttons: click the left half to lower a digit, the right half to raise it,
 * just as the applet does; arrow keys and Enter work as well. All arithmetic
 * lives in s1089-core.js. No canvas, so theme changes need no redraw.
 */

(() => {
  const C = S1089Core;
  const digitsEl = document.getElementById("digits");
  const statusEl = document.getElementById("status");
  const baseInput = document.getElementById("baseInput");
  const countInput = document.getElementById("countInput");
  const autonomousEl = document.getElementById("autonomous");
  const digitButtons = [];
  const outputs = {
    aPrime: document.getElementById("line-aPrime"),
    b: document.getElementById("line-b"),
    bPrime: document.getElementById("line-bPrime"),
    c: document.getElementById("line-c"),
  };

  let state = C.start();

  /** Show a line under the game. "done" is how the record sees a demo play. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /** The applet's digit buttons are built only when the length changes, so
   * keyboard focus survives every redraw. */
  function buildDigits(count) {
    digitsEl.replaceChildren();
    digitButtons.length = 0;
    for (let i = 0; i < count; i++) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "digit";
      button.dataset.index = String(i);
      button.addEventListener("click", (event) => {
        const rect = button.getBoundingClientRect();
        const x = event.clientX ? event.clientX - rect.left : rect.width / 2;
        press(i, x >= rect.width / 2);
      });
      button.addEventListener("keydown", (event) => {
        if (["ArrowUp", "ArrowRight", "+", "="].includes(event.key)) {
          event.preventDefault();
          press(i, true);
        } else if (["ArrowDown", "ArrowLeft", "-"].includes(event.key)) {
          event.preventDefault();
          press(i, false);
        }
      });
      digitsEl.appendChild(button);
      digitButtons.push(button);
    }
  }

  function render() {
    if (digitButtons.length !== state.digitCount) buildDigits(state.digitCount);
    digitButtons.forEach((button, i) => {
      const glyph = C.GLYPHS[state.digits[i]];
      button.textContent = glyph;
      button.setAttribute("aria-label", `Digit ${i + 1} of ${state.digitCount}: ${glyph}. ` +
        "Click the left half to lower it, the right half to raise it. Arrow keys work too.");
    });
    const lines = C.compute(state);
    for (const key of Object.keys(outputs)) outputs[key].textContent = lines[key];
    baseInput.value = String(state.base);
    countInput.value = String(state.digitCount);
    autonomousEl.checked = state.autonomous;
    say(state.message, C.result(state));

    // The position, for the player's record and the tutor: plain JSON only.
    if (window.Track) {
      window.Track.state({
        base: state.base,
        digitCount: state.digitCount,
        digits: state.digits.slice(),
        autonomous: state.autonomous,
        lines: [lines.a, lines.aPrime, lines.b, lines.bPrime, lines.c],
        explored: state.explored,
      });
    }
  }

  function press(index, up) {
    state = C.changeDigit(state, index, up);
    render();
  }

  function changeBase(value) {
    state = C.setBase(state, Number(value));
    render();
  }

  function changeCount(value) {
    state = C.setDigitCount(state, Number(value));
    render();
  }

  document.getElementById("baseDown").addEventListener("click", () => changeBase(state.base - 1));
  document.getElementById("baseUp").addEventListener("click", () => changeBase(state.base + 1));
  document.getElementById("countDown").addEventListener("click", () => changeCount(state.digitCount - 1));
  document.getElementById("countUp").addEventListener("click", () => changeCount(state.digitCount + 1));
  baseInput.addEventListener("change", () => changeBase(baseInput.value));
  countInput.addEventListener("change", () => changeCount(countInput.value));
  autonomousEl.addEventListener("change", () => {
    state = C.setAutonomous(state, autonomousEl.checked);
    render();
  });
  document.getElementById("randomBtn").addEventListener("click", () => {
    state = C.randomize(state);
    render();
  });

  render();
})();
