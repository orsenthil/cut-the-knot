"use strict";

/*
 * The page for Egyptian Multiplication: drawing and input only; the rules are in
 * egyptian-multiplication-core.js. The two multiplicands are rows of digit
 * buttons (press a digit to raise it); below them is the table of powers of two
 * and doubles, the chosen rows marked, and the sum that gives the product.
 */

(function () {
  const Core = EgyptianMultiplicationCore;
  const numsEl = document.getElementById("nums");
  const tableEl = document.getElementById("table");
  const sumEl = document.getElementById("sum");
  const statusEl = document.getElementById("status");
  const digitsIn = document.getElementById("digitsIn");
  const autoBox = document.getElementById("autoBox");
  const binBox = document.getElementById("binBox");
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
    wrap.setAttribute("aria-label", `${which === "a" ? "First" : "Second"} multiplicand ${state[which]}`);
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
    const x = document.createElement("span"); x.className = "times"; x.textContent = "×"; x.setAttribute("aria-hidden", "true");
    numsEl.appendChild(x);
    numsEl.appendChild(numberRow("b"));
    const v = Core.view(state);
    tableEl.textContent = "";
    const head = document.createElement("tr");
    for (const t of [state.binary ? `1 | 2 | ... (${state.a} = ${v.binary} in binary)` : "Powers of 2", String(state.b) + " doubled", ""]) { const th = document.createElement("th"); th.textContent = t; head.appendChild(th); }
    head.lastChild.className = "sr-only"; head.lastChild.textContent = "Used";
    tableEl.appendChild(head);
    v.rows.forEach((r) => {
      const tr = document.createElement("tr");
      tr.className = r.chosen ? "chosen" : "other";
      const td1 = document.createElement("td"), td2 = document.createElement("td"), td3 = document.createElement("td");
      td1.textContent = String(r.power); td2.textContent = String(r.double); td3.textContent = r.chosen ? "✓" : ""; td3.setAttribute("aria-label", r.chosen ? "used" : "not used");
      td3.className = "tag";
      tr.append(td1, td2, td3); tableEl.appendChild(tr);
    });
    sumEl.textContent = `${v.chosen.join(" + ")} = ${v.sumOfPowers}, so ${state.a} × ${state.b} = ${v.rows.filter((r) => r.chosen).map((r) => r.double).join(" + ")} = ${v.product}`;
    digitsIn.value = String(state.digits); autoBox.checked = state.autonomous; binBox.checked = state.binary;
    if (focusAt) { const b = numsEl.querySelector(`button.digit.${focusAt[0]}[data-place="${focusAt[1]}"]`); if (b) b.focus(); focusAt = null; }
    if (window.Track) window.Track.state(state);
  }

  function apply(m, note) {
    const next = Core.move(state, m);
    if (!next) return false;
    state = next; render(); say(note); return true;
  }

  numsEl.addEventListener("click", (e) => {
    const b = e.target.closest("button.digit"); if (!b) return;
    focusAt = [b.dataset.which, b.dataset.place];
    if (!apply({ type: "digit", which: b.dataset.which, place: Number(b.dataset.place) }, "")) say("The first number cannot be 0.");
  });
  numsEl.addEventListener("keydown", (e) => {
    const b = e.target.closest("button.digit"); if (!b) return;
    const which = b.dataset.which, place = Number(b.dataset.place);
    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault(); focusAt = [which, place];
      const cur = state[which], unit = 10 ** place, v = cur - (Math.floor(cur / unit) % 10) * unit + Number(e.key) * unit;
      if (!apply({ type: "set", which, value: v }, "")) say("The first number cannot be 0.");
    } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      const np = Math.max(0, Math.min(state.digits - 1, place + (e.key === "ArrowLeft" ? 1 : -1)));
      const nb = numsEl.querySelector(`button.digit.${which}[data-place="${np}"]`); if (nb) nb.focus();
    }
  });
  digitsIn.addEventListener("change", () => { if (!apply({ type: "digits", value: digitsIn.value, seed: Date.now() % 100000 + 1 }, "New numbers.")) { say("Digits run from 1 to 4."); digitsIn.value = String(state.digits); } });
  autoBox.addEventListener("change", () => apply({ type: "autonomous", value: autoBox.checked }, autoBox.checked ? "Each digit changes by itself." : "A digit raises the whole number by its place value."));
  binBox.addEventListener("change", () => apply({ type: "binary", value: binBox.checked }, ""));
  newBtn.addEventListener("click", () => { state = Core.move(state, { type: "reset", seed: Date.now() % 100000 + 1 }); render(); say("Two new numbers."); });

  render();
})();
