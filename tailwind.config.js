/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: '#0f0f10',
        panel: '#1a1a1e',
        card: '#222228',
        border: '#2e2e36',
        accent: '#6366f1',
      }
    }
  },
  plugins: []
}
