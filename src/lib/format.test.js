import process from "node:process";

import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";

// Zones on both sides of Greenwich, including the ones where the old bug
// showed up (everything west of UTC) and the extremes of the offset range.
const TIME_ZONES = [
  "UTC",
  "America/New_York",
  "America/Los_Angeles",
  "Pacific/Honolulu",
  "Pacific/Pago_Pago", // UTC-11
  "Europe/London",
  "Asia/Tokyo",
  "Pacific/Kiritimati", // UTC+14
];

describe("formatDate", () => {
  const originalTimeZone = process.env.TZ;

  afterEach(() => {
    if (originalTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimeZone;
    vi.resetModules();
  });

  // Regression test for the off-by-one due date. The module is re-imported
  // after switching the zone so its module-scope formatter is built under that
  // zone, which is how it would be built on a machine that lives there. A
  // formatter left on the local zone fails this in every zone west of UTC.
  test.each(TIME_ZONES)(
    'the stored date "2026-09-15" renders as Sep 15 when the local time zone is %s',
    async (zone) => {
      process.env.TZ = zone;
      vi.resetModules();
      const { formatDate } = await import("./format.js");

      expect(formatDate("2026-09-15")).toBe("Sep 15, 2026");
    },
  );

  describe("with the default time zone", () => {
    let formatDate;

    beforeAll(async () => {
      ({ formatDate } = await import("./format.js"));
    });

    test("an empty value renders as null", () => {
      expect(formatDate(null)).toBeNull();
      expect(formatDate(undefined)).toBeNull();
      expect(formatDate("")).toBeNull();
    });

    test("a value that is not a date renders as null", () => {
      expect(formatDate("not a date")).toBeNull();
    });
  });
});
