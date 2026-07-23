// Browse + exchange screen (/redeem/exchange) — spec §5.4's three
// scenarios, one screen: pick any active experience, and the backend
// decides whether it's an instant re-pin (equal/cheaper, or a monetary
// voucher's first-ever pin) or needs a top-up (more expensive). No design
// export exists for this screen; it reuses the recipient flow's card/chip
// grammar from RedeemSuccessPage.
//
// Browsing itself is a direct anon-key PostgREST read (RLS already allows
// public read of active experiences) — no edge function involved, no
// session needed for that part. Only starting an exchange is session-gated.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { browseExperiences, startExchange } from "../lib/api";
import type { ApiError, BrowseExperience } from "../lib/types";
import { useVoucherSession } from "../session/VoucherSessionContext";
import { AlertBanner, Flower, Icon, PrimaryButton, cx, formatMoney } from "../components/redeem/shared";

type Phase = "loading" | "error" | "ready";

export default function ExchangePage() {
  const navigate = useNavigate();
  const { session, applyExchange } = useVoucherSession();
  const voucher = session!.voucher;
  const currentSlug = voucher.pinnedExperience?.slug ?? null;

  const [phase, setPhase] = useState<Phase>("loading");
  const [experiences, setExperiences] = useState<BrowseExperience[]>([]);
  const [selected, setSelected] = useState<BrowseExperience | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<ApiError | null>(null);
  const [repinnedTitle, setRepinnedTitle] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    browseExperiences().then((r) => {
      if (!alive) return;
      if (r.ok) {
        setExperiences(r.data.filter((e) => e.slug !== currentSlug));
        setPhase("ready");
      } else {
        setPhase("error");
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const confirm = async () => {
    if (!selected) return;
    setBanner(null);
    setSubmitting(true);
    const r = await startExchange(session!.token, selected.slug);
    setSubmitting(false);
    if (!r.ok) {
      if (r.error.kind === "session_expired") { navigate("/redeem"); return; }
      setBanner(r.error);
      return;
    }
    if (r.data.mode === "repinned") {
      applyExchange(r.data.sessionToken, r.data.sessionExpiresAt, {
        balanceCents: r.data.voucher.balanceCents,
        currency: r.data.voucher.currency,
        pinExpiresAt: r.data.voucher.pinExpiresAt,
        pinnedExperience: r.data.voucher.pinnedExperience,
      });
      setRepinnedTitle(selected.title);
    } else {
      // Real payment page — leave the SPA entirely, same as any external checkout.
      window.location.href = r.data.checkoutUrl;
    }
  };

  if (repinnedTitle) {
    return (
      <section className="relative min-h-screen w-full overflow-hidden bg-violet-50 px-4 py-6 pb-16 text-gray-900 sm:py-12">
        <div className="rs-rise relative z-10 mx-auto max-w-xl text-center">
          <div className="rs-pop mx-auto mb-5 mt-10 flex h-16 w-16 items-center justify-center rounded-full bg-brand-lime shadow-lg shadow-brand-violet/20">
            <Icon name="check" className="h-8 w-8 text-brand-violet" strokeWidth={2.6} />
          </div>
          <h1 className="mb-2 font-display text-3xl tracking-tight text-brand-violet">Swapped — enjoy!</h1>
          <p className="mx-auto mb-6 max-w-[42ch] text-lg leading-normal text-gray-600">
            Your gift now points to <strong className="font-semibold text-gray-900">{repinnedTitle}</strong>.
          </p>
          <PrimaryButton onClick={() => navigate("/redeem/success")}>Back to my gift</PrimaryButton>
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="exchange-title"
      className="relative min-h-screen w-full overflow-hidden bg-violet-50 px-4 py-6 pb-16 text-gray-900 sm:py-12"
    >
      <div className="rs-rise relative z-10 mx-auto max-w-3xl">
        <button
          type="button"
          onClick={() => navigate("/redeem/success")}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700"
        >
          <Icon name="arrow" className="h-4 w-4 rotate-180" /> Back to your gift
        </button>

        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-700">
          <Flower className="h-3.5 w-4 text-brand-orange" /> Exchange
        </span>
        <h1
          id="exchange-title"
          className="mb-2 mt-3 text-balance font-display text-3xl leading-tight tracking-tight text-brand-violet sm:text-4xl"
        >
          Pick something else
        </h1>
        <p className="mb-6 max-w-[60ch] text-lg leading-normal text-gray-600">
          Equal or cheaper — it&rsquo;s instant, and the rest stays on your balance. Pricier —
          you&rsquo;ll cover just the difference.
        </p>

        {banner && (
          <AlertBanner className="mb-5" tone={banner.kind === "pending_topup_exists" ? "muted" : "error"} data-error-kind={banner.kind}>
            {banner.message}
          </AlertBanner>
        )}

        {phase === "loading" && (
          <div className="flex items-center justify-center gap-3 py-16 text-gray-600">
            <Icon name="spinner" className="rs-spin h-5 w-5" strokeWidth={2.4} /> Loading experiences…
          </div>
        )}

        {phase === "error" && (
          <AlertBanner>Couldn&rsquo;t load the catalogue right now. Please try again shortly.</AlertBanner>
        )}

        {phase === "ready" && (
          <div className="grid gap-4 sm:grid-cols-2">
            {experiences.map((e) => {
              const isSelected = selected?.id === e.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setSelected(e)}
                  disabled={submitting}
                  className={cx(
                    "overflow-hidden rounded-2xl border-2 bg-white text-left shadow-md shadow-brand-violet/10 transition",
                    isSelected ? "border-brand-violet" : "border-violet-100 hover:border-violet-700",
                  )}
                >
                  {e.imageUrl ? (
                    <div className="aspect-video bg-violet-100">
                      <img src={e.imageUrl} alt={e.title} className="h-full w-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex aspect-video items-center justify-center bg-violet-100">
                      <Flower className="h-8 w-10 text-brand-violet opacity-60" />
                    </div>
                  )}
                  <div className="p-4">
                    <div className="text-base font-semibold leading-snug text-gray-900">{e.title}</div>
                    <div className="mt-0.5 text-sm text-gray-500">
                      by {e.providerName} · {formatMoney(e.retailPriceCents, e.currency)}
                    </div>
                    {(e.city || e.participants || e.duration) && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {e.city && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-gray-700">📍 {e.city}</span>}
                        {e.participants && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-gray-700">👥 {e.participants}</span>}
                        {e.duration && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-gray-700">⏱ {e.duration}</span>}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {selected && (
          <div className="fixed inset-x-0 bottom-0 z-20 border-t border-violet-100 bg-white p-4 shadow-[0_-8px_24px_rgba(60,17,174,0.12)] sm:p-5">
            <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Exchange for</div>
                <div className="truncate text-base font-semibold text-gray-900">{selected.title}</div>
              </div>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  disabled={submitting}
                  className="text-sm font-semibold text-gray-600 underline decoration-2 underline-offset-4"
                >
                  Cancel
                </button>
                <PrimaryButton className="w-auto px-6" loading={submitting} disabled={submitting} onClick={() => void confirm()}>
                  Confirm exchange
                </PrimaryButton>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
