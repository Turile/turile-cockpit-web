import type { Config } from "tailwindcss";

// Brand tokens — verified against the live storefront theme (turile-platform).
// Do NOT invent colors; extend only from the storefront design system.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          violet: "#3C11AE",
          lime: "#D5E454",
          pink: "#FFA3D5",
          orange: "#FA742A",
        },
      },
      fontFamily: {
        // Body font. TAN-Songbird is display-only and licensed — until the
        // web license is confirmed, --font-display resolves to Poppins too
        // (swap happens in styles/index.css, nothing else changes).
        sans: ["Poppins", "ui-sans-serif", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "Poppins", "sans-serif"],
      },
    },
  },
  plugins: [],
} satisfies Config;
