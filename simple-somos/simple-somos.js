"use strict";

/*
 * The page for Simple Somos Sequence: drawing and input only; the
 * arithmetic is in simple-somos-core.js. Three number boxes set m, a and b
 * (1..100); the terms are listed below, with an alarm when a division is not
 * exact, and a line with the number k that keeps the terms whole.
 */

(function () {
  const Core = SimpleSomosCore;
  const listEl = document.getElementById("terms");
  const statusEl = document.getElementById("status");
  const kEl = document.getElementById("kLine");
  const inputs = { m: document.getElementById("mInput"), a: document.getElementById("aInput"), b: document.getElementById("bInput") };

  let state = Core.start();

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    if (kind) statusEl.classList.add(kind);
  }

  function render() {
    for (const k of ["m", "a", "b"]) inputs[k].value = String(state[k]);
    const r = Core.sequence(state);
    listEl.textContent = "";
    r.terms.forEach((t, i) => {
      const li = document.createElement("li");
      const idx = document.createElement("span");
      idx.className = "idx";
      idx.textContent = `a${i + 1}`;
      const val = document.createElement("span");
      val.className = "val";
      val.textContent = t;
      li.append(idx, val);
      listEl.appendChild(li);
    });
    if (r.alarm) {
      const li = document.createElement("li");
      li.className = "alarm";
      li.textContent = `Alarm: ${r.alarm.num}/${r.alarm.den}`;
      listEl.appendChild(li);
      say(`a${r.terms.length + 1} would be ${r.alarm.num}/${r.alarm.den}, which is not a whole number.`);
    } else {
      say(`All ${r.terms.length} terms are whole numbers.`);
    }
    const [p, q] = Core.invariant(state);
    kEl.textContent = q === 1n
      ? `k = (a² + b² + m)/(ab) = ${p}: each term is ${p} times the one before minus the one before that.`
      : `k = (a² + b² + m)/(ab) = ${p}/${q}, not a whole number.`;
    if (window.Track) window.Track.state(state);
  }

  for (const k of ["m", "a", "b"]) {
    inputs[k].addEventListener("change", () => { state = Core.start({ ...state, [k]: inputs[k].value }); render(); });
  }
  document.querySelectorAll("[data-bump]").forEach((btn) => btn.addEventListener("click", () => {
    const [k, d] = btn.dataset.bump.split(":");
    state = Core.start({ ...state, [k]: state[k] + Number(d) });
    render();
  }));

  render();
})();
