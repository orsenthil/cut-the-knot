"use strict";

/* Browser UI: cycle ISBN cells, see the check digit and the EAN-13 barcode. */
(() => {
  const C = IsbnEncodingCore;
  const cellsEl = document.getElementById("cells");
  const status = document.getElementById("status");
  const eanText = document.getElementById("eanText");
  const bars = document.getElementById("bars");
  const resetBtn = document.getElementById("resetBtn");
  const SVG_NS = "http://www.w3.org/2000/svg";
  let state = null;

  function render() {
    cellsEl.replaceChildren();
    const r = C.analyze(state);
    r.symbols.forEach((symbol, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "isbn-cell" + (symbol === "-" ? " hyphen" : "") + (i === 12 ? " check" : "");
      btn.textContent = symbol;
      btn.disabled = i === 12;
      btn.setAttribute("aria-label", i === 12
        ? `Computed check digit ${symbol}`
        : `Position ${i + 1}: ${symbol}. Click to cycle through digits and hyphen.`);
      if (i < 12) btn.addEventListener("click", () => {
        state = C.advance(state, i);
        render();
        const again = cellsEl.children[i];
        if (again) again.focus();
      });
      cellsEl.appendChild(btn);
    });

    bars.replaceChildren();
    r.modules.forEach((bit, i) => {
      const rect = document.createElementNS(SVG_NS, "rect");
      rect.setAttribute("x", String(i * 2));
      rect.setAttribute("y", "0");
      rect.setAttribute("width", bit ? "2" : "2");
      rect.setAttribute("height", "70");
      rect.setAttribute("class", bit ? "module on" : "module off");
      bars.appendChild(rect);
    });
    eanText.textContent = r.ean.length === 13 ? r.ean.join("") : "———";

    if (!r.valid) {
      const reasons = [];
      if (!r.formatValid) reasons.push("exactly three hyphens, none together, with one before the check digit");
      if (r.digits.length !== 9) reasons.push("nine digits");
      if (!r.sumValid) reasons.push("the mod-11 check");
      status.textContent = `Not a valid ISBN yet: needs ${reasons.join("; ")}.`;
      status.className = "lose";
    } else {
      status.textContent = `Valid ISBN. The check digit ${r.checkDigit} makes 10·d₁ + 9·d₂ + … + d₁₀ a multiple of 11.`;
      status.className = "win";
    }
    if (window.Track) window.Track.state({
      symbols: state.symbols.slice(), enteredCheck: state.symbols[12],
      digits: r.digits.slice(), checkDigit: r.checkDigit,
      formatValid: r.formatValid, sumValid: r.sumValid, valid: r.valid, ean: r.ean.slice(),
    });
  }

  resetBtn.addEventListener("click", () => { state = C.start(); render(); });
  state = C.start();
  render();
})();
