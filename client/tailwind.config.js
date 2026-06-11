/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bgDeep: '#0b0c10',
        bgSurface: '#1f2833',
        textMain: '#c5c6c7',
        textDim: '#8b8e95',
        accentPrimary: '#66fcf1',
        accentSecondary: '#45f3ff',
        colorDanger: '#ff4d4d',
        colorSuccess: '#2ecc71',
      },
      backdropBlur: {
        glass: '16px',
      }
    },
  },
  plugins: [],
}
