// Activation screen. TODO(design): full visual — this skeleton fixes the
// logic, states and semantics; layout/styling goes on top without rework.
//
// States exposed to the design layer:
//   values.{code,email,pin} · fieldErrors (client + server 400)
//   submitting · banner (not_found / rate_limited / unavailable / server / network)

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { activateVoucher } from "../lib/api";
import type { ApiError } from "../lib/types";
import { useVoucherSession } from "../session/VoucherSessionContext";

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
    <section aria-labelledby="redeem-title">
      {/* TODO(design): hero, brand illustration, spacing, input styling */}
      <h1 id="redeem-title" className="font-display">
        Активуй свій подарунок
      </h1>

      {banner && (
        <p role="alert" data-error-kind={banner.kind}>
          {banner.message}
          {banner.kind === "rate_limited" && banner.retryAfterS
            ? ` (~${Math.ceil(banner.retryAfterS / 60)} хв)`
            : null}
        </p>
      )}

      <form onSubmit={onSubmit} noValidate>
        <label>
          Код ваучера
          <input
            name="code"
            autoComplete="off"
            value={values.code}
            onChange={set("code")}
            aria-invalid={fieldErrors.includes("code")}
          />
        </label>
        <label>
          Email
          <input
            name="email"
            type="email"
            value={values.email}
            onChange={set("email")}
            aria-invalid={fieldErrors.includes("email")}
          />
        </label>
        <label>
          PIN (4 цифри з подарункового листа)
          <input
            name="pin"
            inputMode="numeric"
            maxLength={4}
            value={values.pin}
            onChange={set("pin")}
            aria-invalid={fieldErrors.includes("pin")}
          />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? "Перевіряємо…" : "Активувати"}
        </button>
      </form>
    </section>
  );
}
