"use strict";

/*
 * The page for Signs and Sums in a Sequence: drawing and input only. The rules
 * are in signs-and-sums-core.js. The stage is three grids that share columns:
 * the row of numbers with an up and a down button on each, the sums of every
 * three neighbours (each under the middle one of its three), and the total.
 */

(function () {
  const Core = SignsAndSumsCore;
  const stageEl = document.getElementById("stage");
  const statusEl = document.getElementById("status");
  const newBtn = document.getElementById("newBtn");
  const showBtn = document.getElementById("showBtn");
  const lengthSel = document.getElementById("lengthSel");

  let state = null;
  let announced = false;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  for (let n = Core.MIN_N; n <= Core.MAX_N; n++) {
    const o = document.createElement("option");
    o.value = String(n);
    o.textContent = String(n);
    lengthSel.appendChild(o);
  }

  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function gridRow(label) {
    stageEl.appendChild(el("div", "row-label", label));
    const row = el("div", "row");
    row.style.setProperty("--n", String(state.n));
    stageEl.appendChild(row);
    return row;
  }

  function render() {
    stageEl.textContent = "";
    const sums = Core.tripleSums(state.values);
    const total = Core.total(state.values);

    const up = gridRow("Sequence (press the arrows to change a number)");
    state.values.forEach((v, i) => {
      const b = el("button", "step", "▲");
      b.type = "button";
      b.setAttribute("aria-label", `Increase number ${i + 1}`);
      b.addEventListener("click", () => change(i, 1));
      up.appendChild(b);
    });
    const mid = el("div", "row");
    mid.style.setProperty("--n", String(state.n));
    state.values.forEach((v, i) => {
      const c = el("div", "cell " + (v < 0 ? "neg" : "pos"), String(v));
      c.setAttribute("aria-label", `Number ${i + 1}: ${v}`);
      mid.appendChild(c);
    });
    stageEl.appendChild(mid);
    const down = el("div", "row");
    down.style.setProperty("--n", String(state.n));
    state.values.forEach((v, i) => {
      const b = el("button", "step", "▼");
      b.type = "button";
      b.setAttribute("aria-label", `Decrease number ${i + 1}`);
      b.addEventListener("click", () => change(i, -1));
      down.appendChild(b);
    });
    stageEl.appendChild(down);

    const sr = gridRow("Sums of every three neighbours");
    sums.forEach((s, i) => {
      const c = el("div", "cell sum " + (s > 0 ? "ok" : "no"), String(s));
      c.style.gridColumn = String(i + 2);
      c.setAttribute("aria-label", `Sum of numbers ${i + 1} to ${i + 3}: ${s}`);
      sr.appendChild(c);
    });

    const tr = gridRow("Total");
    const t = el("div", "cell total " + (total < 0 ? "neg" : ""), String(total));
    t.setAttribute("aria-label", `Total: ${total}`);
    tr.appendChild(t);

    if (window.Track) window.Track.state(state);
    announce();
  }

  function announce() {
    if (Core.solved(state)) {
      if (!announced) say("Every three in a row add up to more than zero, yet the total is negative.", "done");
      announced = true;
    } else {
      announced = false;
      if (Core.allTriplesPositive(state.values)) {
        say(Core.verdict(state.n) === "never"
          ? "Every three are positive, so the total is positive too. With this length it cannot be negative."
          : "Every three are positive, but the total is not negative yet. This length allows it.");
      } else {
        say("");
      }
    }
  }

  function change(i, d) {
    const next = Core.nudge(state, i, d);
    if (!next) return;
    state = next;
    render();
  }

  function newRow() {
    state = Core.start({ n: Number(lengthSel.value) });
    announced = false;
    say("");
    render();
  }

  newBtn.addEventListener("click", newRow);
  lengthSel.addEventListener("change", newRow);
  showBtn.addEventListener("click", () => {
    const n = Number(lengthSel.value);
    const c = Core.construct(n);
    if (!c) {
      state = Core.start({ n });
      announced = false;
      render();
      say("There is no such row of this length: it splits into groups of three, each positive, so the total is positive.");
      return;
    }
    state = c;
    announced = false;
    render();
  });

  lengthSel.value = "4";
  newRow();
})();
