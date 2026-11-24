import type { NextConfig } from 'next';

/**
 * Lex Detetive web (PWA): site estático; todos os dados ficam no navegador.
 * NEXT_PUBLIC_BASE_PATH: subpasta onde o site é publicado (ex.: "/Lex-Detetive" no GitHub Pages).
 */
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const config: NextConfig = {
  output: 'export',
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  devIndicators: false,
};

export default config;
