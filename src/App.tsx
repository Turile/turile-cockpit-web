import { Navigate, Route, Routes } from "react-router-dom";
import { RequireSession } from "./session/VoucherSessionContext";
import RedeemPage from "./routes/RedeemPage";
import RedeemSuccessPage from "./routes/RedeemSuccessPage";
import BookingPage from "./routes/BookingPage";
import BookingSentPage from "./routes/BookingSentPage";
import ProviderRespondPage from "./routes/ProviderRespondPage";
import RecipientRespondPage from "./routes/RecipientRespondPage";

// TODO(design): app shell (header with brand mark, background, footer).
// Keep the shell here so route components stay pure screens.
export default function App() {
  return (
    <div className="min-h-screen font-sans">
      <main>
        <Routes>
          <Route path="/" element={<Navigate to="/redeem" replace />} />
          <Route path="/redeem" element={<RedeemPage />} />
          <Route
            path="/redeem/success"
            element={
              <RequireSession>
                <RedeemSuccessPage />
              </RequireSession>
            }
          />
          <Route
            path="/redeem/booking"
            element={
              <RequireSession>
                <BookingPage />
              </RequireSession>
            }
          />
          <Route
            path="/redeem/booking/sent"
            element={
              <RequireSession>
                <BookingSentPage />
              </RequireSession>
            }
          />
          {/* Provider side: authenticated by the emailed magic-link token,
              deliberately outside the recipient session guard. */}
          <Route path="/provider/respond/:token" element={<ProviderRespondPage />} />
          {/* Recipient side of the second booking round: a different emailed
              magic-link token, independent of the activate-voucher session. */}
          <Route path="/recipient/respond/:token" element={<RecipientRespondPage />} />
          <Route path="*" element={<Navigate to="/redeem" replace />} />
        </Routes>
      </main>
    </div>
  );
}
