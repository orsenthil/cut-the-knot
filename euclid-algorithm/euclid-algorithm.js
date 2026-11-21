"use strict";

/*
 * The page for Euclid's Algorithm: drawing and input only; the rules are in
 * euclid-algorithm-core.js. The two numbers are rows of digit buttons (press one to
 * raise it, or type a digit); the division steps and the gcd are listed under them.
 */

(function () {
  const Core = EuclidAlgorithmCore;
  const numsEl = document.getElementById("nums");
  const listEl = document.getElementById("steps");
    const statusEl = document.getElementById("status");
  const digitsIn = document.getElementById("digitsIn");
  const autoBox = document.getElementById("autoBox");
  const newBtn = document.getElementById("newBtn");

  let state = Core.start({ seed: (Date.now() % 100000) + 1 });
  let focusAt = null;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    kind = kind || Core.result(state);
    if (kind) statusEl.classList.add(kind);
  }

  function numberRow(which) {
    const wrap = document.createElement("div");
    wrap.className = "number";
    wrap.setAttribute("role", "group");
    wrap.setAttribute("aria-label", `${which === "a" ? "First" : "Second"} number ${state[which]}`);
    const s = String(state[which]).padStart(state.digits, "0");
    [...s].forEach((ch, k) => {
      const place = state.digits - 1 - k;
      const b = document.createElement("button");
      b.type = "button"; b.className = "digit " + which; b.textContent = ch; b.dataset.which = which; b.dataset.place = place;
      b.setAttribute("aria-label", `${which === "a" ? "First" : "Second"} number, ${place === 0 ? "units" : "10 to the " + place} digit ${ch}. Press to raise it, or type a digit.`);
      wrap.appendChild(b);
    });
    return wrap;
  }

  function render() {
    numsEl.textContent = "";
    numsEl.appendChild(numberRow("a"));
    const x = document.createElement("span"); x.className = "comma"; x.textContent = ","; x.setAttribute("aria-hidden", "true");
    numsEl.appendChild(x);
    numsEl.appendChild(numberRow("b"));
    listEl.textContent = "";
    Core.lines(state).forEach((t, i, all) => {
      const li = document.createElement("li");
      li.textContent = t.replace(/ x /g, " × ");
      if (i === all.length - 1) li.className = "gcd";
      listEl.appendChild(li);
    });
    digitsIn.value = String(state.digits); autoBox.checked = state.autonomous;
    if (focusAt) { const b = numsEl.querySelector(`button.digit.${focusAt[0]}[data-place="${focusAt[1]}"]`); if (b) b.focus(); focusAt = null; }
    if (window.Track) window.Track.state(state);
  }

  function apply(m, note) {
    const next = Core.move(state, m);
    if (!next) return false;
    state = next; render();
    say(state.a === 0 || state.b === 0 ? "Euclid's algorithm needs two numbers that are not 0." : note);
    return true;
  }

  numsEl.addEventListener("click", (e) => {
    const b = e.target.closest("button.digit"); if (!b) return;
    focusAt = [b.dataset.which, b.dataset.place];
    apply({ type: "digit", which: b.dataset.which, place: Number(b.dataset.place) }, "");
  });
  numsEl.addEventListener("keydown", (e) => {
    const b = e.target.closest("button.digit"); if (!b) return;
    const which = b.dataset.which, place = Number(b.dataset.place);
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault(); focusAt = [which, place];
      const cur = state[which], unit = 10 ** place, v = cur - (Math.floor(cur / unit) % 10) * unit + Number(e.key) * unit;
      apply({ type: "set", which, value: v }, "");
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const np = Math.max(0, Math.min(state.digits - 1, place + (e.key === "ArrowLeft" ? 1 : -1)));
      const nb = numsEl.querySelector(`button.digit.${which}[data-place="${np}"]`); if (nb) nb.focus();
    }
  });
  digitsIn.addEventListener("change", () => { if (!apply({ type: "digits", value: digitsIn.value, seed: Date.now() % 100000 + 1 }, "New numbers.")) { say("Digits run from 1 to 4."); digitsIn.value = String(state.digits); } });
  autoBox.addEventListener("change", () => apply({ type: "autonomous", value: autoBox.checked }, autoBox.checked ? "Each digit changes by itself." : "A digit raises the whole number by its place value."));
  newBtn.addEventListener("click", () => { state = Core.move(state, { type: "reset", seed: Date.now() % 100000 + 1 }); render(); say("Two new numbers."); });

  render();
})();
