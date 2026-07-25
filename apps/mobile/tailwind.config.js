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
        display: ["Outfit"],
      },
      borderRadius: {
        groove: "22px",
      },
    },
  },
  plugins: [],
};
