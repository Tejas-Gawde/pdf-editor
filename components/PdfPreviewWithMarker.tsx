"use client";

import * as React from "react";

// pdfjs is dynamically imported inside effects to avoid server-side execution

type Marker = { x: number; y: number; page: number } | null;
type Props = {
  fileUrl: string | null;
  marker: Marker;
  onSetMarker: (marker: Marker) => void;
  placementMode?: boolean;
  signaturePreviewUrl?: string | null;
};


export function PdfPreviewWithMarker({
  fileUrl,
  marker,
  onSetMarker,
  placementMode = false,
  signaturePreviewUrl,
}: Props) {
  const [numPages, setNumPages] = React.useState(0);
  const [pdfDoc, setPdfDoc] = React.useState<any | null>(null);
  const [pageSizes, setPageSizes] = React.useState<{ w: number; h: number }[]>([]);
  const [sigSize, setSigSize] = React.useState<{ w: number; h: number } | null>(null);

  React.useEffect(() => {
    if (!fileUrl) {
      setPdfDoc(null);
      setNumPages(0);
      setPageSizes([]);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        // Load pdfjs in the browser only to avoid server-side DOM references
  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-ignore dynamic import of pdfjs for browser-only use
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf");
        // Use local worker file instead of CDN
        const worker = await import("pdfjs-dist/legacy/build/pdf.worker.mjs");
        const { getDocument, GlobalWorkerOptions } = pdfjs;
        if (typeof window !== "undefined") {
          // Create a blob URL for the worker code
          const workerBlob = new Blob([worker.default], { type: "text/javascript" });
          GlobalWorkerOptions.workerSrc = URL.createObjectURL(workerBlob);
        }

        const loadingTask = getDocument(fileUrl as string);
        const doc = await loadingTask.promise;
        if (cancelled) return;
        setPdfDoc(doc as any);
        setNumPages(doc.numPages);
        const sizes = await Promise.all(
          Array.from({ length: doc.numPages }, (_, i) =>
            doc.getPage(i + 1).then((page: any) => {
              const viewport = page.getViewport({ scale: 1 });
              return { w: viewport.width, h: viewport.height };
            })
          )
        );
        if (!cancelled) setPageSizes(sizes as { w: number; h: number }[]);
      } catch (err) {
        // fail silently — preview will not render
        console.error("Failed to load pdfjs", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  React.useEffect(() => {
    if (!signaturePreviewUrl) {
      setSigSize(null);
      return;
    }
    const img = new window.Image();
    img.onload = () => {
      setSigSize({ w: img.naturalWidth, h: img.naturalHeight });
    };
    img.src = signaturePreviewUrl;
    return () => {
      setSigSize(null);
    };
  }, [signaturePreviewUrl]);

  // Render each page as a canvas
  React.useEffect(() => {
    if (!pdfDoc || !numPages) return;
        for (let i = 1; i <= numPages; i++) {
      const canvas = document.getElementById(`pdf-canvas-${i}`) as HTMLCanvasElement | null;
      if (!canvas) continue;
      pdfDoc.getPage(i).then((page: any) => {
        const viewport = page.getViewport({ scale: 1.2 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          page.render({ canvasContext: ctx, canvas, viewport }).promise;
        }
      });
    }
  }, [pdfDoc, numPages, fileUrl]);

  if (!fileUrl || !numPages) return null;
  return (
    <div className="rounded-md border overflow-auto relative" style={{ maxHeight: 700 }}>
      {Array.from({ length: numPages }, (_, idx) => {
        const pageNum = idx + 1;
        const size = pageSizes[idx] || { w: 600, h: 800 };
        return (
          <div
            key={pageNum}
            className="relative mb-4"
            style={{ width: size.w, height: size.h }}
          >
            <canvas
              id={`pdf-canvas-${pageNum}`}
              style={{ width: "100%", height: "100%", display: "block" }}
            />
            {placementMode && (
              <div
                className="absolute inset-0 z-10 cursor-crosshair"
                onClick={(e) => {
                  const rect = (e.currentTarget as HTMLDivElement).getBoundingClientRect();
                  const clickX = e.clientX - rect.left;
                  const clickY = e.clientY - rect.top;
                  const x = Math.min(Math.max(clickX / rect.width, 0), 1);
                  const y = Math.min(Math.max(clickY / rect.height, 0), 1);
                  onSetMarker({ x, y, page: pageNum });
                }}
                aria-label={`Click to set signature position on page ${pageNum}`}
                style={{ pointerEvents: "auto" }}
              />
            )}
            {marker && marker.page === pageNum && signaturePreviewUrl && sigSize ? (
              <img
                src={signaturePreviewUrl}
                alt="Signature marker"
                className="absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-sm shadow pointer-events-none"
                style={{
                  left: `${marker.x * 100}%`,
                  top: `${marker.y * 100}%`,
                  width: (() => {
                    if (!sigSize || !size) return "36px";
                    const targetWidthPx = Math.max(120, Math.min(300, size.w * 0.25));
                    const scale = targetWidthPx / sigSize.w;
                    return `${sigSize.w * scale}px`;
                  })(),
                  height: (() => {
                    if (!sigSize || !size) return "auto";
                    const targetWidthPx = Math.max(120, Math.min(300, size.w * 0.25));
                    const scale = targetWidthPx / sigSize.w;
                    return `${sigSize.h * scale}px`;
                  })(),
                }}
                aria-hidden
              />
            ) : marker && marker.page === pageNum ? (
              <div
                className="absolute z-20 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary border border-background shadow pointer-events-none"
                style={{ left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }}
                aria-hidden
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
