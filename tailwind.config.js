// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        background: '#ffffff',
        'muted-foreground': '#64748b',
        'primary-foreground': '#f8fafc',
        'sidebar-primary': '#1e293b',
        'zinc-200': '#e4e4e7',
        'zinc-300': '#d4d4d8',
        'zinc-400': '#a1a1aa',
        'zinc-600': '#52525b',
        'zinc-700': '#3f3f46',
        'zinc-800': '#27272a',
      }
    },
  },
  plugins: [],
}
