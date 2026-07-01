import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "#e5e7eb",
        surface: "#f8fafc",
        primary: {
          DEFAULT: "#2563eb",
          dark: "#1d4ed8",
          soft: "#dbeafe",
        },
      },
      boxShadow: {
        soft: "0 12px 28px rgba(15, 23, 42, 0.08)",
      },
    },
  },
  plugins: [],
};

export default config;
