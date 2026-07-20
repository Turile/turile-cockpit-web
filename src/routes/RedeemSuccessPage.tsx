// Voucher state after activation — visual from the Design export
// (GiftRevealed.jsx), data straight from the session context (the route
// guard guarantees presence). CTA "book" is shown only when there is a
// pinned experience, its provider is request-mode, and there is balance
// to redeem — same gate as the skeleton. The raw voucher status stays
// exposed as data-status on the card for QA hooks; the visible layout
// follows the design (balance is the headline number).
//
// Monetary variant (pinnedExperience === null — a pure gift-card purchase or
// a pin already converted to open balance): the design export covers only the
// pinned screen, so this branch reuses its grammar — the photo hero becomes a
// violet flower band, the primary CTA becomes "Browse experiences", and the
// "book by" chip gives way to a no-expiry reassurance (monetary value never
// expires; only the experience pin is time-limited).

import { useNavigate } from "react-router-dom";
import { useVoucherSession } from "../session/VoucherSessionContext";
import {
  Flower,
  Icon,
  PrimaryButton,
  PrimaryLink,
  formatDateLong,
  formatMoney,
} from "../components/redeem/shared";

// TODO: real experience photo from catalog
const EXPERIENCE_IMAGE = "https://picsum.photos/seed/turile-balloon-hero/900/560";

export default function RedeemSuccessPage() {
  const navigate = useNavigate();
  const { session } = useVoucherSession();
  const voucher = session!.voucher;
  const exp = voucher.pinnedExperience;

  const canBook =
    exp !== null && exp.provider.bookingMode === "request" && voucher.balanceCents > 0;
  const bookBy = voucher.pinExpiresAt ? formatDateLong(voucher.pinExpiresAt) : null;

  return (
    <section
      aria-labelledby="voucher-title"
      className="relative min-h-screen w-full overflow-hidden bg-violet-50 px-4 py-6 pb-16 text-gray-900 sm:py-12"
    >
      <div className="rs-rise relative z-10 mx-auto max-w-xl text-center">
        <Flower className="rs-pop absolute left-[6%] top-2 h-8 w-10 -rotate-6 text-brand-violet opacity-90" />
        <Flower className="rs-pop absolute right-[7%] top-6 h-6 w-8 rotate-12 text-brand-orange opacity-90 [animation-delay:.15s]" />

        <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-violet-700">
          <Flower className="h-3.5 w-4 text-brand-orange" /> Gift unwrapped
        </span>
        <h1
          id="voucher-title"
          className="mb-2 mt-3 text-balance font-display text-3xl leading-tight tracking-tight text-brand-violet sm:text-4xl"
        >
          Surprise — this one&rsquo;s yours
        </h1>
        <p className="mx-auto mb-6 max-w-[38ch] text-lg leading-normal text-gray-600">
          {exp
            ? "Someone picked a moment just for you. Here's what's waiting."
            : "Someone gave you the pick of the whole catalogue. Here's what you have to play with."}
        </p>

        {/* experience / voucher card */}
        <article
          aria-label={exp ? "Pinned experience" : "Gift balance"}
          data-status={voucher.status}
          className="overflow-hidden rounded-3xl border border-violet-100 bg-white text-left shadow-xl shadow-brand-violet/20"
        >
          {exp ? (
            <div className="relative aspect-video bg-violet-100">
              <img
                src={EXPERIENCE_IMAGE}
                alt={exp.title}
                className="absolute inset-0 h-full w-full object-cover"
              />
              <span className="absolute left-3.5 top-3.5 inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-brand-violet shadow-md shadow-brand-violet/10">
                <Flower className="h-3 w-3.5 text-brand-orange" /> Pinned for you
              </span>
            </div>
          ) : (
            <div className="relative flex h-28 items-center justify-center overflow-hidden bg-brand-violet sm:h-32">
              <Flower className="absolute -left-4 -top-7 h-24 w-28 -rotate-12 text-brand-pink opacity-70" />
              <Flower className="absolute -bottom-9 right-5 h-28 w-32 rotate-6 text-brand-lime opacity-80" />
              <Flower className="absolute right-[30%] -top-1 h-8 w-10 rotate-45 text-brand-orange opacity-80" />
              <span className="relative inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-brand-violet shadow-md shadow-brand-violet/10">
                <Flower className="h-3 w-3.5 text-brand-orange" /> Yours to choose
              </span>
            </div>
          )}
          <div className="p-5 sm:p-7">
            {exp ? (
              <>
                <h2 className="m-0 text-pretty text-2xl font-semibold leading-snug text-gray-900">
                  {exp.title}
                </h2>
                <div className="mt-1 text-sm text-gray-500">
                  by {exp.provider.name} · {formatMoney(exp.retailPriceCents, exp.currency)} value
                </div>
              </>
            ) : (
              <>
                <h2 className="m-0 text-2xl font-semibold leading-snug text-gray-900">
                  Pick any experience you like
                </h2>
                <p className="mt-2 text-base leading-normal text-gray-600">
                  This gift is an open amount — browse the Turile catalogue and choose your
                  moment.
                </p>
              </>
            )}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3.5 border-t border-violet-100 pt-5">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Gift balance
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="font-display text-3xl leading-none text-brand-violet">
                    {formatMoney(voucher.balanceCents, voucher.currency)}
                  </span>
                  <span className="text-sm font-semibold tracking-wide text-gray-500">
                    {voucher.currency}
                  </span>
                </div>
              </div>
              {bookBy && (
                <span className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3.5 py-2 text-sm font-medium text-gray-600">
                  <span className="h-2 w-2 flex-none rounded-full bg-brand-orange" />
                  Book by <strong className="-ml-1 font-bold text-gray-900">{bookBy}</strong>
                </span>
              )}
            </div>
          </div>
        </article>

        {canBook && (
          <PrimaryButton className="mt-6" onClick={() => navigate("/redeem/booking")}>
            Book your experience
          </PrimaryButton>
        )}
        {!exp && (
          <PrimaryLink href="https://turil.ca" className="mt-6">
            Browse experiences <Icon name="arrow" className="h-5 w-5" strokeWidth={2.4} />
          </PrimaryLink>
        )}
        <div className="mt-3">
          {exp ? (
            <a
              href="https://turil.ca"
              className="text-sm font-semibold text-brand-violet underline decoration-2 underline-offset-4"
            >
              Prefer something else? Browse experiences
            </a>
          ) : (
            <span className="text-sm text-gray-500">
              No rush and no expiry — this balance stays yours until you spend it.
            </span>
          )}
        </div>
        <div className="mt-6 text-xs tracking-wide text-gray-500">
          Gift code ending in •• {voucher.codeLast4}
        </div>
      </div>
    </section>
  );
}
