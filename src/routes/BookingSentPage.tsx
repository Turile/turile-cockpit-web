// Confirmation screen after a booking request — visual from the Design
// export (BookingSent.jsx).
//
// Data arrives via router state (BookingCreated) from BookingPage; a direct
// visit without state redirects back to the voucher screen. The experience
// recap comes from the session voucher (route guard guarantees presence).
// The recipient's email is not kept in the session, so the copy says
// "we'll email you" instead of echoing an address.

import { Navigate, useLocation } from "react-router-dom";
import type { BookingCreated } from "../lib/types";
import { useVoucherSession } from "../session/VoucherSessionContext";
import { Flower, Icon, PrimaryLink } from "../components/redeem/shared";

// TODO: real experience photo from catalog
const EXPERIENCE_THUMB = "https://picsum.photos/seed/turile-balloon-hero/200/200";

const fmt = new Intl.DateTimeFormat("en-CA", {
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

export default function BookingSentPage() {
  const { session } = useVoucherSession();
  const { state } = useLocation();
  const data = state as BookingCreated | null;
  if (!data) return <Navigate to="/redeem/success" replace />;

  const exp = session!.voucher.pinnedExperience;
  const provider = exp?.provider.name ?? "Your provider";
  // Guest count lives in the purchased product variant, so it isn't echoed.
  const meta = exp ? `by ${exp.provider.name}` : "";

  return (
    <section
      aria-labelledby="sent-title"
      className="relative min-h-screen w-full overflow-hidden bg-violet-50 px-4 py-6 pb-16 text-gray-900 sm:py-12"
    >
      <div className="rs-rise relative z-10 mx-auto max-w-xl text-center">
        <Flower className="rs-pop absolute right-[9%] top-4 h-6 w-8 rotate-12 text-brand-pink opacity-90" />

        <div className="rs-pop mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-brand-lime shadow-lg shadow-brand-violet/20">
          <Icon name="check" className="h-8 w-8 text-brand-violet" strokeWidth={2.6} />
        </div>
        <h1
          id="sent-title"
          className="mb-2 text-balance font-display text-3xl leading-tight tracking-tight text-brand-violet sm:text-4xl"
        >
          {data.alreadyPending
            ? "This request is already on its way"
            : "Request sent — sit tight"}
        </h1>
        <p className="mx-auto mb-6 max-w-[40ch] text-lg leading-normal text-gray-600">
          {provider} will confirm one of your times within{" "}
          <strong className="font-bold text-gray-900">24–48 hours</strong>. We&rsquo;ll email you
          the moment it&rsquo;s booked.
          {data.resent && " We've re-sent your request to the provider just now."}
        </p>

        <article className="overflow-hidden rounded-3xl border border-violet-100 bg-white text-left shadow-xl shadow-brand-violet/20">
          <div className="flex items-center gap-3.5 border-b border-violet-100 p-4">
            {exp && (
              <img
                src={EXPERIENCE_THUMB}
                alt=""
                className="h-16 w-16 flex-none rounded-2xl object-cover"
              />
            )}
            <div className="min-w-0">
              <div className="text-xl font-semibold leading-snug text-gray-900">
                {exp?.title ?? "Your experience"}
              </div>
              <div className="mt-1 text-sm text-gray-500">{meta}</div>
            </div>
          </div>
          <div className="px-4 py-5 sm:px-6">
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
              Your preferred times
            </h2>
            <div className="flex flex-col gap-2.5">
              {data.request.proposedSlots.map((s, i) => (
                <div key={s.start} className="flex items-center gap-3">
                  <span className="inline-flex h-7 w-7 flex-none items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-brand-violet">
                    {i + 1}
                  </span>
                  <Icon name="calendar" className="h-4 w-4 flex-none text-violet-700" />
                  <span className="text-base font-medium text-gray-900">
                    {/* arrival time only — the slot's end is technical */}
                    {fmt.format(new Date(s.start))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </article>
        <div className="mt-3 text-xs text-gray-500">Request #{data.booking.id}</div>

        <PrimaryLink href="https://turil.ca" className="mt-6">
          Explore more experiences <Icon name="arrow" className="h-5 w-5" strokeWidth={2.4} />
        </PrimaryLink>
        <p className="mt-5 text-xs text-gray-500">
          Need to change something? Reply to your confirmation email or reach us at
          hello@turile.ca.
        </p>
      </div>
    </section>
  );
}
