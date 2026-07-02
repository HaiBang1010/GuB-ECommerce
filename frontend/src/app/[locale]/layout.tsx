import type { Metadata } from "next";
import type { ReactNode } from "react";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { Analytics } from "@vercel/analytics/next";
import { routing } from "@/i18n/routing";
import { Providers } from "@/app/providers";
import "../globals.css";

export const metadata: Metadata = {
  title: "GuB",
  description: "Shoes & clothing web store",
};

// Pre-render both locales at build time.
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Enables static rendering for this locale segment.
  setRequestLocale(locale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body>
        <NextIntlClientProvider>
          {/* Providers (TanStack Query + Supabase session/role bridge) wrap BOTH
              route groups — (storefront) renders the Header, (admin) its own shell. */}
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
        {/* Vercel Web Analytics — visitor metrics (ARCHITECTURE §7). Renders its own
            client boundary, so this server layout stays a server component. Only
            collects data when deployed on Vercel; a no-op locally. The dashboard lives
            in the Vercel project, independent of the DB-backed /admin/analytics. */}
        <Analytics />
      </body>
    </html>
  );
}
