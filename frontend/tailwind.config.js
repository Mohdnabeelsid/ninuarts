/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    "./index.html",
    "./src/**/*.{ts,tsx,js,jsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["'DM Sans'", "sans-serif"],
        serif: ["'DM Serif Display'", "Georgia", "serif"],
        mono: ["'JetBrains Mono'", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1rem" }],
        "3xs": ["0.625rem", { lineHeight: "0.875rem" }],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Ninu Arts Soft Editorial Custom Tokens
        boutique: {
          ivory: "#F7F4F0",
          rose: "#E8D8D4",
          taupe: "#D6C4B5",
          charcoal: "#34312F",
          muted: "#817872",
          sage: "#8B9B86",
          amber: "#D4A373",
          terracotta: "#C96A5B",
        },
      },
      borderRadius: {
        "2xl": "18px",
        xl: "14px",
        lg: "12px",
        md: "10px",
        sm: "8px",
      },
      spacing: {
        "4.5": "1.125rem",
        "5.5": "1.375rem",
        "9.5": "2.375rem",
        "18": "4.5rem",
      },
      boxShadow: {
        soft: "0 2px 14px -3px rgba(52, 49, 47, 0.05), 0 1px 3px 0 rgba(52, 49, 47, 0.03)",
        card: "0 1px 3px 0 rgba(52, 49, 47, 0.04), 0 4px 18px -2px rgba(52, 49, 47, 0.03)",
        drawer: "-4px 0 24px -4px rgba(52, 49, 47, 0.08)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
