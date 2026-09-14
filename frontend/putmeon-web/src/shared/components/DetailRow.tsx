import type { ReactNode } from 'react';

export default function DetailRow({
  icon,
  children,
}: {
  icon: 'location' | 'calendar';
  children: ReactNode;
}) {
  return (
    <p className="detail-row">
      <svg
        className="detail-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {icon === 'location' ? (
          <>
            <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0Z" />
            <circle cx="12" cy="10" r="2.5" />
          </>
        ) : (
          <>
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M16 3v4M8 3v4M3 11h18M8 15h2M14 15h2" />
          </>
        )}
      </svg>
      <span>{children}</span>
    </p>
  );
}
