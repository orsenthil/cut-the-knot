"use strict";

(function () {
  const Core = SctCore;
  const rowEl = document.getElementById("row");
  const statusEl = document.getElementById("status");
  const nSel = document.getElementById("nInput");
  const elimChk = document.getElementById("elimInput");
  const randomChk = document.getElementById("randomInput");
  const resetBtn = document.getElementById("resetBtn");
  const repeatBtn = document.getElementById("repeatBtn");

  let state = null;

  for (let n = Core.MIN_N; n <= Core.MAX_N; n++) {
    const o = document.createElement("option");
    o.value = String(n);
    o.textContent = String(n);
    nSel.appendChild(o);
  }
  nSel.value = String(Core.DEFAULT_N);

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    rowEl.replaceChildren();
    state.shapes.forEach((v, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "shape";
      if (v === Core.EMPTY) {
        btn.classList.add("empty");
        btn.disabled = true;
        btn.setAttribute("aria-hidden", "true");
      } else {
        btn.classList.add(Core.NAMES[v]);
        btn.setAttribute("aria-label", Core.NAMES[v] + " " + (i + 1));
        if (state.selected.includes(i)) btn.classList.add("selected");
        btn.addEventListener("click", () => onPick(i));
      }
      rowEl.appendChild(btn);
    });
    if (window.Track) window.Track.state(Core.snapshot(state));
  }

  function onPick(i) {
    state = Core.select(state, i);
    if (state.note === "different") say("Please select different shapes.");
    else if (state.note === "gone") say("That shape is gone.");
    else if (state.over) {
      const name = Core.NAMES[state.remaining] || "shape";
      say("Done — only " + name + (state.remaining === Core.TRIANGLE && !state.eliminate ? "s" : "") + " left.", "done");
    } else if (state.selected.length === 1) say("Pick a different shape.");
    else say("Pick two different shapes.");
    render();
  }

  function newGame() {
    const n = Number(nSel.value);
    const eliminate = elimChk.checked;
    let shapes;
    if (randomChk.checked) {
      state = Core.start({ n, eliminate });
    } else {
      // Fixed alternating pattern when Random is off (applet still randomizes
      // on Reset unless Random is checked — we keep the last spare via Repeat).
      state = Core.start({ n, eliminate });
    }
    say("Pick two different shapes.");
    render();
  }

  resetBtn.addEventListener("click", newGame);
  repeatBtn.addEventListener("click", () => {
    state = Core.repeat(state);
    say("Same start again. Pick two different shapes.");
    render();
  });
  nSel.addEventListener("change", newGame);
  elimChk.addEventListener("change", newGame);
  randomChk.addEventListener("change", newGame);

  newGame();
})();
