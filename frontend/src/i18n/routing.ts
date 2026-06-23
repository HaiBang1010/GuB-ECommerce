import { defineRouting } from 'next-intl/routing';

// vi/en with an always-on [locale] prefix; vi is the default ("/" → "/vi").
export const routing = defineRouting({
  locales: ['vi', 'en'],
  defaultLocale: 'vi',
  localePrefix: 'always',
});
