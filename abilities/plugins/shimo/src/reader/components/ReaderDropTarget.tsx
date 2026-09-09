import type { DragEvent, ReactElement, ReactNode } from "react";

export function ReaderDropTarget({
  children,
  onFiles,
}: {
  children: ReactNode;
  onFiles(files: FileList): Promise<void>;
}): ReactElement {
  const isFileDrag = (event: DragEvent<HTMLElement>): boolean =>
    Array.from(event.dataTransfer.types).includes("Files");

  const handleDrop = (event: DragEvent<HTMLElement>): void => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    if (event.dataTransfer.files.length > 0) void onFiles(event.dataTransfer.files);
  };

  return (
    <main
      className="shimo-workspace relative flex h-full min-h-0 overflow-hidden bg-background text-foreground"
      onDragOver={(event) => {
        if (isFileDrag(event)) event.preventDefault();
      }}
      onDrop={handleDrop}
    >
      {children}
    </main>
  );
}
