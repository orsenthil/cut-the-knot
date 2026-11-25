"use strict";

/*
 * The page for The Monty Hall Problem: drawing and input only. Three door
 * buttons; a click is the first pick, the doors open (the car behind one, goats
 * behind the others) and the counters are updated. A click on a door after that
 * starts the next round, as in the applet. The rules are in monty-hall-core.js.
 */

(function () {
  const Core = MontyCore;
  const doorsEl = document.getElementById("doors");
  const msg = document.getElementById("msg");
  const statusEl = document.getElementById("status");
  const ids = { trials: "tTrials", stayedWon: "tStayedWon", stayedLost: "tStayedLost", switchedWon: "tSwitchedWon", switchedLost: "tSwitchedLost" };

  let state = Core.start();

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  const doors = [0, 1, 2].map((d) => {
    const b = document.createElement("button");
    b.type = "button"; b.className = "door";
    const num = document.createElement("span"); num.className = "num"; num.textContent = d + 1;
    const img = document.createElement("img"); img.alt = ""; img.width = 135; img.height = 88;
    b.append(num, img);
    b.addEventListener("click", () => { const s = Core.pick(state, d); if (s) { state = s; render(); } });
    doorsEl.appendChild(b);
    return b;
  });

  function render() {
    const open = state.picked !== null;
    doors.forEach((b, d) => {
      const car = d === state.car;
      b.classList.toggle("open", open); b.classList.toggle("picked", open && d === state.picked);
      const img = b.querySelector("img");
      if (open) { img.src = car ? "images/NiceCar.gif" : "images/BigGoat.gif"; img.width = car ? 159 : 135; img.height = car ? 88 : 188; }
      b.setAttribute("aria-label", open ? `Door ${d + 1}: ${car ? "the car" : "a goat"}${d === state.picked ? ", the door you picked" : ""}. Press for the next round.` : `Door ${d + 1}. Press to pick it.`);
    });
    for (const k in ids) document.getElementById(ids[k]).textContent = state[k];
    const o = Core.outcome(state);
    msg.textContent = "";
    if (o) {
      const host = Core.hostOpens(state.car, state.picked), sw = Core.switchTo(state.car, state.picked);
      msg.textContent = `You picked door ${state.picked + 1}. The host would open door ${host + 1}, and switching would take you to door ${sw + 1}. Staying ${o.stay === "won" ? "wins the car" : "loses (a goat)"}; switching ${o.switch === "won" ? "wins the car" : "loses (a goat)"}.`;
    }
    const rate = Core.rates(state);
    say(rate ? `So far: staying has won ${Math.round(100 * rate.stay)}% and switching ${Math.round(100 * rate.switch)}% of ${state.trials} round${state.trials === 1 ? "" : "s"}.` : "", rate ? "done" : null);
    if (window.Track) window.Track.state(state.picked === null ? { ...state, car: null } : state);
  }

  document.getElementById("resetBtn").addEventListener("click", () => { state = Core.start(); render(); });
  document.getElementById("runBtn").addEventListener("click", () => {
    for (let i = 0; i < 100; i++) state = Core.pick(state, Math.floor(Math.random() * Core.DOORS));
    render();
  });
  render();
})();
