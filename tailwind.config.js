/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#16845b",
          dark: "#106b49",
          light: "#e7f5ee",
        },
      },
      fontFamily: {
        prompt: ["Prompt", "sans-serif"],
      },
    },
  },
  plugins: [],
};