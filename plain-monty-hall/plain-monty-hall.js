"use strict";

/*
 * The page for Plain Monty Hall: drawing and input only. Three door buttons;
 * the first click is your pick and the host opens a goat door, the second is
 * your final choice and every door opens, and the four counts change. A click
 * on a door after that starts the next round with that door as the pick, as in
 * the applet. Reset clears the counts. The rules are in plain-monty-hall-core.js.
 */

(function () {
  const Core = PlainMontyHallCore;
  const doorsEl = document.getElementById("doors");
  const prompt = document.getElementById("prompt");
  const statusEl = document.getElementById("status");
  const bars = {
    switchedLost: "Switched and lost", switchedWon: "Switched and won",
    stayedLost: "Stayed and lost", stayedWon: "Stayed and won",
  };

  // ?prize=N fixes the first car, so screenshots and play scenarios repeat.
  const fixture = Number(new URLSearchParams(location.search).get("prize"));
  const startOptions = () => (Number.isInteger(fixture) && fixture >= 1 && fixture <= 3 ? { prize: fixture - 1 } : {});

  let state = Core.start(startOptions());

  /**
   * Shows a line under the game. `kind` is "win", "lose", "done" or nothing;
   * those three classes are also how the player's record learns that a play
   * has ended (assets/progress.js), so use them for that and nothing else.
   */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const doors = [0, 1, 2].map((d) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "door";
    const num = document.createElement("span"); num.className = "num"; num.textContent = d + 1;
    const img = document.createElement("img"); img.alt = ""; img.width = 135; img.height = 188;
    b.append(num, img);
    b.addEventListener("click", () => {
      const s = Core.click(state, d);
      if (!s) return;
      state = s;
      render();
      // Keep the focus on the board: the door just pressed, or a closed one.
      if (b.disabled) doors.find((x) => !x.disabled).focus();
    });
    doorsEl.appendChild(b);
    return b;
  });

  const barRows = {};
  const tally = document.getElementById("tally");
  for (const k in bars) {
    const row = document.createElement("div"); row.className = "bar-row";
    const label = document.createElement("span"); label.className = "bar-label"; label.textContent = bars[k];
    const track = document.createElement("span"); track.className = "bar-track";
    const fill = document.createElement("span"); fill.className = `bar ${k.endsWith("Won") ? "won" : "lost"}`;
    track.append(fill);
    const count = document.createElement("span"); count.className = "bar-count";
    row.append(label, track, count);
    tally.append(row);
    barRows[k] = { fill, count };
  }

  const what = (d) => (d === state.prize ? "the car" : "a goat");

  function render() {
    const stage = Core.stage(state);
    const legal = Core.legalMoves(state);
    doors.forEach((b, d) => {
      const open = stage === "reveal" || d === state.opened;
      b.classList.toggle("open", open);
      b.classList.toggle("first", d === state.first && stage !== "reveal");
      b.classList.toggle("final", stage === "reveal" && d === state.final);
      b.disabled = !legal.includes(d);
      const img = b.querySelector("img");
      if (open) {
        const car = d === state.prize;
        img.src = car ? "images/NiceCar.gif" : "images/BigGoat.gif";
        img.width = car ? 159 : 135; img.height = car ? 88 : 188;
      }
      let label = `Door ${d + 1}`;
      if (stage === "pick") label += ". Press to pick it.";
      else if (stage === "choose") label += d === state.opened ? ": open, a goat." : d === state.first ? ", your first pick. Press to stay." : ". Press to switch to it.";
      else label += `: ${what(d)}${d === state.final ? ", your choice" : ""}. Press to start the next round with this door.`;
      b.setAttribute("aria-label", label);
    });

    if (stage === "pick") prompt.textContent = state.trials ? "A new car is hidden. Pick a door." : "Pick a door.";
    else if (stage === "choose") prompt.textContent = `You picked door ${state.first + 1}. The host opened door ${state.opened + 1}: a goat. Stay with door ${state.first + 1}, or switch?`;
    else prompt.textContent = `The car was behind door ${state.prize + 1}. Press a door to play again.`;

    const most = Math.max(1, ...Object.keys(bars).map((k) => state[k]));
    for (const k in bars) {
      barRows[k].fill.style.width = `${(100 * state[k]) / most}%`;
      barRows[k].count.textContent = state[k];
    }

    const o = Core.outcome(state);
    if (o) {
      const r = Core.rates(state);
      const so = `Switching has won ${state.switchedWon} of ${state.trials} round${state.trials === 1 ? "" : "s"} (${Math.round(100 * r.switch)}%).`;
      say(`You ${o.switched ? "switched" : "stayed"} and ${o.won ? "won the car!" : "got a goat."} ${so}`, o.won ? "win" : "lose");
    } else say("");

    // The position, for the player's record and the tutor. The car stays hidden until the reveal.
    if (window.Track) window.Track.state(stage === "reveal" ? state : { ...state, prize: null });
  }

  document.getElementById("resetBtn").addEventListener("click", () => { state = Core.start(); render(); });
  render();
})();
