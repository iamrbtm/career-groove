/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        coral: "#ef6a5b",
        cream: "#f6f0e5",
        ink: "#26312c",
        mint: "#93c9ad",
        plum: "#74517d",
        sunshine: "#f4c95d",
      },
      fontFamily: {
        sans: ["Outfit_400Regular"],
        semibold: ["Outfit_600SemiBold"],
        bold: ["Outfit_700Bold"],
        extrabold: ["Outfit_800ExtraBold"],
        black: ["Outfit_900Black"],
      },
      borderRadius: {
        groove: "22px",
      },
    },
  },
  plugins: [],
};
