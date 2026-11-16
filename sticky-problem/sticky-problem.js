"use strict";

/*
 * Sticky Problem UI: rows of chocolate squares for each stick. In break mode,
 * click a square to the right of the break; in remove mode, click a stick
 * when there are at least n sticks of length n.
 */
(() => {
  const S = StickyProblemCore;
  const stage = document.getElementById("stage");
  const status = document.getElementById("status");
  const modeBreak = document.getElementById("modeBreak");
  const modeRemove = document.getElementById("modeRemove");
  const btnReset = document.getElementById("reset");
  const btnStandard = document.getElementById("standard");
  const btnMakeMove = document.getElementById("makeMove");

  let state = S.start({});
  let busy = false;

  function setStatus(text, cls) {
    status.textContent = text;
    status.classList.remove("win", "lose", "done");
    if (cls) status.classList.add(cls);
  }

  function render() {
    if (window.Track) {
      window.Track.state({
        sticks: state.sticks.slice(),
        turn: state.turn,
        over: state.over,
        winner: state.winner,
        mode: state.mode,
        wins: state.wins,
        losses: state.losses,
      });
    }

    stage.replaceChildren();
    stage.setAttribute("aria-label", "Sticks made of unit squares");

    if (state.sticks.length === 0) {
      const empty = document.createElement("p");
      empty.className = "empty-board";
      empty.textContent = "No sticks left.";
      stage.appendChild(empty);
    } else {
      const list = document.createElement("div");
      list.className = "sticks";
      state.sticks.forEach((len, index) => {
        const row = document.createElement("div");
        row.className = "stick";
        row.setAttribute("role", "group");
        row.setAttribute("aria-label", `Stick of length ${len}`);
        for (let cell = 0; cell < len; cell++) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "cell";
          btn.dataset.index = String(index);
          btn.dataset.cell = String(cell);
          btn.setAttribute(
            "aria-label",
            state.mode === "break"
              ? cell === 0
                ? `Length ${len} stick, first square (cannot break here)`
                : `Break length ${len} stick after ${cell} unit${cell === 1 ? "" : "s"}`
              : `Select length ${len} stick for remove-n`,
          );
          btn.disabled = state.over || busy || state.turn !== "you";
          btn.addEventListener("click", () => onCell(index, cell));
          row.appendChild(btn);
        }
        list.appendChild(row);
      });
      stage.appendChild(list);
    }

    modeBreak.checked = state.mode === "break";
    modeRemove.checked = state.mode === "remove";
    btnMakeMove.disabled = state.over || busy || state.turn !== "you";

    if (state.over) {
      if (state.winner === "you") setStatus("You won — last stick is yours.", "win");
      else setStatus("Computer won — it took the last stick.", "lose");
    } else if (busy) {
      setStatus("Thinking…");
    } else if (state.turn === "you") {
      setStatus(
        state.mode === "break"
          ? "Your turn — click a square to break a stick (not the first square)."
          : "Your turn — click a stick to remove n sticks of that length.",
      );
    } else {
      setStatus("Computer’s turn.");
    }
  }

  function onCell(index, cell) {
    if (busy || state.over || state.turn !== "you") return;
    let next = null;
    if (state.mode === "break") {
      if (cell < 1) {
        setStatus("Break to the right of the cut — not on the first square.");
        return;
      }
      next = S.breakAt(state, index, cell);
      if (!next) {
        setStatus("That break is not allowed.");
        return;
      }
    } else {
      next = S.removeN(state, index);
      if (!next) {
        setStatus("Need n sticks of length n to remove them.");
        return;
      }
    }
    state = next;
    render();
    if (state.over) return;
    scheduleComputer();
  }

  function scheduleComputer() {
    busy = true;
    render();
    window.setTimeout(() => {
      state = S.playComputer(state, Math.random);
      busy = false;
      render();
    }, 280);
  }

  modeBreak.addEventListener("change", () => {
    if (modeBreak.checked) {
      state = { ...state, mode: "break" };
      render();
    }
  });
  modeRemove.addEventListener("change", () => {
    if (modeRemove.checked) {
      state = { ...state, mode: "remove" };
      render();
    }
  });

  btnStandard.addEventListener("click", () => {
    busy = false;
    state = S.start({ mode: state.mode });
    render();
  });

  btnReset.addEventListener("click", () => {
    busy = false;
    state = S.start({ randomStart: true, mode: state.mode });
    render();
  });

  btnMakeMove.addEventListener("click", () => {
    if (busy || state.over || state.turn !== "you") return;
    state = { ...state, turn: "computer" };
    scheduleComputer();
  });

  window.addEventListener("themechange", render);
  render();
})();
