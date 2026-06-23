import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  // Linting runs as its own step (`npm run lint`), not during the build.
  eslint: { ignoreDuringBuilds: true },
};

export default withNextIntl(nextConfig);
