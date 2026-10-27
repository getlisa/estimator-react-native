import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/contexts/ThemeContext';
import { blobToBase64, blobToCacheFile } from '@/lib/download';

/**
 * Inline PDF viewer. iOS: WKWebView renders a local PDF file natively. Android: the system
 * WebView cannot, so a small pdf.js page (CDN) paints every page onto a canvas.
 * Web has its own implementation (PdfViewer.web.tsx: an <iframe>).
 */
export function PdfViewer({ blob, filename, style }: { blob: Blob; filename: string; style?: object }) {
  const { colors } = useTheme();
  const [source, setSource] = useState<{ uri: string } | { html: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setSource(null); setError(null);
    (async () => {
      try {
        if (Platform.OS === 'ios') {
          const file = await blobToCacheFile(blob, filename);
          if (live) setSource({ uri: file.uri });
        } else {
          const base64 = await blobToBase64(blob);
          if (live) setSource({ html: pdfJsPage(base64, colors.background) });
        }
      } catch (e) {
        if (live) setError(e instanceof Error ? e.message : 'Could not open PDF');
      }
    })();
    return () => { live = false; };
  }, [blob, filename, colors.background]);

  if (error) return <ThemedText type="caption" style={{ padding: 16 }}>{error}</ThemedText>;
  if (!source) return <View style={[styles.center, style]}><ActivityIndicator color={colors.tint} /></View>;
  return (
    <WebView
      source={source}
      style={[{ backgroundColor: colors.background }, style]}
      originWhitelist={['*']}
      allowFileAccess
      allowFileAccessFromFileURLs
      allowingReadAccessToURL={Platform.OS === 'ios' && 'uri' in source ? source.uri.replace(/[^/]+$/, '') : undefined}
      javaScriptEnabled
      scalesPageToFit
      setBuiltInZoomControls={false}
      startInLoadingState
      renderLoading={() => <View style={styles.center}><ActivityIndicator color={colors.tint} /></View>}
      onError={(e) => setError(e.nativeEvent.description || 'Could not open PDF')}
    />
  );
}

/** pdf.js 3.11.174 (legacy build, works in Android WebView) rendering every page to a canvas. */
const pdfJsPage = (base64: string, bg: string) => `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=4">
<style>body{margin:0;background:${bg};display:flex;flex-direction:column;align-items:center;gap:8px;padding:8px}canvas{max-width:100%;box-shadow:0 1px 4px rgba(0,0,0,.3);background:#fff}#s{font:14px sans-serif;color:#888;padding:24px}</style>
<script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script></head>
<body><div id="s">Rendering…</div><script>
pdfjsLib.GlobalWorkerOptions.workerSrc='https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const bin=atob('${base64}');const bytes=new Uint8Array(bin.length);for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
pdfjsLib.getDocument({data:bytes}).promise.then(async pdf=>{document.getElementById('s').remove();
const width=document.body.clientWidth-16;const ratio=window.devicePixelRatio||1;
for(let n=1;n<=pdf.numPages;n++){const page=await pdf.getPage(n);const v0=page.getViewport({scale:1});const scale=width/v0.width;const v=page.getViewport({scale:scale*ratio});
const c=document.createElement('canvas');c.width=v.width;c.height=v.height;c.style.width=width+'px';c.style.height=(v.height/ratio)+'px';document.body.appendChild(c);
await page.render({canvasContext:c.getContext('2d'),viewport:v}).promise;}
}).catch(e=>{document.getElementById('s').textContent='Could not render PDF: '+e.message});
</script></body></html>`;

const styles = StyleSheet.create({ center: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 200 } });
