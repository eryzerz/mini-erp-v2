export const roundHalfUp = (value: number): number => {
  const sign = value < 0 ? -1 : 1;
  // Epsilon correction: binary float dust (e.g. 0.145 * 100 === 14.4999...) would
  // otherwise push genuine half-ties below the floor.
  const corrected = Math.abs(value) + 1e-9;
  return sign * Math.floor(corrected + 0.5);
};

/**
 * Round to a fixed number of decimal places using half-up rounding.
 * Banker's-style floating point drift is avoided by shifting through
 * an integer representation.
 */
export const roundTo = (value: number, decimals = 2): number => {
  const factor = 10 ** decimals;
  return roundHalfUp(value * factor) / factor;
};

export const toNumber = (value: string | number): number =>
  typeof value === "number" ? value : Number(value);

export const formatMoney = (value: number, decimals = 2): string => value.toFixed(decimals);

/** Line subtotal before tax: quantity x unitPrice, rounded to 2 dp. */
export const computeLineSubtotal = (quantity: string | number, unitPrice: string | number): number =>
  roundTo(toNumber(quantity) * toNumber(unitPrice));

/** Line tax: subtotal x rate/100, rounded to 2 dp. */
export const computeLineTax = (
  quantity: string | number,
  unitPrice: string | number,
  taxRate: string | number,
): number => roundTo(computeLineSubtotal(quantity, unitPrice) * (toNumber(taxRate) / 100));

/** Lines are rounded first, then summed — invoice totals are the sum of the rounded lines. */
export function computeInvoiceTotals(
  lines: { quantity: string | number; unitPrice: string | number; taxRate: string | number }[],
): { subtotal: number; taxTotal: number; total: number } {
  let subtotal = 0;
  let taxTotal = 0;
  for (const line of lines) {
    subtotal += computeLineSubtotal(line.quantity, line.unitPrice);
    taxTotal += computeLineTax(line.quantity, line.unitPrice, line.taxRate);
  }
  subtotal = roundTo(subtotal);
  taxTotal = roundTo(taxTotal);
  return { subtotal, taxTotal, total: roundTo(subtotal + taxTotal) };
}
