import { useState, type DragEvent, type ReactElement, type ReactNode } from "react";

export function ReaderDropTarget({
  children,
  onFiles,
}: {
  children: ReactNode;
  onFiles(files: FileList): Promise<void>;
}): ReactElement {
  const [dragging, setDragging] = useState(false);

  const isFileDrag = (event: DragEvent<HTMLElement>): boolean =>
    Array.from(event.dataTransfer.types).includes("Files");

  const handleDrop = (event: DragEvent<HTMLElement>): void => {
    if (!isFileDrag(event)) return;
    event.preventDefault();
    setDragging(false);
    if (event.dataTransfer.files.length > 0) void onFiles(event.dataTransfer.files);
  };

  return (
    <main
      className="@container/shimo-workspace relative flex h-full min-h-0 overflow-hidden bg-background text-foreground outline-primary/60 data-[dragging=true]:-outline-offset-10 data-[dragging=true]:outline-2 data-[dragging=true]:outline-dashed"
      data-dragging={dragging}
      onDragOver={(event) => {
        if (!isFileDrag(event)) return;
        event.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(event) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setDragging(false);
      }}
      onDrop={handleDrop}
    >
      {children}
    </main>
  );
}
