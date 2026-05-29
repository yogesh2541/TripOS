import type {
  BookingStatus,
  LeadSource,
  LeadStatus,
  PaymentType,
  TripStatus,
  VendorType,
  VendorAssignmentCategory,
  VendorAssignmentStatus,
  VendorPaymentMode,
  OperationTaskStatus,
  OperationTaskType,
  OperationTaskPriority,
} from "@prisma/client";

export const LEAD_STATUS_ORDER: LeadStatus[] = [
  "NEW",
  "CONTACTED",
  "REQUIREMENT_UNDERSTOOD",
  "QUOTED",
  "FOLLOW_UP",
  "WON",
  "LOST",
];

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  REQUIREMENT_UNDERSTOOD: "Understood",
  QUOTED: "Quoted",
  FOLLOW_UP: "Follow up",
  WON: "Won",
  LOST: "Lost",
};

export const LEAD_STATUS_COLUMN_DESC: Record<LeadStatus, string> = {
  NEW: "Just landed",
  CONTACTED: "Reached out",
  REQUIREMENT_UNDERSTOOD: "Brief captured",
  QUOTED: "Quote sent",
  FOLLOW_UP: "Awaiting reply",
  WON: "Booked",
  LOST: "Closed",
};

export type LeadStatusTone =
  | "default"
  | "outline"
  | "accent"
  | "muted"
  | "danger"
  | "success"
  | "warn"
  | "info";

export const LEAD_STATUS_TONE: Record<LeadStatus, LeadStatusTone> = {
  NEW: "outline",
  CONTACTED: "info",
  REQUIREMENT_UNDERSTOOD: "info",
  QUOTED: "accent",
  FOLLOW_UP: "warn",
  WON: "success",
  LOST: "danger",
};

// Left-edge accent colour for dense table rows — lets the eye scan a long
// list by pipeline stage without reading every Status badge. Border-color
// utility classes (consumed as `border-l-[3px] <class>`).
export const LEAD_STATUS_ACCENT: Record<LeadStatus, string> = {
  NEW: "border-l-dv-slate",
  CONTACTED: "border-l-info",
  REQUIREMENT_UNDERSTOOD: "border-l-dv-sage",
  QUOTED: "border-l-gold",
  FOLLOW_UP: "border-l-warn",
  WON: "border-l-ok",
  LOST: "border-l-bad",
};

export const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
  MANUAL: "Manual",
  INSTAGRAM: "Instagram",
  REFERRAL: "Referral",
  WEBSITE: "Website",
  WHATSAPP: "WhatsApp",
  GOOGLE: "Google",
  OTHER: "Other",
};

export const TRIP_STATUS_LABEL: Record<TripStatus, string> = {
  PLANNING: "Planning",
  QUOTED: "Quoted",
  BOOKED: "Booked",
  VENDOR_CONFIRMATION_PENDING: "Awaiting vendors",
  PARTIALLY_CONFIRMED: "Partially confirmed",
  READY_TO_TRAVEL: "Ready to travel",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const TRIP_STATUS_TONE: Record<TripStatus, LeadStatusTone> = {
  PLANNING: "outline",
  QUOTED: "accent",
  BOOKED: "info",
  VENDOR_CONFIRMATION_PENDING: "warn",
  PARTIALLY_CONFIRMED: "warn",
  READY_TO_TRAVEL: "success",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  CANCELLED: "danger",
};

export const BOOKING_STATUS_ORDER: BookingStatus[] = [
  "PENDING",
  "CONFIRMED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

export const BOOKING_STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const BOOKING_STATUS_TONE: Record<BookingStatus, LeadStatusTone> = {
  PENDING: "warn",
  CONFIRMED: "info",
  IN_PROGRESS: "accent",
  COMPLETED: "success",
  CANCELLED: "danger",
};

export const BOOKING_STATUS_ACCENT: Record<BookingStatus, string> = {
  PENDING: "border-l-warn",
  CONFIRMED: "border-l-info",
  IN_PROGRESS: "border-l-gold",
  COMPLETED: "border-l-ok",
  CANCELLED: "border-l-bad",
};

export const PAYMENT_TYPE_LABEL: Record<PaymentType, string> = {
  ADVANCE: "Advance",
  PARTIAL: "Partial",
  FINAL: "Final",
};

// Vendors & operations
export const VENDOR_TYPE_LABEL: Record<VendorType, string> = {
  HOTEL: "Hotel",
  TRANSPORT: "Transport",
  DRIVER: "Driver",
  GUIDE: "Guide",
  ACTIVITY: "Activity",
  DMC: "DMC",
  OTHER: "Other",
};

export const VENDOR_TYPE_ORDER: VendorType[] = [
  "HOTEL",
  "TRANSPORT",
  "DRIVER",
  "GUIDE",
  "ACTIVITY",
  "DMC",
  "OTHER",
];

export const VENDOR_ASSIGNMENT_CATEGORY_LABEL: Record<
  VendorAssignmentCategory,
  string
> = {
  HOTEL: "Hotel",
  TRANSFER: "Transfer",
  SIGHTSEEING: "Sightseeing",
  ACTIVITY: "Activity",
  GUIDE: "Guide",
  FLIGHT: "Flight",
  TRAIN: "Train",
  OTHER: "Other",
};

export const VENDOR_ASSIGNMENT_CATEGORY_ORDER: VendorAssignmentCategory[] = [
  "HOTEL",
  "TRANSFER",
  "SIGHTSEEING",
  "ACTIVITY",
  "GUIDE",
  "FLIGHT",
  "TRAIN",
  "OTHER",
];

export const VENDOR_ASSIGNMENT_STATUS_LABEL: Record<
  VendorAssignmentStatus,
  string
> = {
  PENDING: "Pending",
  REQUESTED: "Requested",
  CONFIRMED: "Confirmed",
  CANCELLED: "Cancelled",
  COMPLETED: "Completed",
};

export const VENDOR_ASSIGNMENT_STATUS_TONE: Record<
  VendorAssignmentStatus,
  LeadStatusTone
> = {
  PENDING: "outline",
  REQUESTED: "info",
  CONFIRMED: "success",
  COMPLETED: "success",
  CANCELLED: "danger",
};

export const VENDOR_PAYMENT_MODE_LABEL: Record<VendorPaymentMode, string> = {
  CASH: "Cash",
  BANK: "Bank transfer",
  UPI: "UPI",
  CARD: "Card",
  OTHER: "Other",
};

export const OPERATION_TASK_STATUS_LABEL: Record<OperationTaskStatus, string> =
  {
    PENDING: "Pending",
    IN_PROGRESS: "In progress",
    COMPLETED: "Completed",
    BLOCKED: "Blocked",
  };

export const OPERATION_TASK_STATUS_TONE: Record<
  OperationTaskStatus,
  LeadStatusTone
> = {
  PENDING: "outline",
  IN_PROGRESS: "info",
  COMPLETED: "success",
  BLOCKED: "danger",
};

export const OPERATION_TASK_TYPE_LABEL: Record<OperationTaskType, string> = {
  HOTEL_CONFIRMATION: "Hotel confirmation",
  DRIVER_ASSIGNMENT: "Driver assignment",
  PAYMENT_COLLECTION: "Payment collection",
  VOUCHER_SENT: "Voucher sent",
  DOCUMENT_COLLECTION: "Document collection",
  INTERNAL: "Internal",
  OTHER: "Other",
};

export const OPERATION_TASK_PRIORITY_LABEL: Record<
  OperationTaskPriority,
  string
> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const OPERATION_TASK_PRIORITY_TONE: Record<
  OperationTaskPriority,
  LeadStatusTone
> = {
  LOW: "muted",
  MEDIUM: "outline",
  HIGH: "accent",
  URGENT: "danger",
};

export function vendorContactLine(v: {
  city?: string | null;
  state?: string | null;
  country?: string | null;
}) {
  return [v.city, v.state, v.country].filter(Boolean).join(", ");
}

export function whatsappLink(phone?: string | null) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

export function telLink(phone?: string | null) {
  return phone ? `tel:${phone}` : null;
}

export function mailtoLink(email?: string | null) {
  return email ? `mailto:${email}` : null;
}
