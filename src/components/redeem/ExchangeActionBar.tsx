// Sticky bottom action bar for the Exchange screen — ported from
// Turile_Product_Page_v4.html's `.buybar` (mobile sticky buy bar: fixed
// bottom, price info + one primary button, safe-area-aware padding).
// Rendered via a portal to document.body, same reasoning as FilterModal:
// `position: fixed` must not depend on where this sits in the React tree
// relative to ExchangePage's `.rs-rise` entrance-animation wrapper.
//
// One implementation for both mobile and desktop — no separate sidebar.
//
// Delta note (2026-07-28): the exchange delta ("+$X to pay" / "$X stays on
// balance" / "Even swap") is computed server-side by the `exchange` edge
// function only at confirm-time — BrowseExperience carries no delta field,
// so this bar cannot show a real number the moment a card is selected
// without a backend change (out of scope here). It states the
// already-deterministic rule in plain language instead, and never
// computes, estimates, or interpolates a delta client-side.

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
        <p className="buybar-rule">
          Equal or cheaper swaps instantly — the rest stays on your balance. Pricier: you&rsquo;ll be sent to pay the
          difference.
        </p>
      </div>
    </div>,
    document.body,
  );
}
