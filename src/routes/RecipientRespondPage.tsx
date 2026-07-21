// Recipient magic-link screen (/recipient/respond/:token) — the page behind
// the URL in the "provider suggested another time" email. This is the
// second, and last, round of request-mode booking (decision 2026-07-20/21):
// the recipient can only accept the ONE suggested time (redeems the gift
// card) or decline it (nothing charged, provider contact + exchange
// surfaced) — never propose yet another time. Mirrors ProviderRespondPage's
// shape (verify → act → outcome), simpler: no slot list, no counter-panel.
//
// The URL token is the only credential, independent of the activate-voucher
// session (which expires in 1h — this link must still work days later).
// Accept failure modes mirror the provider page: insufficient_balance
// (nothing the recipient can fix; reassure and stop) and redeem_failed
// (retryable — the backend compensates the claim, the link stays valid).

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { respondToAlternative, verifyRecipientToken } from "../lib/api";
import type { ApiError, RecipientAlternativeSummary, RecipientResponseOutcome } from "../lib/types";
import { AlertBanner, Flower, Icon, PrimaryButton, PrimaryLink, cx } from "../components/redeem/shared";
import logoOrange from "../assets/logo-orange.svg";

// Arrival time only — a slot's end is technical (arrival-time decision,
// 2026-07-19). Mountain Time, spelled out, like the email.
// TODO(phase2): per-provider timezone, together with the backend.
const fmtMoment = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone: "America/Edmonton",
  }).format(new Date(iso));

type Phase = "loading" | "invalid" | "ready";

export default function RecipientRespondPage() {
  const { token = "" } = useParams();

  const [phase, setPhase] = useState<Phase>("loading");
  const [summary, setSummary] = useState<RecipientAlternativeSummary | null>(null);
  const [outcome, setOutcome] = useState<RecipientResponseOutcome | null>(null);
  const [banner, setBanner] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    verifyRecipientToken(token).then((r) => {
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

  const act = async (action: "accept" | "decline") => {
    setBanner(null);
    setSubmitting(true);
    const r = await respondToAlternative(token, action);
    setSubmitting(false);
    if (r.ok) setOutcome(r.data);
    else if (r.error.kind === "not_found") setPhase("invalid");
    else setBanner(r.error);
  };

  const shell = (children: React.ReactNode) => (
    <section
      aria-labelledby="recipient-respond-title"
      className="relative min-h-screen w-full overflow-hidden bg-violet-50 px-4 py-6 pb-16 text-gray-900 sm:py-12"
    >
      <div className="rs-rise relative z-10 mx-auto max-w-xl text-center">
        <img src={logoOrange} alt="Turile" className="mx-auto mb-6 h-8 w-auto" />
        {children}
      </div>
    </section>
  );

  if (phase === "loading") {
    return shell(
      <div className="flex min-h-[50vh] items-center justify-center gap-3 text-gray-600">
        <Icon name="spinner" className="rs-spin h-5 w-5" strokeWidth={2.4} /> Checking your link…
      </div>,
    );
  }

  if (phase === "invalid") {
    return shell(
      <div className="mt-10">
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-violet-100">
          <Icon name="alert" className="h-8 w-8 text-brand-violet" strokeWidth={2.2} />
        </div>
        <h1 id="recipient-respond-title" className="mb-2 font-display text-3xl tracking-tight text-brand-violet">
          This link isn&rsquo;t active anymore
        </h1>
        <p className="mx-auto max-w-[42ch] text-lg leading-normal text-gray-600">
          It may have expired, or you&rsquo;ve already responded. Your gift is safe either way —
          open it again to check its status.
        </p>
      </div>,
    );
  }

  if (outcome) {
    const accepted = outcome.response === "accepted";
    return shell(
      <div className="mt-10">
        <div
          className={cx(
            "rs-pop mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full shadow-lg shadow-brand-violet/20",
            accepted ? "bg-brand-lime" : "bg-violet-100",
          )}
        >
          <Icon name={accepted ? "check" : "alert"} className="h-8 w-8 text-brand-violet" strokeWidth={2.6} />
        </div>
        <h1 id="recipient-respond-title" className="mb-2 font-display text-3xl tracking-tight text-brand-violet">
          {accepted ? "Confirmed — you're all set" : "No worries — here's what to do next"}
        </h1>
        {accepted ? (
          <>
            <p className="mx-auto mb-4 max-w-[42ch] text-lg leading-normal text-gray-600">
              Your gift has been redeemed for this booking:
            </p>
            <p className="text-base font-semibold text-gray-900">{fmtMoment(outcome.booking.slot.start)}</p>
            <p className="mt-5 text-xs tracking-wide text-gray-500">
              Booking reference: {outcome.booking.id}
            </p>
          </>
        ) : (
          <>
            <p className="mx-auto mb-5 max-w-[42ch] text-lg leading-normal text-gray-600">
              Your gift was not charged. To find another time, reach {outcome.providerName} directly
              {outcome.providerContactEmail ? (
                <>
                  {" "}
                  at{" "}
                  <a
                    href={`mailto:${outcome.providerContactEmail}`}
                    className="font-semibold text-brand-violet underline decoration-2 underline-offset-4"
                  >
                    {outcome.providerContactEmail}
                  </a>
                </>
              ) : (
                ""
              )}
              . Or pick a different experience altogether:
            </p>
            <PrimaryLink href="https://turil.ca" className="mx-auto max-w-xs">
              Browse experiences <Icon name="arrow" className="h-5 w-5" strokeWidth={2.4} />
            </PrimaryLink>
          </>
        )}
      </div>,
    );
  }

  const s = summary!;
  return shell(
    <>
      <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-700">
        <Flower className="h-3.5 w-4 text-brand-orange" /> New time suggested
      </span>
      <h1
        id="recipient-respond-title"
        className="mb-2 mt-3 text-balance font-display text-3xl leading-tight tracking-tight text-brand-violet sm:text-4xl"
      >
        Does this time work?
      </h1>
      <p className="mx-auto mb-6 max-w-[46ch] text-lg leading-normal text-gray-600">
        {s.providerName} couldn&rsquo;t make your proposed times for{" "}
        <strong className="font-semibold text-gray-900">{s.experienceTitle}</strong>, but suggested:
      </p>

      {banner && (
        <AlertBanner
          className="mb-5 text-left"
          tone={banner.kind === "insufficient_balance" ? "muted" : "error"}
          data-error-kind={banner.kind}
        >
          {banner.message}
        </AlertBanner>
      )}

      <div className="rounded-3xl border border-violet-100 bg-white p-5 shadow-xl shadow-brand-violet/20 sm:p-7">
        <p className="mb-5 text-xl font-semibold text-gray-900">{fmtMoment(s.suggestedSlot.start)}</p>

        <PrimaryButton loading={submitting} disabled={submitting} onClick={() => void act("accept")}>
          Yes, this works
        </PrimaryButton>
        <button
          type="button"
          disabled={submitting}
          onClick={() => void act("decline")}
          className="mt-4 w-full text-sm font-semibold text-gray-600 underline decoration-2 underline-offset-4"
        >
          I can&rsquo;t make this time
        </button>
      </div>

      <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs tracking-wide text-gray-500">
        <Flower className="h-3 w-3.5 text-brand-orange" />
        This link is personal and expires {fmtMoment(s.tokenExpiresAt)} (Mountain Time)
      </p>
    </>,
  );
}
