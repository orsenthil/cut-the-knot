"use strict";

/*
 * Fish Soup UI: nine word cards in a shuffled row; you blue, computer red.
 */
(() => {
  const S = SoupFishCore;
  const board = document.getElementById("board");
  const status = document.getElementById("status");
  const score = document.getElementById("score");
  const computerFirst = document.getElementById("computerFirst");
  const goBtn = document.getElementById("goBtn");
  const newBtn = document.getElementById("newBtn");

  let state = S.start({ computerFirst: false });
  let awaitingGo = false;

  function setStatus(text, cls) {
    status.textContent = text;
    status.classList.remove("win", "lose", "done");
    if (cls) status.classList.add(cls);
  }

  function render() {
    if (window.Track) {
      window.Track.state({
        you: state.you,
        computer: state.computer,
        over: state.over,
        result: state.result,
        perm: state.perm.slice(),
        winsYou: state.winsYou,
        winsComputer: state.winsComputer,
        winLetter: state.winLetter,
      });
    }

    board.replaceChildren();
    for (let display = 0; display < 9; display++) {
      const logical = S.translate(state, display);
      const word = S.wordAtLogical(logical);
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "card";
      btn.textContent = word;
      const yours = state.you & (1 << logical);
      const comps = state.computer & (1 << logical);
      if (yours) btn.classList.add("you");
      if (comps) btn.classList.add("computer");
      btn.disabled = state.over || awaitingGo || Boolean(yours || comps);
      btn.setAttribute(
        "aria-label",
        yours ? `${word}, yours` : comps ? `${word}, computer` : `Choose ${word}`,
      );
      btn.addEventListener("click", () => onPick(logical));
      board.appendChild(btn);
    }

    score.textContent = `You ${state.winsYou} : ${state.winsComputer} Computer`;
    goBtn.disabled = !awaitingGo;
    computerFirst.checked = state.computerFirst;

    if (state.over) {
      const letter = state.winLetter ? ` (${state.winLetter})` : "";
      if (state.result === "you") setStatus(`You won!${letter}`, "win");
      else if (state.result === "computer") setStatus(`Computer won!${letter}`, "lose");
      else setStatus("Stalemate — try again.", "done");
    } else if (awaitingGo) {
      setStatus('Computer moves first — press "So, go!".');
    } else {
      setStatus("Your turn — pick a word.");
    }
  }

  function onPick(logical) {
    if (state.over || awaitingGo) return;
    const next = S.playYou(state, logical);
    if (!next) return;
    state = next;
    render();
  }

  function newGame() {
    state = S.start({ computerFirst: computerFirst.checked });
    awaitingGo = state.computerFirst;
    render();
  }

  computerFirst.addEventListener("change", () => {
    state = S.start({ computerFirst: computerFirst.checked });
    awaitingGo = state.computerFirst;
    render();
  });

  goBtn.addEventListener("click", () => {
    if (!awaitingGo) return;
    state = S.computerOpen(state);
    awaitingGo = false;
    render();
  });

  newBtn.addEventListener("click", newGame);
  window.addEventListener("themechange", render);
  render();
})();
