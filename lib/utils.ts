import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Format "YYYY-MM" → "Jan 2026" */
export function formatMonth(ym: string): string {
  const [year, month] = ym.split("-");
  return `${MONTH_NAMES[parseInt(month, 10) - 1]} ${year}`;
}

/** Format "YYYY-MM-DD" → "Jan 1, 2026" */
export function formatDate(ymd: string): string {
  const [year, month, day] = ymd.split("-");
  return `${MONTH_NAMES[parseInt(month, 10) - 1]} ${parseInt(day, 10)}, ${year}`;
}
