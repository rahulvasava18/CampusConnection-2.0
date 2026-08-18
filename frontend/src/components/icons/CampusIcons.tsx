import type { SVGProps } from 'react';

type CampusIconProps = SVGProps<SVGSVGElement>;

export function CampusMessagesIcon({ className, ...props }: CampusIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path
        d="M4.1 5.3h16.2l-5.8 4.8-2.9 9.8-2.6-9.7L4.1 5.3Z"
        stroke="currentColor"
        strokeWidth="2.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="m4.1 5.3 7.5 7.2 8.7-7.2"
        stroke="currentColor"
        strokeWidth="2.35"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CampusSunIcon({ className, ...props }: CampusIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <circle cx="12" cy="12" r="4.9" stroke="currentColor" strokeWidth="2.25" />
      <path
        d="M12 2.1v2.2M12 19.7v2.2M4.99 4.99l1.55 1.55m10.92 10.92 1.55 1.55M2.1 12h2.2m15.4 0h2.2M4.99 19.01l1.55-1.55m10.92-10.92 1.55-1.55"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CampusMoonIcon({ className, ...props }: CampusIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path
        d="M19.7 15.8a8.35 8.35 0 1 1-10.95-10.4A8.35 8.35 0 0 0 19.7 15.8Z"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CampusSettingsIcon({ className, ...props }: CampusIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={className}
      {...props}
    >
      <path
        d="m9.35 3.35.55 1.72a7.4 7.4 0 0 1 2.1 0l.55-1.72 2.14.9-.68 1.67a7.5 7.5 0 0 1 1.49 1.49l1.67-.68.9 2.14-1.72.55a7.4 7.4 0 0 1 0 2.1l1.72.55-.9 2.14-1.67-.68a7.5 7.5 0 0 1-1.49 1.49l.68 1.67-2.14.9-.55-1.72a7.4 7.4 0 0 1-2.1 0l-.55 1.72-2.14-.9.68-1.67a7.5 7.5 0 0 1-1.49-1.49l-1.67.68-.9-2.14 1.72-.55a7.4 7.4 0 0 1 0-2.1l-1.72-.55.9-2.14 1.67.68a7.5 7.5 0 0 1 1.49-1.49l-.68-1.67 2.14-.9Z"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="11.97" r="2.65" stroke="currentColor" strokeWidth="1.9" />
    </svg>
  );
}
