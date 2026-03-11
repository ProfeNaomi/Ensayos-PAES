import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { QuizQuestion } from './gemini';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export async function pdfToImages(pdfFile: File): Promise<string[]> {
  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const images: string[] = [];

  // Tomamos todas las páginas disponibles para ensayos completos
  const numPages = pdf.numPages;

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
      const viewport = page.getViewport({ scale: 2.5 }); // Higher quality for OCR
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d')!;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;

      let [ymin, xmin, ymax, xmax] = q.box;
      // Capturamos el 100% del ANCHO de la página para no perder alternativas laterales
      const V_PADDING = 120; 
      const realYmin = Math.max(0, ymin - V_PADDING);
      const realYmax = Math.min(1000, ymax + V_PADDING);

      const cropX = 0; // Desde el borde izquierdo
      const cropY = (realYmin / 1000) * canvas.height;
      const cropW = canvas.width; // Todo el ancho
      const cropH = ((realYmax - realYmin) / 1000) * canvas.height;

      if (cropH < 10) throw new Error("Recorte inválido");

      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = cropW;
      cropCanvas.height = cropH;
      const cropCtx = cropCanvas.getContext('2d')!;
      cropCtx.fillStyle = '#ffffff';
      cropCtx.fillRect(0, 0, cropW, cropH);
      cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      const imageBase64 = cropCanvas.toDataURL('image/jpeg', 0.95);
      updatedQuestions.push({ ...q, imageBase64 });
    } catch (e) {
      console.error(`Failed to crop image for question ${q.id}`, e);
      updatedQuestions.push(q);
    }
  }

  return updatedQuestions;
}
