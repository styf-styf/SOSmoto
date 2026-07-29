import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#FF6B00',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};

export default config;
