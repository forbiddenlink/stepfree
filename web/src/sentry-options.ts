import type { init } from '@sentry/nextjs';

// Keep stack locations for grouping. Free-form messages, request data and
// breadcrumbs can contain application input and are deliberately omitted.
export const sentryOptions = {
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: 'production',
  sendDefaultPii: false,
  maxBreadcrumbs: 0,
  tracesSampleRate: 0,
  beforeSend(event) {
    return {
      event_id: event.event_id,
      timestamp: event.timestamp,
      platform: event.platform,
      environment: event.environment,
      release: event.release,
      level: event.level,
      exception: {
        values: event.exception?.values?.map(exception => ({
          type: /^(TypeError|RangeError|ReferenceError|SyntaxError|Error)$/.test(exception.type ?? '') ? exception.type : 'Error',
          value: 'Application exception',
          stacktrace: {
            frames: exception.stacktrace?.frames?.map(frame => ({
              filename: frame.filename?.split(/[?#]/)[0]?.match(/(?:^|\/)([\w.-]+\.[cm]?js)$/)?.[1],
              function: frame.function?.match(/^[\w.$<> ]{1,100}$/)?.[0],
              lineno: frame.lineno,
              colno: frame.colno,
              in_app: frame.in_app,
            })),
          },
        })),
      },
    };
  },
} satisfies NonNullable<Parameters<typeof init>[0]>;
