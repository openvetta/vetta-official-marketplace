import type { ReactElement } from "react";

type IconProps = { className?: string };

function Icon({ children, className = "size-4" }: IconProps & { children: ReactElement | ReactElement[] }): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function LibraryIcon(props: IconProps): ReactElement {
  return <Icon {...props}><path d="M5 4.8A2.8 2.8 0 0 1 7.8 2H20v16H7.8A2.8 2.8 0 0 0 5 20.8V4.8Z" /><path d="M5 20.8A2.8 2.8 0 0 1 7.8 18H20M9 6h7" /></Icon>;
}

export function ImportIcon(props: IconProps): ReactElement {
  return <Icon {...props}><path d="M12 3v12m0-12 4 4m-4-4L8 7M5 14v5h14v-5" /></Icon>;
}

export function RecordsIcon(props: IconProps): ReactElement {
  return <Icon {...props}><path d="M6 3h12v18l-6-3-6 3V3Z" /></Icon>;
}

export function SettingsIcon(props: IconProps): ReactElement {
  return <Icon {...props}><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.08-1l2-1.55-2-3.46-2.38.96a7 7 0 0 0-1.72-1L14.5 3h-4l-.32 2.95a7 7 0 0 0-1.72 1L6.08 6l-2 3.46L6.08 11a7 7 0 0 0 0 2l-2 1.55 2 3.46 2.38-.96a7 7 0 0 0 1.72 1L10.5 21h4l.32-2.95a7 7 0 0 0 1.72-1l2.38.96 2-3.46L18.92 13a7 7 0 0 0 .08-1Z" /></Icon>;
}

export function CloseIcon(props: IconProps): ReactElement {
  return <Icon {...props}><path d="m6 6 12 12M18 6 6 18" /></Icon>;
}

export function ChevronLeftIcon(props: IconProps): ReactElement {
  return <Icon {...props}><path d="m15 18-6-6 6-6" /></Icon>;
}

export function ChevronRightIcon(props: IconProps): ReactElement {
  return <Icon {...props}><path d="m9 18 6-6-6-6" /></Icon>;
}

export function MoreIcon(props: IconProps): ReactElement {
  return <Icon {...props}><circle cx="5" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" /></Icon>;
}
