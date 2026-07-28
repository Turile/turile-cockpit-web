// Browse + exchange screen (/redeem/exchange) — spec §5.4's three
// scenarios, one screen: pick any active experience, and the backend
// decides whether it's an instant re-pin (equal/cheaper, or a monetary
// voucher's first-ever pin) or needs a top-up (more expensive). No design
// export exists for this screen; the card/chip grammar comes from
// RedeemSuccessPage, the search+filter bar and sticky purchase panel are
// adapted from the real storefront's product/filter patterns (2026-07-27).
//
// Browsing goes through the session-gated `catalog` function (service
// role — providers stays fully closed to anon, diagnosed 2026-07-24), with
// server-side search/sort/delta-range filtering and pagination — a
// client-side slice wouldn't compose with any of those, and won't hold up
// once the catalog actually grows (Phase 3). Variant-level pricing (picking
// a specific variant before the delta is computed) is a deliberately
// deferred follow-up — see the platform spec.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { browseExperiences, startExchange } from "../lib/api";
import type { ApiError, BrowseExperience, CatalogSort, DeltaRangeKey } from "../lib/types";
import { useVoucherSession } from "../session/VoucherSessionContext";
import { AlertBanner, Flower, Icon, PrimaryButton, cx, formatMoney } from "../components/redeem/shared";

const PAGE_SIZE = 24;

const DELTA_RANGE_OPTIONS: { key: DeltaRangeKey; label: string }[] = [
  { key: "free", label: "No top-up" },
  { key: "0-50", label: "+$0–50" },
  { key: "50-100", label: "+$50–100" },
  { key: "100-250", label: "+$100–250" },
  { key: "250-plus", label: "+$250+" },
];

const SORT_OPTIONS: { key: CatalogSort; label: string }[] = [
  { key: "name_asc", label: "Name A–Z" },
  { key: "price_asc", label: "Price: low to high" },
  { key: "price_desc", label: "Price: high to low" },
  { key: "newest", label: "Newest" },
];

type Phase = "loading" | "error" | "ready";

export default function ExchangePage() {
  const navigate = useNavigate();
  const { session, applyExchange } = useVoucherSession();

  const [phase, setPhase] = useState<Phase>("loading");
  const [experiences, setExperiences] = useState<BrowseExperience[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);

  const [searchInput, setSearchInput] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [sort, setSort] = useState<CatalogSort>("name_asc");
  const [showSortOptions, setShowSortOptions] = useState(false);
  const [deltaRange, setDeltaRange] = useState<DeltaRangeKey | null>(null);

  const [selected, setSelected] = useState<BrowseExperience | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [banner, setBanner] = useState<ApiError | null>(null);
  const [repinnedTitle, setRepinnedTitle] = useState<string | null>(null);

  const fetchPage = async (pageNum: number, append: boolean) => {
    if (append) setLoadingMore(true);
    else setPhase("loading");

    const r = await browseExperiences(session!.token, {
      page: pageNum,
      pageSize: PAGE_SIZE,
      search: appliedSearch || undefined,
      sort,
      deltaRange: deltaRange ?? undefined,
      balanceCents: session!.voucher.balanceCents,
    });

    if (append) setLoadingMore(false);
    if (!r.ok) {
      if (r.error.kind === "session_expired") { navigate("/redeem"); return; }
      setPhase("error");
      return;
    }
    setExperiences((prev) => (append ? [...prev, ...r.data.experiences] : r.data.experiences));
    setTotalCount(r.data.totalCount);
    setPage(r.data.page);
    setPhase("ready");
  };

  useEffect(() => {
    void fetchPage(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedSearch, sort, deltaRange]);

  const submitSearch = () => setAppliedSearch(searchInput.trim());
  const toggleDeltaRange = (key: DeltaRangeKey) => setDeltaRange((cur) => (cur === key ? null : key));
  const chooseSort = (key: CatalogSort) => {
    setSort(key);
    setShowSortOptions(false);
  };
  const loadMore = () => void fetchPage(page + 1, true);

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

  const purchasePanel = (
    <div className="rounded-3xl border border-violet-100 bg-white p-5 shadow-xl shadow-brand-violet/20">
      {selected ? (
        <>
          <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">Exchange for</div>
          <div className="mt-1 text-lg font-semibold leading-snug text-gray-900">{selected.title}</div>
          <div className="mt-1 text-sm text-gray-500">{formatMoney(selected.retailPriceCents, selected.currency)}</div>
          <PrimaryButton className="mt-4" loading={submitting} disabled={submitting} onClick={() => void confirm()}>
            Confirm exchange
          </PrimaryButton>
          <button
            type="button"
            onClick={() => setSelected(null)}
            disabled={submitting}
            className="mt-2.5 w-full text-center text-sm font-semibold text-gray-600 underline decoration-2 underline-offset-4"
          >
            Cancel
          </button>
        </>
      ) : (
        <p className="text-sm leading-normal text-gray-500">
          Pick an experience from the list — equal or cheaper swaps instantly, pricier just needs the difference.
        </p>
      )}
    </div>
  );

  return (
    <section
      aria-labelledby="exchange-title"
      className="relative min-h-screen w-full overflow-hidden bg-violet-50 px-4 py-6 pb-24 text-gray-900 sm:py-12 lg:pb-12"
    >
      <div className="rs-rise relative z-10 mx-auto max-w-5xl">
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

        {/* search + filter block */}
        <div className="mb-6 rounded-3xl border border-violet-100 bg-white p-4 shadow-md shadow-brand-violet/10 sm:p-5">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-[220px] flex-1">
              <Icon
                name="search"
                className="pointer-events-none absolute left-4 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-gray-400"
                strokeWidth={2}
              />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitSearch();
                }}
                placeholder="Search an experience, location or occasion…"
                aria-label="Search experiences"
                className="w-full rounded-full border-2 border-violet-100 bg-white py-3 pl-11 pr-4 text-base text-gray-900 placeholder:text-gray-500 transition hover:border-violet-700 focus:border-brand-violet focus:outline-none focus:ring-4 focus:ring-brand-violet/20"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowSortOptions((v) => !v)}
              aria-expanded={showSortOptions}
              aria-label="Sort options"
              className={cx(
                "flex h-12 w-12 flex-none items-center justify-center rounded-full transition",
                showSortOptions ? "bg-brand-violet text-white" : "bg-violet-100 text-brand-violet hover:brightness-95",
              )}
            >
              <Icon name="sliders" className="h-5 w-5" strokeWidth={2.2} />
            </button>
            <PrimaryButton className="w-auto flex-none px-6" onClick={submitSearch}>
              Search
            </PrimaryButton>
          </div>

          {showSortOptions && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-violet-100 pt-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Sort:</span>
              {SORT_OPTIONS.map((o) => (
                <button
                  key={o.key}
                  type="button"
                  onClick={() => chooseSort(o.key)}
                  className={cx(
                    "rounded-full px-3 py-1.5 text-sm font-semibold transition",
                    sort === o.key ? "bg-brand-violet text-white" : "bg-violet-100 text-gray-700 hover:brightness-95",
                  )}
                >
                  {o.label}
                </button>
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-violet-100 pt-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">Top-up:</span>
            {DELTA_RANGE_OPTIONS.map((o) => (
              <button
                key={o.key}
                type="button"
                onClick={() => toggleDeltaRange(o.key)}
                className={cx(
                  "rounded-full px-3 py-1.5 text-sm font-semibold transition",
                  deltaRange === o.key ? "bg-brand-violet text-white" : "bg-violet-100 text-gray-700 hover:brightness-95",
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        {banner && (
          <AlertBanner className="mb-5" tone={banner.kind === "pending_topup_exists" ? "muted" : "error"} data-error-kind={banner.kind}>
            {banner.message}
          </AlertBanner>
        )}

        <div className="lg:grid lg:grid-cols-[1fr_300px] lg:items-start lg:gap-6">
          <div>
            {phase === "loading" && (
              <div className="flex items-center justify-center gap-3 py-16 text-gray-600">
                <Icon name="spinner" className="rs-spin h-5 w-5" strokeWidth={2.4} /> Loading experiences…
              </div>
            )}

            {phase === "error" && (
              <AlertBanner>Couldn&rsquo;t load the catalogue right now. Please try again shortly.</AlertBanner>
            )}

            {phase === "ready" && experiences.length === 0 && (
              <AlertBanner tone="muted">No experiences match your search — try different filters.</AlertBanner>
            )}

            {phase === "ready" && experiences.length > 0 && (
              <>
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

                <div className="mt-6 text-center">
                  <p className="mb-3 text-sm text-gray-500">
                    Showing {experiences.length} of {totalCount}
                  </p>
                  {experiences.length < totalCount && (
                    <button
                      type="button"
                      onClick={loadMore}
                      disabled={loadingMore}
                      className="inline-flex items-center gap-2 rounded-full border-2 border-violet-100 bg-white px-6 py-3 text-sm font-semibold text-brand-violet transition hover:border-violet-700 disabled:opacity-60"
                    >
                      {loadingMore && <Icon name="spinner" className="rs-spin h-4 w-4" strokeWidth={2.4} />}
                      Load more experiences
                    </button>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Desktop: sticky purchase panel. Mobile: fixed bottom bar below. */}
          <div className="hidden lg:sticky lg:top-6 lg:block">{purchasePanel}</div>
        </div>
      </div>

      {selected && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-violet-100 bg-white p-4 shadow-[0_-8px_24px_rgba(60,17,174,0.12)] lg:hidden">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3">
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
    </section>
  );
}
