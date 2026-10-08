"use strict";

/*
 * UI for Torque. TorqueCore (torque-core.js) owns the puzzle generation and
 * the balance check; this file renders the beam/tray and handles the
 * select-then-place interaction (works identically for mouse, touch and
 * keyboard since every hit target is a real <button>).
 */
(() => {
  const beamEl = document.getElementById("beam");
  const trayEl = document.getElementById("tray");
  const verifyBtn = document.getElementById("verifyBtn");
  const resetBtn = document.getElementById("resetBtn");
  const newPuzzleBtn = document.getElementById("newPuzzleBtn");
  const statusEl = document.getElementById("status");
  const solvedNumEl = document.getElementById("solvedNum");

  const MAX_TILT_DEG = 22;

  let round = null; // { pegs, items }
  let placements = {}; // itemId -> pegPosition
  let selectedId = null; // currently picked-up item id, or null
  let solved = 0;

  function itemById(id) {
    return round.items.find((it) => it.id === id);
  }

  function kindOf(item) {
    if (item.isJoker) return "joker";
    return item.value > 0 ? "weight" : "balloon";
  }

  function labelText(item) {
    return (item.value > 0 ? "+" : "") + item.value;
  }

  function placedPegFor(id) {
    return placements[id];
  }

  function currentSum() {
    let sum = 0;
    for (const item of round.items) {
      const pos = placements[item.id];
      if (pos !== undefined) sum += item.value * pos;
    }
    return sum;
  }

  function render() {
    renderBeam();
    renderTray();
    renderTilt();
  }

  function renderBeam() {
    beamEl.innerHTML = "";
    for (const pos of round.pegs) {
      const peg = document.createElement("button");
      peg.type = "button";
      peg.className = "peg";
      peg.dataset.pos = String(pos);

      const tick = document.createElement("div");
      tick.className = "tick";
      peg.appendChild(tick);

      const label = document.createElement("div");
      label.className = "label";
      label.textContent = pos > 0 ? "+" + pos : String(pos);
      peg.appendChild(label);

      const slot = document.createElement("div");
      slot.className = "slot";

      const occupantId = Object.keys(placements).find((id) => placements[id] === pos);
      if (occupantId) {
        const item = itemById(occupantId);
        slot.classList.add("filled", kindOf(item));
        slot.textContent = labelText(item);
        peg.setAttribute("aria-label", `Peg at position ${pos}: holding ${describeItem(item)}. Press to take it back.`);
      } else {
        slot.textContent = "";
        if (selectedId) slot.classList.add("dropReady");
        peg.setAttribute("aria-label", `Peg at position ${pos}: empty.` + (selectedId ? " Press to hang the selected item here." : ""));
      }

      peg.appendChild(slot);
      peg.addEventListener("click", () => onPegClick(pos));
      beamEl.appendChild(peg);
    }
  }

  function describeItem(item) {
    const kind = kindOf(item);
    const name = kind === "joker" ? "the joker" : kind === "weight" ? "a weight" : "a balloon";
    return `${name} worth ${labelText(item)}`;
  }

  function renderTray() {
    trayEl.innerHTML = "";
    const unplaced = round.items.filter((it) => placedPegFor(it.id) === undefined);
    if (unplaced.length === 0) {
      const p = document.createElement("div");
      p.className = "trayEmpty";
      p.textContent = "Every item is hung on the beam.";
      trayEl.appendChild(p);
      return;
    }
    for (const item of unplaced) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip " + kindOf(item);
      if (item.id === selectedId) chip.classList.add("selected");
      chip.textContent = labelText(item);
      chip.setAttribute(
        "aria-label",
        `${describeItem(item)}, not yet placed.` + (item.id === selectedId ? " Selected." : " Press to select it.")
      );
      chip.addEventListener("click", () => onChipClick(item.id));
      trayEl.appendChild(chip);
    }
  }

  function renderTilt() {
    const sum = currentSum();
    const maxPossible = round.items.reduce((m, it) => m + Math.abs(it.value) * TorqueCore.HALF_LENGTH, 0) || 1;
    const deg = Math.max(-MAX_TILT_DEG, Math.min(MAX_TILT_DEG, (sum / maxPossible) * MAX_TILT_DEG * 3));
    document.getElementById("beam").style.transform = `rotate(${deg}deg)`;
  }

  function onChipClick(id) {
    selectedId = selectedId === id ? null : id;
    render();
  }

  function onPegClick(pos) {
    const occupantId = Object.keys(placements).find((id) => placements[id] === pos);
    if (occupantId) {
      delete placements[occupantId];
      selectedId = null;
      setStatus("");
      render();
      return;
    }
    if (selectedId) {
      placements[selectedId] = pos;
      selectedId = null;
      setStatus("");
      render();
    }
  }

  function setStatus(text, cls) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose");
    if (cls) statusEl.classList.add(cls);
  }

  function onVerify() {
    const result = TorqueCore.evaluate(round.items, placements);
    if (!result.allPlaced) {
      const left = round.items.length - Object.keys(placements).length;
      setStatus(`Place every item on the beam first — ${left} still in the tray.`);
      return;
    }
    if (result.balanced) {
      solved++;
      solvedNumEl.textContent = String(solved);
      setStatus("Equilibrium! The torques cancel exactly.", "win");
    } else {
      const side = result.sum > 0 ? "right" : "left";
      setStatus(`Not balanced yet — the sum of the torques is ${result.sum} (tipping ${side}). Try again.`);
    }
  }

  function onReset() {
    placements = {};
    selectedId = null;
    setStatus("");
    render();
  }

  function onNewPuzzle() {
    round = TorqueCore.generate();
    placements = {};
    selectedId = null;
    setStatus("");
    render();
  }

  verifyBtn.addEventListener("click", onVerify);
  resetBtn.addEventListener("click", onReset);
  newPuzzleBtn.addEventListener("click", onNewPuzzle);

  onNewPuzzle();
})();
