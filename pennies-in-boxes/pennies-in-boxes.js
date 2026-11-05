"use strict";

/*
 * Pennies in Boxes - the UI. The move, the search and the gcd test live in
 * pennies-core.js.
 *
 * Two clicks make a move, as in the applet: the first picks a box, the second
 * picks its partner, and the fuller of the two pays the other. The applet
 * sorted the pair itself (Compute() swapped them when needed), so the order of
 * the clicks does not matter here either.
 *
 * The Hint button is the one addition. The applet let you shuffle pennies
 * forever in a deal that can never be gathered up; here the gcd test answers
 * that question honestly.
 */

(function () {
  const P = PenniesCore;

  const boxesEl = document.getElementById("boxes");
  const statusEl = document.getElementById("status");
  const boxLabel = document.getElementById("boxLabel");
  const pennyLabel = document.getElementById("pennyLabel");
  const backBtn = document.getElementById("backBtn");

  const BOXES_MIN = 2;
  const BOXES_MAX = 6;
  const PENNIES_MIN = 4;
  const PENNIES_MAX = 24;

  const state = {
    boxes: 3,
    pennies: 16,
    game: null,
    picked: null,     // the box waiting for a partner
    hinted: null,     // [i, j] while a hint is showing
    flash: null,      // the box that has just been paid
  };

  function newDeal() {
    state.game = new P.Game(P.deal(state.boxes, state.pennies));
    state.picked = null;
    state.hinted = null;
    state.flash = null;
    boxLabel.textContent = String(state.boxes);
    pennyLabel.textContent = String(state.pennies);
    render();
    say("Click two boxes. The fuller one pays the other what it is holding.");
  }

  function render() {
    const g = state.game;
    boxesEl.textContent = "";

    g.counts.forEach((count, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "box";
      if (i === state.picked) btn.classList.add("picked");
      if (state.hinted && state.hinted.includes(i)) btn.classList.add("hinted");
      if (i === state.flash) btn.classList.add("flash");
      if (count === 0) btn.classList.add("empty");

      const pile = document.createElement("div");
      pile.className = "pennies";
      for (let n = 0; n < count; n++) {
        const penny = document.createElement("span");
        penny.className = "penny";
        pile.appendChild(penny);
      }
      btn.appendChild(pile);

      const label = document.createElement("div");
      label.className = "count";
      label.textContent = String(count);
      btn.appendChild(label);

      btn.setAttribute("aria-label", `Box ${i + 1}, ${count} ${count === 1 ? "penny" : "pennies"}`
        + (i === state.picked ? ", picked" : ""));
      btn.addEventListener("click", () => onPick(i));
      boxesEl.appendChild(btn);
    });

    backBtn.disabled = g.history.length === 0;
  }

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.toggle("win", kind === "win");
    statusEl.classList.toggle("lose", kind === "lose");
  }

  function onPick(i) {
    const g = state.game;
    if (g.finished) { say("All the pennies are already in one box. Deal again to play on.", "win"); return; }
    state.hinted = null;

    if (g.counts[i] === 0) {
      say("That box is empty: it has nothing to pay and nothing to double.");
      state.picked = null;
      render();
      return;
    }
    if (state.picked === null) {
      state.picked = i;
      render();
      say(`Box ${i + 1} picked. Now click the box it should trade with.`);
      return;
    }
    if (state.picked === i) {
      state.picked = null;
      render();
      say("Box unpicked. Click two boxes to make a move.");
      return;
    }

    const move = g.play(state.picked, i);
    state.picked = null;
    if (!move) { render(); say("Those two boxes cannot trade."); return; }

    state.flash = move.to;
    render();
    setTimeout(() => { state.flash = null; render(); }, 450);

    if (g.finished) {
      say(`All ${g.total} pennies in one box. Done!`, "win");
      return;
    }
    say(`Box ${move.from + 1} paid ${move.amount} to box ${move.to + 1}, doubling it to ${g.counts[move.to]}.`);
  }

  /* -------------------------------------------------------------- controls */

  function setBoxes(n) {
    const next = Math.min(Math.max(n, BOXES_MIN), BOXES_MAX);
    if (next === state.boxes || next > state.pennies) return;
    state.boxes = next;
    newDeal();
  }

  function setPennies(n) {
    const next = Math.min(Math.max(n, PENNIES_MIN), PENNIES_MAX);
    if (next === state.pennies || next < state.boxes) return;
    state.pennies = next;
    newDeal();
  }

  document.getElementById("fewerBoxes").addEventListener("click", () => setBoxes(state.boxes - 1));
  document.getElementById("moreBoxes").addEventListener("click", () => setBoxes(state.boxes + 1));
  document.getElementById("fewerPennies").addEventListener("click", () => setPennies(state.pennies - 1));
  document.getElementById("morePennies").addEventListener("click", () => setPennies(state.pennies + 1));

  document.getElementById("hintBtn").addEventListener("click", () => {
    const g = state.game;
    if (g.finished) { say("Nothing left to do: every penny is in one box.", "win"); return; }
    const move = P.hint(g.counts);
    if (!move) {
      state.hinted = null;
      render();
      const g0 = P.gcdAll(g.counts);
      say(`No sequence of moves can gather these up: ${g.total} ÷ ${g0} = ${g.total / g0}, which is not a power of two. Deal again.`, "lose");
      return;
    }
    state.hinted = move;
    state.picked = null;
    render();
    say(`Try boxes ${move[0] + 1} and ${move[1] + 1}.`);
  });

  backBtn.addEventListener("click", () => {
    state.picked = null;
    state.hinted = null;
    if (!state.game.undo()) { say("Nothing to take back."); return; }
    render();
    say("Move taken back.");
  });

  document.getElementById("dealBtn").addEventListener("click", newDeal);

  newDeal();
})();
