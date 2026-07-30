// Balance view (/redeem/balance) — the last launch-blocking Phase 1 item
// (turile-platform-spec.md §7). A dedicated live read, separate from the
// session's own balanceCents snapshot (fetched once at activation/exchange,
// held in memory for up to 1h — this screen always re-checks). Exactly ONE
// explanatory line about the most recent money-affecting event, no
// transaction table — full history is Phase 4 Cockpit scope.
//
// Reuses ExchangePage/RedeemSuccessPage's card/chip/button language rather
// than inventing new components: rounded-3xl white card, font-display
// balance figure, violet-100 pill chips, PrimaryButton.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getBalance } from "../lib/api";
import type { ApiError, BalanceInfo } from "../lib/types";
import { useVoucherSession } from "../session/VoucherSessionContext";
import { AlertBanner, Flower, Icon, PrimaryButton, formatMoney } from "../components/redeem/shared";

const fmtAsOf = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

type Phase = "loading" | "error" | "ready";

export default function BalancePage() {
  const navigate = useNavigate();
  const { session } = useVoucherSession();

  const [phase, setPhase] = useState<Phase>("loading");
  const [balance, setBalance] = useState<BalanceInfo | null>(null);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await getBalance(session!.token);
      if (cancelled) return;
      if (!r.ok) {
        if (r.error.kind === "session_expired") { navigate("/redeem"); return; }
        setError(r.error);
        setPhase("error");
        return;
      }
      setBalance(r.data);
      setPhase("ready");
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const redeemedLine = (() => {
    const r = balance?.redeemed;
    if (!r) return null;
    if (r.count === 1) {
      return r.singleExperienceTitle
        ? `${formatMoney(r.totalAmountCents, balance!.currency ?? "CAD")} used on ${r.singleExperienceTitle}`
        : `${formatMoney(r.totalAmountCents, balance!.currency ?? "CAD")} used so far`;
    }
    return `${formatMoney(r.totalAmountCents, balance!.currency ?? "CAD")} used across ${r.count} bookings`;
  })();

  return (
    <section
      aria-labelledby="balance-title"
      className="relative min-h-screen w-full overflow-hidden bg-violet-50 px-4 py-6 pb-16 text-gray-900 sm:py-12"
    >
      <div className="rs-rise relative z-10 mx-auto max-w-xl">
        <button
          type="button"
          onClick={() => navigate("/redeem/success")}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700"
        >
          <Icon name="arrow" className="h-4 w-4 rotate-180" /> Back to your gift
        </button>

        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-700">
          <Flower className="h-3.5 w-4 text-brand-orange" /> Balance
        </span>
        <h1
          id="balance-title"
          className="mb-6 mt-3 text-balance font-display text-3xl leading-tight tracking-tight text-brand-violet sm:text-4xl"
        >
          Your gift balance
        </h1>

        {phase === "loading" && (
          <div className="flex items-center justify-center gap-3 rounded-3xl border border-violet-100 bg-white py-16 text-gray-600 shadow-xl shadow-brand-violet/20">
            <Icon name="spinner" className="rs-spin h-5 w-5" strokeWidth={2.4} /> Checking your balance…
          </div>
        )}

        {phase === "error" && (
          <AlertBanner>{error?.message ?? "Couldn't load your balance right now. Please try again shortly."}</AlertBanner>
        )}

        {phase === "ready" && balance && (
          <div className="overflow-hidden rounded-3xl border border-violet-100 bg-white p-6 text-center shadow-xl shadow-brand-violet/20 sm:p-8">
            {balance.balanceCents !== null ? (
              <div className="flex items-baseline justify-center gap-2">
                <span className="font-display text-5xl leading-none text-brand-violet">
                  {formatMoney(balance.balanceCents, balance.currency ?? "CAD")}
                </span>
                <span className="text-base font-semibold tracking-wide text-gray-500">{balance.currency}</span>
              </div>
            ) : (
              <p className="text-lg text-gray-600">We don&rsquo;t have a balance to show right now.</p>
            )}

            {redeemedLine && <p className="mt-3 text-base leading-normal text-gray-600">{redeemedLine}</p>}

            {balance.deactivated === true && (
              <div className="mt-5">
                <AlertBanner className="text-left">This gift card has been deactivated. Contact us if that&rsquo;s unexpected.</AlertBanner>
              </div>
            )}

            {!balance.isLive && (
              <p className="mt-4 text-sm text-gray-500">
                {balance.asOf
                  ? <>Showing the last balance we could confirm, as of {fmtAsOf(balance.asOf)} — we couldn&rsquo;t reach the live balance just now.</>
                  : <>We couldn&rsquo;t reach the live balance right now, and have no earlier value to show.</>}
              </p>
            )}
          </div>
        )}

        <PrimaryButton className="mt-6" onClick={() => navigate("/redeem/exchange")}>
          Browse experiences <Icon name="arrow" className="h-5 w-5" strokeWidth={2.4} />
        </PrimaryButton>
      </div>
    </section>
  );
}
