"use strict";

/*
 * Page layer for Combi Gem. All the mathematics lives in combi-gem-core.js;
 * this file only draws and takes input.
 *
 * The top row of the play area is the collection A: each blue button is one
 * whole number, and tapping its right half adds one while tapping its left
 * half takes one away, exactly like the applet's split-hit CTKNumber. Below it
 * sits the sorted list of sums. The options are the applet's "Set size" (2-9),
 * "#summonds" (2-5), the Economize check box and the Pop frame button, which
 * here opens the complete list instead of a second browser window.
 */

(function () {
  const Core = CombiGemCore;
  const stageEl = document.getElementById("stage");
  const numsEl = document.getElementById("nums");
  const sumsEl = document.getElementById("sums");
  const sumsTitle = document.getElementById("sumsTitle");
  const allSums = document.getElementById("allSums");
  const allSumsText = document.getElementById("allSumsText");
  const sizeInput = document.getElementById("sizeInput");
  const summondsInput = document.getElementById("summondsInput");
  const econInput = document.getElementById("econInput");
  const listBtn = document.getElementById("listBtn");
  const newBtn = document.getElementById("newBtn");
  const statusEl = document.getElementById("status");

  let state = Core.start({
    n: Number(sizeInput.value),
    s: Number(summondsInput.value),
    economize: econInput.checked,
  });
  let focusedIndex = -1;

  /**
   * Shows a line under the game. "done" is how a demo tells the record it has
   * been explored; nothing here ever wins or loses.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function nudge(index, delta) {
    const next = Core.move(state, { type: "setNumber", index, delta });
    if (!next) return;
    state = next;
    const value = state.nums[index];
    say(`Number ${index + 1} is now ${value}. ${Core.describe(state).text}`, "done");
    render();
  }

  function buildNumbers() {
    numsEl.replaceChildren();
    for (let i = 0; i < state.n; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "numCell";
      btn.dataset.index = String(i);
      btn.textContent = String(state.nums[i]);
      btn.setAttribute("aria-label",
        `Number ${i + 1} of ${state.n}, value ${state.nums[i]}. ` +
        "Tap the right half or press Right Arrow to add one; " +
        "tap the left half or press Left Arrow to take one away.");

      // CTKNumber.IsHit: the right half of the little vertical line is "up",
      // the left half is "down". Map the pointer through the element's own
      // box so a shrunken row still splits in the right place.
      btn.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        const rect = btn.getBoundingClientRect();
        const scale = btn.offsetWidth / Math.max(1, rect.width);
        const localX = (e.clientX - rect.left) * scale;
        btn.focus(); // render() rebuilds the row; this lets it put focus back
        nudge(i, localX > btn.offsetWidth / 2 ? 1 : -1);
      });
      // A keyboard-generated click (Enter or Space) has detail 0; pointer
      // clicks have already been handled by pointerdown.
      btn.addEventListener("click", (e) => {
        if (e.detail === 0) nudge(i, 1);
      });
      btn.addEventListener("keydown", (e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          e.preventDefault();
          nudge(i, 1);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          e.preventDefault();
          nudge(i, -1);
        }
      });
      numsEl.appendChild(btn);
    }
  }

  function buildSums(d) {
    sumsTitle.textContent = ["", "", "A₂", "A₃", "A₄", "A₅"][state.s] || `A^${state.s}`;
    sumsEl.replaceChildren();
    for (const value of d.sums) {
      const chip = document.createElement("span");
      chip.className = "sumChip";
      chip.textContent = String(value);
      sumsEl.appendChild(chip);
    }
    allSumsText.textContent = d.sums.join("\n");
  }

  function render() {
    const active = document.activeElement;
    if (active && active.classList && active.classList.contains("numCell")) {
      focusedIndex = Number(active.dataset.index);
    } else {
      focusedIndex = -1; // never steal focus back from an option or a button
    }
    sizeInput.value = String(state.n);
    summondsInput.value = String(state.s);
    econInput.checked = state.economize;

    const d = Core.describe(state);
    buildNumbers();
    buildSums(d);

    // Keyboard play must leave the focus on the board after every change.
    if (focusedIndex >= 0 && focusedIndex < state.n) {
      const btn = numsEl.querySelector(`[data-index="${focusedIndex}"]`);
      if (btn) btn.focus();
    }

    // The position, for the player's record and the tutor.
    if (window.Track) {
      window.Track.state({
        nums: state.nums.slice(0, state.n),
        n: state.n,
        s: state.s,
        economize: state.economize,
        sums: d.sums,
        description: d.text,
      });
    }
  }

  function change(option) {
    const next = Core.move(state, option);
    if (!next) return;
    state = next;
    const d = Core.describe(state);
    say(`With ${state.n} numbers and ${state.s} ${state.s === 2 ? "summond" : "summonds"}: ${d.text}`, "done");
    render();
  }

  sizeInput.addEventListener("input", () => {
    const n = Number(sizeInput.value);
    if (Number.isFinite(n) && n !== state.n) change({ type: "setSize", size: n });
  });
  summondsInput.addEventListener("input", () => {
    const s = Number(summondsInput.value);
    if (Number.isFinite(s) && s !== state.s) change({ type: "setSummonds", s });
  });
  econInput.addEventListener("change", () => change({ type: "setEconomize", value: econInput.checked }));

  listBtn.addEventListener("click", () => {
    const opening = allSums.hidden;
    allSums.hidden = !opening;
    listBtn.textContent = opening ? "Hide the full list" : "Show all sums";
    listBtn.setAttribute("aria-label", opening ? "Hide the complete list of sums" : "Show the complete list of sums");
    say(opening
      ? `The whole list: ${Core.describe(state).sums.length} sums, one on each line.`
      : `The list is folded away. ${Core.describe(state).text}`, "done");
  });

  newBtn.addEventListener("click", () => {
    state = Core.move(state, { type: "reset" });
    focusedIndex = -1;
    say(`Back to the start. ${Core.describe(state).text}`, "done");
    render();
  });

  stageEl.setAttribute("aria-label", "The collection and its list of sums");
  say(`Tap a number to change it, then watch its list of sums. ${Core.describe(state).text}`);
  render();
})();
