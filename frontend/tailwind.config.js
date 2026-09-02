/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ["class"],
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      // The locked stack (Gloock / Literata / Schibsted Grotesk, see
      // design_guidelines.json and index.css's --display-font/--reading-font/
      // --body-font) is applied via `!important` in index.css's .font-editorial/
      // .font-plex rules, which is what actually wins over these Tailwind
      // utilities today. These are left as the correct fallback chains rather
      // than deleted, so nothing regresses if that CSS ever changes — but
      // don't read this block as "what font actually renders."
      fontFamily: {
        editorial: ['Gloock', '"Playfair Display"', 'Georgia', 'serif'],
        plex: ['"Schibsted Grotesk"', '"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        'plex-mono': ['"IBM Plex Mono"', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        'display': ['4.5rem', { lineHeight: '1', letterSpacing: '-0.02em', fontWeight: '900' }],
        '5xl': ['3rem', { lineHeight: '1.1', letterSpacing: '-0.01em' }],
        '4xl': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.01em' }],
        '3xl': ['1.875rem', { lineHeight: '1.25' }],
        '2xl': ['1.5rem', { lineHeight: '1.3' }],
        'xl': ['1.25rem', { lineHeight: '1.4' }],
        'lg': ['1.125rem', { lineHeight: '1.6' }],
        'base': ['1rem', { lineHeight: '1.6' }],
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
