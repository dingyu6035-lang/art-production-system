import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

export function compactName(name?: string | null, email?: string | null) {
  return name || email?.split("@")[0] || "未分配";
}
