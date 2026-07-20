// Slot proposal screen (request-mode booking) — visual from the Design
// export (BookingRequest.jsx), reworked per the arrival-time decision
// (2026-07-19): the recipient proposes WHEN THEY ARRIVE (date + time in
// 15-minute steps, AM/PM) — the experience's duration is described on the
// product, so no end time is asked for. The API contract stays Slot{start,
// end} with end > start, so a technical end of start + 15 min is sent; the
// provider-respond page renders arrival time only. (Known tail: the
// provider EMAIL still formats a start–end range — backend copy tweak.)
//
// Party size is deliberately not asked: the guest count is baked into the
// purchased product variant. The API's party_size is always sent as 1.
//
// Client validation mirrors the server (2-3 slots, 24h lead, 1y horizon,
// no duplicates) so 400s stay rare. Server error kinds handled:
// session_expired (inline banner — the session is cleared only when the
// user clicks "Re-enter your code", not automatically), already_booked,
// not_bookable, email_failed (retry by resubmitting), rate_limited.

import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
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
// The API needs end > start; arrival-time semantics make the end technical.
const TECHNICAL_END_MS = 15 * 60 * 1000;

// Arrival time is composed from four small controls (hour / :minutes /
// AM-PM), not one 96-option list: hours in a select, the four quarter-hour
// steps and the meridiem as segmented pills. Minutes default to :00; hour
// and AM/PM are explicit choices so nobody books 9 AM meaning 9 PM.
type SlotDraft = { date: string; hour: string; minute: string; ampm: "" | "AM" | "PM" };

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTE_OPTIONS = ["00", "15", "30", "45"];

const draftTouched = (d: SlotDraft) => Boolean(d.date || d.hour || d.ampm);
const to24h = (d: SlotDraft) =>
  `${String((Number(d.hour) % 12) + (d.ampm === "PM" ? 12 : 0)).padStart(2, "0")}:${d.minute}`;

function validate(drafts: SlotDraft[]): { slots?: Slot[]; errors: string[] } {
  const errors: string[] = [];
  const filled = drafts.filter(draftTouched);
  if (filled.length < MIN_SLOTS) {
    errors.push(
      `Pick at least ${MIN_SLOTS} time options — it helps your provider confirm one faster.`,
    );
  }

  const now = Date.now();
  const slots: Slot[] = [];
  filled.forEach((d, i) => {
    const n = i + 1;
    if (!d.date || !d.hour || !d.ampm)
      return errors.push(`Option ${n}: pick a date, an hour and AM or PM.`);
    const start = Date.parse(`${d.date}T${to24h(d)}`); // local time, like datetime-local was
    if (Number.isNaN(start)) return errors.push(`Option ${n}: that date doesn't look right.`);
    if (start < now + MIN_LEAD_MS)
      return errors.push(`Option ${n}: pick a time at least 24 hours from now.`);
    if (start > now + MAX_HORIZON_MS)
      return errors.push(`Option ${n}: keep it within the next year.`);
    slots.push({
      start: new Date(start).toISOString(),
      end: new Date(start + TECHNICAL_END_MS).toISOString(),
    });
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
    Array.from({ length: MAX_SLOTS }, () => ({ date: "", hour: "", minute: "00", ampm: "" as const })),
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [banner, setBanner] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const expired = banner?.kind === "session_expired";
  const disabled = submitting || expired;

  // Monetary vouchers have nothing to book here — the reveal screen sends
  // them to the catalogue instead. Guards direct /redeem/booking visits.
  // (After the hooks: keeps the hook order unconditional.)
  if (!exp) return <Navigate to="/redeem/success" replace />;

  const setDraft = (i: number, k: keyof SlotDraft, value: string) =>
    setDrafts((ds) => ds.map((d, j) => (j === i ? { ...d, [k]: value } : d)));

  const reenter = () => {
    clearSession();
    navigate("/redeem");
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    const v = validate(drafts);
    setErrors(v.errors);
    if (!v.slots) return;

    setSubmitting(true);
    const result = await createBookingRequest(session!.token, {
      slots: v.slots,
      partySize: 1, // guest count lives in the purchased product variant
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
                const complete = d.date && d.hour && d.ampm;
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
                      <label className="min-w-[140px] flex-[1_1_140px]">
                        <span className="mb-1 block text-xs font-medium text-gray-500">Date</span>
                        <input
                          type="date"
                          value={d.date}
                          onChange={(e) => setDraft(i, "date", e.target.value)}
                          className={inputCls}
                        />
                      </label>
                      <div className="min-w-[280px] flex-[2_1_300px]">
                        <span className="mb-1 block text-xs font-medium text-gray-500">
                          Arrival time
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            aria-label={`Option ${i + 1}: hour`}
                            value={d.hour}
                            onChange={(e) => setDraft(i, "hour", e.target.value)}
                            className={`${inputCls} !w-[86px] flex-none`}
                          >
                            <option value="" disabled>
                              Hour
                            </option>
                            {HOUR_OPTIONS.map((h) => (
                              <option key={h} value={h}>
                                {h}
                              </option>
                            ))}
                          </select>
                          <div
                            role="radiogroup"
                            aria-label={`Option ${i + 1}: minutes`}
                            className="inline-flex flex-none rounded-full bg-violet-100 p-1"
                          >
                            {MINUTE_OPTIONS.map((m) => (
                              <button
                                key={m}
                                type="button"
                                role="radio"
                                aria-checked={d.minute === m}
                                onClick={() => setDraft(i, "minute", m)}
                                className={`rounded-full px-2 py-1.5 text-[13px] font-semibold transition ${
                                  d.minute === m
                                    ? "bg-brand-violet text-white shadow-sm"
                                    : "text-gray-600 hover:text-brand-violet"
                                }`}
                              >
                                :{m}
                              </button>
                            ))}
                          </div>
                          <div
                            role="radiogroup"
                            aria-label={`Option ${i + 1}: AM or PM`}
                            className="inline-flex flex-none rounded-full bg-violet-100 p-1"
                          >
                            {(["AM", "PM"] as const).map((ap) => (
                              <button
                                key={ap}
                                type="button"
                                role="radio"
                                aria-checked={d.ampm === ap}
                                onClick={() => setDraft(i, "ampm", ap)}
                                className={`rounded-full px-2.5 py-1.5 text-[13px] font-semibold transition ${
                                  d.ampm === ap
                                    ? "bg-brand-violet text-white shadow-sm"
                                    : "text-gray-600 hover:text-brand-violet"
                                }`}
                              >
                                {ap}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
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
