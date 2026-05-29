"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function ChipInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder?: string;
  className?: string;
}) {
  const [draft, setDraft] = useState("");

  function commit(text: string) {
    const t = text.trim();
    if (!t) return;
    if (value.includes(t)) {
      setDraft("");
      return;
    }
    onChange([...value, t]);
    setDraft("");
  }

  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div
      className={cn(
        "flex flex-wrap gap-1.5 rounded-[10px] border border-line bg-paper px-2 py-1.5 min-h-[42px] focus-within:border-[var(--gold-line)] focus-within:ring-2 focus-within:ring-[var(--gold-line)] transition-all",
        className
      )}
    >
      {value.map((v, i) => (
        <span
          key={`${v}-${i}`}
          className="inline-flex items-center gap-1.5 h-7 pl-3 pr-1 bg-paper-2 border border-line rounded-[6px] text-xs text-ink"
        >
          {v}
          <button
            type="button"
            onClick={() => remove(i)}
            className="h-5 w-5 rounded-[5px] hover:bg-line/50 flex items-center justify-center text-muted hover:text-bad transition-colors"
            aria-label={`Remove ${v}`}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commit(draft);
          }
          if (e.key === "Backspace" && !draft && value.length > 0) {
            remove(value.length - 1);
          }
        }}
        onBlur={() => commit(draft)}
        placeholder={value.length === 0 ? placeholder : ""}
        className="flex-1 min-w-[120px] h-7 px-2 outline-none bg-transparent text-sm placeholder:text-muted"
      />
    </div>
  );
}
