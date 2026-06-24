'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocale, useTranslations } from 'next-intl';

import { Link, useRouter } from '@/i18n/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const passwordSchema = z.object({
  email: z.email(),
  password: z.string().min(6),
});
type PasswordValues = z.infer<typeof passwordSchema>;

const magicSchema = z.object({ email: z.email() });
type MagicValues = z.infer<typeof magicSchema>;

export default function LoginPage() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const [authError, setAuthError] = useState<string | null>(null);
  const [magicSent, setMagicSent] = useState(false);

  const passwordForm = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
  });
  const magicForm = useForm<MagicValues>({ resolver: zodResolver(magicSchema) });

  async function onPasswordSubmit(values: PasswordValues) {
    setAuthError(null);
    const { error } = await createClient().auth.signInWithPassword(values);
    if (error) {
      setAuthError(
        error.message.toLowerCase().includes('confirm')
          ? t('emailConfirmation')
          : t('invalidCredentials'),
      );
      return;
    }
    router.push('/');
  }

  async function onMagicSubmit(values: MagicValues) {
    setAuthError(null);
    const { error } = await createClient().auth.signInWithOtp({
      email: values.email,
      options: {
        emailRedirectTo: `${window.location.origin}/${locale}/auth/callback`,
      },
    });
    if (error) {
      setAuthError(t('invalidCredentials'));
      return;
    }
    setMagicSent(true);
  }

  return (
    <main className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">{t('login')}</h1>

      <Tabs defaultValue="password">
        <TabsList className="w-full">
          <TabsTrigger value="password">{t('passwordTab')}</TabsTrigger>
          <TabsTrigger value="magic">{t('magicLinkTab')}</TabsTrigger>
        </TabsList>

        <TabsContent value="password">
          <form
            onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}
            className="flex flex-col gap-4 pt-4"
            noValidate
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-email">{t('email')}</Label>
              <Input
                id="login-email"
                type="email"
                autoComplete="email"
                {...passwordForm.register('email')}
              />
              {passwordForm.formState.errors.email ? (
                <p className="text-destructive text-sm">{t('invalidEmail')}</p>
              ) : null}
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="login-password">{t('password')}</Label>
              <Input
                id="login-password"
                type="password"
                autoComplete="current-password"
                {...passwordForm.register('password')}
              />
              {passwordForm.formState.errors.password ? (
                <p className="text-destructive text-sm">{t('passwordTooShort')}</p>
              ) : null}
            </div>
            {authError ? (
              <p className="text-destructive text-sm">{authError}</p>
            ) : null}
            <Button type="submit" disabled={passwordForm.formState.isSubmitting}>
              {passwordForm.formState.isSubmitting ? t('submitting') : t('login')}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="magic">
          {magicSent ? (
            <p className="text-muted-foreground pt-4 text-sm">{t('checkEmail')}</p>
          ) : (
            <form
              onSubmit={magicForm.handleSubmit(onMagicSubmit)}
              className="flex flex-col gap-4 pt-4"
              noValidate
            >
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="magic-email">{t('email')}</Label>
                <Input
                  id="magic-email"
                  type="email"
                  autoComplete="email"
                  {...magicForm.register('email')}
                />
                {magicForm.formState.errors.email ? (
                  <p className="text-destructive text-sm">{t('invalidEmail')}</p>
                ) : null}
              </div>
              {authError ? (
                <p className="text-destructive text-sm">{authError}</p>
              ) : null}
              <Button type="submit" disabled={magicForm.formState.isSubmitting}>
                {magicForm.formState.isSubmitting
                  ? t('submitting')
                  : t('magicLink')}
              </Button>
            </form>
          )}
        </TabsContent>
      </Tabs>

      <Link
        href="/auth/signup"
        className="text-muted-foreground mt-6 text-center text-sm hover:underline"
      >
        {t('noAccount')}
      </Link>
    </main>
  );
}
