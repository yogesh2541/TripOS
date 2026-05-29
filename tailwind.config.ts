import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1280px" },
    },
    extend: {
      colors: {
        // "Atelier Pro" — heritage navy deepened to an inkwash; warm-paper
        // canvas pulled slightly deeper. Legacy navy/sand scales kept so
        // existing components keep working while screens migrate to tokens.
        navy: {
          DEFAULT: "#0C1620",
          50: "#E7ECF1",
          100: "#C5D0DA",
          200: "#8FA1B3",
          300: "#5A728B",
          400: "#2E4761",
          500: "#0C1620",
          600: "#13212F",
          700: "#06101A",
          800: "#040A11",
          900: "#020508",
        },
        sand: {
          DEFAULT: "#C8A96A",
          50: "#FBF6EC",
          100: "#F4E9CE",
          200: "#E7D29D",
          300: "#DABA6C",
          400: "#C8A96A",
          500: "#B08F4E",
          600: "#8B7039",
          700: "#665225",
          800: "#403415",
          900: "#1F1908",
        },
        // --- Atelier Pro tokens (mirror :root in globals.css) ---
        canvas: "#F4F2EC",
        paper: { DEFAULT: "#FFFFFF", 2: "#FCFBF7" },
        inkwash: { DEFAULT: "#0C1620", 2: "#13212F" },
        gold: {
          DEFAULT: "#C8A96A",
          deep: "#9F7C36",
          soft: "#F2E8D2",
        },
        // muted data-viz palette — use in series order
        dv: {
          gold: "#C8A96A",
          sage: "#739C8C",
          slate: "#7B8FB2",
          clay: "#C2856A",
          plum: "#9180A6",
        },
        ok: { DEFAULT: "#5C8C69", soft: "#E7F0E8" },
        warn: { DEFAULT: "#B98A37", soft: "#F6ECD6" },
        bad: { DEFAULT: "#BD6354", soft: "#F6E2DC" },
        info: { DEFAULT: "#6981A6", soft: "#E6EBF3" },
        ivory: "#F8F6F2",
        ink: {
          DEFAULT: "#16191D",
          2: "#3C434B",
        },
        line: { DEFAULT: "#E6E2D8", 2: "#EEEBE3" },
        faint: "#9BA0A6",
        // Labels / secondary text — clears WCAG AA on paper and canvas.
        muted: {
          DEFAULT: "#6B7077",
          foreground: "#6B7077",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-playfair)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        // Tighter than the old 2xl/3xl for a precision "pro tool" feel.
        sm: "8px",
        DEFAULT: "10px",
        lg: "14px",
        xl: "18px",
        "2xl": "1rem",
        "3xl": "1.5rem",
      },
      // Elevation scale — very soft, layered (mirrors --sh-* in globals.css).
      boxShadow: {
        soft: "0 1px 2px rgba(12,22,32,0.05), 0 1px 1px rgba(12,22,32,0.03)",
        lift: "0 2px 4px rgba(12,22,32,0.05), 0 10px 26px rgba(12,22,32,0.07)",
        pop: "0 6px 14px rgba(12,22,32,0.10), 0 22px 48px rgba(12,22,32,0.16)",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(6px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        screen: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "none" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.5s ease-out both",
        screen: "screen 0.42s cubic-bezier(0.2,0.7,0.3,1) both",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
