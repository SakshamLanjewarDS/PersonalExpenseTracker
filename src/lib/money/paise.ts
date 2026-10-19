/**
 * PocketPlan Money Engine
 *
 * Strict Integer Paise Representation:
 * 1 Rupee (₹1.00) = 100 paise.
 * All amounts are stored, validated, and computed as integer paise.
 * Zero floating-point arithmetic errors.
 */

export type Paise = number; // Integer paise

/**
 * Validates that an amount is a valid safe integer paise.
 */
export function isValidPaise(amount: unknown): amount is Paise {
  return typeof amount === "number" && Number.isSafeInteger(amount);
}

/**
 * Asserts that an amount is a valid integer paise, throwing if invalid.
 */
export function assertValidPaise(amount: unknown, label = "Amount"): asserts amount is Paise {
  if (!isValidPaise(amount)) {
    throw new TypeError(`${label} must be a safe integer paise, received: ${amount}`);
  }
}

/**
 * Parses user input (string or number like "300", "300.50", "₹1,250.75", 300.5)
 * into exact integer paise without floating-point inaccuracy.
 */
export function parseRupeesToPaise(input: string | number): Paise {
  if (typeof input === "number") {
    if (isNaN(input) || !isFinite(input)) {
      throw new Error("Invalid number input");
    }
    // Convert to fixed 2 decimal places to avoid IEEE 754 float glitches
    input = input.toFixed(2);
  }

  const clean = input
    .trim()
    .replace(/[₹,\s]/g, "") // strip rupee symbol, commas, whitespace
    .replace(/^[+]/, ""); // strip optional leading plus

  if (!clean || clean === "-" || clean === ".") {
    return 0;
  }

  const isNegative = clean.startsWith("-");
  const unsigned = isNegative ? clean.slice(1) : clean;

  const parts = unsigned.split(".");
  if (parts.length > 2) {
    throw new Error(`Invalid currency format: "${input}"`);
  }

  const integerPartStr = parts[0] || "0";
  const fractionalPartStr = (parts[1] || "").slice(0, 2).padEnd(2, "0");

  if (!/^\d+$/.test(integerPartStr) || !/^\d{2}$/.test(fractionalPartStr)) {
    throw new Error(`Invalid numeric input: "${input}"`);
  }

  const rupees = parseInt(integerPartStr, 10);
  const paiseFrac = parseInt(fractionalPartStr, 10);

  const total = rupees * 100 + paiseFrac;
  const result = isNegative ? -total : total;

  assertValidPaise(result, "Parsed amount");
  return result;
}

/**
 * Converts integer paise to decimal rupees number (e.g. 30050 -> 300.50).
 * Use only for charts or external APIs that require decimal representation.
 */
export function paiseToRupees(paise: Paise): number {
  assertValidPaise(paise);
  return paise / 100;
}

/**
 * Formats integer paise into Indian currency string:
 * e.g. 30050 -> "₹300.50", 10000000 -> "₹1,00,000"
 */
export function formatPaise(
  paise: Paise,
  options: {
    showCurrencySymbol?: boolean;
    alwaysShowDecimals?: boolean;
    hideDecimalsIfZero?: boolean;
  } = {}
): string {
  assertValidPaise(paise);

  const {
    showCurrencySymbol = true,
    alwaysShowDecimals = false,
    hideDecimalsIfZero = true,
  } = options;

  const isNegative = paise < 0;
  const absPaise = Math.abs(paise);
  const rupees = Math.floor(absPaise / 100);
  const fraction = absPaise % 100;

  // Format integer rupees according to Indian numbering system (2,2,3)
  const rupeesFormatted = new Intl.NumberFormat("en-IN", {
    useGrouping: true,
  }).format(rupees);

  let formatted = "";
  if (fraction === 0 && hideDecimalsIfZero && !alwaysShowDecimals) {
    formatted = rupeesFormatted;
  } else {
    formatted = `${rupeesFormatted}.${fraction.toString().padStart(2, "0")}`;
  }

  const prefix = isNegative ? "- " : "";
  const symbol = showCurrencySymbol ? "₹" : "";

  return `${prefix}${symbol}${formatted}`;
}

/**
 * Safe Addition of Paise
 */
export function addPaise(...amounts: Paise[]): Paise {
  let sum = 0;
  for (const amt of amounts) {
    assertValidPaise(amt);
    sum += amt;
    assertValidPaise(sum, "Sum");
  }
  return sum;
}

/**
 * Safe Subtraction of Paise: a - b
 */
export function subPaise(a: Paise, b: Paise): Paise {
  assertValidPaise(a);
  assertValidPaise(b);
  const diff = a - b;
  assertValidPaise(diff, "Difference");
  return diff;
}

/**
 * Safe Multiplication of Paise by an integer factor or ratio
 */
export function multiplyPaise(amount: Paise, factor: number): Paise {
  assertValidPaise(amount);
  const result = Math.round(amount * factor);
  assertValidPaise(result, "Multiplied amount");
  return result;
}

/**
 * Distribute a total paise amount across proportions, distributing any remainder
 * so that sum(splits) === totalPaise exactly.
 */
export function distributePaise(totalPaise: Paise, ratios: number[]): Paise[] {
  assertValidPaise(totalPaise);
  if (ratios.length === 0) return [];
  const sumRatio = ratios.reduce((acc, r) => acc + r, 0);
  if (sumRatio <= 0) {
    throw new Error("Sum of ratios must be greater than 0");
  }

  let distributed = 0;
  const results: Paise[] = [];

  for (let i = 0; i < ratios.length; i++) {
    if (i === ratios.length - 1) {
      // Last item gets the exact remainder to prevent rounding drift
      const remainder = totalPaise - distributed;
      results.push(remainder);
    } else {
      const share = Math.round((totalPaise * ratios[i]) / sumRatio);
      results.push(share);
      distributed += share;
    }
  }

  return results;
}

/**
 * Financial Calculation: Available Category Budget
 * Formula: Opening Rollover + Allocations + Net Reallocations - Net Spending (Expenses - Refunds)
 */
export function calculateAvailableBudget(params: {
  openingRolloverPaise: Paise;
  allocatedPaise: Paise;
  netReallocationsPaise: Paise;
  expensesPaise: Paise;
  refundsPaise: Paise;
}): {
  availablePaise: Paise;
  netSpentPaise: Paise;
  isOverspent: boolean;
} {
  const {
    openingRolloverPaise,
    allocatedPaise,
    netReallocationsPaise,
    expensesPaise,
    refundsPaise,
  } = params;

  // Net spent = expenses - refunds
  const netSpentPaise = subPaise(expensesPaise, refundsPaise);

  // Available = Opening + Allocated + Net Reallocations - Net Spent
  const availablePaise = subPaise(
    addPaise(openingRolloverPaise, allocatedPaise, netReallocationsPaise),
    netSpentPaise
  );

  return {
    availablePaise,
    netSpentPaise,
    isOverspent: availablePaise < 0,
  };
}
