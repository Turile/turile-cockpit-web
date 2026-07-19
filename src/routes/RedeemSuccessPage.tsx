// Voucher state after activation. TODO(design): full visual (voucher card,
// experience imagery, balance presentation).
//
// Data source: voucher from the session context (guard guarantees presence).
// CTA "book" is shown only when there is a pinned experience, its provider is
// request-mode, and there is balance to redeem.

import { Link } from "react-router-dom";
import { useVoucherSession } from "../session/VoucherSessionContext";

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("uk-UA", { style: "currency", currency }).format(cents / 100);

export default function RedeemSuccessPage() {
  const { session } = useVoucherSession();
  const voucher = session!.voucher;
  const exp = voucher.pinnedExperience;

  const canBook =
    exp !== null && exp.provider.bookingMode === "request" && voucher.balanceCents > 0;

  return (
    <section aria-labelledby="voucher-title">
      {/* TODO(design): voucher card visual */}
      <h1 id="voucher-title" className="font-display">
        Твій подарунок активовано
      </h1>

      <dl>
        <dt>Ваучер</dt>
        <dd>···· {voucher.codeLast4}</dd>
        <dt>Баланс</dt>
        <dd>{money(voucher.balanceCents, voucher.currency)}</dd>
        <dt>Статус</dt>
        <dd data-status={voucher.status}>{voucher.status}</dd>
      </dl>

      {exp ? (
        <article aria-label="Закріплений досвід">
          {/* TODO(design): experience card */}
          <h2>{exp.title}</h2>
          <p>{exp.provider.name}</p>
          <p>{money(exp.retailPriceCents, exp.currency)}</p>
          {voucher.pinExpiresAt && (
            <p>
              Досвід закріплено до{" "}
              {new Intl.DateTimeFormat("uk-UA", { dateStyle: "long" }).format(
                new Date(voucher.pinExpiresAt),
              )}
            </p>
          )}
        </article>
      ) : (
        <p>Це подарунок на вільну суму — обери досвід у каталозі Turile.</p>
      )}

      {canBook && <Link to="/redeem/booking">Обрати час →</Link>}
    </section>
  );
}
