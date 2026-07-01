"use client";

import { cn } from "@/lib/utils";

export function MultiSelect({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string[];
  onChange: (value: string[]) => void;
}) {
  function toggle(option: string) {
    onChange(value.includes(option) ? value.filter((item) => item !== option) : [...value, option]);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => toggle(option)}
          className={cn(
            "rounded-lg border px-3 py-2 text-sm font-medium transition",
            value.includes(option)
              ? "border-primary bg-primary-soft text-primary"
              : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
