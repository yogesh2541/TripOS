// Single source of truth for the app's primary navigation. Consumed by
// both the desktop sidebar ([app-sidebar.tsx](src/components/app-sidebar.tsx))
// and the mobile drawer ([mobile-nav.tsx](src/components/mobile-nav.tsx)) so
// the two never drift apart.

import {
  BarChart3,
  Building2,
  CalendarClock,
  Compass,
  FileText,
  Heart,
  LayoutDashboard,
  ClipboardList,
  MessageCircle,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export type NavGroup = {
  // null = no section header (the lone Dashboard item)
  label: string | null;
  items: NavItem[];
};

export const NAV_GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/reports", label: "Reports", icon: BarChart3 },
    ],
  },
  {
    label: "Pipeline",
    items: [
      { href: "/contacts", label: "Contacts", icon: Users },
      { href: "/customers", label: "Customers", icon: Heart },
      { href: "/trips", label: "Trips", icon: Compass },
      { href: "/bookings", label: "Bookings", icon: Wallet },
      { href: "/invoices", label: "Invoices", icon: FileText },
    ],
  },
  {
    label: "Operations",
    items: [
      { href: "/vendors", label: "Vendors", icon: Building2 },
      { href: "/operations", label: "Operations", icon: ClipboardList },
    ],
  },
  {
    label: "Engage",
    items: [
      { href: "/communications", label: "Communications", icon: MessageCircle },
      { href: "/follow-ups", label: "Follow-ups", icon: CalendarClock },
    ],
  },
];

/**
 * True when `pathname` belongs to `href` — exact match for "/", prefix
 * match otherwise. Shared so the sidebar and drawer highlight identically.
 */
export function isNavActive(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}
