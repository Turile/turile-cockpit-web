// Activation screen — visual from the Design export (VoucherEntry.jsx),
// logic unchanged from the skeleton:
//   values.{code,email,pin} · fieldErrors (client + server 400, aria-invalid)
//   submitting · banner (not_found / rate_limited / unavailable / server / network)

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { activateVoucher } from "../lib/api";
import type { ApiError } from "../lib/types";
import { useVoucherSession } from "../session/VoucherSessionContext";
import {
  AlertBanner,
  Flower,
  Icon,
  PrimaryButton,
  inputCls,
  labelCls,
} from "../components/redeem/shared";

import heroImage from "../assets/redeem-pic.png";
import logoOrange from "../assets/logo-orange.svg";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PIN_RE = /^\d{4}$/;

// Client-side validation mirrors the server so a 400 round-trip stays rare.
function validate(values: { code: string; email: string; pin: string }): string[] {
  const bad: string[] = [];
  if (!values.code.trim()) bad.push("code");
  if (!EMAIL_RE.test(values.email.trim())) bad.push("email");
  if (!PIN_RE.test(values.pin.trim())) bad.push("pin"); // exactly 4 digits, caught locally
  return bad;
}

export default function RedeemPage() {
  const navigate = useNavigate();
  const { startSession } = useVoucherSession();

  const [values, setValues] = useState({ code: "", email: "", pin: "" });
  const [fieldErrors, setFieldErrors] = useState<string[]>([]);
  const [banner, setBanner] = useState<ApiError | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setValues((v) => ({ ...v, [k]: e.target.value }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    const bad = validate(values);
    setFieldErrors(bad);
    if (bad.length) return;

    setSubmitting(true);
    const result = await activateVoucher({
      code: values.code.trim(),
      email: values.email.trim(),
      pin: values.pin.trim(),
    });
    setSubmitting(false);

    if (result.ok) {
      startSession(result.data);
      navigate("/redeem/success");
    } else if (result.error.kind === "invalid_input") {
      setFieldErrors(result.error.fields ?? []);
    } else {
      setBanner(result.error);
    }
  };

  return (
    <section
      aria-labelledby="redeem-title"
      className="relative min-h-screen w-full overflow-hidden bg-violet-50 text-gray-900"
    >
      <div className="rs-rise mx-auto flex max-w-6xl flex-wrap items-stretch gap-5 px-4 py-6 pb-16 sm:gap-10 sm:px-10 sm:py-11">
        {/* hero panel */}
        <div className="relative min-h-[260px] min-w-[300px] flex-[1_1_430px] overflow-hidden rounded-3xl shadow-xl shadow-brand-violet/20 sm:min-h-[520px]">
          <img
            src={heroImage}
            alt="A collage of Turile experiences — helicopter flights, diving, hot-air balloons"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <Flower className="rs-pop absolute right-6 top-6 h-11 w-14 -rotate-6 text-brand-orange opacity-90" />
          <div className="absolute inset-x-5 bottom-5 sm:inset-x-8 sm:bottom-8">
            <img src={logoOrange} alt="Turile" className="mb-4 h-9 w-auto sm:h-10" />
            <p className="m-0 max-w-[16ch] font-display text-2xl leading-tight text-brand-violet sm:text-3xl">
              Give them a moment — not another thing.
            </p>
          </div>
        </div>

        {/* form card */}
        <div className="flex min-w-[300px] flex-[1_1_380px] flex-col justify-center rounded-3xl border border-violet-100 bg-white p-6 shadow-xl shadow-brand-violet/20 sm:p-11">
          <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-700">
            <Flower className="h-3.5 w-4 text-brand-orange" /> Redeem a gift
          </span>
          <h1
            id="redeem-title"
            className="mb-2 mt-3 font-display text-3xl leading-tight tracking-tight text-brand-violet sm:text-4xl"
          >
            Got a gift? Let&rsquo;s unwrap it
          </h1>
          <p className="mb-5 text-lg leading-normal text-gray-600">
            Pop in the details from your gift email and we&rsquo;ll reveal your experience.
          </p>

          <form onSubmit={onSubmit} noValidate>
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="rf-code" className={labelCls}>
                  Voucher code
                </label>
                <input
                  id="rf-code"
                  name="code"
                  className={inputCls}
                  placeholder="TURILE-XXXX-3928"
                  autoComplete="off"
                  value={values.code}
                  disabled={submitting}
                  onChange={set("code")}
                  aria-invalid={fieldErrors.includes("code")}
                />
              </div>
              <div>
                <label htmlFor="rf-email" className={labelCls}>
                  Email
                </label>
                <input
                  id="rf-email"
                  name="email"
                  type="email"
                  className={inputCls}
                  placeholder="you@email.com"
                  autoComplete="email"
                  value={values.email}
                  disabled={submitting}
                  onChange={set("email")}
                  aria-invalid={fieldErrors.includes("email")}
                />
              </div>
              <div>
                <label htmlFor="rf-pin" className={labelCls}>
                  PIN
                </label>
                <input
                  id="rf-pin"
                  name="pin"
                  inputMode="numeric"
                  maxLength={4}
                  className={inputCls}
                  placeholder="4 digits"
                  value={values.pin}
                  disabled={submitting}
                  onChange={set("pin")}
                  aria-invalid={fieldErrors.includes("pin")}
                />
                <span className="mt-1.5 block text-xs text-gray-500">
                  The 4-digit PIN from your gift email
                </span>
              </div>
            </div>

            {banner && (
              <AlertBanner
                tone={banner.kind === "rate_limited" ? "muted" : "error"}
                data-error-kind={banner.kind}
                className="mt-5"
              >
                {banner.message}
                {banner.kind === "rate_limited" && banner.retryAfterS
                  ? ` (~${Math.ceil(banner.retryAfterS / 60)} min)`
                  : null}
              </AlertBanner>
            )}

            <PrimaryButton type="submit" className="mt-6" loading={submitting}>
              {submitting ? "Unwrapping…" : "Continue"}
            </PrimaryButton>
          </form>

          <div className="mt-4 text-center">
            {/* TODO: swap for the help-center article once it exists */}
            <a
              href="mailto:hello@turile.ca?subject=Where%20do%20I%20find%20my%20code%3F"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-violet underline-offset-4 hover:underline"
            >
              <Icon name="help" className="h-4 w-4" /> Where do I find my code?
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
