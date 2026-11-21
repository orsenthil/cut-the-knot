"use strict";

/*
 * The page for Fraction Comparison Sped up: drawing and input only; the rules are in
 * fc-exercise-core.js. Two fractions and, between them, a middle fraction whose digits are
 * buttons: press a digit to raise it (or select it and type a digit), until the middle fraction
 * lies between the two, then press Check.
 */

(function () {
  const Core = FcExerciseCore;
  const rowEl = document.getElementById("row");
  const scoreEl = document.getElementById("score");
  const statusEl = document.getElementById("status");
  const checkBtn = document.getElementById("checkBtn");
  const commonBtn = document.getElementById("commonBtn");
  const simplifyBtn = document.getElementById("simplifyBtn");
  const nextBtn = document.getElementById("nextBtn");
  const restartBtn = document.getElementById("restartBtn");
  const SIGN = { "-1": "<", "0": "=", "1": ">" };

  const fresh = () => (Date.now() % 1000003) + 1;
  let state = Core.start({ seed: fresh() });
  let focusAt = null;

  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    kind = kind || Core.result(state);
    if (kind) statusEl.classList.add(kind);
  }
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };

  function fixedFraction(n, d, label) {
    const f = el("div", "frac");
    f.setAttribute("role", "img"); f.setAttribute("aria-label", `${label}: ${n} over ${d}`);
    f.append(el("span", "num", String(n)), el("span", "bar"), el("span", "den", String(d)));
    return f;
  }

  function digits(which, label) {
    const wrap = el("div", "digits"); wrap.setAttribute("role", "group"); wrap.setAttribute("aria-label", `${label} ${state[which]}`);
    const v = String(state[which]).padStart(2, "0");
    [...v].forEach((ch, k) => {
      const place = 1 - k;
      const b = el("button", "digit", ch); b.type = "button"; b.dataset.which = which; b.dataset.place = place;
      b.disabled = state.checked;
      b.setAttribute("aria-label", `${label}, ${place === 1 ? "tens" : "units"} digit ${ch}. Press to raise it, or type a digit.`);
      wrap.appendChild(b);
    });
    return wrap;
  }

  function render() {
    rowEl.textContent = "";
    const sg = Core.signs(state);
    const shown = state.checked;
    rowEl.appendChild(fixedFraction(state.n1, state.d1, "First fraction"));
    rowEl.appendChild(el("span", "sign", shown ? SIGN[sg.first] : "?"));
    const mid = el("div", "frac mid");
    mid.append(digits("n0", "Middle fraction numerator"), el("span", "bar"), digits("d0", "Middle fraction denominator"));
    rowEl.appendChild(mid);
    rowEl.appendChild(el("span", "sign", shown ? SIGN[sg.second] : "?"));
    rowEl.appendChild(fixedFraction(state.n2, state.d2, "Second fraction"));
    scoreEl.textContent = `Problems: ${state.problems}   Correct answers: ${state.solved}`;
    checkBtn.disabled = state.checked; commonBtn.disabled = state.checked; simplifyBtn.disabled = state.checked;
    if (focusAt) { const b = rowEl.querySelector(`button.digit[data-which="${focusAt[0]}"][data-place="${focusAt[1]}"]`); if (b && !b.disabled) b.focus(); focusAt = null; }
    if (window.Track) window.Track.state(state);
  }

  function apply(m, note) {
    const next = Core.move(state, m);
    if (!next) return false;
    state = next; render(); if (note !== undefined) say(note);
    return true;
  }

  rowEl.addEventListener("click", (e) => {
    const b = e.target.closest("button.digit"); if (!b) return;
    focusAt = [b.dataset.which, b.dataset.place];
    apply({ type: "digit", which: b.dataset.which, place: Number(b.dataset.place) }, "");
  });
  rowEl.addEventListener("keydown", (e) => {
    const b = e.target.closest("button.digit"); if (!b) return;
    const which = b.dataset.which, place = Number(b.dataset.place);
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault(); focusAt = [which, place];
      const cur = state[which], unit = 10 ** place;
      apply({ type: "set", which, value: cur - (Math.floor(cur / unit) % 10) * unit + Number(e.key) * unit }, "");
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault(); const o = which === "n0" ? "d0" : "n0"; const nb = rowEl.querySelector(`button.digit[data-which="${o}"][data-place="${place}"]`); if (nb) nb.focus();
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault(); const nb = rowEl.querySelector(`button.digit[data-which="${which}"][data-place="${place === 1 ? 0 : 1}"]`); if (nb) nb.focus();
    }
  });

  checkBtn.addEventListener("click", () => {
    if (state.d0 < 1) { say("The middle denominator cannot be 0."); return; }
    if (!apply({ type: "check" }, "")) return;
    const sg = Core.signs(state);
    say(`${state.response} ${state.n1}/${state.d1} ${SIGN[sg.first]} ${state.n0}/${state.d0} ${SIGN[sg.second]} ${state.n2}/${state.d2}.` + (state.response === "Correct!" ? " The middle fraction is between the two." : " The middle fraction has to be between the other two."));
    nextBtn.focus();
  });
  commonBtn.addEventListener("click", () => apply({ type: "common" }, "Both fractions now have the least common denominator."));
  simplifyBtn.addEventListener("click", () => apply({ type: "simplify" }, "All three fractions reduced as far as they go."));
  nextBtn.addEventListener("click", () => { state = Core.move(state, { type: "next", seed: fresh() }); render(); say("A new pair. Put a fraction between them."); });
  restartBtn.addEventListener("click", () => { state = Core.move(state, { type: "restart", seed: fresh() }); render(); say("Scores reset."); });

  render();
  say("Change the middle fraction so that it lies between the other two, then press Check.");
})();
