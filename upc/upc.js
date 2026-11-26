"use strict";

/*
 * The page for UPC: drawing and input only; the rules are in upc-core.js.
 * The twelve digits are a row of buttons over a drawing of the 95 bars. The
 * first eleven are real buttons: press the left half to raise that digit by
 * one, the right half to lower it (both wrap round), or press a key. The
 * twelfth digit is worked out by the core and shown as a computed label.
 */

(function () {
  const Core = UpcCore;
  const digitsEl = document.getElementById("digits");
  const bars = document.getElementById("bars");
  const sumEl = document.getElementById("sum");
  const statusEl = document.getElementById("status");
  const resetBtn = document.getElementById("resetBtn");
  const SVGNS = "http://www.w3.org/2000/svg";
  let state = Core.start({});
  let focusAt = null;

  /** A line under the game. "done" also tells the player's record it was explored. */
  function say(text, kind) {
    statusEl.textContent = text;
    statusEl.classList.remove("win", "lose", "done");
    kind = kind || Core.result(state);
    if (kind) statusEl.classList.add(kind);
  }

  const el = (name, attrs, text) => {
    const e = document.createElementNS(SVGNS, name);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (text) e.textContent = text;
    return e;
  };

  function drawBars() {
    bars.textContent = "";
    bars.appendChild(el("rect", { x: 0, y: 0, width: 105, height: 64, class: "paper" }));
    let x = 5;
    for (const p of Core.parts(state)) {
      p.bits.forEach((b, k) => {
        if (!b) return;
        const tall = p.kind === "guard";
        bars.appendChild(el("rect", {
          x: x + k, y: tall ? 5 : 12, width: 1, height: tall ? 54 : 40, class: "bar",
        }));
      });
      x += p.bits.length;
    }
  }

  function render() {
    drawBars();
    digitsEl.textContent = "";
    state.digits.forEach((v, i) => {
      if (i < Core.CHOOSABLE) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "digit";
        b.dataset.i = i;
        b.textContent = String(v);
        b.setAttribute("aria-label", `Digit ${i + 1}: ${v}. Click the left half to add one, the right half to take one away; or press a digit, Up, Down, Left or Right.`);
        digitsEl.appendChild(b);
      } else {
        const s = document.createElement("span");
        s.className = "digit check";
        s.textContent = String(v);
        s.setAttribute("aria-label", `Check digit: ${v}, worked out from the other eleven digits.`);
        digitsEl.appendChild(s);
      }
    });
    const terms = state.digits.map((d, i) => (i % 2 === 0 && i < Core.CHOOSABLE ? "3×" : "") + d);
    const total = 3 * Core.sums(state.digits).odd + Core.sums(state.digits).even + state.digits[11];
    sumEl.textContent = terms.join(" + ") + " = " + total + " (a multiple of ten)";
    if (focusAt !== null) {
      const b = digitsEl.querySelector(`button[data-i="${focusAt}"]`);
      if (b) b.focus();
      focusAt = null;
    }
    // The position, for the player's record and the tutor.
    if (window.Track) window.Track.state(state);
  }

  function apply(m, note) {
    const next = Core.move(state, m);
    if (!next) return false;
    state = next;
    render();
    say(note);
    return true;
  }

  digitsEl.addEventListener("click", (e) => {
    const b = e.target.closest("button.digit");
    if (!b) return;
    const i = Number(b.dataset.i);
    focusAt = i;
    // The applet's CTKNumber.IsHit: left half raises, right half lowers.
    const rect = b.getBoundingClientRect();
    const delta = e.detail === 0 || e.clientX < rect.left + rect.width / 2 ? 1 : -1;
    apply({ type: "step", i, delta }, `Digit ${i + 1} ${delta > 0 ? "raised" : "lowered"}; the check digit is now ${state.digits[11]}.`);
  });

  digitsEl.addEventListener("keydown", (e) => {
    const b = e.target.closest("button.digit");
    if (!b) return;
    const i = Number(b.dataset.i);
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      focusAt = i;
      apply({ type: "set", i, value: Number(e.key) }, `Digit ${i + 1} set to ${e.key}; the check digit is now ${state.digits[11]}.`);
    } else if (e.key === "ArrowUp" || e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      focusAt = i;
      apply({ type: "step", i, delta: 1 }, `Digit ${i + 1} raised; the check digit is now ${state.digits[11]}.`);
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      focusAt = i;
      apply({ type: "step", i, delta: -1 }, `Digit ${i + 1} lowered; the check digit is now ${state.digits[11]}.`);
    } else if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      const j = Math.max(0, Math.min(Core.CHOOSABLE - 1, i + (e.key === "ArrowRight" ? 1 : -1)));
      const nb = digitsEl.querySelector(`button[data-i="${j}"]`);
      if (nb) nb.focus();
    }
  });

  resetBtn.addEventListener("click", () => {
    state = Core.move(state, { type: "reset" });
    render();
    say("Back to 012345678905.");
  });

  render();
  say("");
})();
