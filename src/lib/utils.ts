import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatMoney(value: number, currency = "ARS") {
  if (currency === "USDT") {
    return `USDT ${new Intl.NumberFormat("es-AR", { maximumFractionDigits: 2 }).format(value)}`;
  }

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "ARS" ? 0 : 2
  }).format(value);
}

export function formatPercent(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "percent",
    maximumFractionDigits: 1
  }).format(value);
}

export function toInputDate(date: Date | string) {
  const parsed = typeof date === "string" ? new Date(`${date}T00:00:00`) : date;
  return parsed.toISOString().slice(0, 10);
}

export function makeId(prefix: string) {
  const randomId =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return `${prefix}-${randomId}`;
}
