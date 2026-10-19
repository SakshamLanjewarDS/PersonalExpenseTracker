import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/features/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#F7F8F5",
        surface: "#FFFFFF",
        primary: {
          DEFAULT: "#0F766E",
          hover: "#0D655E",
          subtle: "#E6F4F1",
          foreground: "#FFFFFF",
        },
        primaryText: "#17211E",
        secondaryText: "#64716B",
        warning: {
          DEFAULT: "#B45309",
          subtle: "#FEF3C7",
        },
        error: {
          DEFAULT: "#C24141",
          subtle: "#FEE2E2",
        },
        border: "#E2E8F0",
        input: "#E2E8F0",
        ring: "#0F766E",
        muted: {
          DEFAULT: "#F1F5F9",
          foreground: "#64716B",
        },
      },
      fontFamily: {
        sans: ["var(--font-dm-sans)", "DM Sans", "system-ui", "-apple-system", "sans-serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
