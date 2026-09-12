import type { NextConfig } from 'next';

const config: NextConfig = {
  // Los paquetes del monorepo se consumen como TypeScript sin paso de build.
  transpilePackages: ['@worldtune/core', '@worldtune/db', '@worldtune/sources'],
  experimental: {
    // PGlite y postgres-js no deben empaquetarse: se cargan en tiempo de ejecucion.
    serverActions: { bodySizeLimit: '1mb' },
  },
  serverExternalPackages: ['@electric-sql/pglite', 'postgres'],
  images: {
    // Los logos vienen de cientos de dominios distintos; no se optimizan.
    unoptimized: true,
  },
  eslint: { ignoreDuringBuilds: true },
};

export default config;
