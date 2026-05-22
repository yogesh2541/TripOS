import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatINR(value: number) {
  if (!Number.isFinite(value)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatDate(d: Date | string | null | undefined) {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Calendar-day difference between two dates, ignoring time-of-day.
 * `calendarDayDiff(2 Apr 23:00, 3 Apr 01:00)` === 1, not 0.
 * Both dates are read in the local frame — correct for an operator
 * picking dates in their own timezone.
 */
export function calendarDayDiff(
  from: Date | string,
  to: Date | string
): number {
  const a = typeof from === "string" ? new Date(from) : from;
  const b = typeof to === "string" ? new Date(to) : to;
  const aMid = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  const bMid = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((bMid.getTime() - aMid.getTime()) / 86_400_000);
}

/**
 * Which itinerary day a dated event falls on, given the trip's start date.
 * Day 1 is the start date itself. Returns null when there's no start date
 * (the caller then keeps a manual day number). The result is NOT clamped —
 * callers clamp to the trip's day count and surface out-of-range warnings.
 */
export function dayNumberForDate(
  eventDate: Date | string | null | undefined,
  tripStartDate: Date | string | null | undefined
): number | null {
  if (!eventDate || !tripStartDate) return null;
  return calendarDayDiff(tripStartDate, eventDate) + 1;
}
