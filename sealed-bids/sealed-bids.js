"use strict";

/*
 * Browser UI for the Method of Sealed Bids demo. The stage is a table: each
 * column is a bidder, each of the first rows is an item, and the last four
 * rows are each bidder's total, fair share, amount owed and final cash.
 * Click the left half of a bid to lower it, the right half to raise it; arrow
 * keys work too. The winning bid in each item is highlighted in words (a
 * "W" badge) as well as by colour. All arithmetic is in sealed-bids-core.js.
 */

(() => {
  const C = SealedBidsCore;
  const tableEl = document.getElementById("table");
  const statusEl = document.getElementById("status");
  const playersInput = document.getElementById("playersInput");
  const itemsInput = document.getElementById("itemsInput");
  let state = C.start();
  let result = C.compute(state);
  let builtPlayers = 0;
  let builtItems = 0;
  const bidButtons = [];

  /** Show a line under the game. "done" is how the record sees a demo play. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function cell(row, text, className) {
    const td = document.createElement("td");
    td.textContent = text;
    if (className) td.className = className;
    return td;
  }

  /** The table is rebuilt only when its shape changes, so focus survives. */
  function buildTable() {
    tableEl.replaceChildren();
    bidButtons.length = 0;

    const head = document.createElement("tr");
    head.appendChild(cell("th", "Bidder", "row-label"));
    for (let p = 0; p < state.players; p++) {
      head.appendChild(cell("th", C.LETTERS[p], "col-label"));
    }
    tableEl.appendChild(head);

    for (let i = 0; i < state.items; i++) {
      const row = document.createElement("tr");
      row.appendChild(cell("th", `Item ${i + 1}`, "row-label"));
      for (let p = 0; p < state.players; p++) {
        const td = document.createElement("td");
        const button = document.createElement("button");
        button.type = "button";
        button.className = "bid";
        button.dataset.player = String(p);
        button.dataset.item = String(i);
        button.addEventListener("click", (event) => {
          const rect = button.getBoundingClientRect();
          const x = event.clientX ? event.clientX - rect.left : rect.width / 2;
          setBid(p, i, x >= rect.width / 2 ? 1 : -1);
        });
        button.addEventListener("keydown", (event) => {
          if (["ArrowUp", "ArrowRight", "+"].includes(event.key)) {
            event.preventDefault();
            setBid(p, i, 1);
          } else if (["ArrowDown", "ArrowLeft", "-"].includes(event.key)) {
            event.preventDefault();
            setBid(p, i, -1);
          }
        });
        const badge = document.createElement("span");
        badge.className = "win-badge";
        badge.textContent = "W";
        td.append(button, badge);
        row.appendChild(td);
        bidButtons.push(button);
      }
      tableEl.appendChild(row);
    }

    for (const [key, label] of [
      ["total", "Total"], ["fair", "Fair share"], ["owed", "Owe(s/d)"], ["cash", "Cash"],
    ]) {
      const row = document.createElement("tr");
      row.className = "result-row";
      row.appendChild(cell("th", label, "row-label"));
      for (let p = 0; p < state.players; p++) row.appendChild(cell("td", "", key));
      tableEl.appendChild(row);
    }
    builtPlayers = state.players;
    builtItems = state.items;
  }

  function render() {
    if (builtPlayers !== state.players || builtItems !== state.items) buildTable();
    result = C.compute(state);

    bidButtons.forEach((button) => {
      const p = Number(button.dataset.player);
      const i = Number(button.dataset.item);
      const value = state.bids[p][i];
      button.textContent = String(value);
      button.setAttribute("aria-label", `Bidder ${C.LETTERS[p]}, item ${i + 1}: ${value}. ` +
        "Click the left half to lower it, the right half to raise it. Arrow keys work too.");
      const won = result.winners[i] === p;
      button.parentElement.classList.toggle("winner", won);
      button.parentElement.querySelector(".win-badge").setAttribute("aria-label", won ? "Winning bid" : "");
    });

    for (const [key, values] of [
      ["total", result.totals],
      ["fair", result.fairText],
      ["owed", result.owedText],
      ["cash", result.cashText],
    ]) {
      tableEl.querySelectorAll(`td.${key}`).forEach((td, p) => {
        td.textContent = String(values[p]);
      });
    }
    tableEl.querySelectorAll("td.owed").forEach((td, p) => {
      td.classList.toggle("negative", result.owed[p] < 0);
    });
    tableEl.querySelectorAll("td.cash").forEach((td, p) => {
      td.classList.toggle("negative", result.cash[p] < 0);
    });

    playersInput.value = String(state.players);
    itemsInput.value = String(state.items);
    say(`${state.message} Left over: ${C.cutDigits(result.surplus)}. ` +
      `The final payments add up to zero.`, C.result(state));

    // The position, for the player's record and the tutor: plain JSON only.
    if (window.Track) {
      window.Track.state({
        players: state.players,
        items: state.items,
        bids: state.bids.map((row) => row.slice()),
        winners: result.winners.slice(),
        surplus: result.surplus,
        cash: result.cash.slice(),
        explored: state.explored,
      });
    }
  }

  function setBid(player, item, delta) {
    state = C.setBid(state, player, item, state.bids[player][item] + delta);
    render();
  }

  function changePlayers(value) {
    state = C.setPlayers(state, Number(value));
    render();
  }

  function changeItems(value) {
    state = C.setItems(state, Number(value));
    render();
  }

  document.getElementById("playersDown").addEventListener("click", () => changePlayers(state.players - 1));
  document.getElementById("playersUp").addEventListener("click", () => changePlayers(state.players + 1));
  document.getElementById("itemsDown").addEventListener("click", () => changeItems(state.items - 1));
  document.getElementById("itemsUp").addEventListener("click", () => changeItems(state.items + 1));
  playersInput.addEventListener("change", () => changePlayers(playersInput.value));
  itemsInput.addEventListener("change", () => changeItems(itemsInput.value));
  document.getElementById("newBidsBtn").addEventListener("click", () => {
    state = C.reset(state);
    render();
  });

  render();
})();
