'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocale, useTranslations } from 'next-intl';

import { Link } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const signupSchema = z
  .object({
    email: z.email(),
    password: z.string().min(6),
    confirmPassword: z.string().min(6),
  })
  .refine((d) => d.password === d.confirmPassword, {
    path: ['confirmPassword'],
    message: 'mismatch',
  });
type SignupValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const [authError, setAuthError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const form = useForm<SignupValues>({ resolver: zodResolver(signupSchema) });

  async function onSubmit(values: SignupValues) {
    setAuthError(null);
    const { error } = await createClient().auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        emailRedirectTo: `${window.location.origin}/${locale}/auth/callback`,
      },
    });
    if (error) {
      setAuthError(t('invalidCredentials'));
      return;
    }
    setDone(true);
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">{t('signup')}</h1>

      {done ? (
        <p className="text-muted-foreground text-sm">{t('checkEmail')}</p>
      ) : (
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="flex flex-col gap-4"
          noValidate
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signup-email">{t('email')}</Label>
            <Input
              id="signup-email"
              type="email"
              autoComplete="email"
              {...form.register('email')}
            />
            {form.formState.errors.email ? (
              <p className="text-destructive text-sm">{t('invalidEmail')}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signup-password">{t('password')}</Label>
            <Input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              {...form.register('password')}
            />
            {form.formState.errors.password ? (
              <p className="text-destructive text-sm">{t('passwordTooShort')}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signup-confirm">{t('confirmPassword')}</Label>
            <Input
              id="signup-confirm"
              type="password"
              autoComplete="new-password"
              {...form.register('confirmPassword')}
            />
            {form.formState.errors.confirmPassword ? (
              <p className="text-destructive text-sm">{t('passwordMismatch')}</p>
            ) : null}
          </div>
          {authError ? (
            <p className="text-destructive text-sm">{authError}</p>
          ) : null}
          <Button type="submit" disabled={form.formState.isSubmitting}>
            {form.formState.isSubmitting ? t('submitting') : t('signup')}
          </Button>
        </form>
      )}

      <Link
        href="/auth/login"
        className="text-muted-foreground mt-6 text-center text-sm hover:underline"
      >
        {t('haveAccount')}
      </Link>
    </main>
  );
}
