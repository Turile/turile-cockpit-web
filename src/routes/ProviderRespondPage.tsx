// Provider magic-link screen (/provider/respond/:token) — the page behind
// the URL in booking-request emails. No design export exists for the
// provider side; this reuses the recipient flow's visual grammar with a
// calmer, more business-like tone (the reader is a partner, not a giftee).
//
// The URL token is the only credential (verified server-side by hash).
// verify is read-only and safe to repeat; accept/decline/suggest burn the
// token one-shot — accept also captures money, so its failure modes are
// surfaced distinctly: insufficient_balance (nothing the provider can fix;
// reassure and stop) and redeem_failed (retryable — the backend compensates
// the claim and the token stays valid).
//
// Alternative-slot validation mirrors the server rules (24h lead, ≤24h
// duration, ≤1y horizon) so 400s stay rare, same approach as BookingPage.

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { respondToBooking, verifyProviderToken } from "../lib/api";
import type { ApiError, ProviderBookingSummary, ProviderResponseOutcome, Slot } from "../lib/types";
import {
  AlertBanner,
  Flower,
  Icon,
  PrimaryButton,
  cx,
  inputCls,
  labelCls,
} from "../components/redeem/shared";

const MIN_LEAD_MS = 24 * 60 * 60 * 1000;
const MAX_HORIZON_MS = 365 * 24 * 60 * 60 * 1000;
const MAX_DURATION_MS = 24 * 60 * 60 * 1000;
const MAX_NOTE_LEN = 500;

// Same rendering as the provider email: Mountain Time, spelled out.
// TODO(phase2): per-provider timezone, together with the backend.
const fmtSlot = (s: Slot) => {
  const day = new Intl.DateTimeFormat("en-CA", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Edmonton",
  });
  const end = new Intl.DateTimeFormat("en-CA", { timeStyle: "short", timeZone: "America/Edmonton" });
  return `${day.format(new Date(s.start))} – ${end.format(new Date(s.end))} (Mountain Time)`;
};

const fmtMoment = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Edmonton",
  }).format(new Date(iso));

const validateAlt = (draft: { start: string; end: string }): { slot?: Slot; error?: string } => {
  const start = draft.start ? Date.parse(draft.start) : NaN;
  const end = draft.end ? Date.parse(draft.end) : NaN;
  if (Number.isNaN(start) || Number.isNaN(end)) return { error: "Pick both a start and an end time." };
  if (end <= start) return { error: "The end time must be after the start." };
  if (end - start > MAX_DURATION_MS) return { error: "Keep it under 24 hours." };
  const now = Date.now();
  if (start < now + MIN_LEAD_MS) return { error: "Pick a time at least 24 hours from now." };
  if (start > now + MAX_HORIZON_MS) return { error: "Keep it within the next year." };
  return { slot: { start: new Date(start).toISOString(), end: new Date(end).toISOString() } };
};

type Phase = "loading" | "invalid" | "ready";
type Panel = "none" | "alternative" | "decline";

export default function ProviderRespondPage() {
  const { token = "" } = useParams();

  const [phase, setPhase] = useState<Phase>("loading");
  const [summary, setSummary] = useState<ProviderBookingSummary | null>(null);
  const [outcome, setOutcome] = useState<ProviderResponseOutcome | null>(null);
  const [banner, setBanner] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [slotIndex, setSlotIndex] = useState(0);
  const [panel, setPanel] = useState<Panel>("none");
  const [altDraft, setAltDraft] = useState({ start: "", end: "" });
  const [altError, setAltError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  useEffect(() => {
    let alive = true;
    verifyProviderToken(token).then((r) => {
      if (!alive) return;
      if (r.ok) {
        setSummary(r.data);
        setPhase("ready");
      } else {
        setPhase("invalid");
      }
    });
    return () => {
      alive = false;
    };
  }, [token]);

  const act = async (input: Parameters<typeof respondToBooking>[1]) => {
    setBanner(null);
    setSubmitting(true);
    const r = await respondToBooking(token, input);
    setSubmitting(false);
    if (r.ok) setOutcome(r.data);
    else if (r.error.kind === "not_found") setPhase("invalid");
    else setBanner(r.error);
  };

  const submitAlternative = () => {
    const v = validateAlt(altDraft);
    setAltError(v.error ?? null);
    if (v.slot) void act({ action: "propose_alternative", slot: v.slot, note: note.trim() || undefined });
  };

  const shell = (children: React.ReactNode) => (
    <section
      aria-labelledby="respond-title"
      className="relative min-h-screen w-full overflow-hidden bg-violet-50 px-4 py-6 pb-16 text-gray-900 sm:py-12"
    >
      <div className="rs-rise relative z-10 mx-auto max-w-xl">{children}</div>
    </section>
  );

  if (phase === "loading") {
    return shell(
      <div className="flex min-h-[60vh] items-center justify-center gap-3 text-gray-600">
        <Icon name="spinner" className="rs-spin h-5 w-5" strokeWidth={2.4} /> Checking your link…
      </div>,
    );
  }

  if (phase === "invalid") {
    return shell(
      <div className="text-center">
        <div className="mx-auto mb-5 mt-10 flex h-16 w-16 items-center justify-center rounded-full bg-violet-100">
          <Icon name="alert" className="h-8 w-8 text-brand-violet" strokeWidth={2.2} />
        </div>
        <h1 id="respond-title" className="mb-2 font-display text-3xl tracking-tight text-brand-violet">
          This link isn&rsquo;t active anymore
        </h1>
        <p className="mx-auto max-w-[42ch] text-lg leading-normal text-gray-600">
          It may have expired, or this request was already answered. If something feels off,
          just reply to the booking email and we&rsquo;ll take it from there.
        </p>
      </div>,
    );
  }

  if (outcome) {
    const accepted = outcome.response === "accepted";
    return shell(
      <div className="text-center">
        <div
          className={cx(
            "rs-pop mx-auto mb-5 mt-10 flex h-16 w-16 items-center justify-center rounded-full shadow-lg shadow-brand-violet/20",
            accepted ? "bg-brand-lime" : "bg-violet-100",
          )}
        >
          <Icon name="check" className="h-8 w-8 text-brand-violet" strokeWidth={2.6} />
        </div>
        <h1 id="respond-title" className="mb-2 font-display text-3xl tracking-tight text-brand-violet">
          {accepted
            ? "Confirmed — you're all set"
            : outcome.response === "declined"
              ? "Request declined"
              : "Suggestion sent"}
        </h1>
        {accepted ? (
          <>
            <p className="mx-auto mb-4 max-w-[42ch] text-lg leading-normal text-gray-600">
              The guest has been notified and their gift has been redeemed for this booking:
            </p>
            <p className="text-base font-semibold text-gray-900">{fmtSlot(outcome.booking.slot)}</p>
            <p className="mt-1 text-sm text-gray-600">
              {outcome.booking.partySize} {outcome.booking.partySize === 1 ? "guest" : "guests"}
            </p>
            <p className="mt-5 text-xs tracking-wide text-gray-500">
              Booking reference: {outcome.booking.id}
            </p>
          </>
        ) : (
          <p className="mx-auto max-w-[42ch] text-lg leading-normal text-gray-600">
            {outcome.response === "declined"
              ? "The guest has been notified. Their gift stays untouched — nothing was charged."
              : "The guest has been notified of your suggested time. Their gift stays untouched; if the new time works, they'll simply book again."}
          </p>
        )}
      </div>,
    );
  }

  const s = summary!;
  return shell(
    <>
      <span className="block text-xs font-semibold uppercase tracking-wider text-violet-700">
        Booking request
      </span>
      <h1
        id="respond-title"
        className="mb-2 mt-2 text-balance font-display text-3xl leading-tight tracking-tight text-brand-violet sm:text-4xl"
      >
        Can you host this one?
      </h1>
      <p className="mb-6 max-w-[52ch] text-lg leading-normal text-gray-600">
        Hi {s.providerName} — a Turile gift recipient would like to book{" "}
        <strong className="font-semibold text-gray-900">{s.experienceTitle}</strong> for{" "}
        {s.partySize} {s.partySize === 1 ? "guest" : "guests"}. Pick a time that works, suggest
        another, or decline.
      </p>

      {banner && (
        <AlertBanner
          className="mb-5"
          tone={banner.kind === "insufficient_balance" ? "muted" : "error"}
          data-error-kind={banner.kind}
        >
          {banner.message}
        </AlertBanner>
      )}

      <div className="rounded-3xl border border-violet-100 bg-white p-5 shadow-xl shadow-brand-violet/20 sm:p-7">
        <div role="radiogroup" aria-label="Proposed times" className="grid gap-3">
          {s.proposedSlots.map((slot, i) => (
            <button
              key={slot.start}
              type="button"
              role="radio"
              aria-checked={slotIndex === i}
              onClick={() => setSlotIndex(i)}
              disabled={submitting}
              className={cx(
                "flex items-center gap-3 rounded-2xl border-2 px-4 py-3.5 text-left text-base transition",
                slotIndex === i
                  ? "border-brand-violet bg-violet-50 font-semibold text-gray-900"
                  : "border-violet-100 text-gray-600 hover:border-violet-700",
              )}
            >
              <span
                aria-hidden="true"
                className={cx(
                  "flex h-5 w-5 flex-none items-center justify-center rounded-full border-2",
                  slotIndex === i ? "border-brand-violet" : "border-violet-100",
                )}
              >
                {slotIndex === i && <span className="h-2.5 w-2.5 rounded-full bg-brand-violet" />}
              </span>
              {fmtSlot(slot)}
            </button>
          ))}
        </div>

        <PrimaryButton
          className="mt-5"
          loading={submitting && panel === "none"}
          disabled={submitting}
          onClick={() => void act({ action: "accept", slotIndex })}
        >
          Confirm this time
        </PrimaryButton>

        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-violet-100 pt-4 text-sm font-semibold">
          <button
            type="button"
            disabled={submitting}
            onClick={() => setPanel(panel === "alternative" ? "none" : "alternative")}
            className="text-brand-violet underline decoration-2 underline-offset-4"
          >
            Suggest another time
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => setPanel(panel === "decline" ? "none" : "decline")}
            className="text-gray-600 underline decoration-2 underline-offset-4"
          >
            Can&rsquo;t host this — decline
          </button>
        </div>

        {panel !== "none" && (
          <div className="mt-5 rounded-2xl bg-violet-50 p-4 sm:p-5">
            {panel === "alternative" && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label htmlFor="alt-start" className={labelCls}>
                    Starts
                  </label>
                  <input
                    id="alt-start"
                    type="datetime-local"
                    className={inputCls}
                    value={altDraft.start}
                    disabled={submitting}
                    aria-invalid={!!altError}
                    onChange={(e) => setAltDraft((d) => ({ ...d, start: e.target.value }))}
                  />
                </div>
                <div>
                  <label htmlFor="alt-end" className={labelCls}>
                    Ends
                  </label>
                  <input
                    id="alt-end"
                    type="datetime-local"
                    className={inputCls}
                    value={altDraft.end}
                    disabled={submitting}
                    aria-invalid={!!altError}
                    onChange={(e) => setAltDraft((d) => ({ ...d, end: e.target.value }))}
                  />
                </div>
              </div>
            )}
            <div className={panel === "alternative" ? "mt-3" : ""}>
              <label htmlFor="respond-note" className={labelCls}>
                Note for the guest <span className="font-normal text-gray-500">(optional)</span>
              </label>
              <textarea
                id="respond-note"
                rows={2}
                maxLength={MAX_NOTE_LEN}
                disabled={submitting}
                className={cx(inputCls, "rounded-2xl")}
                placeholder={
                  panel === "alternative"
                    ? "e.g. Mornings are quieter that week"
                    : "e.g. We're fully booked this season"
                }
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
            {altError && panel === "alternative" && (
              <AlertBanner className="mt-3">{altError}</AlertBanner>
            )}
            <PrimaryButton
              className="mt-4"
              loading={submitting}
              disabled={submitting}
              onClick={() =>
                panel === "alternative"
                  ? submitAlternative()
                  : void act({ action: "decline", note: note.trim() || undefined })
              }
            >
              {panel === "alternative" ? "Send suggestion" : "Decline this request"}
            </PrimaryButton>
          </div>
        )}
      </div>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs tracking-wide text-gray-500">
        <Flower className="h-3 w-3.5 text-brand-lime" />
        This link is personal and expires {fmtMoment(s.tokenExpiresAt)} (Mountain Time)
      </p>
    </>,
  );
}
