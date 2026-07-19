// Slot proposal screen (request-mode booking) — visual from the Design
// export (BookingRequest.jsx). The slot inputs stay start/end
// datetime-local pairs (the API contract is Slot{start,end} with duration
// rules), laid out inside the design's slot cards.
//
// Client validation mirrors the server exactly (2-3 slots, 24h lead, 1y
// horizon, ≤24h duration, no duplicates, party 1-20) so 400s stay rare.
// Server error kinds handled: session_expired (inline banner — the session
// is cleared only when the user clicks "Re-enter your code", not
// automatically), already_booked, not_bookable, email_failed (retry by
// resubmitting), rate_limited.

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createBookingRequest } from "../lib/api";
import type { ApiError, Slot } from "../lib/types";
import { useVoucherSession } from "../session/VoucherSessionContext";
import { AlertBanner, Icon, PrimaryButton, inputCls } from "../components/redeem/shared";

// TODO: real experience photo from catalog
const EXPERIENCE_THUMB = "https://picsum.photos/seed/turile-balloon-hero/200/200";

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
  if (filled.length < MIN_SLOTS) {
    errors.push(
      `Pick at least ${MIN_SLOTS} time options — it helps your provider confirm one faster.`,
    );
  }
  if (!Number.isInteger(partySize) || partySize < PARTY_MIN || partySize > PARTY_MAX) {
    errors.push(`Party size should be between ${PARTY_MIN} and ${PARTY_MAX}.`);
  }

  const now = Date.now();
  const slots: Slot[] = [];
  filled.forEach((d, i) => {
    const start = Date.parse(d.start);
    const end = Date.parse(d.end);
    const n = i + 1;
    if (Number.isNaN(start) || Number.isNaN(end))
      return errors.push(`Option ${n}: fill in both the start and the end.`);
    if (end <= start) return errors.push(`Option ${n}: the end should come after the start.`);
    if (end - start > MAX_DURATION_MS)
      return errors.push(`Option ${n}: keep it under 24 hours.`);
    if (start < now + MIN_LEAD_MS)
      return errors.push(`Option ${n}: pick a time at least 24 hours from now.`);
    if (start > now + MAX_HORIZON_MS)
      return errors.push(`Option ${n}: keep it within the next year.`);
    slots.push({ start: new Date(start).toISOString(), end: new Date(end).toISOString() });
  });
  if (new Set(slots.map((s) => s.start)).size !== slots.length) {
    errors.push("Your options shouldn't repeat — mix the times up a little.");
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

  const expired = banner?.kind === "session_expired";
  const disabled = submitting || expired;

  const setDraft = (i: number, k: keyof SlotDraft) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, [k]: e.target.value } : d)));

  const reenter = () => {
    clearSession();
    navigate("/redeem");
  };

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
    } else if (result.error.kind === "invalid_input") {
      setErrors(result.error.fields ?? [result.error.message]);
    } else {
      // session_expired renders the dedicated inline banner below; the session
      // itself is cleared only via the "Re-enter your code" link.
      setBanner(result.error);
    }
  };

  return (
    <section
      aria-labelledby="booking-title"
      className="relative min-h-screen w-full overflow-hidden bg-violet-50 px-4 py-6 pb-16 text-gray-900 sm:py-12"
    >
      <div className="rs-rise mx-auto max-w-xl">
        <Link
          to="/redeem/success"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700"
        >
          <Icon name="arrow" className="h-4 w-4 rotate-180" /> Back to your gift
        </Link>

        <span className="block text-xs font-semibold uppercase tracking-wider text-violet-700">
          Request your dates
        </span>
        <h1
          id="booking-title"
          className="my-2 font-display text-3xl leading-tight tracking-tight text-brand-violet sm:text-4xl"
        >
          Choose a few times that work
        </h1>
        <p className="mb-5 text-lg leading-normal text-gray-600">
          Pick 2–3 options and your provider will confirm one within 24–48 hours.
        </p>

        {/* recap strip */}
        {exp && (
          <div className="mb-5 flex items-center gap-3.5 rounded-2xl border border-violet-100 bg-white p-3 shadow-md shadow-brand-violet/10">
            <img
              src={EXPERIENCE_THUMB}
              alt=""
              className="h-16 w-16 flex-none rounded-xl object-cover"
            />
            <div className="min-w-0">
              <div className="text-base font-semibold leading-snug text-gray-900">{exp.title}</div>
              <div className="mt-0.5 text-sm text-gray-500">by {exp.provider.name}</div>
            </div>
          </div>
        )}

        {expired && (
          <div
            role="alert"
            data-error-kind="session_expired"
            className="mb-5 flex items-start gap-3 rounded-2xl border border-violet-100 bg-violet-100 p-4 text-sm leading-normal text-gray-600"
          >
            <Icon name="clockAlt" className="h-5 w-5 flex-none text-brand-orange" />
            <div>
              <strong className="font-bold text-gray-900">Your session timed out.</strong> For
              your security we paused this booking. Your gift is safe — sign back in to pick up
              where you left off.{" "}
              <button
                type="button"
                onClick={reenter}
                className="font-semibold text-brand-violet underline underline-offset-2"
              >
                Re-enter your code
              </button>
            </div>
          </div>
        )}

        <form onSubmit={onSubmit} noValidate>
          <fieldset
            disabled={disabled}
            className={`m-0 min-w-0 border-0 p-0 ${expired ? "opacity-50" : ""}`}
          >
            <div className="flex flex-col gap-3.5">
              {drafts.map((d, i) => {
                const complete = d.start && d.end;
                return (
                  <div
                    key={i}
                    className={`rounded-2xl border-2 bg-white p-4 shadow-md shadow-brand-violet/10 ${
                      complete ? "border-violet-700" : "border-violet-100"
                    }`}
                  >
                    <div className="mb-3 flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-900">Option {i + 1}</span>
                      <span
                        className={`text-xs font-semibold ${
                          i < MIN_SLOTS ? "text-brand-orange" : "text-gray-500"
                        }`}
                      >
                        {i < MIN_SLOTS ? "Required" : "Optional"}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      <label className="min-w-[150px] flex-[1_1_150px]">
                        <span className="mb-1 block text-xs font-medium text-gray-500">
                          Starts
                        </span>
                        <input
                          type="datetime-local"
                          value={d.start}
                          onChange={setDraft(i, "start")}
                          className={inputCls}
                        />
                      </label>
                      <label className="min-w-[150px] flex-[1_1_150px]">
                        <span className="mb-1 block text-xs font-medium text-gray-500">Ends</span>
                        <input
                          type="datetime-local"
                          value={d.end}
                          onChange={setDraft(i, "end")}
                          className={inputCls}
                        />
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-100 bg-white p-4 shadow-md shadow-brand-violet/10">
              <span className="inline-flex items-center gap-2 text-base font-semibold text-gray-900">
                <Icon name="users" className="h-5 w-5 text-violet-700" /> Party size
              </span>
              <div className="inline-flex items-center gap-3.5 rounded-full bg-violet-100 px-2 py-1">
                <button
                  type="button"
                  aria-label="Fewer guests"
                  onClick={() => setPartySize((p) => Math.max(PARTY_MIN, p - 1))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-xl font-semibold text-brand-violet shadow-sm"
                >
                  −
                </button>
                <span className="min-w-[20px] text-center text-base font-bold text-gray-900">
                  {partySize}
                </span>
                <button
                  type="button"
                  aria-label="More guests"
                  onClick={() => setPartySize((p) => Math.min(PARTY_MAX, p + 1))}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-xl font-semibold text-brand-violet shadow-sm"
                >
                  +
                </button>
              </div>
            </div>
          </fieldset>

          {errors.length > 0 && (
            <AlertBanner className="mt-5">
              <ul className="m-0 list-none p-0">
                {errors.map((err) => (
                  <li key={err}>{err}</li>
                ))}
              </ul>
            </AlertBanner>
          )}

          {banner && !expired && (
            <AlertBanner
              tone={banner.kind === "rate_limited" ? "muted" : "error"}
              data-error-kind={banner.kind}
              className="mt-5"
            >
              {banner.message}
              {banner.kind === "rate_limited" && banner.retryAfterS
                ? ` (~${Math.ceil(banner.retryAfterS / 60)} min)`
                : null}
            </AlertBanner>
          )}

          <PrimaryButton type="submit" className="mt-6" loading={submitting} disabled={expired}>
            {submitting ? "Sending request…" : "Send booking request"}
          </PrimaryButton>
        </form>
        <p className="mt-3.5 text-center text-xs text-gray-500">
          No charge — your gift covers the full experience.
        </p>
      </div>
    </section>
  );
}
