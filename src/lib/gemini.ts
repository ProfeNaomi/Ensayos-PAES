import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface QuizQuestion {
  id: number;
  pageIndex: number;
  box: [number, number, number, number];
  text: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
  imageBase64?: string;
}

/**
 * Attempts to repair a truncated JSON string by closing open braces and brackets.
 */
function repairTruncatedJson(jsonStr: string): string {
  jsonStr = jsonStr.trim();
  
  try {
    JSON.parse(jsonStr);
    return jsonStr;
  } catch (e) {
    // Continue cleanup
  }

  // Remove trailing commas and fix incomplete objects
  let cleaned = jsonStr.replace(/,\s*$/, "");
  
  const openBrackets = (cleaned.match(/\[/g) || []).length;
  const closeBrackets = (cleaned.match(/\]/g) || []).length;
  const openBraces = (cleaned.match(/\{/g) || []).length;
  const closeBraces = (cleaned.match(/\}/g) || []).length;

  for (let i = 0; i < openBraces - closeBraces; i++) {
    cleaned += "}";
  }
  for (let i = 0; i < openBrackets - closeBrackets; i++) {
    cleaned += "]";
  }

  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch (e) {
    // Last resort: find last complete object
    const lastCompleteObjectEnd = jsonStr.lastIndexOf("},");
    if (lastCompleteObjectEnd !== -1) {
      return jsonStr.substring(0, lastCompleteObjectEnd + 1) + "]";
    }
  }

  return "[]";
}

export async function generateQuizFromPDFs(
  questionsPdfBase64: string,
  solutionsPdfBase64: string | null
): Promise<QuizQuestion[]> {
  const parts: any[] = [
    {
      inlineData: {
        data: questionsPdfBase64,
        mimeType: "application/pdf",
      },
    },
    {
      text: `Eres un experto transcriptor y docente de matemáticas chileno. Tu tarea es extraer TODAS las preguntas de opción múltiple de este ensayo PAES (Prueba de Acceso a la Educación Superior).
      
      INSTRUCCIONES CRÍTICAS:
      1. Transcribe el texto de cada pregunta exactamente como aparece.
      2. Si la pregunta incluye una gráfica, tabla o figura, asegúrate de que el 'box' incluya tanto el texto como la imagen.
      3. Identifica todas las opciones (A, B, C, D, E).
      4. Si se proporciona un documento de soluciones, úsalo para extraer la clave correcta y la explicación.
      5. Si NO hay soluciones, resuelve tú mismo la pregunta paso a paso para asegurar la precisión.
      6. Todas las fórmulas matemáticas DEBEN estar en formato LaTeX rodeado por $, por ejemplo: $x^2 + \frac{1}{2}$.
      `,
    },
  ];

  if (solutionsPdfBase64) {
    parts.push({
      inlineData: {
        data: solutionsPdfBase64,
        mimeType: "application/pdf",
      },
    });
    parts.push({
      text: "Usa este documento de soluciones solo para verificar las respuestas correctas y explicaciones.",
    });
  }

  parts.push({
    text: `Genera una respuesta en formato JSON estrictamente siguiendo este esquema:
    - 'id' (número secuencial)
    - 'pageIndex' (índice de página 0-based)
    - 'box' ([ymin, xmin, ymax, xmax] normalizado 0-1000 que encierra la pregunta y sus figuras, EXCLUYENDO las opciones si es posible)
    - 'text' (texto completo de la pregunta)
    - 'options' (arreglo de strings con las alternativas)
    - 'correctOptionIndex' (índice 0-based de la correcta)
    - 'explanation' (explicación didáctica y paso a paso, ideal para un estudiante de 4to medio).
    
    No incluyas texto fuera del JSON.`,
  });

  const response = await ai.models.generateContent({
    model: "gemini-1.5-flash",
    contents: { parts },
    config: {
      maxOutputTokens: 16384,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.INTEGER },
            pageIndex: { type: Type.INTEGER },
            box: {
              type: Type.ARRAY,
              items: { type: Type.NUMBER },
            },
            text: { type: Type.STRING },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            correctOptionIndex: { type: Type.INTEGER },
            explanation: { type: Type.STRING },
          },
          required: ["id", "pageIndex", "box", "text", "options", "correctOptionIndex", "explanation"],
        },
      },
    },
  });

  const rawText = response.text || "";
  if (!rawText) throw new Error("No se recibió respuesta de la IA.");
  
  let jsonStr = rawText.trim();
  if (jsonStr.startsWith("```")) {
    jsonStr = jsonStr.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  try {
    return JSON.parse(jsonStr) as QuizQuestion[];
  } catch (e) {
    try {
      return JSON.parse(repairTruncatedJson(jsonStr)) as QuizQuestion[];
    } catch (err) {
      throw new Error("Error crítico al procesar el JSON generado.");
    }
  }
}

export async function chatWithTutor(
  question: QuizQuestion,
  userWrongAnswerIndex: number,
  chatHistory: { role: "user" | "model"; text: string }[],
  newMessage: string
) {
  const systemInstruction = `Eres un tutor experto en matemáticas para la PAES (Chile), con un estilo Socrático y empático.
  
  CONTEXTO DE LA PREGUNTA:
  - Pregunta: "${question.text}"
  - Opciones: ${question.options.map((opt, i) => `${i}: ${opt}`).join(", ")}
  - Respuesta Correcta: Opción ${question.correctOptionIndex}
  - Respuesta del Usuario: Opción ${userWrongAnswerIndex}
  - Explicación de Referencia: ${question.explanation}

  TU MISIÓN:
  1. NUNCA des la respuesta correcta directamente al inicio.
  2. Empatiza con el error del estudiante: "Entiendo por qué elegiste esa opción, es un error común cuando..."
  3. Guía al estudiante con preguntas que lo hagan reflexionar sobre el concepto clave (ej. definición de logaritmo, prioridad de operaciones, interpretación de gráficos).
  4. Usa LaTeX para toda expresión matemática entre símbolos $.
  5. Mantén un tono chileno amable y cercano (ej. "¡Buena! Mira...", "Fíjate en este detalle...", "¡Vamos que tú puedes!").
  6. Si el estudiante se siente muy perdido, dale una pista más directa o desglosa el problema en partes más pequeñas.`;

  const contents = chatHistory.map((msg) => ({
    role: msg.role,
    parts: [{ text: msg.text }],
  }));

  contents.push({
    role: "user",
    parts: [{ text: newMessage }],
  });

  const response = await ai.models.generateContentStream({
    model: "gemini-1.5-flash",
    contents,
    config: {
      systemInstruction: {
        role: "system",
        parts: [{ text: systemInstruction }]
      }
    },
  });

  return response;
}

