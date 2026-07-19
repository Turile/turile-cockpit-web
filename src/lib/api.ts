// The only module that talks to the backend. Plain fetch — the functions are
// public (their own auth), no supabase-js needed.
//
// Error mapping follows the backend status contract exactly:
// - 404 is ONE neutral message (the server deliberately does not distinguish
//   "no such code" / "wrong email" / "wrong PIN" — neither do we);
// - 429 → wait + Retry-After; 401 → session expired (caller clears session);
// - 502 email_failed → state was created, resubmitting retries the send.

import type { Activation, ApiError, ApiResult, BookingCreated, Slot } from "./types";

// Dev: same-origin path, proxied by Vite (see vite.config.ts — CORS).
// Prod: direct call, the app origin is the one the functions allow.
const BASE = import.meta.env.DEV ? "" : (import.meta.env.VITE_SUPABASE_URL as string);

const NETWORK_ERROR: ApiError = {
  kind: "network",
  message: "Немає з'єднання. Перевір інтернет і спробуй ще раз.",
};
const SERVER_ERROR: ApiError = {
  kind: "server",
  message: "Щось пішло не так з нашого боку. Спробуй ще раз за хвилину.",
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
  message: "Забагато спроб. Зачекай трохи і спробуй знову.",
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
          message: "Перевір виділені поля.",
          fields: (body.fields as string[]) ?? [],
        }
      : status === 404
        ? { kind: "not_found", message: "Це поєднання коду, email та PIN не знайдено." }
        : status === 429
          ? rateLimited(res.retryAfterS)
          : status === 503
            ? { kind: "unavailable", message: "Сервіс тимчасово недоступний. Спробуй за кілька хвилин." }
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
    voucher_not_active: "Цей ваучер зараз не можна забукати.",
    no_pinned_experience: "На цьому ваучері немає закріпленого досвіду.",
    experience_not_active: "Цей досвід тимчасово недоступний.",
    provider_not_active: "Провайдер тимчасово недоступний.",
    provider_not_request_mode: "Цей досвід букається інакше — зв'яжись із нами.",
  };

  const error: ApiError =
    status === 401
      ? { kind: "session_expired", message: "Сесія завершилась. Активуй ваучер ще раз." }
      : status === 400
        ? {
            kind: "invalid_input",
            message: "Перевір обрані слоти.",
            fields: (body.details as string[]) ?? [],
          }
        : status === 409 && body.error === "already_booked"
          ? { kind: "already_booked", message: "У цього ваучера вже є активне бронювання." }
          : status === 409
            ? {
                kind: "not_bookable",
                message: reasonText[(body.reason as string) ?? ""] ?? "Зараз забукати не вийде.",
              }
            : status === 429
              ? rateLimited(res.retryAfterS)
              : status === 502
                ? {
                    kind: "email_failed",
                    message:
                      "Запит створено, але лист провайдеру не пішов. Натисни «Надіслати» ще раз — ми повторимо відправку.",
                  }
                : SERVER_ERROR;
  return { ok: false, error };
}
