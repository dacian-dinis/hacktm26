import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        background: "hsl(0 0% 100%)",
        foreground: "hsl(222 47% 11%)",
        muted: "hsl(210 40% 96%)",
        mutedForeground: "hsl(215 16% 47%)",
        border: "hsl(214 32% 91%)",
        accent: "hsl(221 83% 53%)",
        success: "hsl(142 71% 45%)",
        warning: "hsl(38 92% 50%)",
        danger: "hsl(0 84% 60%)",
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};

export default config;
