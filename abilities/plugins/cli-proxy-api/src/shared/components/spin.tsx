import { type ReactElement } from "react";

export function Spin(): ReactElement {
  return <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-r-transparent align-[-2px]" aria-hidden="true" />;
}
