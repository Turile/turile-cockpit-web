// Visual primitives for the recipient flow, ported from the Claude Design
// export (turile-redeem/_shared.jsx) and mapped onto the brand Tailwind
// tokens (brand.violet/lime/pink/orange + default palette neutrals).
// Purely presentational — no data, API or session awareness here.
// Motion classes (.rs-rise / .rs-pop / .rs-spin) live in styles/index.css.

import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes } from "react";

export const cx = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(" ");

export const formatMoney = (cents: number, currency = "CAD") =>
  new Intl.NumberFormat("en-CA", { style: "currency", currency })
    .format(cents / 100)
    .replace(/\.00$/, "");

export const formatDateLong = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", { month: "long", day: "numeric", year: "numeric" }).format(
    new Date(iso),
  );

/* Brand motifs (currentColor) */

export function Flower({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 1280 1024" className={className} style={style} aria-hidden="true" fill="currentColor">
      <path d="M568.4,136.7c-74.5,167.5-142,338-219.8,506c-7.7,16.6-22,51.4-28.5,67.6c-48,120,7.2,253.6,113.2,290.3c120.3,41.7,239.4,3.5,290.3-113.2c73.3-168,142-338,219.8-506c7.7-16.6,22-51.4,28.5-67.6c48-120-7.2-253.6-113.2-290.3C738.4-18.3,620.5,19.5,568.4,136.7z" />
      <path d="M1019.3,434.4c-168.2-72.7-337.8-142.4-504-219.8c-16.6-7.7-51.4-21.9-67.6-28.5c-118.1-47.7-254.4,9.1-290.3,113.2c-42.2,122.2-3.5,239.4,113.2,290.3c168,73.3,337.8,142.4,504,219.8c16.6,7.8,51.4,21.9,67.6,28.5c118.1,47.7,254-9.2,290.3-113.2C1169.5,619.2,1138,485.7,1019.3,434.4z" />
    </svg>
  );
}

export function Squiggle({ className = "", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 1920 1080" className={className} style={style} aria-hidden="true" fill="currentColor">
      <path d="M47.9,853c120.8,53.3,266.6,41.4,373.1-38.7c96.8-72.5,165.7-206.7,147.1-329.8c-7.9-51.6-64.4-70.9-97.3-27.7C437,501,431.8,568,439.2,621.1c17.4,124.6,111.6,220.1,231.3,252.1c128.3,34.2,261.7-4.4,364.5-84.7c112.9-87.9,183.1-216.8,225.1-351.4c19.3-61.5,46-137.9,19.2-200.8c-22-51.6-76.3-79.4-129.3-54.8c-57.1,26.6-76.4,91.1-82.5,148.8c-6.7,62.7,3.1,126.9,24.9,186.1c51.2,138.7,161.8,248.2,294.4,310.3c149,69.9,316.8,85.9,479.5,79.7c17.4-0.5,17.3-27.7-0.1-27.2c-232.9,8.9-492-30.8-654.1-215.3c-70.7-80.7-119.1-184.8-119.6-293.1c-0.1-53.9,8-126.2,57.3-158.6c27.4-17.9,60.9-18,84.9,5.3c24.2,23.6,29.8,58.4,27.4,90.6c-4.6,61.7-27.9,126-49.9,183.2c-22,56.7-50.1,111.4-85.2,161.1c-66,92.8-161.5,168.6-273.6,196.1c-109.3,26.4-236,1.3-315.3-81.6c-36.4-37.9-60.7-86.7-70.4-138.1c-8.9-46.8-8.6-121.1,26.6-158.5c16.3-17.4,39-11.7,45.9,11c4.3,14.3,2.8,33.5,2.4,48.1c-0.9,30-6.4,59.7-15.2,88.5c-18.2,58.7-52.1,112.5-97.6,154.1c-98.3,89.9-247.3,110.7-368.1,57.3C45.8,822.5,32,845.9,47.9,853z" />
    </svg>
  );
}

/* Lucide glyphs (the brand's standardised icon set) */

const PATHS = {
  pin: (
    <>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ),
  clockAlt: (
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </>
  ),
  calendar: (
    <>
      <rect width="18" height="18" x="3" y="4" rx="2" />
      <path d="M3 10h18M8 2v4M16 2v4" />
    </>
  ),
  check: <path d="M20 6 9 17l-5-5" />,
  arrow: (
    <>
      <path d="M5 12h14" />
      <path d="m12 5 7 7-7 7" />
    </>
  ),
  help: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
      <path d="M12 17h.01" />
    </>
  ),
  alert: (
    <>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4M12 16h.01" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  spinner: <path d="M21 12a9 9 0 1 1-6.2-8.6" />,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({
  name,
  className = "",
  style,
  strokeWidth = 2,
}: {
  name: IconName;
  className?: string;
  style?: React.CSSProperties;
  strokeWidth?: number;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      style={style}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {PATHS[name]}
    </svg>
  );
}

/* Form field styling shared by the activation and booking screens.
   aria-invalid drives the error border — pages keep setting it from their
   own fieldErrors state, nothing visual leaks into the logic layer. */

export const inputCls =
  "w-full rounded-full border-2 border-violet-100 bg-white px-4 py-3 text-base text-gray-900 placeholder:text-gray-500 transition hover:border-violet-700 focus:border-brand-violet focus:outline-none focus:ring-4 focus:ring-brand-violet/20 disabled:cursor-not-allowed disabled:bg-violet-100 disabled:text-gray-500 aria-[invalid=true]:border-brand-orange";

export const labelCls = "mb-1.5 block text-sm font-medium text-gray-900";

/* Primary lime CTA — button and anchor twins share the same look */

const primaryCtaCls =
  "inline-flex w-full items-center justify-center gap-2.5 rounded-full border-2 border-transparent bg-brand-lime px-7 py-3.5 text-lg font-semibold text-brand-violet shadow-md shadow-brand-violet/10 transition";
const primaryCtaHoverCls =
  "hover:-translate-y-px hover:brightness-95 hover:shadow-lg hover:shadow-brand-violet/20 active:translate-y-0 active:scale-[.98]";

type PrimaryButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean };

export function PrimaryButton({
  children,
  loading,
  disabled,
  className = "",
  type = "button",
  ...rest
}: PrimaryButtonProps) {
  const off = disabled || loading;
  return (
    <button
      type={type}
      disabled={off}
      className={cx(
        primaryCtaCls,
        off ? "cursor-not-allowed opacity-60" : primaryCtaHoverCls,
        className,
      )}
      {...rest}
    >
      {loading && <Icon name="spinner" className="rs-spin h-4 w-4" strokeWidth={2.4} />}
      {children}
    </button>
  );
}

export function PrimaryLink({
  children,
  className = "",
  ...rest
}: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a className={cx(primaryCtaCls, primaryCtaHoverCls, className)} {...rest}>
      {children}
    </a>
  );
}

/* Arrival-time picker: hour select + quarter-hour pills + AM/PM toggle.
   Arrival-time decision (2026-07-19): recipients and providers pick when the
   guest ARRIVES — no end time is asked anywhere; durations live on the
   product. Minutes default to :00; hour and meridiem stay explicit choices
   so 9 AM never silently means 9 PM. Used by the booking screen and the
   provider "suggest another time" panel. */

export type ArrivalTime = { hour: string; minute: string; ampm: "" | "AM" | "PM" };
export const EMPTY_ARRIVAL: ArrivalTime = { hour: "", minute: "00", ampm: "" };
export const arrivalTo24h = (t: ArrivalTime): string =>
  `${String((Number(t.hour) % 12) + (t.ampm === "PM" ? 12 : 0)).padStart(2, "0")}:${t.minute}`;

const HOUR_OPTIONS = Array.from({ length: 12 }, (_, i) => String(i + 1));
const MINUTE_OPTIONS = ["00", "15", "30", "45"];

function PillGroup<T extends string>({
  label,
  options,
  selected,
  onSelect,
  render = (v: T) => v,
}: {
  label: string;
  options: readonly T[];
  selected: string;
  onSelect: (v: T) => void;
  render?: (v: T) => string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex flex-none rounded-full bg-violet-100 p-1">
      {options.map((v) => (
        <button
          key={v}
          type="button"
          role="radio"
          aria-checked={selected === v}
          onClick={() => onSelect(v)}
          className={cx(
            "rounded-full py-1.5 text-[13px] font-semibold transition",
            render(v).length > 2 ? "px-2" : "px-2.5",
            selected === v
              ? "bg-brand-violet text-white shadow-sm"
              : "text-gray-600 hover:text-brand-violet",
          )}
        >
          {render(v)}
        </button>
      ))}
    </div>
  );
}

export function ArrivalTimeControls({
  labelPrefix,
  value,
  onChange,
}: {
  labelPrefix: string; // e.g. "Option 1" — prefixes the aria labels
  value: ArrivalTime;
  onChange: (next: ArrivalTime) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        aria-label={`${labelPrefix}: hour`}
        value={value.hour}
        onChange={(e) => onChange({ ...value, hour: e.target.value })}
        className={cx(inputCls, "!w-[86px] flex-none")}
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
      <PillGroup
        label={`${labelPrefix}: minutes`}
        options={MINUTE_OPTIONS}
        selected={value.minute}
        onSelect={(m) => onChange({ ...value, minute: m })}
        render={(m) => `:${m}`}
      />
      <PillGroup
        label={`${labelPrefix}: AM or PM`}
        options={["AM", "PM"] as const}
        selected={value.ampm}
        onSelect={(ap) => onChange({ ...value, ampm: ap })}
      />
    </div>
  );
}

/* Inline alert. tone="muted" is the calm grey variant (rate-limit, session
   notices); tone="error" the orange one. Pages pass data-error-kind through. */

type AlertBannerProps = HTMLAttributes<HTMLDivElement> & { tone?: "error" | "muted" };

export function AlertBanner({ tone = "error", className = "", children, ...rest }: AlertBannerProps) {
  return (
    <div
      role="alert"
      className={cx(
        "flex items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm leading-normal",
        tone === "muted"
          ? "border-violet-100 bg-violet-100 text-gray-600"
          : "border-brand-orange/30 bg-brand-orange/10 text-orange-800",
        className,
      )}
      {...rest}
    >
      <Icon name="alert" className="mt-px h-4 w-4 flex-none" />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
