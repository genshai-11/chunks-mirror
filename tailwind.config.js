/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: '#0A0A0B',
        paper: '#FAFAFA',
        line: '#27272A',
        accent: '#E10600',
        'accent-press': '#B80500',
        'fg-muted': '#A1A1AA',
      },
    },
  },
  plugins: [],
}
