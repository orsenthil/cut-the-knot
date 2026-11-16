"use strict";

/*
 * UI for Proizvolov's Identity. The pool is a wrap of number buttons; picked
 * values fill the left column (decreasing) and, once N are chosen, the right
 * column (increasing) with the absolute-difference table underneath.
 */

(function () {
  const Core = ProizvolovGameCore;
  const poolEl = document.getElementById("pool");
  const leftEl = document.getElementById("leftCol");
  const rightEl = document.getElementById("rightCol");
  const sumBox = document.getElementById("sumBox");
  const statusEl = document.getElementById("status");
  const nInput = document.getElementById("nInput");
  const clueInput = document.getElementById("clueInput");
  const backBtn = document.getElementById("backBtn");
  const newBtn = document.getElementById("newBtn");

  let state = null;
  let focusValue = 1;

  for (let n = Core.MIN_N; n <= Core.MAX_N; n++) {
    const o = document.createElement("option");
    o.value = String(n);
    o.textContent = String(n);
    nInput.appendChild(o);
  }
  nInput.value = String(Core.DEFAULT_N);

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function band(n, N) {
    return n <= N ? "low" : "high";
  }

  function render() {
    const done = Core.complete(state);
    const avail = new Set(Core.available(state));
    const L = Core.left(state);
    const R = Core.right(state);

    poolEl.innerHTML = "";
    for (const v of state.pool) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "num";
      btn.textContent = String(v);
      btn.dataset.value = String(v);
      const free = avail.has(v) && !done;
      btn.disabled = !free;
      btn.setAttribute(
        "aria-label",
        free ? "Pick " + v : state.picked.includes(v) ? v + ", already picked" : String(v),
      );
      btn.tabIndex = free && v === focusValue ? 0 : -1;
      if (free) btn.addEventListener("click", () => onPick(v));
      btn.addEventListener("keydown", onPoolKey);
      poolEl.appendChild(btn);
    }

    leftEl.innerHTML = "";
    for (const v of L) {
      const li = document.createElement("li");
      li.textContent = String(v);
      if (done) li.classList.add(band(v, state.n));
      leftEl.appendChild(li);
    }

    rightEl.innerHTML = "";
    for (const v of R) {
      const li = document.createElement("li");
      li.textContent = String(v);
      if (done) li.classList.add(band(v, state.n));
      rightEl.appendChild(li);
    }

    clueInput.disabled = !done;
    backBtn.disabled = state.picked.length === 0;

    if (done) {
      const pairs = Core.pairsSplitLowHigh(state);
      const sum = Core.pairSum(state);
      let html = "<table><thead><tr><th>|a − b|</th>" +
        (state.clue ? "<th>clue</th>" : "") +
        "</tr></thead><tbody>";
      for (const p of pairs) {
        html += "<tr><td>|" + p.a + " − " + p.b + "| = " + p.abs + "</td>";
        if (state.clue) {
          const hi = Math.max(p.a, p.b);
          const lo = Math.min(p.a, p.b);
          html += "<td>" + hi + " − " + lo + " = " + p.abs + "</td>";
        }
        html += "</tr>";
      }
      html += "</tbody></table>";
      html +=
        '<p class="total">Sum = ' +
        sum +
        " = N² = " +
        state.n +
        "²</p>";
      sumBox.innerHTML = html;
      sumBox.hidden = false;
      say("Every split gives N² = " + Core.expected(state.n) + ".", "done");
    } else {
      sumBox.hidden = true;
      sumBox.innerHTML = "";
      const left = state.n - state.picked.length;
      say(
        left === state.n
          ? "Pick " + state.n + " numbers from the pool."
          : "Pick " + left + " more.",
      );
    }

    if (window.Track) window.Track.state(Core.snapshot(state));
  }

  function focusButton() {
    const btn = poolEl.querySelector('.num[data-value="' + focusValue + '"]:not(:disabled)');
    if (btn) btn.focus();
    else {
      const first = poolEl.querySelector(".num:not(:disabled)");
      if (first) first.focus();
    }
  }

  function onPick(v) {
    focusValue = v;
    state = Core.pick(state, v);
    render();
    if (!Core.complete(state)) focusButton();
  }

  function onPoolKey(ev) {
    const v = Number(ev.currentTarget.dataset.value);
    const free = Core.available(state);
    if (!free.length) return;
    if (ev.key === "ArrowRight" || ev.key === "ArrowLeft") {
      ev.preventDefault();
      const i = free.indexOf(v);
      const next =
        ev.key === "ArrowRight"
          ? free[(i + 1) % free.length]
          : free[(i - 1 + free.length) % free.length];
      focusValue = next;
      render();
      focusButton();
    } else if (ev.key === "Enter" || ev.key === " ") {
      ev.preventDefault();
      onPick(v);
    }
  }

  function newGame() {
    state = Core.start({ n: Number(nInput.value), clue: clueInput.checked });
    focusValue = 1;
    clueInput.checked = false;
    state = Core.setClue(state, false);
    say("Pick " + state.n + " numbers from the pool.");
    render();
  }

  newBtn.addEventListener("click", newGame);
  nInput.addEventListener("change", newGame);
  backBtn.addEventListener("click", () => {
    state = Core.undo(state);
    render();
    focusButton();
  });
  clueInput.addEventListener("change", () => {
    state = Core.setClue(state, clueInput.checked);
    render();
  });

  newGame();
})();
