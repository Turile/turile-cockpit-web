// Slot proposal screen (request-mode booking). TODO(design): full visual —
// date/time pickers, slot rows, party size stepper.
//
// Client validation mirrors the server exactly (2-3 slots, 24h lead, 1y
// horizon, ≤24h duration, no duplicates, party 1-20) so 400s stay rare.
// Server error kinds handled: session_expired (redirect), already_booked,
// not_bookable, email_failed (retry by resubmitting), rate_limited.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createBookingRequest } from "../lib/api";
import type { ApiError, Slot } from "../lib/types";
import { useVoucherSession } from "../session/VoucherSessionContext";

const MIN_SLOTS = 2;
const MAX_SLOTS = 3;
const MIN_LEAD_MS = 24 * 60 * 60 * 1000;
const MAX_HORIZON_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_DURATION_MS = 24 * 60 * 60 * 1000;
const PARTY_MIN = 1;
const PARTY_MAX = 20;

type SlotDraft = { start: string; end: string }; // datetime-local values

function validate(drafts: SlotDraft[], partySize: number): { slots?: Slot[]; errors: string[] } {
  const errors: string[] = [];
  const filled = drafts.filter((d) => d.start || d.end);
  if (filled.length < MIN_SLOTS) errors.push(`Запропонуй щонайменше ${MIN_SLOTS} варіанти часу.`);
  if (!Number.isInteger(partySize) || partySize < PARTY_MIN || partySize > PARTY_MAX) {
    errors.push(`Кількість людей — від ${PARTY_MIN} до ${PARTY_MAX}.`);
  }

  const now = Date.now();
  const slots: Slot[] = [];
  filled.forEach((d, i) => {
    const start = Date.parse(d.start);
    const end = Date.parse(d.end);
    const n = i + 1;
    if (Number.isNaN(start) || Number.isNaN(end)) return errors.push(`Слот ${n}: заповни початок і кінець.`);
    if (end <= start) return errors.push(`Слот ${n}: кінець має бути після початку.`);
    if (end - start > MAX_DURATION_MS) return errors.push(`Слот ${n}: не довше 24 годин.`);
    if (start < now + MIN_LEAD_MS) return errors.push(`Слот ${n}: щонайменше за 24 години від зараз.`);
    if (start > now + MAX_HORIZON_MS) return errors.push(`Слот ${n}: не далі ніж за рік.`);
    slots.push({ start: new Date(start).toISOString(), end: new Date(end).toISOString() });
  });
  if (new Set(slots.map((s) => s.start)).size !== slots.length) {
    errors.push("Слоти не мають повторюватись.");
  }
  return errors.length ? { errors } : { slots, errors: [] };
}

export default function BookingPage() {
  const navigate = useNavigate();
  const { session, clearSession } = useVoucherSession();
  const exp = session!.voucher.pinnedExperience;

  const [drafts, setDrafts] = useState<SlotDraft[]>(
    Array.from({ length: MAX_SLOTS }, () => ({ start: "", end: "" })),
  );
  const [partySize, setPartySize] = useState(1);
  const [errors, setErrors] = useState<string[]>([]);
  const [banner, setBanner] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const setDraft = (i: number, k: keyof SlotDraft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, [k]: e.target.value } : d)));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    const v = validate(drafts, partySize);
    setErrors(v.errors);
    if (!v.slots) return;

    setSubmitting(true);
    const result = await createBookingRequest(session!.token, {
      slots: v.slots,
      partySize,
    });
    setSubmitting(false);

    if (result.ok) {
      navigate("/redeem/booking/sent", { state: result.data });
    } else if (result.error.kind === "session_expired") {
      clearSession();
      navigate("/redeem");
    } else if (result.error.kind === "invalid_input") {
      setErrors(result.error.fields ?? [result.error.message]);
    } else {
      setBanner(result.error); // already_booked / not_bookable / email_failed / rate_limited / ...
    }
  };

  return (
    <section aria-labelledby="booking-title">
      {/* TODO(design): full visual */}
      <h1 id="booking-title" className="font-display">
        Обери зручний час
      </h1>
      {exp && (
        <p>
          {exp.title} · {exp.provider.name}
        </p>
      )}
      <p>Запропонуй 2–3 варіанти — провайдер підтвердить один упродовж 24–48 годин.</p>

      {banner && (
        <p role="alert" data-error-kind={banner.kind}>
          {banner.message}
        </p>
      )}
      {errors.length > 0 && (
        <ul role="alert">
          {errors.map((err) => (
            <li key={err}>{err}</li>
          ))}
        </ul>
      )}

      <form onSubmit={onSubmit} noValidate>
        {drafts.map((d, i) => (
          <fieldset key={i}>
            <legend>
              Варіант {i + 1}
              {i >= MIN_SLOTS ? " (необов'язково)" : ""}
            </legend>
            <label>
              Початок
              <input type="datetime-local" value={d.start} onChange={setDraft(i, "start")} />
            </label>
            <label>
              Кінець
              <input type="datetime-local" value={d.end} onChange={setDraft(i, "end")} />
            </label>
          </fieldset>
        ))}
        <label>
          Кількість людей
          <input
            type="number"
            min={PARTY_MIN}
            max={PARTY_MAX}
            value={partySize}
            onChange={(e) => setPartySize(Number(e.target.value))}
          />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? "Надсилаємо…" : "Надіслати запит"}
        </button>
      </form>
    </section>
  );
}
