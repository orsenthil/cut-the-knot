#!/usr/bin/env node
"use strict";

/*
 * Logic test for interest-rates/interest-rates-core.js.
 *
 *   1. The page's compounding table for 1000 at 12% over one year, and the
 *      12.36% effective rate for twice-yearly compounding.
 *   2. The loan formula checked by simulating every amortisation payment, and
 *      the investment formula checked by simulating every deposit.
 *   3. Zero interest, validation messages and compounding monotonicity.
 */

import { loadCore, check, equal, done } from "./lib/load-core.mjs";

const C = loadCore("interest-rates/interest-rates-core.js", "InterestRatesCore");
const close = (a, b, eps = 1e-8) => Math.abs(a - b) < eps;

{
  equal("frequency: monthly", C.FREQ.monthly, 12);
  equal("frequency: daily", C.FREQ.daily, 365);
  equal("truncate to cents", C.cents(1125.50881), 1125.5);
  equal("default loan payment mode", C.loanStart().mode, "loan");
  equal("default compounding is monthly", C.loanStart().compoundFreq, 12);

  // The page's table: principal 1000, nominal 12%, one year.
  const expected = [[1, 1120.0], [2, 1123.6], [4, 1125.5], [12, 1126.82]];
  for (const [m, value] of expected) {
    const r = C.accumulation({ principal: 1000, deposit: 0, depositsPerYear: m, interest: 12, years: 1 });
    equal(`${m} compounds a year`, r.accumulated, value);
  }
  check("twice-yearly compounding gives 12.36% effective", close(C.effectiveRate(12, 2), 0.1236));
}

{
  let amortised = 0;
  let accumulated = 0;
  let cases = 0;
  for (const interest of [0, 3.5, 7, 12, 18]) {
    for (const m of [1, 4, 12, 365]) {
      for (const k of [1, 4, 12]) {
        const loan = C.loanPayment({ loan: 5000, years: 7, interest, paymentsPerYear: k, compoundFreq: m });
        let balance = 5000;
        for (let i = 0; i < loan.periods; i++) balance = balance * (1 + loan.ratePerPayment) - loan.exact;
        cases++;
        if (Math.abs(balance) < 1e-6) amortised++;
      }
    }
  }
  equal("all loans checked", cases, 60);
  equal("every payment plan clears the loan", amortised, cases);

  for (const interest of [0, 2.25, 5, 9.75]) {
    for (const f of [1, 4, 12]) {
      const r = C.accumulation({ principal: 800, deposit: 150, depositsPerYear: f, interest, years: 9 });
      let balance = 800;
      for (let i = 0; i < r.periods; i++) balance = balance * (1 + r.ratePerDeposit) + 150;
      if (close(balance, r.exact, 1e-6)) accumulated++;
    }
  }
  equal("all investments match a period-by-period simulation", accumulated, 12);
}

{
  const freeLoan = C.loanPayment({ loan: 1200, years: 2, interest: 0, paymentsPerYear: 12, compoundFreq: 12 });
  equal("zero-interest loan payment", freeLoan.payment, 50);
  const freeInvestment = C.accumulation({ principal: 1000, deposit: 50, depositsPerYear: 4, interest: 0, years: 3 });
  equal("zero-interest accumulation", freeInvestment.accumulated, 1600);

  check("negative interest is rejected", !!C.loanPayment({ loan: 1, years: 1, interest: -1 }).error);
  check("a zero years is rejected", !!C.accumulation({ principal: 1, years: 0, interest: 5 }).error);
  check("an empty investment is rejected", !!C.accumulation({ principal: 0, deposit: 0, years: 5, interest: 5 }).error);
  check("a zero frequency is rejected", !!C.accumulation({ principal: 100, years: 5, interest: 5, depositsPerYear: 0 }).error);
  check("a zero loan is rejected", !!C.loanPayment({ loan: 0, years: 5, interest: 5 }).error);

  let increasing = 0;
  let previous = -Infinity;
  for (const m of [1, 2, 4, 12, 52, 365]) {
    const r = C.accumulation({ principal: 1000, deposit: 0, depositsPerYear: m, interest: 12, years: 1 });
    if (r.exact > previous) increasing++;
    previous = r.exact;
  }
  equal("more frequent compounding never lowers the balance", increasing, 6);
  check("daily compounding is close to the continuous limit", close(previous, 1000 * Math.E ** 0.12, 0.05));
}

done("interest-rates");
