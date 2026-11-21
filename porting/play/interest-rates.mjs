// Interest rates demo: compute a loan, change compounding and payment
// frequency, then switch to investment and edit its inputs.
// Run with: NODE_PATH=$(npm root -g) node porting/play.mjs interest-rates

export default async ({ page, first, log, shot, text }) => {
  log("loan:", await text("#result"), "|", await text("#detail"));
  await shot("loan");

  if (first) {
    await page.check('input[name="compFreq"][value="1"]');
    await page.check('input[name="payFreq"][value="12"]');
    log("yearly compounding, monthly payments:", await text("#result"));
    await shot("loan-monthly");
  }

  await page.fill("#loanInterest", "0");
  log("zero interest:", await text("#result"), "|", await text("#detail"));
  await shot("zero");

  await page.check('input[name="mode"][value="investment"]');
  log("investment:", await text("#result"), "|", await text("#detail"));
  await shot("investment");

  if (first) {
    await page.selectOption("#depositFreq", "12");
    await page.fill("#investInterest", "7");
    log("monthly deposits at 7%:", await text("#result"));
    await shot("investment-monthly");
  }
};
