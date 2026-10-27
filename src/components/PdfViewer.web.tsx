import { useEffect, useState } from 'react';

/** Web: the browser's own PDF viewer in an iframe; object URL revoked on replace/unmount. */
export function PdfViewer({ blob, style }: { blob: Blob; filename: string; style?: object }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  if (!url) return null;
  const s = (style ?? {}) as { height?: number | string; minHeight?: number };
  return <iframe src={url} title="PDF preview" style={{ width: '100%', height: s.height ?? '60vh', minHeight: s.minHeight ?? 300, border: '1px solid #ccc', borderRadius: 8, background: '#fff' }} />;
}
