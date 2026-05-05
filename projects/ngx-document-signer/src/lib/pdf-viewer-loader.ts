import type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist';
import { DocumentSignerSource } from './document-signer.models';

let pdfjsTask: Promise<typeof import('pdfjs-dist')> | undefined;

export async function getPdfJs(workerSrc?: string): Promise<typeof import('pdfjs-dist')> {
  pdfjsTask ??= import('pdfjs-dist');
  const pdfjs = await pdfjsTask;

  if (workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;
  } else if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.mjs', import.meta.url).toString();
  }

  return pdfjs;
}

export async function sourceToBytes(source: DocumentSignerSource): Promise<Uint8Array> {
  if (typeof source === 'string') {
    const response = await fetch(source);
    if (!response.ok) {
      throw new Error(`Unable to load PDF from ${source}`);
    }
    return new Uint8Array(await response.arrayBuffer());
  }

  if (source instanceof Blob) {
    return new Uint8Array(await source.arrayBuffer());
  }

  if (source instanceof Uint8Array) {
    return new Uint8Array(source);
  }

  return new Uint8Array(source.slice(0));
}

export async function loadPdfDocument(source: DocumentSignerSource, workerSrc?: string): Promise<PDFDocumentProxy> {
  const pdfjs = await getPdfJs(workerSrc);
  const data = await sourceToBytes(source);
  return pdfjs.getDocument({ data, verbosity: pdfjs.VerbosityLevel.ERRORS }).promise;
}

export async function renderPdfPage(
  page: PDFPageProxy,
  canvas: HTMLCanvasElement,
  zoom: number,
): Promise<{ width: number; height: number }> {
  const viewport = page.getViewport({ scale: zoom });
  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Unable to render PDF page without a 2D canvas context.');
  }

  const outputScale = Math.max(1, window.devicePixelRatio || 1);
  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;

  context.setTransform(outputScale, 0, 0, outputScale, 0, 0);

  await page.render({ canvasContext: context, viewport }).promise;
  return { width: viewport.width, height: viewport.height };
}
