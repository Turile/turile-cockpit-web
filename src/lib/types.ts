// Contract with the turile-cockpit edge functions (activate-voucher,
// booking-request). Raw API payloads are snake_case; the app works with the
// camelCase shapes below — mapping happens in lib/api.ts only.

export type Slot = { start: string; end: string }; // ISO timestamps

export type PinnedExperience = {
  title: string;
  slug: string;
  retailPriceCents: number;
  currency: string;
  provider: {
    name: string;
    slug: string;
    bookingMode: "api" | "request";
  };
};

export type VoucherState = {
  codeLast4: string;
  status: "issued" | "activated" | "partially_used" | "depleted" | "expired_dormant";
  activatedAt: string | null;
  initialValueCents: number;
  balanceCents: number; // live from Shopify, never cached locally
  currency: string;
  pinExpiresAt: string | null;
  pinnedExperience: PinnedExperience | null;
};

export type Activation = {
  sessionToken: string;
  sessionExpiresAt: string;
  voucher: VoucherState;
};

export type BookingCreated = {
  booking: {
    id: string;
    status: string;
    partySize: number;
    amountCents: number;
  };
  request: {
    id: string;
    proposedSlots: Slot[];
    tokenExpiresAt: string;
    emailSentAt: string | null;
  };
  alreadyPending: boolean;
  resent: boolean;
};

export type ApiErrorKind =
  | "invalid_input"
  | "not_found"
  | "rate_limited"
  | "session_expired"
  | "not_bookable"
  | "already_booked"
  | "email_failed"
  | "unavailable"
  | "server"
  | "network";

export type ApiError = {
  kind: ApiErrorKind;
  message: string; // ready-to-render UI copy (English, recipient-facing tone)
  fields?: string[]; // invalid_input: offending fields
  retryAfterS?: number; // rate_limited: from Retry-After header
};

export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: ApiError };
