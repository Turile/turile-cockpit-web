// Confirmation screen after a booking request. TODO(design): full visual.
//
// Data arrives via router state (BookingCreated) from BookingPage; a direct
// visit without state redirects back to the voucher screen.

import { Navigate, useLocation } from "react-router-dom";
import type { BookingCreated } from "../lib/types";

const fmt = new Intl.DateTimeFormat("uk-UA", { dateStyle: "full", timeStyle: "short" });

export default function BookingSentPage() {
  const { state } = useLocation();
  const data = state as BookingCreated | null;
  if (!data) return <Navigate to="/redeem/success" replace />;

  return (
    <section aria-labelledby="sent-title">
      {/* TODO(design): success illustration, timeline of what happens next */}
      <h1 id="sent-title" className="font-display">
        {data.alreadyPending ? "Запит уже в провайдера" : "Запит надіслано!"}
      </h1>

      <p>Провайдер підтвердить один із варіантів упродовж 24–48 годин — ми повідомимо листом.</p>

      <h2>Запропоновані варіанти</h2>
      <ul>
        {data.request.proposedSlots.map((s) => (
          <li key={s.start}>{fmt.formatRange(new Date(s.start), new Date(s.end))}</li>
        ))}
      </ul>

      <dl>
        <dt>Кількість людей</dt>
        <dd>{data.booking.partySize}</dd>
        <dt>Номер запиту</dt>
        <dd>{data.booking.id}</dd>
      </dl>
    </section>
  );
}
