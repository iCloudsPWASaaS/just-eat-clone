import type { Config } from "tailwindcss";

// Palette values are taken verbatim from Just Eat's published design system
// (justeat/fozzie-colour-palette). Keeping them as named tokens rather than
// inline hex means the brand can be re-skinned from this one file.
const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // JET Orange — the brand colour
        jet: {
          DEFAULT: "#ff8000",
          offWhite: "#ffead4",
        },
        orange: {
          DEFAULT: "#f36d00",
          dark: "#df6400",
          darkest: "#a44900",
          aa: "#cd4900",
          offWhite: "#ffead4",
        },
        blue: {
          light: "#4996fd",
          DEFAULT: "#125fca",
          dark: "#0f4fa9",
          darkest: "#0d4089",
          offWhite: "#e7f1fe",
          offWhiteDark: "#dde7f4",
        },
        red: {
          DEFAULT: "#d50525",
          offWhite: "#ffe9ea",
        },
        green: {
          DEFAULT: "#006631",
          offWhite: "#e5faef",
        },
        yellow: {
          offWhite: "#fff9df",
        },
        grey: {
          offWhite: "#f9fafb",
          lighter: "#f1f2f4",
          light: "#e2e6e9",
          mid: "#c5ccd3",
          midDark: "#929faa",
          dark: "#5e6b77",
          darkest: "#2a3846",
        },
      },
      fontFamily: {
        sans: ["var(--font-justeat)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      borderRadius: {
        // Fozzie buttons use a 3px radius
        button: "3px",
        card: "8px",
      },
      boxShadow: {
        card: "0 1px 2px 0 rgba(42, 56, 70, 0.1)",
        raised: "0 2px 8px 0 rgba(42, 56, 70, 0.15)",
        sticky: "0 2px 4px 0 rgba(42, 56, 70, 0.12)",
      },
      maxWidth: {
        page: "1200px",
      },
    },
  },
  plugins: [],
};

export default config;
