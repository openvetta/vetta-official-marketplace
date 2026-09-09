import type { PluginTranslate } from "@vetta-org/plugin-sdk";
import { Button, Spin } from "@vetta/ui";
import { useCallback, useEffect, useState, type ReactElement, type RefObject } from "react";
import type { MaterialManifest, OcrPageCache, ReadingPreferences, ReadingRecord } from "../../domain";
import type { ShimoRuntime } from "../../runtime";
import { usePdfPage } from "./usePdfPage";

type OcrClientLike = {
  recognize(
    request: {
      inputs: Array<{ id: string; mimeType: string; source: { type: "plugin-blob"; blobId: string } }>;
      output: { text: boolean; blocks: boolean; regions: boolean };
    },
    options?: { providerId?: string }
  ): Promise<{ providerId: string; items: Array<{ text: string; blocks?: OcrPageCache["blocks"] }> }>;
};

type OcrContext = ShimoRuntime["context"] & { ocr?: OcrClientLike };

export interface PdfReaderProps {
  runtime: ShimoRuntime;
  manifest: MaterialManifest;
  preferences: ReadingPreferences;
  url: string;
  page: number;
  onPage(page: number): void;
  onCount(count: number): void;
  records: ReadingRecord[];
  t: PluginTranslate;
  rootRef: RefObject<HTMLDivElement | null>;
}

export function PdfReader(props: PdfReaderProps): ReactElement {
  const { runtime, manifest, preferences, url, page, onPage, onCount, records, t, rootRef } = props;
  const pdfPage = usePdfPage(url, page, onPage, onCount);
  const [ocrPage, setOcrPage] = useState<OcrPageCache | null>(null);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const ocrAvailable = Boolean((runtime.context as OcrContext).ocr);

  const recognizePage = useCallback(async (): Promise<void> => {
    const canvas = pdfPage.canvasRef.current;
    const ocr = (runtime.context as OcrContext).ocr;
    if (!canvas || !ocr || ocrRunning || pdfPage.renderedPage !== page) return;

    setOcrRunning(true);
    setOcrError(null);
    const blobId = `ocr-page-${crypto.randomUUID()}`;
    try {
      const blob = await canvasToBlob(canvas);
      const file = new File([blob], `page-${page}.png`, { type: "image/png" });
      await runtime.context.storage.putBlobFromFile({ id: blobId, file, mimeType: "image/png" });
      const result = await ocr.recognize({
        inputs: [{ id: `page-${page}`, mimeType: "image/png", source: { type: "plugin-blob", blobId } }],
        output: { text: true, blocks: true, regions: true }
      }, preferences.ocrProviderOverride ? { providerId: preferences.ocrProviderOverride } : undefined);
      const item = result.items[0];
      if (!item) throw new Error("OCR returned no page result");
      const cache: OcrPageCache = {
        schemaVersion: 1,
        page,
        text: item.text,
        blocks: item.blocks,
        providerId: result.providerId,
        createdAt: new Date().toISOString()
      };
      await runtime.repository.writeOcrPage(manifest.id, cache);
      setOcrPage(cache);
    } catch (error) {
      setOcrError(error instanceof Error ? error.message : String(error));
    } finally {
      const storage = runtime.context.storage as typeof runtime.context.storage & { deleteBlob?: (id: string) => Promise<void> };
      await storage.deleteBlob?.(blobId).catch(() => undefined);
      setOcrRunning(false);
    }
  }, [manifest.id, ocrRunning, page, pdfPage.canvasRef, pdfPage.renderedPage, preferences.ocrProviderOverride, runtime]);

  useEffect(() => {
    let cancelled = false;
    setOcrPage(null);
    setOcrError(null);
    if (pdfPage.renderedPage === page && pdfPage.spans.length === 0) {
      void runtime.repository.readOcrPage(manifest.id, page).then((cache) => {
        if (!cancelled) setOcrPage(cache);
      });
    }
    return () => { cancelled = true; };
  }, [manifest.id, page, pdfPage.renderedPage, pdfPage.spans.length, runtime.repository]);

  useEffect(() => {
    const shouldRecognize = pdfPage.renderedPage === page
      && pdfPage.spans.length === 0
      && !ocrPage
      && !ocrRunning
      && preferences.scannedPdfOcr === "visible-pages";
    if (shouldRecognize) void recognizePage();
  }, [ocrPage, ocrRunning, page, pdfPage.renderedPage, pdfPage.spans.length, preferences.scannedPdfOcr, recognizePage]);

  const pagePinyin = records.filter((record) => record.anchor.type === "pdf" && record.anchor.page === page);

  return (
    <div
      ref={rootRef}
      className="relative mx-auto overflow-hidden bg-white shadow-[0_24px_48px_-28px_color-mix(in_oklab,var(--foreground)_28%,transparent)] ring-1 ring-border/80"
      style={{ width: pdfPage.size.width, height: pdfPage.size.height }}
    >
      <canvas ref={pdfPage.canvasRef} className="block" />
      <PdfTextLayer spans={pdfPage.spans} />
      <PdfPinyin records={pagePinyin} />

      {pdfPage.loading ? (
        <div className="absolute inset-0 grid place-items-center bg-background/80 text-xs text-muted-foreground backdrop-blur-sm">
          <div className="flex items-center gap-2">
            <Spin size="sm" />
            <span>{t("status.opening")}</span>
          </div>
        </div>
      ) : null}
      {pdfPage.error ? (
        <div role="alert" className="absolute inset-x-5 top-5 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive shadow-lg">
          {t("pdf.loadFailed")}: {pdfPage.error}
        </div>
      ) : null}
      {pdfPage.spans.length === 0 && ocrPage ? <OcrTextPanel cache={ocrPage} t={t} /> : null}
      {pdfPage.spans.length === 0 && !ocrPage && !pdfPage.loading ? (
        <OcrPrompt
          enabled={preferences.scannedPdfOcr !== "never" && ocrAvailable}
          running={ocrRunning}
          error={ocrError}
          t={t}
          onRecognize={recognizePage}
        />
      ) : null}
    </div>
  );
}

function PdfTextLayer({ spans }: { spans: ReturnType<typeof usePdfPage>["spans"] }): ReactElement {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {spans.map((span, index) => (
        <span
          key={`${index}:${span.text}`}
          className="absolute cursor-text whitespace-pre leading-none text-transparent"
          style={{ left: span.left, top: span.top, fontSize: span.fontSize }}
        >
          {span.text}
        </span>
      ))}
    </div>
  );
}

function PdfPinyin({ records }: { records: ReadingRecord[] }): ReactElement {
  return (
    <>
      {records.map((record) => record.anchor.type === "pdf" && record.anchor.rects[0] ? (
        <div
          key={record.id}
          title={record.quote}
          className="absolute rounded-md border border-border/70 bg-popover/95 px-1.5 py-0.5 text-[11px] text-popover-foreground shadow-sm"
          style={{
            left: `${record.anchor.rects[0].x * 100}%`,
            top: `${Math.max(0, record.anchor.rects[0].y * 100 - 2.8)}%`
          }}
        >
          {record.pinyin?.map((token) => token.pinyin).filter(Boolean).join(" ")}
        </div>
      ) : null)}
    </>
  );
}

function OcrTextPanel({ cache, t }: { cache: OcrPageCache; t: PluginTranslate }): ReactElement {
  return (
    <aside aria-label={t("pdf.ocrText")} className="absolute inset-x-4 bottom-4 max-h-[38%] overflow-auto rounded-2xl border border-border/70 bg-popover/95 p-4 text-[13px] leading-relaxed text-foreground shadow-xl backdrop-blur">
      <strong className="text-xs font-semibold">{t("pdf.ocrText")}</strong>
      <p className="mt-1.5 whitespace-pre-wrap">{cache.text}</p>
    </aside>
  );
}

function OcrPrompt({ enabled, running, error, t, onRecognize }: { enabled: boolean; running: boolean; error: string | null; t: PluginTranslate; onRecognize(): Promise<void> }): ReactElement {
  return (
    <div className="absolute inset-x-5 bottom-5 flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-popover/95 px-3.5 py-3 text-xs text-foreground shadow-lg backdrop-blur">
      <span>{error ? `${t("pdf.ocrFailed")}: ${error}` : enabled ? t("pdf.noTextLayer") : t("pdf.ocrUnavailable")}</span>
      {enabled ? (
        <Button type="button" size="xs" variant="secondary" disabled={running} onClick={() => void onRecognize()}>
          {running ? <Spin size="sm" /> : null}
          {running ? t("pdf.ocrRunning") : t("pdf.ocrRun")}
        </Button>
      ) : null}
    </div>
  );
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Unable to encode PDF page"));
    }, "image/png");
  });
}
