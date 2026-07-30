// Sticky bottom action bar for the Exchange screen — ported from
// Turile_Product_Page_v4.html's `.buybar` (mobile sticky buy bar: fixed
// bottom, price info + one primary button, safe-area-aware padding).
// Rendered via a portal to document.body, same reasoning as FilterModal:
// `position: fixed` must not depend on where this sits in the React tree
// relative to ExchangePage's `.rs-rise` entrance-animation wrapper.
//
// One implementation for both mobile and desktop — no separate sidebar.
//
// Delta (2026-07-30): catalog now returns price_delta_cents per experience
// (computeExchangeDeltaCents(retailPriceCents, balanceCents), the same
// shared function and the same balance exchange itself uses) — the bar
// renders it directly. It branches ONLY on the sign of that already-server-
// computed number to pick a sentence; it never computes, derives, or
// re-subtracts the delta itself. Still a preview against the caller's
// last-known balance — exchange re-verifies live and recomputes
// authoritatively before any money moves.

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { BrowseExperience } from "../../lib/types";
import { formatMoney } from "./shared";

export function ExchangeActionBar({
  selected,
  submitting,
  onConfirm,
  onCancel,
  onHeightChange,
}: {
  selected: BrowseExperience | null;
  submitting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onHeightChange: (px: number) => void;
}) {
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selected) {
      onHeightChange(0);
      return;
    }
    const el = barRef.current;
    if (!el) return;
    // getBoundingClientRect (not entry.contentRect, which excludes this
    // element's own padding/border) — the caller adds this straight to a
    // padding-bottom, so it must be the bar's full rendered height.
    const ro = new ResizeObserver(() => onHeightChange(el.getBoundingClientRect().height));
    ro.observe(el);
    onHeightChange(el.getBoundingClientRect().height);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  if (!selected) return null;

  // Sign-only branch on a server-computed number — see the file header.
  const delta = selected.priceDeltaCents;
  const deltaLine =
    delta > 0
      ? `+${formatMoney(delta, selected.currency)} to pay`
      : delta < 0
        ? `${formatMoney(-delta, selected.currency)} stays on your balance`
        : "Even swap";

  return createPortal(
    <div className="turile">
      <div ref={barRef} className="buybar" role="region" aria-label="Exchange action bar">
        <div className="buybar-row">
          <div className="buybar-total">
            <span className="bb-label">Exchange for</span>
            <span className="bb-name">{selected.title}</span>
            <span className="bb-price">{formatMoney(selected.retailPriceCents, selected.currency)}</span>
          </div>
          <div className="buybar-actions">
            <button type="button" className="buybar-cancel" onClick={onCancel} disabled={submitting}>
              Cancel
            </button>
            <button type="button" className="btn btn-primary" onClick={onConfirm} disabled={submitting}>
              {submitting ? "Confirming…" : "Confirm exchange"}
            </button>
          </div>
        </div>
        <p className="buybar-rule">{deltaLine}</p>
      </div>
    </div>,
    document.body,
  );
}
