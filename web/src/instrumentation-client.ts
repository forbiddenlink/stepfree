import { init } from '@sentry/nextjs';
import { sentryOptions } from './sentry-options';

if (sentryOptions.dsn) {
  init(sentryOptions);
}
