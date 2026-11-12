import { describe, expect, test } from "vitest";

import {
  AVALANCHE,
  SNOWBALL,
  annualBleed,
  avalancheOrder,
  balanceGrowsFlag,
  cardUtilization,
  monthlyInterest,
  overallUtilization,
  simulatePayoff,
  snowballOrder,
  totalMonthlyBleed,
} from "./finance.js";

// A fixed "now" so every simulation is deterministic.
const TODAY = new Date(2026, 10, 12);

describe("monthlyInterest", () => {
  test("a $1,000 balance at 18% APR costs $15.00 a month", () => {
    expect(monthlyInterest({ balance: 1000, apr_pct: 18 })).toBe(15);
  });

  test("a $2,500 balance at 21% APR costs $43.75 a month", () => {
    expect(monthlyInterest({ balance: 2500, apr_pct: 21 })).toBe(43.75);
  });

  test("the result is rounded to the cent", () => {
    // 1000 * 0.20 / 12 = 16.6666…
    expect(monthlyInterest({ balance: 1000, apr_pct: 20 })).toBe(16.67);
  });

  test("numeric strings are accepted as numbers", () => {
    expect(monthlyInterest({ balance: "1000", apr_pct: "18" })).toBe(15);
  });

  test("a missing balance or APR returns null", () => {
    expect(monthlyInterest({ apr_pct: 18 })).toBeNull();
    expect(monthlyInterest({ balance: 1000 })).toBeNull();
    expect(monthlyInterest(null)).toBeNull();
  });

  test("an empty-string balance returns null instead of zero", () => {
    expect(monthlyInterest({ balance: "", apr_pct: 18 })).toBeNull();
  });
});

describe("totalMonthlyBleed and annualBleed", () => {
  const cards = [
    { balance: 1000, apr_pct: 18 },
    { balance: 2500, apr_pct: 21 },
  ];

  test("the monthly total is the sum of each card's interest", () => {
    expect(totalMonthlyBleed(cards)).toBe(58.75);
  });

  test("the annual total is exactly twelve times the monthly total", () => {
    expect(annualBleed(cards)).toBe(705);
  });

  test("an empty list of cards totals zero", () => {
    expect(totalMonthlyBleed([])).toBe(0);
    expect(annualBleed([])).toBe(0);
  });

  test("one card with unusable numbers makes the whole total null", () => {
    const withBadRow = [...cards, { balance: 500 }];
    expect(totalMonthlyBleed(withBadRow)).toBeNull();
    expect(annualBleed(withBadRow)).toBeNull();
  });

  test("a value that is not a list returns null", () => {
    expect(totalMonthlyBleed(undefined)).toBeNull();
    expect(annualBleed(undefined)).toBeNull();
  });
});

describe("cardUtilization", () => {
  test("a $300 balance on a $1,000 limit is 30% utilized", () => {
    expect(cardUtilization({ balance: 300, credit_limit: 1000 })).toBe(0.3);
  });

  test("a balance over the limit is reported above 100% rather than clamped", () => {
    expect(cardUtilization({ balance: 1200, credit_limit: 1000 })).toBe(1.2);
  });

  test("a zero credit limit returns null", () => {
    expect(cardUtilization({ balance: 300, credit_limit: 0 })).toBeNull();
  });

  test("a negative credit limit returns null", () => {
    expect(cardUtilization({ balance: 300, credit_limit: -1000 })).toBeNull();
  });

  test("a missing credit limit returns null", () => {
    expect(cardUtilization({ balance: 300 })).toBeNull();
  });

  test("a missing balance returns null", () => {
    expect(cardUtilization({ credit_limit: 1000 })).toBeNull();
  });
});

describe("overallUtilization", () => {
  test("overall utilization is total balances over total limits, not the average of each card", () => {
    const cards = [
      { balance: 50, credit_limit: 500 },
      { balance: 9000, credit_limit: 10000 },
    ];
    // 9050 / 10500, where averaging the two ratios would give 0.55.
    expect(overallUtilization(cards)).toBeCloseTo(9050 / 10500, 12);
  });

  test("an empty list of cards returns null because there is no credit line", () => {
    expect(overallUtilization([])).toBeNull();
  });

  test("cards whose limits add up to zero return null", () => {
    expect(
      overallUtilization([
        { balance: 100, credit_limit: 0 },
        { balance: 200, credit_limit: 0 },
      ]),
    ).toBeNull();
  });

  test("one card with a missing limit makes the overall figure null", () => {
    expect(
      overallUtilization([
        { balance: 100, credit_limit: 1000 },
        { balance: 200 },
      ]),
    ).toBeNull();
  });

  test("a value that is not a list returns null", () => {
    expect(overallUtilization(null)).toBeNull();
  });
});

describe("balanceGrowsFlag", () => {
  // $5,000 at 24% APR accrues exactly $100 a month.
  const card = { balance: 5000, apr_pct: 24 };

  test("the flag is raised when a month's interest is more than the minimum payment", () => {
    expect(balanceGrowsFlag({ ...card, min_due: 75 })).toBe(true);
  });

  test("the flag is not raised when the minimum payment is more than a month's interest", () => {
    expect(balanceGrowsFlag({ ...card, min_due: 150 })).toBe(false);
  });

  test("the flag is not raised when the minimum payment exactly equals a month's interest", () => {
    expect(balanceGrowsFlag({ ...card, min_due: 100 })).toBe(false);
  });

  test("the flag is not raised when the minimum payment is missing", () => {
    expect(balanceGrowsFlag(card)).toBe(false);
  });

  test("the flag is not raised when the interest cannot be computed", () => {
    expect(balanceGrowsFlag({ balance: 5000, min_due: 10 })).toBe(false);
  });
});

// Every ordering of a list, for checking that sort results don't depend on
// the order the cards arrived in.
function permutations(items) {
  if (items.length <= 1) return [items];
  return items.flatMap((item, index) =>
    permutations([...items.slice(0, index), ...items.slice(index + 1)]).map(
      (rest) => [item, ...rest],
    ),
  );
}

const ids = (cards) => cards.map((card) => card.id);

describe("avalancheOrder", () => {
  const cards = [
    { id: "low", balance: 4000, apr_pct: 18 },
    { id: "high", balance: 500, apr_pct: 29.99 },
    { id: "mid", balance: 2000, apr_pct: 24 },
  ];

  test("cards are ordered from highest APR to lowest", () => {
    expect(ids(avalancheOrder(cards))).toEqual(["high", "mid", "low"]);
  });

  test("the input array is not mutated", () => {
    const snapshot = structuredClone(cards);
    const result = avalancheOrder(cards);

    expect(cards).toEqual(snapshot);
    expect(result).not.toBe(cards);
  });

  test("cards with the same APR are ordered by larger balance first", () => {
    const tied = [
      { id: "small", balance: 500, apr_pct: 24 },
      { id: "large", balance: 3000, apr_pct: 24 },
    ];
    expect(ids(avalancheOrder(tied))).toEqual(["large", "small"]);
  });

  test("cards with the same APR and balance are ordered by id", () => {
    const tied = [
      { id: "c", balance: 1000, apr_pct: 24 },
      { id: "a", balance: 1000, apr_pct: 24 },
      { id: "b", balance: 1000, apr_pct: 24 },
    ];
    expect(ids(avalancheOrder(tied))).toEqual(["a", "b", "c"]);
  });

  test("the order is the same no matter what order the cards arrive in", () => {
    const tied = [
      { id: "a", balance: 1000, apr_pct: 24 },
      { id: "b", balance: 1000, apr_pct: 24 },
      { id: "c", balance: 3000, apr_pct: 24 },
      { id: "d", balance: 1000, apr_pct: 29 },
    ];
    const expected = ["d", "c", "a", "b"];

    for (const arrangement of permutations(tied)) {
      expect(ids(avalancheOrder(arrangement))).toEqual(expected);
    }
  });

  test("a value that is not a list returns an empty list", () => {
    expect(avalancheOrder(undefined)).toEqual([]);
  });
});

describe("snowballOrder", () => {
  const cards = [
    { id: "large", balance: 4000, apr_pct: 18 },
    { id: "small", balance: 500, apr_pct: 29.99 },
    { id: "medium", balance: 2000, apr_pct: 24 },
  ];

  test("cards are ordered from smallest balance to largest", () => {
    expect(ids(snowballOrder(cards))).toEqual(["small", "medium", "large"]);
  });

  test("the input array is not mutated", () => {
    const snapshot = structuredClone(cards);
    const result = snowballOrder(cards);

    expect(cards).toEqual(snapshot);
    expect(result).not.toBe(cards);
  });

  test("cards with the same balance are ordered by higher APR first", () => {
    const tied = [
      { id: "cheap", balance: 1200, apr_pct: 15 },
      { id: "costly", balance: 1200, apr_pct: 27 },
    ];
    expect(ids(snowballOrder(tied))).toEqual(["costly", "cheap"]);
  });

  test("cards with the same balance and APR are ordered by id", () => {
    const tied = [
      { id: "c", balance: 1200, apr_pct: 24 },
      { id: "a", balance: 1200, apr_pct: 24 },
      { id: "b", balance: 1200, apr_pct: 24 },
    ];
    expect(ids(snowballOrder(tied))).toEqual(["a", "b", "c"]);
  });

  test("the order is the same no matter what order the cards arrive in", () => {
    const tied = [
      { id: "a", balance: 1200, apr_pct: 24 },
      { id: "b", balance: 1200, apr_pct: 24 },
      { id: "c", balance: 1200, apr_pct: 29 },
      { id: "d", balance: 300, apr_pct: 10 },
    ];
    const expected = ["d", "c", "a", "b"];

    for (const arrangement of permutations(tied)) {
      expect(ids(snowballOrder(arrangement))).toEqual(expected);
    }
  });

  test("a value that is not a list returns an empty list", () => {
    expect(snowballOrder(undefined)).toEqual([]);
  });
});

describe("simulatePayoff", () => {
  test("one card at $1,000, 12% APR and a $100 minimum ends the first month at $910", () => {
    const result = simulatePayoff(
      [{ id: "a", balance: 1000, apr_pct: 12, min_due: 100 }],
      0,
      AVALANCHE,
      TODAY,
    );

    expect(result.clears).toBe(true);
    expect(result.balances[0]).toBe(1000);
    // $10 interest lands first, then the $100 payment: 1000 + 10 - 100.
    expect(result.balances[1]).toBe(910);
  });

  test("the balance series starts today and has one point per month after that", () => {
    const result = simulatePayoff(
      [{ id: "a", balance: 1000, apr_pct: 12, min_due: 100 }],
      0,
      AVALANCHE,
      TODAY,
    );

    expect(result.balances).toHaveLength(result.months + 1);
    expect(result.balances.at(-1)).toBe(0);
  });

  test("a debt whose payments do not cover the interest never clears", () => {
    // $5,000 at 24% accrues $100 a month against a $75 minimum.
    const result = simulatePayoff(
      [{ id: "a", balance: 5000, apr_pct: 24, min_due: 75 }],
      0,
      AVALANCHE,
      TODAY,
    );

    expect(result).toEqual({
      clears: false,
      months: null,
      totalInterest: null,
      payoffDate: null,
      balances: [],
    });
  });

  test("a debt whose payments exactly equal the interest never clears", () => {
    const result = simulatePayoff(
      [{ id: "a", balance: 5000, apr_pct: 24, min_due: 100 }],
      0,
      AVALANCHE,
      TODAY,
    );

    expect(result.clears).toBe(false);
  });

  test("an extra payment can turn a debt that never clears into one that does", () => {
    const result = simulatePayoff(
      [{ id: "a", balance: 5000, apr_pct: 24, min_due: 75 }],
      50,
      AVALANCHE,
      TODAY,
    );

    expect(result.clears).toBe(true);
  });

  test("paying more extra each month never makes the payoff take longer", () => {
    const cards = [
      { id: "a", balance: 4200, apr_pct: 26.99, min_due: 110 },
      { id: "b", balance: 900, apr_pct: 19.5, min_due: 35 },
      { id: "c", balance: 7600, apr_pct: 22.24, min_due: 190 },
    ];
    const extras = [0, 10, 25, 50, 100, 250, 500, 1000, 5000];

    for (const strategy of [AVALANCHE, SNOWBALL]) {
      let previous = Infinity;
      for (const extra of extras) {
        const { clears, months } = simulatePayoff(
          cards,
          extra,
          strategy,
          TODAY,
        );
        expect(clears).toBe(true);
        expect(months).toBeLessThanOrEqual(previous);
        previous = months;
      }
    }
  });

  test("a minimum larger than the remaining balance only pays off the balance", () => {
    const result = simulatePayoff(
      [{ id: "a", balance: 30, apr_pct: 0, min_due: 50 }],
      0,
      AVALANCHE,
      TODAY,
    );

    expect(result.months).toBe(1);
    expect(result.balances).toEqual([30, 0]);
  });

  test("the unused part of an oversized minimum goes to the next card instead of being lost", () => {
    // $75 goes out in total: A needs only $30 of its $50 minimum, so the other
    // $20 joins B's $25 minimum. At 0% APR, every dollar paid is a dollar off.
    const result = simulatePayoff(
      [
        { id: "a", balance: 30, apr_pct: 0, min_due: 50 },
        { id: "b", balance: 1000, apr_pct: 0, min_due: 25 },
      ],
      0,
      AVALANCHE,
      TODAY,
    );

    expect(result.balances[1]).toBe(1030 - 75);
  });

  test("a cleared card's minimum keeps working on the remaining cards in later months", () => {
    const result = simulatePayoff(
      [
        { id: "a", balance: 30, apr_pct: 0, min_due: 50 },
        { id: "b", balance: 1000, apr_pct: 0, min_due: 25 },
      ],
      0,
      AVALANCHE,
      TODAY,
    );

    // Month two onward, the full $75 lands on B alone.
    expect(result.balances[2]).toBe(955 - 75);
  });

  test("money left over after clearing the target card goes to the next card in the same month", () => {
    // Month one: A (30%) becomes 205, B (20%) becomes 1016.67; minimums take
    // them to 195 and 996.67. The $500 extra clears A's 195 and the remaining
    // 305 lands on B in the same month, leaving 691.67 owed.
    const result = simulatePayoff(
      [
        { id: "a", balance: 200, apr_pct: 30, min_due: 10 },
        { id: "b", balance: 1000, apr_pct: 20, min_due: 20 },
      ],
      500,
      AVALANCHE,
      TODAY,
    );

    expect(result.balances[1]).toBe(691.67);
  });

  test("the avalanche strategy never pays more total interest than the snowball strategy", () => {
    const scenarios = [
      // Small balance at a low rate, large balance at a high rate: the two
      // strategies pick different first targets.
      [
        { id: "a", balance: 800, apr_pct: 12, min_due: 25 },
        { id: "b", balance: 6000, apr_pct: 28.99, min_due: 150 },
      ],
      // Three cards, all strategies disagree on the middle of the order.
      [
        { id: "a", balance: 4200, apr_pct: 26.99, min_due: 110 },
        { id: "b", balance: 900, apr_pct: 19.5, min_due: 35 },
        { id: "c", balance: 7600, apr_pct: 22.24, min_due: 190 },
      ],
      // Where both strategies agree, the totals should simply match.
      [
        { id: "a", balance: 500, apr_pct: 29.99, min_due: 25 },
        { id: "b", balance: 3000, apr_pct: 15, min_due: 60 },
      ],
    ];
    const extras = [0, 50, 200, 750];

    for (const cards of scenarios) {
      for (const extra of extras) {
        const avalanche = simulatePayoff(cards, extra, AVALANCHE, TODAY);
        const snowball = simulatePayoff(cards, extra, SNOWBALL, TODAY);

        expect(avalanche.clears).toBe(true);
        expect(snowball.clears).toBe(true);
        expect(avalanche.totalInterest).toBeLessThanOrEqual(
          snowball.totalInterest,
        );
      }
    }
  });

  test("the payoff date is the first of the month the last balance clears in", () => {
    const result = simulatePayoff(
      [{ id: "a", balance: 300, apr_pct: 0, min_due: 100 }],
      0,
      AVALANCHE,
      TODAY,
    );

    expect(result.months).toBe(3);
    expect(result.payoffDate.toISOString()).toBe("2027-02-01T00:00:00.000Z");
  });

  test("a debt that is already paid off clears in zero months", () => {
    const result = simulatePayoff(
      [{ id: "a", balance: 0, apr_pct: 24, min_due: 0 }],
      0,
      AVALANCHE,
      TODAY,
    );

    expect(result).toMatchObject({ clears: true, months: 0, totalInterest: 0 });
  });

  test("cards that cannot be simulated return null", () => {
    expect(simulatePayoff([], 0, AVALANCHE, TODAY)).toBeNull();
    expect(
      simulatePayoff(
        [{ id: "a", balance: 100, apr_pct: 10 }],
        0,
        AVALANCHE,
        TODAY,
      ),
    ).toBeNull();
    expect(
      simulatePayoff(
        [{ id: "a", balance: 100, apr_pct: 10, min_due: 10 }],
        -5,
        AVALANCHE,
        TODAY,
      ),
    ).toBeNull();
  });

  test("the input cards are not changed by running a simulation", () => {
    const cards = [
      { id: "a", balance: 1000, apr_pct: 12, min_due: 100 },
      { id: "b", balance: 400, apr_pct: 20, min_due: 40 },
    ];
    const snapshot = structuredClone(cards);

    simulatePayoff(cards, 50, SNOWBALL, TODAY);

    expect(cards).toEqual(snapshot);
  });
});
