"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Lightweight, dependency-free table for the power-user list views
// (Leads / Bookings / Invoices). Sorting is client-side over the
// already-loaded dataset, so it's instant.
//
// Two row modes:
//   - default: each row is a real <Link> (middle-click / new-tab work)
//   - selectable: a checkbox sits left of a Link — selecting never
//     navigates, navigating never selects.

export type Column<T> = {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  sortValue?: (row: T) => string | number | Date | null | undefined;
  align?: "left" | "right" | "center";
  className?: string;
};

type SortState = { key: string; dir: "asc" | "desc" } | null;

function compare(
  a: string | number | Date | null | undefined,
  b: string | number | Date | null | undefined
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (a instanceof Date && b instanceof Date) return a.getTime() - b.getTime();
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true });
}

export function DataTable<T>({
  rows,
  columns,
  rowKey,
  rowHref,
  gridClassName,
  initialSort,
  empty,
  selectable = false,
  selectedIds,
  onToggleRow,
  onToggleAll,
  rowAccent,
}: {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  rowHref?: (row: T) => string;
  gridClassName: string;
  initialSort?: { key: string; dir: "asc" | "desc" };
  empty?: React.ReactNode;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleRow?: (id: string) => void;
  /** Toggles every currently-rendered row. */
  onToggleAll?: () => void;
  /**
   * Optional left-edge accent — returns a `border-l-*` colour class so the
   * eye can scan the table by category (e.g. pipeline stage) without
   * reading every cell.
   */
  rowAccent?: (row: T) => string;
}) {
  const [sort, setSort] = useState<SortState>(initialSort ?? null);

  const sorted = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.key === sort.key);
    if (!col?.sortValue) return rows;
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort(
      (a, b) => compare(col.sortValue!(a), col.sortValue!(b)) * dir
    );
  }, [rows, sort, columns]);

  function toggleSort(key: string) {
    setSort((cur) => {
      if (cur?.key !== key) return { key, dir: "asc" };
      if (cur.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  if (rows.length === 0 && empty) {
    return <>{empty}</>;
  }

  const allShownSelected =
    selectable &&
    sorted.length > 0 &&
    sorted.every((r) => selectedIds?.has(rowKey(r)));

  const gridCell = (row: T) => (
    <div
      className={cn(
        "grid gap-4 px-4 py-3 items-center text-sm flex-1 min-w-0",
        gridClassName
      )}
    >
      {columns.map((col) => (
        <div
          key={col.key}
          className={cn(
            "min-w-0",
            col.align === "right"
              ? "text-right"
              : col.align === "center"
                ? "text-center"
                : "text-left",
            col.className
          )}
        >
          {col.render(row)}
        </div>
      ))}
    </div>
  );

  return (
    <div className="rounded-2xl border border-line bg-white overflow-hidden">
      {/* Header */}
      <div className="flex items-center bg-ivory border-b border-line">
        {selectable ? (
          <div className="pl-4 flex items-center">
            <input
              type="checkbox"
              aria-label="Select all"
              checked={allShownSelected}
              onChange={() => onToggleAll?.()}
              className="h-4 w-4 accent-navy cursor-pointer"
            />
          </div>
        ) : null}
        <div className={cn("grid gap-4 px-4 py-2.5 flex-1", gridClassName)}>
          {columns.map((col) => {
            const alignClass =
              col.align === "right"
                ? "justify-end text-right"
                : col.align === "center"
                  ? "justify-center text-center"
                  : "justify-start text-left";
            const isSorted = sort?.key === col.key;
            return (
              <div
                key={col.key}
                className={cn("flex items-center", alignClass, col.className)}
              >
                {col.sortValue ? (
                  <button
                    type="button"
                    onClick={() => toggleSort(col.key)}
                    className={cn(
                      "inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.16em] transition-colors",
                      isSorted
                        ? "text-navy"
                        : "text-muted-foreground hover:text-navy"
                    )}
                  >
                    {col.header}
                    {isSorted ? (
                      sort!.dir === "asc" ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )
                    ) : (
                      <ChevronsUpDown className="h-3 w-3 opacity-40" />
                    )}
                  </button>
                ) : (
                  <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    {col.header}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <ul className="divide-y divide-line/70">
        {sorted.map((row) => {
          const id = rowKey(row);
          const href = rowHref?.(row);
          const selected = selectedIds?.has(id) ?? false;
          // A constant 3px left edge keeps row heights identical whether or
          // not an accent is supplied — transparent when there's none.
          const accent = cn(
            "border-l-[3px]",
            rowAccent ? rowAccent(row) : "border-l-transparent"
          );

          if (selectable) {
            return (
              <li key={id}>
                <div
                  className={cn(
                    "flex items-center transition-colors",
                    accent,
                    selected ? "bg-sand-50/60" : "hover:bg-ivory/70"
                  )}
                >
                  <div className="pl-4 flex items-center">
                    <input
                      type="checkbox"
                      aria-label="Select row"
                      checked={selected}
                      onChange={() => onToggleRow?.(id)}
                      className="h-4 w-4 accent-navy cursor-pointer"
                    />
                  </div>
                  {href ? (
                    <Link href={href} className="flex-1 min-w-0">
                      {gridCell(row)}
                    </Link>
                  ) : (
                    gridCell(row)
                  )}
                </div>
              </li>
            );
          }

          return (
            <li key={id}>
              {href ? (
                <Link
                  href={href}
                  className={cn(
                    "block hover:bg-ivory/70 transition-colors",
                    accent
                  )}
                >
                  {gridCell(row)}
                </Link>
              ) : (
                gridCell(row)
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
