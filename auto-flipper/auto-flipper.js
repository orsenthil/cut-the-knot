"use strict";

/*
 * Browser UI for Auto Flipper. All the rules live in auto-flipper-core.js.
 *
 * The play area is a column of buttons, one per pancake, drawn top first. A
 * button's width grows with the number on that pancake, so the stack reads like
 * a pile of pancakes. The main action is the "One flip" button; clicking an
 * individual pancake also flips a prefix, as the original applet's mouse press
 * did. The stack is rebuilt from the position on every change, and the theme
 * tokens are read at draw time so a themechange can redraw it.
 */

(function () {
  const Core = AutoFlipperCore;
  const el = (id) => document.getElementById(id);
  const stageEl = el("stage");
  const stackEl = el("stack");
  const statusEl = el("status");
  const nInput = el("nInput");
  const oneFlipBtn = el("oneFlip");
  const resetBtn = el("resetBtn");

  let state = null;

  /** Show a line under the game. "done" also tells the record the demo ended. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  /** The shared colours, read from the site's tokens at draw time. */
  function readTokens() {
    const cs = getComputedStyle(document.documentElement);
    const token = (name) => cs.getPropertyValue(name).trim();
    return {
      ink: token("--ink"),
      accent: token("--accent"),
      highlight: token("--highlight"),
    };
  }

  function ordinal(i) {
    if (i === 0) return "top";
    if (i === 1) return "2nd";
    if (i === 2) return "3rd";
    return `${i + 1}th`;
  }

  /** A sentence saying, in words, what the last flip did. */
  function statusText() {
    let text = Core.describe(state);
    if (state.finished) {
      text += " Pancake 1 is on top now, so one flip turns over a single pancake" +
        " and changes nothing: the stack has stopped.";
    }
    return text;
  }

  /**
   * Draw `state` into stageEl. `keepFocus` is the pancake index to refocus
   * after the stack is rebuilt, so keyboard play survives the computer's turn.
   */
  function render(keepFocus) {
    const tokens = readTokens();
    stageEl.style.setProperty("--pf-ink", tokens.ink);
    stageEl.style.setProperty("--pf-accent", tokens.accent);
    stageEl.style.setProperty("--pf-highlight", tokens.highlight);

    stackEl.replaceChildren();
    const n = state.stack.length;
    state.stack.forEach((value, index) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "pancake" + (index === 0 ? " top" : "") +
        (index === state.lastK - 1 && state.lastK > 0 ? " just" : "");
      btn.textContent = String(value);
      btn.style.setProperty("--pw", `${Math.round(32 + (value / n) * 68)}%`);
      const flipCount = index; // the applet's mouse press: flip the top `index` pancakes
      btn.setAttribute(
        "aria-label",
        `Pancake ${value}, ${ordinal(index)} from the top. Press to flip ` +
          (flipCount === 0 ? "no pancakes." : `the top ${flipCount} pancakes.`)
      );
      btn.addEventListener("click", () => manual(index));

      // Arrow keys walk the stack; native buttons handle Enter and Space.
      btn.addEventListener("keydown", (event) => {
        const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
        if (!step) return;
        event.preventDefault();
        const target = Math.min(n - 1, Math.max(0, index + step));
        if (stackEl.children[target]) stackEl.children[target].focus();
      });
      stackEl.appendChild(btn);
    });

    if (keepFocus != null && stackEl.children[keepFocus]) {
      stackEl.children[keepFocus].focus();
    }

    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function play(next, keepFocus) {
    state = next;
    render(keepFocus);
    if (Core.result(state) === "done") say(statusText(), "done");
    else say(statusText());
  }

  function oneFlip() {
    if (state.finished) return;
    play(Core.autoFlip(state));
  }

  function manual(index) {
    if (state.finished) return;
    play(Core.manualFlip(state, index), index);
  }

  function newGame() {
    const n = Core.clampN(nInput.value);
    nInput.value = String(n);
    state = Core.start({ n });
    say("");
    render();
  }

  oneFlipBtn.addEventListener("click", oneFlip);
  resetBtn.addEventListener("click", newGame);
  nInput.addEventListener("change", newGame);
  nInput.addEventListener("blur", newGame);
  window.addEventListener("themechange", () => render());

  // Keyboard shortcuts: F flips once, R resets, unless the player is typing.
  document.addEventListener("keydown", (event) => {
    const tag = (document.activeElement && document.activeElement.tagName) || "";
    if (tag === "INPUT" || event.altKey || event.ctrlKey || event.metaKey) return;
    const key = event.key.toLowerCase();
    if (key === "f") {
      event.preventDefault();
      oneFlip();
    } else if (key === "r") {
      event.preventDefault();
      newGame();
    }
  });

  newGame();
})();
