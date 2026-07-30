// Shared experience card for the Exchange screen's catalog grid — the one
// place this markup used to live inline in ExchangePage.tsx. Structural
// technique (not visual re-skin) ported from
// _design-export/Turile_Gifts_for_Him_Standalone.html's real product-card
// grid: `.p-media` (aspect-ratio: 4/3, full-bleed, object-cover), `.p-body`
// (flex column, flex:1), `.p-title` (line-clamp-2 + reserved min-height so
// 1-line and 2-line titles align), `.p-price` (margin-top: auto, pinned to
// the card's bottom regardless of what's above it) — 2026-07-29.
//
// Chips stay this app's existing pill style (already used identically on
// RedeemSuccessPage) rather than the export's plain icon-list — this is
// about alignment, not introducing a second chip visual language.
//
// Reserved heights are in rem, not px, so the alignment fix still holds at
// non-default browser font-size zoom: min-h-[2.75rem] for the title (2
// lines at text-base/leading-snug — 16px * 1.375 * 2 ≈ 44px at 100%, and
// scales with root font-size like everything else here) and
// min-h-[1.625rem] for the tag row (~26px at 100%), always rendered even
// when an experience has zero city/participants/duration — 4 of the 33
// active experiences do (Farm-to-Table Chef's Table Dinner, Helicopter
// Tour Over Vancouver, Nordic Spa & Thermal Circuit Day, Supercar Track
// Day), and previously had no tag row at all, breaking row alignment
// against neighbors that had chips.
//
// Price is formatMoney(retailPriceCents, currency) only — no client-side
// delta. retail_price_cents is the experience's single default price, not
// variant-aware (see turile-platform-spec.md §9.5) — this card inherits
// that same limitation, logged there, not fixed here.

import type { BrowseExperience } from "../../lib/types";
import { Flower, cx, formatMoney } from "./shared";

export function ExperienceCard({
  experience: e,
  isSelected,
  disabled,
  onSelect,
}: {
  experience: BrowseExperience;
  isSelected: boolean;
  disabled: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      className={cx(
        "flex flex-col overflow-hidden rounded-2xl border-2 bg-white text-left shadow-md shadow-brand-violet/10 transition",
        isSelected ? "border-brand-violet" : "border-violet-100 hover:border-violet-700",
      )}
    >
      {e.imageUrl ? (
        <div className="relative w-full aspect-[4/3] overflow-hidden bg-violet-100">
          <img src={e.imageUrl} alt={e.title} className="absolute inset-0 h-full w-full object-cover" />
        </div>
      ) : (
        <div className="relative flex w-full aspect-[4/3] items-center justify-center overflow-hidden bg-violet-100">
          <Flower className="h-8 w-10 text-brand-violet opacity-60" />
        </div>
      )}
      <div className="flex flex-1 flex-col p-4">
        <div
          title={e.title}
          className="line-clamp-2 min-h-[2.75rem] text-base font-semibold leading-snug text-gray-900"
        >
          {e.title}
        </div>
        <div className="mt-0.5 text-sm text-gray-500">by {e.providerName}</div>

        <div className="mt-2 flex min-h-[1.625rem] flex-wrap items-start gap-1.5">
          {e.city && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-gray-700">📍 {e.city}</span>}
          {e.participants && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-gray-700">👥 {e.participants}</span>}
          {e.duration && <span className="rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-gray-700">⏱ {e.duration}</span>}
        </div>

        <div className="mt-auto pt-2 text-lg font-bold text-brand-violet">
          {formatMoney(e.retailPriceCents, e.currency)}
        </div>
      </div>
    </button>
  );
}
