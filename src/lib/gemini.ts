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

// Helper para limpiar y parsear JSON de forma robusta
function cleanAndParseJSON(text: string) {
  // 1. Quitar bloques de código markdown (```json ... ```) e intentar limpiar basura
  let cleaned = text.replace(/```json\n?/, "").replace(/\n?```/, "").trim();
  
  // 2. Corregir el error de "Bad escaped character" (común con fórmulas LaTeX)
  // Reemplazamos \ por \\ solo si no están ya escapados o no son parte de un escape válido
  // Esta es la parte más difícil. Una forma segura es buscar backslashes que NO sean seguidos por n, r, t, f, b, ", \ o u
  cleaned = cleaned.replace(/\\(?![nrftb"\\\/]|u[0-9a-fA-F]{4})/g, "\\\\");

  // 3. Si la IA usó paréntesis en lugar de corchetes para los arrays (error común), los corregimos
  cleaned = cleaned.replace(/:\s*\(([^)]+)\)/g, ': [$1]');

  // 4. Buscar el inicio y fin del JSON real
  const lastBracket = cleaned.lastIndexOf(']');
  const lastBrace = cleaned.lastIndexOf('}');
  const firstBracket = cleaned.indexOf('[');
  const firstBrace = cleaned.indexOf('{');

  let start = -1;
  let end = -1;

  if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
    start = firstBracket;
    end = lastBracket;
  } else {
    start = firstBrace;
    end = lastBrace;
  }

  if (start !== -1 && end !== -1) {
    cleaned = cleaned.substring(start, end + 1);
  }

  return JSON.parse(cleaned);
}

export async function generateQuizFromImages(
  questionImages: string[],
  solutionImages: string[]
): Promise<QuizQuestion[]> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("VITE_OPENROUTER_API_KEY no configurada");

  const messages: any[] = [
    {
      role: "system",
      content: "Eres un extractor de datos ultra-eficiente. Tu meta es transcribir preguntas PAES de matemáticas."
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `GENERA JSON COMPACTO (Sin espacios extra):
          Schema: Array<{id, pageIndex, box: [ymin, xmin, ymax, xmax], text, options, correctOptionIndex}>.
          REGLAS:
          1. OMITE EXPLICACIONES (Explanation: "").
          2. Usa LaTeX $ para fórmulas.
          3. RESPUESTA SOLO JSON, SIN TEXTO ADICIONAL.
          4. No superes los 8000 tokens.`
        }
      ]
    }
  ];

  // Añadir imágenes de preguntas
  questionImages.forEach((img, idx) => {
    messages[1].content.push({
      type: "text",
      text: `--- PÁGINA ${idx} (PREGUNTAS) ---`
    });
    messages[1].content.push({
      type: "image_url",
      image_url: { url: img }
    });
  });

  // Añadir imágenes de soluciones/claves
  solutionImages.forEach((img, idx) => {
    messages[1].content.push({
      type: "text",
      text: `--- PÁGINA ${idx} (CLAVES/SOLUCIONES) ---`
    });
    messages[1].content.push({
      type: "image_url",
      image_url: { url: img }
    });
  });

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-001",
      messages: messages,
      response_format: { type: "json_object" },
      max_tokens: 8192 // Aumentamos al máximo para evitar cortes
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  
  const rawContent = data.choices[0].message.content;
  try {
    const parsed = cleanAndParseJSON(rawContent);
    return parsed.questions || parsed;
  } catch (e: any) {
    console.error("AI Response:", rawContent);
    throw new Error(`Error de formato en la respuesta de la IA: ${e.message}. Prueba con un PDF más claro o con menos preguntas.`);
  }
}

export async function chatWithTutor(
  question: QuizQuestion,
  userWrongAnswerIndex: number,
  chatHistory: { role: "user" | "model"; text: string }[],
  newMessage: string
) {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  
  const systemInstruction = `Eres un tutor experto en matemáticas para la PAES (Chile), con un estilo Socrático y empático.
  
  CONTEXTO:
  - Pregunta: "${question.text}"
  - Opciones: ${question.options.join(", ")}
  - Correcta: ${question.correctOptionIndex}
  - Error del Alumno: ${userWrongAnswerIndex}
  
  MISIÓN: Empatiza, no des la respuesta, usa LaTeX ($), habla como chileno amable ("ya po", "mira", "fíjate").`;

  const messages = [
    { role: "system", content: systemInstruction },
    ...chatHistory.map(m => ({ 
      role: m.role === "model" ? "assistant" : "user", 
      content: m.text 
    })),
    { role: "user", content: newMessage }
  ];

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "deepseek/deepseek-r1",
      messages: messages,
      stream: true
    })
  });

  return response;
}
