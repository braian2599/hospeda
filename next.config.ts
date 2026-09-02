import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone", // Requerido para deploy Docker/VPS
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: true,
  async headers() {
    return [{
      source: '/(.*)',
      headers: [
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'X-XSS-Protection', value: '1; mode=block' },
        // HSTS: forzar HTTPS por 1 año (incluye subdominios)
        { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
        // CSP: prevenir XSS, data exfiltration, y carga de scripts externos
        // Permite: self, inline styles (necesario para Next.js styled-jsx/tailwind),
        // inline scripts con nonce (Next.js los maneja), imágenes data: y https,
        // font-src de Google Fonts, connect-src a API y webhooks de MP
        {
          key: 'Content-Security-Policy',
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.mercadopago.com",
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
            "font-src 'self' https://fonts.gstatic.com data:",
            "img-src 'self' data: https: blob:",
            "connect-src 'self' https://api.mercadopago.com https://www.mercadopago.com https://*.r2.cloudflarestorage.com wss:",
            "frame-src 'self' https://www.mercadopago.com https://www.google.com",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self' https://www.mercadopago.com",
            "frame-ancestors 'none'",
          ].join('; '),
        },
      ],
    }];
  },
};

export default nextConfig;
