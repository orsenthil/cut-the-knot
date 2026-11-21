"use strict";

/* Browser UI: loan and investment calculators with live amortisation bars. */
(() => {
  const C = InterestRatesCore;
  const resultEl = document.getElementById("result");
  const detailEl = document.getElementById("detail");
  const barEl = document.getElementById("bar");
  const status = document.getElementById("status");
  const loanFields = document.getElementById("loanFields");
  const investFields = document.getElementById("investFields");
  const modeRadios = [...document.querySelectorAll('input[name="mode"]')];
  const payRadios = [...document.querySelectorAll('input[name="payFreq"]')];
  const compRadios = [...document.querySelectorAll('input[name="compFreq"]')];
  const computeBtn = document.getElementById("computeBtn");
  const ids = {
    loan: ["loanAmount", "loanYears", "loanInterest"],
    invest: ["principal", "deposit", "depositFreq", "investInterest", "investYears"],
  };

  function readState() {
    const mode = modeRadios.find((r) => r.checked)?.value || "loan";
    if (mode === "loan") {
      return {
        mode,
        loan: Number(document.getElementById("loanAmount").value),
        years: Number(document.getElementById("loanYears").value),
        interest: Number(document.getElementById("loanInterest").value),
        paymentsPerYear: Number(payRadios.find((r) => r.checked)?.value || 1),
        compoundFreq: Number(compRadios.find((r) => r.checked)?.value || 12),
      };
    }
    return {
      mode,
      principal: Number(document.getElementById("principal").value),
      deposit: Number(document.getElementById("deposit").value),
      depositsPerYear: Number(document.getElementById("depositFreq").value),
      interest: Number(document.getElementById("investInterest").value),
      years: Number(document.getElementById("investYears").value),
    };
  }

  function showBar(first, second, firstLabel, secondLabel) {
    barEl.replaceChildren();
    const total = first + second || 1;
    for (const [amount, label, cls] of [[first, firstLabel, "bar-main"], [second, secondLabel, "bar-extra"]]) {
      const part = document.createElement("span");
      part.className = cls;
      part.style.flexGrow = String(amount / total);
      part.setAttribute("aria-label", `${label}: ${amount.toFixed(2)}`);
      part.title = `${label}: ${amount.toFixed(2)}`;
      barEl.appendChild(part);
    }
  }

  function render() {
    const state = readState();
    const r = C.compute(state);
    if (r.error) {
      resultEl.textContent = "—";
      detailEl.textContent = "";
      status.textContent = r.error;
      barEl.replaceChildren();
      if (window.Track) window.Track.state({ mode: state.mode, error: r.error });
      return;
    }
    if (state.mode === "loan") {
      resultEl.textContent = `${r.payment.toFixed(2)} per payment`;
      detailEl.textContent = `${r.periods} payments of ${r.payment.toFixed(2)} = ${r.totalPaid.toFixed(2)} total, including ${(r.totalPaid - state.loan).toFixed(2)} interest. Effective yearly rate ${(r.effectiveRate * 100).toFixed(2)}%.`;
      showBar(state.loan, Math.max(0, r.totalPaid - state.loan), "Amount borrowed", "Interest paid");
      status.textContent = `Borrow ${state.loan.toFixed(2)} at ${state.interest}% and pay ${r.payment.toFixed(2)} ${r.periods} times.`;
      if (window.Track) window.Track.state({ ...state, payment: r.payment, totalPaid: r.totalPaid });
    } else {
      resultEl.textContent = r.accumulated.toFixed(2);
      detailEl.textContent = `You put in ${r.contributed.toFixed(2)} and earned ${r.interestEarned.toFixed(2)} of interest over ${r.periods} deposits.`;
      showBar(r.contributed, Math.max(0, r.interestEarned), "Money put in", "Interest earned");
      status.textContent = `${r.accumulated.toFixed(2)} accumulated after ${state.years} years at ${state.interest}%.`;
      if (window.Track) window.Track.state({ ...state, accumulated: r.accumulated, contributed: r.contributed });
    }
    status.classList.remove("win", "lose", "done");
    status.classList.add("done");
  }

  function toggleMode() {
    const mode = modeRadios.find((r) => r.checked)?.value || "loan";
    loanFields.hidden = mode !== "loan";
    investFields.hidden = mode !== "investment";
    render();
  }

  modeRadios.forEach((r) => r.addEventListener("change", toggleMode));
  payRadios.forEach((r) => r.addEventListener("change", render));
  compRadios.forEach((r) => r.addEventListener("change", render));
  [...ids.loan, ...ids.invest].forEach((id) => {
    document.getElementById(id).addEventListener("input", render);
  });
  computeBtn.addEventListener("click", render);
  toggleMode();
})();
