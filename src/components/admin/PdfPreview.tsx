import { PdfViewer } from '@/components/PdfViewer';

/** Inline preview in the proposal editor; same component on every platform now. */
export function PdfPreview({ blob, filename }: { blob: Blob | null; filename: string }) {
  if (!blob) return null;
  return <PdfViewer blob={blob} filename={filename} style={{ height: 480 }} />;
}
