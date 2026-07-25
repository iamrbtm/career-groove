import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{js,ts,jsx,tsx}", "./components/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#26312c", cream: "#f6f0e5", coral: "#ff6b57", mint: "#62c6a5",
        sun: "#ffc857", plum: "#725a7a", fog: "#e8e2d7"
      },
      boxShadow: { soft: "0 12px 30px rgba(57, 48, 39, .10)", pop: "0 6px 0 #26312c" },
      borderRadius: { "4xl": "2rem" }
    }
  },
  plugins: []
} satisfies Config;
