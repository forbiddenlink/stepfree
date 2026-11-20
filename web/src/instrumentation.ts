import type { Instrumentation } from 'next';

export async function register() {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const { init } = await import('@sentry/nextjs');
  const { sentryOptions } = await import('./sentry-options');
  init(sentryOptions);
}

export const onRequestError: Instrumentation.onRequestError = async (...args) => {
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return;
  const { captureRequestError } = await import('@sentry/nextjs');
  await captureRequestError(...args);
};
