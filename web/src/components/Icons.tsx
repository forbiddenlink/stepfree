export function ElevatorIcon({ className = "h-4 w-4" }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="m8 10 2-2 2 2" />
      <path d="m8 14 2 2 2-2" />
      <path d="M16 8v8" />
    </svg>
  );
}

export function WheelchairIcon({ className = "h-4 w-4" }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <circle cx="12" cy="4" r="2" />
      <path d="M19 13v-2c0-.55-.45-1-1-1h-5V7c0-.55-.45-1-1-1s-1 .45-1 1v5c0 .55.45 1 1 1h4v3.1c-1.2.6-2 1.8-2 3.2 0 1.9 1.6 3.5 3.5 3.5s3.5-1.6 3.5-3.5c0-1.4-.8-2.6-2-3.2V13h-1zm-1.5 5.2c-.7 0-1.2-.6-1.2-1.2s.6-1.2 1.2-1.2 1.2.6 1.2 1.2-.5 1.2-1.2 1.2z" />
      <path d="M5.5 13.5c.3 0 .5.2.5.5 0 2.2 1.8 4 4 4 .6 0 1.2-.1 1.7-.4l.9 1.6c-.8.5-1.7.8-2.6.8-3.3 0-6-2.7-6-6 0-.3.2-.5.5-.5z" />
    </svg>
  );
}

export function CheckCircleIcon({ className = "h-4 w-4" }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function AlertCircleIcon({ className = "h-4 w-4" }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export function TransferIcon({ className = "h-4 w-4" }: { className?: string }): React.JSX.Element {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 10h14l-4-4" />
      <path d="M17 14H3l4 4" />
    </svg>
  );
}
