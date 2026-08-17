import {
  computeInvoiceTotals,
  computeLineSubtotal,
  computeLineTax,
  roundHalfUp,
  roundTo,
} from "./money";

describe("money math", () => {
  describe("roundHalfUp", () => {
    it("rounds halves up", () => {
      expect(roundHalfUp(2.5)).toBe(3);
      expect(roundHalfUp(2.499)).toBe(2);
      expect(roundHalfUp(-2.5)).toBe(-3);
    });

    it("survives binary float dust on half-ties", () => {
      expect(roundTo(1.005, 2)).toBe(1.01);
      expect(roundTo(0.145, 2)).toBe(0.15);
      expect(roundTo(0.1 * 3, 2)).toBe(0.3);
    });
  });

  describe("computeLineSubtotal", () => {
    it("multiplies quantity by unit price", () => {
      expect(computeLineSubtotal("2.0000", "750000.0000")).toBe(1500000);
      expect(computeLineSubtotal("12.5000", "350000.0000")).toBe(4375000);
    });
  });

  describe("computeLineTax", () => {
    it("applies the rate to the subtotal", () => {
      expect(computeLineTax("2.0000", "750000.0000", "11.00")).toBe(165000);
    });

    it("is zero for a zero rate", () => {
      expect(computeLineTax("3.0000", "100000.0000", "0.00")).toBe(0);
    });
  });

  describe("computeInvoiceTotals", () => {
    it("sums rounded lines and derives the total", () => {
      const totals = computeInvoiceTotals([
        { quantity: "2.0000", unitPrice: "750000.0000", taxRate: "11.00" },
        { quantity: "1.0000", unitPrice: "24500000.0000", taxRate: "0.00" },
      ]);
      expect(totals.subtotal).toBe(26000000);
      expect(totals.taxTotal).toBe(165000);
      expect(totals.total).toBe(26165000);
    });

    it("rounds each line before summing (per-line rounding)", () => {
      const totals = computeInvoiceTotals([
        { quantity: "1.0000", unitPrice: "0.145", taxRate: "0.00" },
        { quantity: "1.0000", unitPrice: "0.145", taxRate: "0.00" },
      ]);
      // 0.145 -> 0.15 per line, so two lines sum to 0.30, not 0.29.
      expect(totals.subtotal).toBe(0.3);
    });
  });
});
