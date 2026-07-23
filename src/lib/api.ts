// The only module that talks to the backend. Plain fetch — the functions are
// public (their own auth), no supabase-js needed.
//
// Error mapping follows the backend status contract exactly:
// - 404 is ONE neutral message (the server deliberately does not distinguish
//   "no such code" / "wrong email" / "wrong PIN" — neither do we);
// - 429 → wait + Retry-After; 401 → session expired (caller clears session);
// - 502 email_failed → state was created, resubmitting retries the send.

import type {
  Activation,
  ApiError,
  ApiResult,
  BookingCreated,
  BrowseExperience,
  ExchangeOutcome,
  ProviderBookingSummary,
  ProviderResponseOutcome,
  RecipientAlternativeSummary,
  RecipientResponseOutcome,
  Slot,
} from "./types";

// Dev: same-origin path, proxied by Vite (see vite.config.ts — CORS).
// Prod: direct call, the app origin is the one the functions allow.
const BASE = import.meta.env.DEV ? "" : (import.meta.env.VITE_SUPABASE_URL as string);

// The Supabase REST endpoint (unlike the edge functions) sends permissive
// CORS by default — no dev proxy needed, always call it directly.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

const NETWORK_ERROR: ApiError = {
  kind: "network",
  message: "Looks like you're offline. Check your connection and try again.",
};
const SERVER_ERROR: ApiError = {
  kind: "server",
  message: "Something hiccuped on our side — give it another try in a minute.",
};

type RawResponse = { status: number; retryAfterS?: number; body: Record<string, unknown> };

async function post(fn: string, payload: unknown): Promise<RawResponse | null> {
  try {
    const res = await fetch(`${BASE}/functions/v1/${fn}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const retryAfter = res.headers.get("Retry-After");
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return {
      status: res.status,
      retryAfterS: retryAfter ? Number(retryAfter) : undefined,
      body,
    };
  } catch {
    return null; // network failure
  }
}

const rateLimited = (retryAfterS?: number): ApiError => ({
  kind: "rate_limited",
  message: "Too many attempts. Take a short breather and try again.",
  retryAfterS,
});

// ── activate-voucher ─────────────────────────────────────────────────────────

export async function activateVoucher(input: {
  code: string;
  email: string;
  pin: string;
}): Promise<ApiResult<Activation>> {
  const res = await post("activate-voucher", input);
  if (!res) return { ok: false, error: NETWORK_ERROR };
  const { status, body } = res;

  if (status === 200) {
    const v = body.voucher as Record<string, any>;
    return {
      ok: true,
      data: {
        sessionToken: body.session_token as string,
        sessionExpiresAt: body.session_expires_at as string,
        voucher: {
          codeLast4: v.code_last4,
          status: v.status,
          activatedAt: v.activated_at ?? null,
          initialValueCents: v.initial_value_cents,
          balanceCents: v.balance_cents,
          currency: v.currency,
          pinExpiresAt: v.pin_expires_at ?? null,
          pinnedExperience: v.pinned_experience
            ? {
                title: v.pinned_experience.title,
                slug: v.pinned_experience.slug,
                retailPriceCents: v.pinned_experience.retail_price_cents,
                currency: v.pinned_experience.currency,
                imageUrl: v.pinned_experience.image_url ?? null,
                city: v.pinned_experience.city ?? null,
                participants: v.pinned_experience.participants ?? null,
                locationText: v.pinned_experience.location_text ?? null,
                duration: v.pinned_experience.duration ?? null,
                variantTitle: v.pinned_experience.variant_title ?? null,
                provider: {
                  name: v.pinned_experience.provider.name,
                  slug: v.pinned_experience.provider.slug,
                  bookingMode: v.pinned_experience.provider.booking_mode,
                },
              }
            : null,
        },
      },
    };
  }

  const error: ApiError =
    status === 400
      ? {
          kind: "invalid_input",
          message: "Check the highlighted fields.",
          fields: (body.fields as string[]) ?? [],
        }
      : status === 404
        ? {
            kind: "not_found",
            message: "We couldn't find that combination — double-check your code, email and PIN.",
          }
        : status === 429
          ? rateLimited(res.retryAfterS)
          : status === 503
            ? {
                kind: "unavailable",
                message: "We're briefly unavailable. Try again in a few minutes.",
              }
            : SERVER_ERROR;
  return { ok: false, error };
}

// ── provider-respond ─────────────────────────────────────────────────────────
// Provider-facing (magic link from the booking-request email). The backend
// answers one flat 404 for invalid/expired/already-used tokens — mirrored
// here as a single neutral message.

const INVALID_LINK: ApiError = {
  kind: "not_found",
  message: "This link is invalid, expired, or has already been used.",
};

export async function verifyProviderToken(
  token: string,
): Promise<ApiResult<ProviderBookingSummary>> {
  const res = await post("provider-respond", { token, action: "verify" });
  if (!res) return { ok: false, error: NETWORK_ERROR };
  const { status, body } = res;

  if (status === 200) {
    return {
      ok: true,
      data: {
        experienceTitle: body.experience_title as string,
        providerName: body.provider_name as string,
        partySize: body.party_size as number,
        proposedSlots: body.proposed_slots as Slot[],
        tokenExpiresAt: body.token_expires_at as string,
      },
    };
  }
  return { ok: false, error: res.status === 404 ? INVALID_LINK : SERVER_ERROR };
}

export async function respondToBooking(
  token: string,
  input:
    | { action: "accept"; slotIndex: number }
    | { action: "decline"; note?: string }
    | { action: "propose_alternative"; slot: Slot; note?: string },
): Promise<ApiResult<ProviderResponseOutcome>> {
  const payload =
    input.action === "accept"
      ? { token, action: "accept", slot_index: input.slotIndex }
      : input.action === "decline"
        ? { token, action: "decline", ...(input.note ? { note: input.note } : {}) }
        : { token, action: "propose_alternative", slot: input.slot, ...(input.note ? { note: input.note } : {}) };
  const res = await post("provider-respond", payload);
  if (!res) return { ok: false, error: NETWORK_ERROR };
  const { status, body } = res;

  if (status === 200) {
    if (body.response === "accepted") {
      const b = body.booking as Record<string, any>;
      return {
        ok: true,
        data: {
          response: "accepted",
          booking: { id: b.id, slot: b.slot, partySize: b.party_size },
        },
      };
    }
    return { ok: true, data: { response: body.response as "declined" | "alternative_proposed" } };
  }

  const error: ApiError =
    status === 404
      ? INVALID_LINK
      : status === 400
        ? {
            kind: "invalid_input",
            message: "Check the highlighted fields.",
            fields: (body.details as string[]) ?? [],
          }
        : status === 409
          ? {
              kind: "insufficient_balance",
              message:
                "This gift's balance can't cover the booking right now. Nothing was changed — Turile will sort it out with the recipient, no action needed on your side.",
            }
          : status === 502
            ? {
                kind: "redeem_failed",
                message:
                  "We couldn't capture the payment just now — nothing was charged and your link still works. Please try again in a moment.",
              }
            : SERVER_ERROR;
  return { ok: false, error };
}

// ── recipient-respond ────────────────────────────────────────────────────────
// The second, bounded round: a provider proposed one alternative time and
// the recipient can only accept (redeems the gift card) or decline (nothing
// charged). Same neutral-404 pattern as the provider flow.

export async function verifyRecipientToken(
  token: string,
): Promise<ApiResult<RecipientAlternativeSummary>> {
  const res = await post("recipient-respond", { token, action: "verify" });
  if (!res) return { ok: false, error: NETWORK_ERROR };
  const { status, body } = res;

  if (status === 200) {
    return {
      ok: true,
      data: {
        experienceTitle: body.experience_title as string,
        providerName: body.provider_name as string,
        suggestedSlot: body.suggested_slot as Slot,
        tokenExpiresAt: body.token_expires_at as string,
      },
    };
  }
  return { ok: false, error: status === 404 ? INVALID_LINK : SERVER_ERROR };
}

export async function respondToAlternative(
  token: string,
  action: "accept" | "decline",
): Promise<ApiResult<RecipientResponseOutcome>> {
  const res = await post("recipient-respond", { token, action });
  if (!res) return { ok: false, error: NETWORK_ERROR };
  const { status, body } = res;

  if (status === 200) {
    if (body.response === "accepted") {
      const b = body.booking as Record<string, any>;
      return { ok: true, data: { response: "accepted", booking: { id: b.id, slot: b.slot } } };
    }
    return {
      ok: true,
      data: {
        response: "declined",
        providerName: body.provider_name as string,
        providerContactEmail: (body.provider_contact_email as string | null) ?? null,
      },
    };
  }

  const error: ApiError =
    status === 404
      ? INVALID_LINK
      : status === 409
        ? {
            kind: "insufficient_balance",
            message:
              "This gift's balance can't cover the booking right now. Nothing was changed — Turile will follow up, no action needed on your side.",
          }
        : status === 502
          ? {
              kind: "redeem_failed",
              message:
                "We couldn't capture the payment just now — nothing was charged and your link still works. Please try again in a moment.",
            }
          : SERVER_ERROR;
  return { ok: false, error };
}

// ── booking-request ──────────────────────────────────────────────────────────

export async function createBookingRequest(
  sessionToken: string,
  input: { slots: Slot[]; partySize: number },
): Promise<ApiResult<BookingCreated>> {
  const res = await post("booking-request", {
    session_token: sessionToken,
    slots: input.slots,
    party_size: input.partySize,
  });
  if (!res) return { ok: false, error: NETWORK_ERROR };
  const { status, body } = res;

  if (status === 200) {
    const b = body.booking as Record<string, any>;
    const r = body.request as Record<string, any>;
    return {
      ok: true,
      data: {
        booking: { id: b.id, status: b.status, partySize: b.party_size, amountCents: b.amount_cents },
        request: {
          id: r.id,
          proposedSlots: r.proposed_slots,
          tokenExpiresAt: r.token_expires_at,
          emailSentAt: r.email_sent_at ?? null,
        },
        alreadyPending: Boolean(body.already_pending),
        resent: Boolean(body.resent),
      },
    };
  }

  const reasonText: Record<string, string> = {
    voucher_not_active: "This voucher can't be booked right now.",
    no_pinned_experience: "This voucher doesn't have a pinned experience.",
    experience_not_active: "This experience is temporarily unavailable.",
    provider_not_active: "This provider is temporarily unavailable.",
    provider_not_request_mode: "This experience books a little differently — get in touch and we'll sort it out.",
  };

  const error: ApiError =
    status === 401
      ? {
          kind: "session_expired",
          message: "Your session timed out. Activate your gift again to keep going.",
        }
      : status === 400
        ? {
            kind: "invalid_input",
            message: "Check your chosen times.",
            fields: (body.details as string[]) ?? [],
          }
        : status === 409 && body.error === "already_booked"
          ? { kind: "already_booked", message: "This gift already has an active booking." }
          : status === 409
            ? {
                kind: "not_bookable",
                message: reasonText[(body.reason as string) ?? ""] ?? "Booking isn't possible right now.",
              }
            : status === 429
              ? rateLimited(res.retryAfterS)
              : status === 502
                ? {
                    kind: "email_failed",
                    message:
                      "Your request is saved, but the email to the provider didn't go through. Hit \"Send booking request\" again and we'll retry.",
                  }
                : SERVER_ERROR;
  return { ok: false, error };
}

// ── browse (direct PostgREST read, anon key — no edge function) ─────────────

export async function browseExperiences(): Promise<ApiResult<BrowseExperience[]>> {
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/experiences?status=eq.active&select=id,title,slug,retail_price_cents,currency,image_url,city,participants,duration,provider:providers(name)&order=title.asc`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } },
    );
    if (!res.ok) return { ok: false, error: SERVER_ERROR };
    const rows = (await res.json()) as Array<Record<string, any>>;
    return {
      ok: true,
      data: rows.map((r) => ({
        id: r.id,
        title: r.title,
        slug: r.slug,
        retailPriceCents: r.retail_price_cents,
        currency: r.currency,
        imageUrl: r.image_url ?? null,
        city: r.city ?? null,
        participants: r.participants ?? null,
        duration: r.duration ?? null,
        providerName: r.provider?.name ?? "",
      })),
    };
  } catch {
    return { ok: false, error: NETWORK_ERROR };
  }
}

// ── exchange ─────────────────────────────────────────────────────────────────

export async function startExchange(
  sessionToken: string,
  toExperienceSlug: string,
): Promise<ApiResult<ExchangeOutcome>> {
  const res = await post("exchange", { session_token: sessionToken, to_experience_slug: toExperienceSlug });
  if (!res) return { ok: false, error: NETWORK_ERROR };
  const { status, body } = res;

  if (status === 200 && body.mode === "repinned") {
    const v = body.voucher as Record<string, any>;
    return {
      ok: true,
      data: {
        mode: "repinned",
        sessionToken: body.session_token as string,
        sessionExpiresAt: body.session_expires_at as string,
        voucher: {
          balanceCents: v.balance_cents,
          currency: v.currency,
          pinExpiresAt: v.pin_expires_at ?? null,
          pinnedExperience: v.pinned_experience
            ? {
                title: v.pinned_experience.title,
                slug: v.pinned_experience.slug,
                retailPriceCents: v.pinned_experience.retail_price_cents,
                currency: v.pinned_experience.currency,
                imageUrl: v.pinned_experience.image_url ?? null,
                city: v.pinned_experience.city ?? null,
                participants: v.pinned_experience.participants ?? null,
                locationText: v.pinned_experience.location_text ?? null,
                duration: v.pinned_experience.duration ?? null,
                variantTitle: null,
                provider: {
                  name: v.pinned_experience.provider.name,
                  slug: v.pinned_experience.provider.slug,
                  bookingMode: v.pinned_experience.provider.booking_mode,
                },
              }
            : null,
        },
      },
    };
  }
  if (status === 200 && body.mode === "checkout_required") {
    return {
      ok: true,
      data: {
        mode: "checkout_required",
        checkoutUrl: body.checkout_url as string,
        priceDeltaCents: body.price_delta_cents as number,
        currency: body.currency as string,
        expiresAt: body.expires_at as string,
      },
    };
  }

  const error: ApiError =
    status === 401
      ? { kind: "session_expired", message: "Your session timed out. Activate your gift again to keep going." }
      : status === 400
        ? { kind: "invalid_input", message: "Check your selection.", fields: (body.details as string[]) ?? [] }
        : status === 404
          ? { kind: "not_found", message: "That experience isn't available right now." }
          : status === 409 && body.error === "pending_topup_exists"
            ? {
                kind: "pending_topup_exists",
                message: "You already have an exchange in progress. Finish that payment, or wait for it to expire and try again.",
                expiresAt: body.expires_at as string | undefined,
              }
            : status === 409
              ? {
                  kind: "not_exchangeable",
                  message:
                    body.reason === "active_booking"
                      ? "This gift has an active booking request — wait for a response, or contact us to make changes."
                      : "This gift can't be exchanged right now.",
                }
              : status === 429
                ? rateLimited(res.retryAfterS)
                : status === 502
                  ? { kind: "checkout_failed", message: "We couldn't start checkout just now. Please try again in a moment." }
                  : status === 503
                    ? { kind: "unavailable", message: "We're briefly unavailable. Try again in a few minutes." }
                    : SERVER_ERROR;
  return { ok: false, error };
}
