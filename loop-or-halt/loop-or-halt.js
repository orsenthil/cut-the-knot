"use strict";

/*
 * The page for Loop Or Halt: drawing and input only. One row per step; the
 * leading number has an outline, the block about to be flipped is tinted, and
 * the last row (1 first) is outlined in green. Every step is shown at once,
 * as in the applet.
 */

(function () {
  const Core = LoopOrHaltCore;
  const rowsEl = document.getElementById("rows");
  const statusEl = document.getElementById("status");
  const readout = document.getElementById("readout");
  const nEl = document.getElementById("n");
  const nOut = document.getElementById("nOut");

  let perm = null;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    const rows = Core.run(perm);
    rowsEl.textContent = "";
    rows.forEach((r, i) => {
      const li = document.createElement("li");
      if (i === rows.length - 1) li.className = "last";
      const idx = document.createElement("span");
      idx.className = "idx"; idx.textContent = i + ".";
      li.appendChild(idx);
      const flipped = i === rows.length - 1 ? 0 : r[0];
      r.forEach((v, j) => {
        const c = document.createElement("span");
        c.className = "n" + (j === 0 ? " lead" : "") + (j < flipped ? " flip" : "");
        c.textContent = v;
        li.appendChild(c);
      });
      li.setAttribute("aria-label", `Step ${i}: ${r.join(" ")}`);
      rowsEl.appendChild(li);
    });
    const lead = Core.leaders(rows);
    readout.textContent = `first numbers: ${lead.join(", ")}\n`.trim();
    const s = rows.length - 1;
    say(s === 0 ? "It starts with 1 first, so it stops straight away." : `It stops after ${s} flip${s === 1 ? "" : "s"}, with 1 first.`, "done");
    if (window.Track) window.Track.state({ n: perm.length, start: perm.slice(), steps: s });
  }

  function newGame() {
    const n = Core.clampN(nEl.value);
    nEl.value = n; nOut.textContent = n;
    perm = Core.randomPermutation(n);
    render();
  }

  nEl.addEventListener("input", newGame);
  document.getElementById("newBtn").addEventListener("click", newGame);
  newGame();
})();
