"use strict";

/*
 * Browser UI for the Abacus demo: draw the wires and counters, take clicks.
 * The place-value model, carries, borrows and Sync live in abacus-core.js.
 *
 * Each wire shows its upper counters above the bar and its digit counters
 * below it. Clicking a lower counter moves that counter and those above it
 * away; clicking an upper counter moves counters down to the bar. With two
 * abaci, Sync mirrors each change on the other one.
 */

(() => {
  const C = AbacusCore;
  const stage = document.getElementById("stage");
  const status = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const radixInput = document.getElementById("radixInput");
  const wiresInput = document.getElementById("wiresInput");
  const countInput = document.getElementById("countInput");
  const syncCheck = document.getElementById("syncCheck");

  let state = null;
  let focusKey = null;

  function say(text) {
    status.textContent = text;
  }

  function render() {
    if (!focusKey) {
      const el = document.activeElement;
      if (el && el.dataset && el.dataset.part) {
        focusKey = { abacus: Number(el.dataset.abacus), wire: el.dataset.wire, part: el.dataset.part, index: el.dataset.index };
      }
    }
    stage.replaceChildren();

    const board = document.createElement("div");
    board.className = "abacus-board";
    state.abaci.forEach((a, which) => {
      const wrap = document.createElement("div");
      wrap.className = "abacus";

      const readout = document.createElement("p");
      readout.className = "readout";
      readout.textContent = `${C.format(a)} (base ${a.radix})`;
      wrap.appendChild(readout);

      const wires = document.createElement("div");
      wires.className = "wires";
      for (let wire = 0; wire < a.wires; wire++) {
        const column = document.createElement("div");
        column.className = "wire";

        const makeCounter = (part, index, title) => {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = `counter ${part}`;
          btn.dataset.abacus = String(which);
          btn.dataset.wire = String(wire);
          btn.dataset.part = part;
          btn.dataset.index = String(index);
          btn.setAttribute("aria-label", `Abacus ${which + 1}, wire ${wire + 1}, ${title}`);
          btn.addEventListener("click", () => click(which, wire, part, index));
          return btn;
        };

        const upper = document.createElement("div");
        upper.className = "upper";
        const upperCount = a.radix - (a.digits[wire] || 0);
        for (let j = upperCount - 1; j >= 0; j--) upper.appendChild(makeCounter("upper", j, `upper counter ${j + 1}: move down`));
        column.appendChild(upper);

        const bar = document.createElement("div");
        bar.className = "bar";
        column.appendChild(bar);

        const lower = document.createElement("div");
        lower.className = "lower";
        for (let j = 0; j < (a.digits[wire] || 0); j++) lower.appendChild(makeCounter("lower", j, `digit counter ${j + 1}: leave ${j}`));
        column.appendChild(lower);

        const label = document.createElement("span");
        label.className = "wire-label";
        label.textContent = String(a.digits[wire] || 0);
        column.appendChild(label);
        wires.appendChild(column);
      }
      wrap.appendChild(wires);
      board.appendChild(wrap);
    });
    stage.appendChild(board);

    radixInput.value = String(state.radix);
    wiresInput.value = String(state.wires);
    countInput.value = String(state.count);
    syncCheck.checked = state.sync;
    syncCheck.disabled = state.count !== 2;

    if (state.message) say(state.message);
    else if (state.count === 2 && state.sync) say("Sync is on: changing one abacus changes the other in the opposite way.");
    else say("Click counters to move them. The bottom row shows the number on each wire.");

    if (window.Track) {
      window.Track.state({ radix: state.radix, wires: state.wires, count: state.count, sync: state.sync, abaci: state.abaci });
    }

    if (focusKey) {
      const target = stage.querySelector(
        `.counter[data-abacus="${focusKey.abacus}"][data-wire="${focusKey.wire}"][data-part="${focusKey.part}"][data-index="${focusKey.index}"]`);
      if (target) {
        focusKey = null;
        target.focus();
      }
    }
  }

  function click(which, wire, part, index) {
    focusKey = { abacus: which, wire: String(wire), part, index: String(index) };
    state = C.click(state, which, wire, part, index);
    render();
  }

  function reset() {
    focusKey = null;
    state = C.start({
      radix: Number(radixInput.value),
      wires: Number(wiresInput.value),
      count: Number(countInput.value),
      sync: syncCheck.checked,
    });
    render();
  }

  resetBtn.addEventListener("click", reset);
  radixInput.addEventListener("change", () => {
    state = C.setRadix(state, Number(radixInput.value));
    render();
  });
  wiresInput.addEventListener("change", () => {
    state = C.setWires(state, Number(wiresInput.value));
    render();
  });
  countInput.addEventListener("change", () => {
    state = C.setCount(state, Number(countInput.value));
    render();
  });
  syncCheck.addEventListener("change", () => {
    state = { ...state, sync: syncCheck.checked };
    render();
  });

  reset();
})();
