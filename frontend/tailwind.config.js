/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        doom: {
          bg: '#0c0d0e',
          surface: '#141618',
          card: '#1a1d20',
          border: '#2a2e33',
          'border-bright': '#3f454c',
          text: '#e2e8f0',
          muted: '#8b949e',
          red: '#dc2626',
          'red-bright': '#ef4444',
          'red-dark': '#991b1b',
          amber: '#f59e0b',
          'amber-bright': '#fbbf24',
          green: '#10b981',
          'green-bright': '#34d399',
          cyan: '#06b6d4',
          blue: '#3b82f6',
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', '"Liberation Mono"', '"Courier New"', 'monospace'],
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
