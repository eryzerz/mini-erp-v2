"use client"

import * as React from "react"

import { cn } from "../lib/utils"
import { Input } from "./ui/input"

const formatRupiah = (digits: string): string => {
  if (!digits) return "";
  const value = Number.parseInt(digits, 10);
  if (Number.isNaN(value)) return "";
  return `Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(value)}`;
};

/**
 * A currency-masked input: the form state holds the raw digit string
 * (e.g. "1200000"), the input displays "Rp 1.200.000", and typing parses
 * back to digits. The mask never leaves the component — the API receives
 * the raw value, exactly as it does from a plain input.
 */
function CurrencyInput({ className, ...props }: React.ComponentProps<typeof Input>) {
  const rawValue = typeof props.value === "string" ? props.value : "";
  const displayed = formatRupiah(rawValue.replace(/\D/g, ""));

  return (
    <Input
      {...props}
      value={displayed}
      inputMode="numeric"
      placeholder="Rp 0"
      onChange={(event) => {
        const digits = event.target.value.replace(/\D/g, "").slice(0, 15);
        props.onChange?.({ ...event, target: { ...event.target, value: digits } });
      }}
      className={cn(className)}
    />
  );
}

export { CurrencyInput, formatRupiah };
