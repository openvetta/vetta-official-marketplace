import type { ReactNode } from "react";

export type IconName =
  | "globe"
  | "search"
  | "document"
  | "key"
  | "shield"
  | "bolt"
  | "check"
  | "chevron"
  | "external"
  | "sparkle";

const PATHS: Record<IconName, ReactNode> = {
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14.5 14.5 0 0 1 0 18a14.5 14.5 0 0 1 0-18Z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m16.5 16.5 4 4" />
    </>
  ),
  document: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8Z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6M9 17h4" />
    </>
  ),
  key: (
    <>
      <circle cx="8" cy="15" r="4" />
      <path d="m11 12 9-9M17 3l4 4M15 8l3 3" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 6v6c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  bolt: <path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12Z" />,
  check: <path d="m4 12.5 5 5L20 6.5" />,
  chevron: <path d="m6 9 6 6 6-6" />,
  external: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3.5 13.9 9 19.5 11 13.9 13 12 18.5 10.1 13 4.5 11 10.1 9Z" />
      <path d="M18.5 16.5 19.3 19l2.2.9-2.2.9-.8 2.2" />
    </>
  )
};

interface IconProps {
  name: IconName;
  className?: string;
  strokeWidth?: number;
}

/** One stroke icon set for the whole page, sized by the caller. */
export function Icon({ name, className = "h-4 w-4", strokeWidth = 1.6 }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {PATHS[name]}
    </svg>
  );
}
