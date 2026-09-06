import * as pdfjs from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { useEffect, useRef, useState, type RefObject } from "react";

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface PdfTextSpan {
  text: string;
  left: number;
  top: number;
  fontSize: number;
}

interface PdfPageState {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  spans: PdfTextSpan[];
  size: { width: number; height: number };
  renderedPage: number;
  loading: boolean;
  error: string | null;
}

export function usePdfPage(
  url: string,
  page: number,
  onPage: (page: number) => void,
  onCount: (count: number) => void
): PdfPageState {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [spans, setSpans] = useState<PdfTextSpan[]>([]);
  const [size, setSize] = useState({ width: 720, height: 960 });
  const [renderedPage, setRenderedPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const task = pdfjs.getDocument({ url });
    setLoading(true);
    setError(null);
    setRenderedPage(0);
    setSpans([]);

    void task.promise.then(async (document) => {
      onCount(document.numPages);
      const boundedPage = Math.max(1, Math.min(page, document.numPages));
      if (boundedPage !== page) onPage(boundedPage);
      const pdfPage = await document.getPage(boundedPage);
      const viewport = pdfPage.getViewport({ scale: 1.35 });
      const canvas = canvasRef.current;
      if (!canvas || cancelled) return;

      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      setSize({ width: canvas.width, height: canvas.height });
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas unavailable");
      await pdfPage.render({ canvas, canvasContext: context, viewport }).promise;
      const content = await pdfPage.getTextContent();
      const nextSpans = content.items.flatMap((item): PdfTextSpan[] => {
        if (!("str" in item) || !item.str) return [];
        const transform = pdfjs.Util.transform(viewport.transform, item.transform);
        const fontSize = Math.hypot(transform[2], transform[3]);
        return [{ text: item.str, left: transform[4], top: transform[5] - fontSize, fontSize }];
      });
      if (!cancelled) {
        setSpans(nextSpans);
        setRenderedPage(boundedPage);
        setLoading(false);
      }
      pdfPage.cleanup();
      await document.destroy();
    }).catch((cause: unknown) => {
      if (!cancelled) {
        setError(cause instanceof Error ? cause.message : String(cause));
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
      void task.destroy();
    };
  }, [onCount, onPage, page, url]);

  return { canvasRef, spans, size, renderedPage, loading, error };
}
