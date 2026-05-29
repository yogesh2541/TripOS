"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  CreditCard,
  LifeBuoy,
  LogOut,
  Plug,
  Settings,
  ShieldCheck,
  Sparkles,
  User,
  Users,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOutAction } from "@/server/actions/auth";
import type { MembershipRole } from "@prisma/client";

const ROLE_LABEL: Record<MembershipRole, string> = {
  OWNER: "Owner",
  STAFF: "Staff",
  VIEWER: "Viewer",
};

const ROLE_TONE: Record<MembershipRole, string> = {
  OWNER: "text-gold-deep",
  STAFF: "text-ink",
  VIEWER: "text-muted",
};

export function UserMenu({
  name,
  email,
  agencyName,
  role,
  isPlatformAdmin = false,
}: {
  name: string | null;
  email: string;
  agencyName: string;
  role: MembershipRole;
  isPlatformAdmin?: boolean;
}) {
  const [, startTransition] = useTransition();
  const initials = (name ?? email)
    .split(/\s+/)
    .map((s) => s[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  function signOut() {
    startTransition(async () => {
      await signOutAction();
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex h-[34px] items-center gap-2 rounded-[9px] border border-line bg-paper pl-1.5 pr-3 hover:border-[var(--gold-line)] hover:bg-paper-2 transition-colors"
          aria-label="Account"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-[7px] bg-inkwash text-gold text-[10px] font-semibold">
            {initials || <User className="h-3.5 w-3.5" />}
          </span>
          <span className="hidden sm:inline text-xs text-ink-2 max-w-[120px] truncate">
            {agencyName}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <div>
            <p className="font-medium text-ink text-sm">{name ?? "—"}</p>
            <p className="text-xs text-muted truncate">{email}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>
          <div className="text-xs">
            <p className="text-[10px] uppercase tracking-[0.18em] text-muted">
              Active agency
            </p>
            <p className="mt-0.5 text-ink">{agencyName}</p>
            <p className={"mt-0.5 text-[10px] uppercase tracking-[0.18em] " + ROLE_TONE[role]}>
              <ShieldCheck className="inline h-3 w-3 mr-0.5" />
              {ROLE_LABEL[role]}
            </p>
          </div>
        </DropdownMenuLabel>
        {isPlatformAdmin ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href="/admin" className="flex items-center gap-2 text-gold-deep">
                <ShieldCheck className="h-3.5 w-3.5" />
                Owner console
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings/agency" className="flex items-center gap-2">
            <Settings className="h-3.5 w-3.5" />
            Agency settings
          </Link>
        </DropdownMenuItem>
        {role === "OWNER" ? (
          <DropdownMenuItem asChild>
            <Link href="/settings/proposal" className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" />
              Proposal branding
            </Link>
          </DropdownMenuItem>
        ) : null}
        {role === "OWNER" ? (
          <DropdownMenuItem asChild>
            <Link href="/settings/integrations" className="flex items-center gap-2">
              <Plug className="h-3.5 w-3.5" />
              Integrations
            </Link>
          </DropdownMenuItem>
        ) : null}
        {role === "OWNER" ? (
          <DropdownMenuItem asChild>
            <Link href="/settings/team" className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5" />
              Team
            </Link>
          </DropdownMenuItem>
        ) : null}
        {role === "OWNER" ? (
          <DropdownMenuItem asChild>
            <Link href="/settings/billing" className="flex items-center gap-2">
              <CreditCard className="h-3.5 w-3.5" />
              Billing & plan
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/help" className="flex items-center gap-2">
            <LifeBuoy className="h-3.5 w-3.5" />
            Help & guides
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={signOut}
          className="flex items-center gap-2 text-bad"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
