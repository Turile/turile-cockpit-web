// Filter modal for the Exchange screen's catalog browse — DOM structure,
// classes and open/close animation ported from
// _design-export/Turile_Filter_Modal.html (styles live in styles/index.css,
// scoped under .turile). The export's LOCATION/CATEGORY/PRICE/RATING/
// OCCASION/GIFTS-FOR sections are trimmed to what our catalog actually has:
// LOCATION (real cities from the `catalog` function's facets) and TOP-UP
// (replaces PRICE — our equivalent, already wired end-to-end). CATEGORY is
// deferred until `experiences` gains a category column (2026-07-27).

import { useEffect, useRef, useState } from "react";
import type { DeltaRangeKey } from "../../lib/types";
import { Icon, cx } from "./shared";

const CLOSE_TRANSITION_MS = 240;

export function FilterModal({
  open,
  onClose,
  cities,
  selectedCities,
  onToggleCity,
  onClearCities,
  deltaRange,
  onSelectDeltaRange,
  deltaRangeOptions,
  onClear,
  onApply,
  resultCount,
}: {
  open: boolean;
  onClose: () => void;
  cities: string[];
  selectedCities: string[];
  onToggleCity: (city: string) => void;
  onClearCities: () => void;
  deltaRange: DeltaRangeKey | null;
  onSelectDeltaRange: (key: DeltaRangeKey | null) => void;
  deltaRangeOptions: { key: DeltaRangeKey; label: string }[];
  onClear: () => void;
  onApply: () => void;
  resultCount: number | null;
}) {
  const [mounted, setMounted] = useState(open);
  const [isOpenClass, setIsOpenClass] = useState(false);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      document.body.style.overflow = "hidden";
      const raf = requestAnimationFrame(() => setIsOpenClass(true));
      closeBtnRef.current?.focus();
      return () => cancelAnimationFrame(raf);
    }
    setIsOpenClass(false);
    document.body.style.overflow = "";
    const t = setTimeout(() => setMounted(false), CLOSE_TRANSITION_MS);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!mounted) return null;

  const tick = <Icon name="check" className="fm-icon tick" strokeWidth={2.6} />;

  return (
    <div className="turile">
      <div
        className={cx("fm-overlay", isOpenClass && "is-open")}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className="fm-card" role="dialog" aria-modal="true" aria-labelledby="fmTitle">
          <header className="fm-head">
            <h2 className="fm-title" id="fmTitle">
              Filters
            </h2>
            <button ref={closeBtnRef} className="fm-x" type="button" aria-label="Close filters" onClick={onClose}>
              <Icon name="x" className="fm-icon" strokeWidth={2.2} />
            </button>
          </header>

          <div className="fm-body">
            <fieldset className="fm-group" role="group" aria-label="Location">
              <legend className="fm-eyebrow">Location</legend>
              <div className="fm-chips">
                <button
                  type="button"
                  className="fm-chip"
                  role="checkbox"
                  aria-checked={selectedCities.length === 0}
                  onClick={onClearCities}
                >
                  <span>All locations</span>
                  {tick}
                </button>
                {cities.map((city) => (
                  <button
                    key={city}
                    type="button"
                    className="fm-chip"
                    role="checkbox"
                    aria-checked={selectedCities.includes(city)}
                    onClick={() => onToggleCity(city)}
                  >
                    <span>{city}</span>
                    {tick}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="fm-group" role="group" aria-label="Top-up">
              <legend className="fm-eyebrow">Top-up</legend>
              <div className="fm-chips">
                {deltaRangeOptions.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    className="fm-chip"
                    role="radio"
                    aria-checked={deltaRange === o.key}
                    onClick={() => onSelectDeltaRange(deltaRange === o.key ? null : o.key)}
                  >
                    <span>{o.label}</span>
                    {tick}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>

          <footer className="fm-foot">
            <button className="fm-clear" type="button" onClick={onClear}>
              Clear all
            </button>
            <button className="fm-apply" type="button" onClick={onApply} disabled={resultCount === null}>
              Show {resultCount ?? "…"}&nbsp;results
            </button>
          </footer>
        </div>
      </div>
    </div>
  );
}
