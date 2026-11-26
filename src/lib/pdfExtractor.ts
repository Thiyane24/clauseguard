import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export async function extractPdfTextLocally(file: File): Promise<{ text: string; pageCount: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;

  const pages: string[] = [];
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum += 1) {
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const lineParts: string[] = [];
    let lastY: number | null = null;

    for (const item of textContent.items) {
      if ('str' in item) {
        const y = Array.isArray(item.transform) ? item.transform[5] : null;
        if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) {
          lineParts.push('\n');
        }
        lineParts.push(item.str);
        if (item.hasEOL) {
          lineParts.push('\n');
        }
        lastY = y;
      }
    }
    pages.push(lineParts.join(' ').replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g, '\n'));
  }

  return {
    text: pages.join('\n\n').trim(),
    pageCount: pdf.numPages,
  };
}
