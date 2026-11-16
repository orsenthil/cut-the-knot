"use strict";

(function () {
  const Core = ScoringMisere2Core;
  const heapsEl = document.getElementById("heaps");
  const statusEl = document.getElementById("status");
  const moveSel = document.getElementById("moveInput");
  const heapSel = document.getElementById("heapInput");
  const backBtn = document.getElementById("backBtn");
  const resetBtn = document.getElementById("resetBtn");

  let state = null;

  function fill(sel, from, to, value) {
    sel.replaceChildren();
    for (let n = from; n <= to; n++) {
      const o = document.createElement("option");
      o.value = String(n);
      o.textContent = String(n);
      sel.appendChild(o);
    }
    sel.value = String(value);
  }
  fill(moveSel, Core.MIN_MOVE, Core.MAX_MOVE, Core.DEFAULT_MOVE);
  fill(heapSel, Core.MIN_HEAP, Core.MAX_HEAP, Core.DEFAULT_HEAP);

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    heapsEl.replaceChildren();
    state.heaps.forEach((n, h) => {
      const row = document.createElement("div");
      row.className = "heap";
      row.setAttribute("role", "group");
      row.setAttribute("aria-label", "Heap " + (h + 1) + ", " + n + " chips");
      for (let i = 0; i < n; i++) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "square";
        const take = n - i;
        btn.disabled = state.over || state.turn !== "you" || take < 1 || take > state.maxMove;
        btn.setAttribute("aria-label", "Remove " + take + " from heap " + (h + 1));
        btn.addEventListener("click", () => playYou(h, take));
        row.appendChild(btn);
      }
      if (n === 0) {
        const empty = document.createElement("span");
        empty.className = "empty";
        empty.textContent = "empty";
        row.appendChild(empty);
      }
      heapsEl.appendChild(row);
    });
    backBtn.disabled = state.history.length === 0 || state.over;
    if (window.Track) window.Track.state(Core.snapshot(state));
  }

  function finishMsg() {
    say(
      state.winner === "you" ? "You won!" : "I won!",
      state.winner === "you" ? "win" : "lose",
    );
  }

  function playYou(heap, take) {
    state = Core.applyMove(state, heap, take);
    if (state.note) {
      say(state.note);
      render();
      return;
    }
    if (state.over) {
      finishMsg();
      render();
      return;
    }
    say("Thinking…");
    render();
    window.setTimeout(() => {
      state = Core.playComputer(state);
      if (state.over) finishMsg();
      else say("Your move — click the first chip you want to remove.");
      render();
    }, 280);
  }

  function newGame() {
    state = Core.start({
      maxMove: Number(moveSel.value),
      maxHeap: Number(heapSel.value),
    });
    say("Your move — click the first chip you want to remove.");
    render();
  }

  resetBtn.addEventListener("click", newGame);
  backBtn.addEventListener("click", () => {
    state = Core.undo(state);
    say("Took back. Your move.");
    render();
  });
  moveSel.addEventListener("change", newGame);
  heapSel.addEventListener("change", newGame);

  newGame();
})();
