import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { QuizQuestion } from './gemini';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export async function pdfToImages(pdfFile: File): Promise<string[]> {
  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const images: string[] = [];

  // Tomamos solo las primeras 10 páginas para no saturar la API (suficiente para la mayoría de ensayos)
  const numPages = Math.min(pdf.numPages, 10);

  for (let i = 1; i <= numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 1.5 });
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    images.push(canvas.toDataURL('image/jpeg', 0.8));
  }

  return images;
}

export async function extractQuestionImages(pdfFile: File, questions: QuizQuestion[]): Promise<QuizQuestion[]> {
  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  const updatedQuestions: QuizQuestion[] = [];

  for (const q of questions) {
    try {
      const page = await pdf.getPage(q.pageIndex + 1);
      const viewport = page.getViewport({ scale: 2.0 }); // 2x scale for better quality
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      await page.render({ canvasContext: ctx, viewport, canvas }).promise;

      let [ymin, xmin, ymax, xmax] = q.box;
      // Add padding (2% of the page)
      ymin = Math.max(0, ymin - 20);
      xmin = Math.max(0, xmin - 20);
      ymax = Math.min(1000, ymax + 20);
      xmax = Math.min(1000, xmax + 20);

      const cropX = (xmin / 1000) * canvas.width;
      const cropY = (ymin / 1000) * canvas.height;
      const cropW = ((xmax - xmin) / 1000) * canvas.width;
      const cropH = ((ymax - ymin) / 1000) * canvas.height;

      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = cropW;
      cropCanvas.height = cropH;
      const cropCtx = cropCanvas.getContext('2d')!;
      cropCtx.fillStyle = '#ffffff';
      cropCtx.fillRect(0, 0, cropW, cropH);
      cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      const imageBase64 = cropCanvas.toDataURL('image/jpeg', 0.9);
      updatedQuestions.push({ ...q, imageBase64 });
    } catch (e) {
      console.error(`Failed to crop image for question ${q.id}`, e);
      updatedQuestions.push(q); // Push without image if it fails
    }
  }

  return updatedQuestions;
}
