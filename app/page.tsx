"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PDFDocument } from "pdf-lib";
import { DocumentTypeSelector } from "@/components/DocumentTypeSelector";
import { PdfPreviewWithMarker } from "@/components/PdfPreviewWithMarker";
import { ActionButtons } from "@/components/ActionButtons";

export default function Home() {
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [documentType, setDocumentType] = React.useState("");
  const [fileUrl, setFileUrl] = React.useState<string | null>(null);
  const [marker, setMarker] = React.useState<{ x: number; y: number; page: number } | null>(null);
  const [signatureFile, setSignatureFile] = React.useState<File | null>(null);
  const [signaturePreviewUrl, setSignaturePreviewUrl] = React.useState<string | null>(null);
  const [hasStoredSignature, setHasStoredSignature] = React.useState(false);
  const [signing, setSigning] = React.useState(false);
  const [autoSigning, setAutoSigning] = React.useState(false);
  const [status, setStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [useExistingType, setUseExistingType] = React.useState(true);
  const [documentTypes, setDocumentTypes] = React.useState<string[]>([]);
  const [loadingTypes, setLoadingTypes] = React.useState(false);

  React.useEffect(() => {
    if (!selectedFile) {
      if (fileUrl) URL.revokeObjectURL(fileUrl);
      setFileUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setFileUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [selectedFile]);

  React.useEffect(() => {
    // Load available document types for dropdown
    void (async () => {
      try {
        setLoadingTypes(true);
        const res = await fetch("/api/document-types");
        if (!res.ok) return;
        const list = (await res.json()) as Array<
          { name?: string } & Record<string, unknown>
        >;
        const names = list
          .map((i) => (typeof i.name === "string" ? i.name : undefined))
          .filter((n): n is string => !!n)
          .sort((a, b) => a.localeCompare(b));
        setDocumentTypes(names);
        if (useExistingType && names.length > 0 && !documentType) {
          setDocumentType(names[0]);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoadingTypes(false);
      }
    })();
    // we intentionally run only once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
  }

  function handleSignatureChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (signaturePreviewUrl) {
      try {
        URL.revokeObjectURL(signaturePreviewUrl);
      } catch {}
    }
    setSignatureFile(file);
    if (file) {
      setSignaturePreviewUrl(URL.createObjectURL(file));
      setHasStoredSignature(false);
    } else {
      setSignaturePreviewUrl(null);
    }
  }

  React.useEffect(() => {
    // Try load saved mapping when doc type changes
    const name = documentType.trim();
    if (!name) {
      setMarker(null);
      return;
    }
    void (async () => {
      try {
        const res = await fetch(
          `/api/mappings?name=${encodeURIComponent(name)}`
        );
        if (!res.ok) return;
        const data = await res.json();
        if (
          data &&
          typeof data.x === "number" &&
          typeof data.y === "number" &&
          typeof data.page === "number"
        ) {
          setMarker({ x: data.x, y: data.y, page: data.page });
          setStatus("Loaded saved mapping.");
        }
      } catch {}
    })();
    // Check for stored signature for this document type
    if (typeof window !== "undefined") {
      const stored = name ? localStorage.getItem(`signature:${name}`) : null;
      if (stored) {
        setHasStoredSignature(true);
        setSignaturePreviewUrl(stored);
      } else {
        setHasStoredSignature(false);
        // do not clear signaturePreviewUrl here if user has uploaded a file
      }
    }
  }, [documentType]);

  async function autoSignAndDownload() {
  if (!selectedFile || !documentType.trim()) return;
    setAutoSigning(true);
    try {
      // Ensure mapping exists/fetch it
      const res = await fetch(
        `/api/mappings?name=${encodeURIComponent(documentType.trim())}`
      );
      const data = res.ok ? await res.json() : null;
      const effectiveMarker =
        data &&
        typeof data.x === "number" &&
        typeof data.y === "number" &&
        typeof data.page === "number"
          ? { x: data.x, y: data.y, page: data.page }
          : marker;
      if (!effectiveMarker) return;

      const pdfBytes = await selectedFile.arrayBuffer();
      let sigBytes: ArrayBuffer | null = null;
      if (signatureFile) {
        sigBytes = await signatureFile.arrayBuffer();
      } else if (typeof window !== "undefined") {
        const key = `signature:${documentType.trim()}`;
        const stored = localStorage.getItem(key);
        if (stored) {
          // data URL => base64
          const base64 = stored.split(",")[1] ?? "";
          const binary = atob(base64);
          const len = binary.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
          sigBytes = bytes.buffer;
        }
      }
      if (!sigBytes) {
        setError("No signature image available for signing.");
        return;
      }
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();
      const pageIdx = Math.min(
        (effectiveMarker.page ?? 1) - 1,
        pages.length - 1
      );
      const page = pages[pageIdx];
      let embeddedImage;
      // determine mime from provided signatureFile or stored data URL
      let mime = signatureFile?.type;
      if (!mime && typeof window !== "undefined") {
        const stored = localStorage.getItem(`signature:${documentType.trim()}`);
        if (stored) {
          mime = stored.slice(5, stored.indexOf(";"));
        }
      }
      if (mime === "image/png") embeddedImage = await pdfDoc.embedPng(sigBytes as ArrayBuffer);
      else embeddedImage = await pdfDoc.embedJpg(sigBytes as ArrayBuffer);
      const { width: pageW, height: pageH } = page.getSize();
      const targetWidthPx = Math.max(120, Math.min(300, pageW * 0.25));
      const scale = targetWidthPx / embeddedImage.width;
      const drawWidth = embeddedImage.width * scale;
      const drawHeight = embeddedImage.height * scale;
      const x = effectiveMarker.x * pageW;
      const yTopOrigin = effectiveMarker.y * pageH;
      const y = pageH - yTopOrigin - drawHeight / 2;
      page.drawImage(embeddedImage, {
        x: x - drawWidth / 2,
        y,
        width: drawWidth,
        height: drawHeight,
      });
      const signedBytes = await pdfDoc.save();
      const blob = new Blob([signedBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = selectedFile.name.replace(/\.pdf$/i, "") + "-signed.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setAutoSigning(false);
    }
  }

  async function saveMappingAndDownload() {
    if (!selectedFile || !signatureFile || !documentType.trim() || !marker)
      return;
    setSigning(true);
    try {
      setError(null);
      setStatus("Saving type and mapping...");
      // Ensure the document type exists
      await fetch("/api/document-types", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: documentType.trim() }),
      });
      // Save mapping for this type
      await fetch("/api/mappings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: documentType.trim(),
          page: marker.page,
          x: marker.x,
          y: marker.y,
        }),
      });
      // persist signature image locally so "use existing" can use it later
      try {
        if (typeof window !== "undefined" && signatureFile) {
          const arr = new Uint8Array(await signatureFile.arrayBuffer());
          let binary = "";
          for (let i = 0; i < arr.length; i++) binary += String.fromCharCode(arr[i]);
          const b64 = btoa(binary);
          const dataUrl = `data:${signatureFile.type};base64,${b64}`;
          localStorage.setItem(`signature:${documentType.trim()}`, dataUrl);
          setHasStoredSignature(true);
          setSignaturePreviewUrl(dataUrl);
        }
      } catch (e) {
        console.warn("Failed to persist signature locally", e);
      }
      setStatus("Mapping saved. Generating signed PDF...");

      // proceed to sign using the current marker
      const pdfBytes = await selectedFile.arrayBuffer();
      const sigBytes = await signatureFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const pages = pdfDoc.getPages();
      const pageIdx = Math.min((marker.page ?? 1) - 1, pages.length - 1);
      const page = pages[pageIdx];
      let embeddedImage;
      if (signatureFile.type === "image/png")
        embeddedImage = await pdfDoc.embedPng(sigBytes);
      else embeddedImage = await pdfDoc.embedJpg(sigBytes);
      const { width: pageW, height: pageH } = page.getSize();
      const targetWidthPx = Math.max(120, Math.min(300, pageW * 0.25));
      const scale = targetWidthPx / embeddedImage.width;
      const drawWidth = embeddedImage.width * scale;
      const drawHeight = embeddedImage.height * scale;
      const x = marker.x * pageW;
      const yTopOrigin = marker.y * pageH;
      const y = pageH - yTopOrigin - drawHeight / 2;
      page.drawImage(embeddedImage, {
        x: x - drawWidth / 2,
        y,
        width: drawWidth,
        height: drawHeight,
      });
      const signedBytes = await pdfDoc.save();
      const blob = new Blob([signedBytes], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = selectedFile.name.replace(/\.pdf$/i, "") + "-signed.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setStatus("Signed PDF downloaded.");
    } catch (e) {
      console.error(e);
      setError("Failed to save mapping or sign.");
    } finally {
      setSigning(false);
    }
  }

  function handleContinue() {
    // Save/ensure document type exists. Actual coordinate mapping will be handled later.
    void (async () => {
      if (!documentType.trim()) return;
      try {
        setError(null);
        setStatus("Saving document type...");
        await fetch("/api/document-types", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ name: documentType.trim() }),
        });
        setStatus("Document type saved.");
      } catch (e) {
        console.error(e);
        setError("Failed to save document type.");
      }
    })();
  }

  // Overlay click is now handled inside PdfPreviewWithMarker

  const isContinueDisabled = !selectedFile || documentType.trim().length === 0;

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-6">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Digital Signature Automation</CardTitle>
          <CardDescription>
            Upload a PDF or .docx and specify its document type to begin.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-4">
            {status && (
              <div className="text-xs text-muted-foreground">{status}</div>
            )}
            {error && <div className="text-xs text-destructive">{error}</div>}
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Document file</label>
              <Input
                type="file"
                accept="application/pdf,.docx"
                onChange={handleFileChange}
                aria-invalid={false}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium">Signature image</label>
              {!useExistingType ? (
                <Input
                  type="file"
                  accept="image/png,image/jpeg"
                  onChange={handleSignatureChange}
                  aria-invalid={false}
                />
              ) : hasStoredSignature ? (
                <div className="text-sm text-muted-foreground">Using stored signature for this document type.</div>
              ) : (
                <div className="text-sm text-muted-foreground">No stored signature for this type. Switch to "Add new" to upload one.</div>
              )}
            </div>
            <DocumentTypeSelector
              useExistingType={useExistingType}
              setUseExistingType={setUseExistingType}
              documentTypes={documentTypes}
              loadingTypes={loadingTypes}
              documentType={documentType}
              setDocumentType={setDocumentType}
            />
            <div className="pt-2">
              <Button onClick={handleContinue} disabled={isContinueDisabled}>
                Continue
              </Button>
            </div>
            {selectedFile && (
              <div className="mt-4 border-t pt-4">
                <div className="text-sm text-muted-foreground mb-2">
                  Preview
                </div>
                {selectedFile.type === "application/pdf" && fileUrl ? (
                  <div className="relative" style={{ maxHeight: 700, overflow: "auto" }}>
                    <PdfPreviewWithMarker
                      fileUrl={fileUrl}
                      marker={marker}
                      onSetMarker={setMarker}
                      placementMode={!useExistingType}
                      signaturePreviewUrl={signaturePreviewUrl ?? (signatureFile ? URL.createObjectURL(signatureFile) : undefined)}
                    />
                  </div>
                ) : (
                  <div className="text-sm">
                    <div>
                      <span className="font-medium">File:</span> {selectedFile.name}
                    </div>
                    <div>
                      <span className="font-medium">Type:</span> {selectedFile.type || "application/vnd.openxmlformats-officedocument.wordprocessingml.document"}
                    </div>
                    <div>
                      <span className="font-medium">Size:</span> {(selectedFile.size / 1024).toFixed(1)} KB
                    </div>
                    <div className="mt-2 text-muted-foreground">
                      .docx preview is not supported in-browser. We will show a render after converting/parsing in a later step.
                    </div>
                  </div>
                )}
                <ActionButtons
                  useExistingType={useExistingType}
                  disabledExisting={
                    !selectedFile ||
                    !signatureFile ||
                    !documentType.trim() ||
                    autoSigning
                  }
                  disabledNew={
                    !selectedFile ||
                    !signatureFile ||
                    !documentType.trim() ||
                    !marker ||
                    signing
                  }
                  onDownloadExisting={autoSignAndDownload}
                  onSaveAndDownloadNew={saveMappingAndDownload}
                  signing={signing}
                  autoSigning={autoSigning}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
