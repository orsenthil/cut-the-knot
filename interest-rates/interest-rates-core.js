"use strict";

/*
 * Interest Rate Calculations, from Bogomolny's applet Interest.
 *
 * The applet has two panels. For a loan it finds the regular payment that
 * clears the debt: with q the yearly rate, m the compounding frequency, k the
 * payment frequency and M the number of years, the rate per payment is
 * r = (1 + q/m)^(m/k) - 1 and the payment is P*r*(1+r)^(kM) / ((1+r)^(kM) - 1).
 * For an investment it finds the accumulation after N deposits a year:
 * P(1 + q/N)^(NM) + p*((1 + q/N)^(NM) - 1)/(q/N).
 *
 * The key idea is that both are geometric series. The logic test reproduces
 * the page's compounding table, checks the loan formula by simulating the
 * amortisation, checks the investment formula by simulating each deposit, and
 * verifies the effective-rate and zero-interest special cases.
 *
 * No document, no window, no storage: one global, InterestRatesCore. The
 * position is plain data, so it can be saved and handed to the tutor.
 */
const InterestRatesCore = (() => {
  const FREQ = { yearly: 1, quarterly: 4, monthly: 12, daily: 365 };

  const num = (v, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  /** Truncate to cents, as the applet does when it prints the result. */
  function cents(amount) {
    return Math.trunc(amount * 100) / 100;
  }

  function loanStart() {
    return { mode: "loan", loan: 1000, years: 10, interest: 12, paymentsPerYear: 1, compoundFreq: 12 };
  }

  function investmentStart() {
    return { mode: "investment", principal: 1000, deposit: 100, depositsPerYear: 1, interest: 5, years: 10 };
  }

  /** The effective yearly rate from compounding m times a year. */
  function effectiveRate(interestPercent, compoundFreq) {
    const q = interestPercent / 100;
    return (1 + q / compoundFreq) ** compoundFreq - 1;
  }

  /** Balance after k payments of `payment` on a loan with per-period rate r. */
  function loanPayment(state) {
    const loan = num(state.loan, 0);
    const years = num(state.years, 0);
    const interest = num(state.interest, 0);
    const k = num(state.paymentsPerYear, 1);
    const m = num(state.compoundFreq, 1);
    if (interest < 0) return { error: "Negative interest?" };
    if (years <= 0) return { error: "Number of years must be positive" };
    if (loan <= 0) return { error: "Loan must be positive" };
    if (k <= 0 || m <= 0) return { error: "Frequencies must be positive" };
    const q = interest / 100;
    const r = q === 0 ? 0 : (1 + q / m) ** (m / k) - 1;
    const n = years * k;
    const amount = r === 0 ? loan / n : loan * r * (1 + r) ** n / ((1 + r) ** n - 1);
    return {
      ratePerPayment: r,
      periods: n,
      effectiveRate: effectiveRate(interest, m),
      payment: cents(amount),
      exact: amount,
      totalPaid: cents(amount * n),
    };
  }

  function accumulation(state) {
    const principal = num(state.principal, 0);
    const deposit = num(state.deposit, 0);
    const f = num(state.depositsPerYear, 0);
    const interest = num(state.interest, 0);
    const years = num(state.years, 0);
    if (interest < 0) return { error: "Negative interest?" };
    if (years <= 0) return { error: "How many years are you going to slave?" };
    if (principal <= 0 && deposit <= 0) return { error: "Are there any deposits or a principal?" };
    if (f <= 0) return { error: "Deposit frequency must be positive" };
    const q = interest / 100;
    const r = q / f;
    const n = years * f;
    const factor = r === 0 ? 1 : (1 + r) ** n;
    const amount = r === 0 ? principal + deposit * n : principal * factor + deposit * (factor - 1) / r;
    return {
      ratePerDeposit: r,
      periods: n,
      factor,
      accumulated: cents(amount),
      exact: amount,
      contributed: principal + deposit * n,
      interestEarned: cents(amount - principal - deposit * n),
    };
  }

  function compute(state) {
    return state.mode === "loan" ? loanPayment(state) : accumulation(state);
  }

  function set(state, key, value) {
    if (key === "mode") return { ...state, mode: value === "investment" ? "investment" : "loan" };
    if (key === "paymentsPerYear" || key === "compoundFreq" || key === "depositsPerYear") {
      return { ...state, [key]: FREQ[value] || num(value, 1) };
    }
    return { ...state, [key]: num(value, state[key]) };
  }

  function start(mode) {
    return mode === "investment" ? investmentStart() : loanStart();
  }

  return { FREQ, cents, loanStart, investmentStart, start, effectiveRate, loanPayment, accumulation, compute, set };
})();
