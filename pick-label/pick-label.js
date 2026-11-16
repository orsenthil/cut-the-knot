"use strict";

/*
 * Box Labels page: three boxes with wrong labels. Click a box to see one ball,
 * then click a label chip and a box to assign guesses. Verify checks them.
 */

(function () {
  const Core = PickLabelCore;
  const boxesEl = document.getElementById("boxes");
  const chipsEl = document.getElementById("chips");
  const statusEl = document.getElementById("status");
  const scoreEl = document.getElementById("scoreLine");
  const verifyBtn = document.getElementById("verifyBtn");
  const newBtn = document.getElementById("newBtn");

  let state = null;
  let holding = null; // label type being placed

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function labelView(type) {
    if (type === null || type === undefined) return '<span class="label empty">?</span>';
    const a = type === Core.BB ? "black" : "white";
    const b = type === Core.WW ? "white" : "black";
    return `<span class="label" title="${Core.NAMES[type]}"><span class="dot ${a}"></span><span class="dot ${b}"></span></span>`;
  }

  function render() {
    boxesEl.replaceChildren();
    state.contents.forEach((_, i) => {
      const box = document.createElement("button");
      box.type = "button";
      box.className = "box";
      box.dataset.i = String(i);
      const printed = labelView(state.labels[i]);
      const guess = state.guesses[i] !== null
        ? `<div class="guess-slot filled">${labelView(state.guesses[i])}</div>`
        : `<div class="guess-slot">drop label</div>`;
      let balls = "";
      if (state.open) {
        const c = state.contents[i];
        const left = c === Core.BB ? "black" : "white";
        const right = c === Core.WW ? "white" : "black";
        balls = `<div class="balls"><span class="ball ${left}"></span><span class="ball ${right}"></span></div>`;
      } else if (state.revealed && state.revealed.box === i) {
        balls = `<div class="balls pop"><span class="ball ${state.revealed.color === 0 ? "white" : "black"}"></span></div>`;
      }
      box.innerHTML = `${balls}<div class="printed">Shown: ${printed}</div>${guess}`;
      box.setAttribute("aria-label", `Box ${i + 1}, shown label ${Core.NAMES[state.labels[i]]}${state.guesses[i] !== null ? `, guess ${Core.NAMES[state.guesses[i]]}` : ""}`);
      if (state.picked === i) box.classList.add("picked");
      if (state.phase === Core.SELECT) box.classList.add("selectable");
      box.addEventListener("click", () => onBox(i));
      boxesEl.appendChild(box);
    });

    chipsEl.replaceChildren();
    [Core.WW, Core.WB, Core.BB].forEach((type) => {
      const used = state.guesses.includes(type);
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "chip" + (holding === type ? " holding" : "") + (used ? " used" : "");
      chip.innerHTML = labelView(type) + `<span>${Core.NAMES[type]}</span>`;
      chip.disabled = state.phase !== Core.LABEL && state.phase !== Core.VERIFY;
      chip.setAttribute("aria-label", `Label ${Core.NAMES[type]}`);
      chip.addEventListener("click", () => {
        if (used) {
          const box = state.guesses.indexOf(type);
          state = Core.clearGuess(state, box);
          holding = type;
        } else {
          holding = holding === type ? null : type;
        }
        render();
      });
      chipsEl.appendChild(chip);
    });

    verifyBtn.disabled = state.phase !== Core.VERIFY;
    scoreEl.textContent = state.games
      ? `Score: ${state.wins} / ${state.games}`
      : "";

    if (state.phase === Core.DONE) {
      say(state.announce, state.won ? "win" : "lose");
    } else {
      say(state.announce);
    }
    if (window.Track) window.Track.state(Core.snapshot(state));
  }

  function onBox(i) {
    if (state.phase === Core.SELECT) {
      state = Core.pickBox(state, i);
      holding = null;
      render();
      return;
    }
    if (state.phase === Core.LABEL || state.phase === Core.VERIFY) {
      if (holding !== null) {
        state = Core.assignGuess(state, i, holding);
        holding = null;
        render();
        return;
      }
      if (state.guesses[i] !== null) {
        holding = state.guesses[i];
        state = Core.clearGuess(state, i);
        render();
      }
      return;
    }
    if (state.phase === Core.DONE) {
      newGame();
    }
  }

  function newGame() {
    const games = state ? state.games : 0;
    const wins = state ? state.wins : 0;
    state = Core.start({});
    state.games = games;
    state.wins = wins;
    holding = null;
    render();
  }

  verifyBtn.addEventListener("click", () => {
    if (state.phase === Core.VERIFY) {
      state = Core.verify(state);
      holding = null;
      render();
    }
  });
  newBtn.addEventListener("click", newGame);

  document.addEventListener("keydown", (event) => {
    if (event.target && (event.target.tagName === "INPUT" || event.target.tagName === "SELECT")) return;
    if (event.key >= "1" && event.key <= "3") {
      event.preventDefault();
      onBox(Number(event.key) - 1);
    } else if (event.key === "Enter" && state.phase === Core.VERIFY) {
      event.preventDefault();
      verifyBtn.click();
    } else if (event.key === "n" || event.key === "N") {
      event.preventDefault();
      newGame();
    }
  });

  newGame();
})();
