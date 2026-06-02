import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#1a2e1f",
        "ink-soft": "#2f4a37",
        paper: "#f4f0e6",
        "paper-2": "#ece6d6",
        card: "#fffdf7",
        terra: "#c8553d",
        "terra-soft": "#e08a6f",
        gold: "#d9a441",
        sage: "#7a9471",
        "sage-soft": "#a9bda0",
        muted: "#6b7b67",
        line: "#dcd5c4",
      },
      fontFamily: {
        serif: ["var(--font-fraunces)", "serif"],
        sans: ["var(--font-outfit)", "sans-serif"],
      },
      boxShadow: {
        pod: "0 1px 2px rgba(26,46,31,.06), 0 8px 24px rgba(26,46,31,.08)",
        "pod-lg": "0 4px 12px rgba(26,46,31,.10), 0 20px 48px rgba(26,46,31,.14)",
      },
    },
  },
  plugins: [],
};
export default config;
