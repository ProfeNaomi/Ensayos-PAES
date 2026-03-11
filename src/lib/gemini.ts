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

export async function generateQuizFromImages(
  questionImages: string[],
  solutionImages: string[]
): Promise<QuizQuestion[]> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("VITE_OPENROUTER_API_KEY no configurada");

  const messages: any[] = [
    {
      role: "system",
      content: "Eres un experto transcriptor y docente de matemáticas chileno. Extrae TODAS las preguntas de opción múltiple de las imágenes del ensayo PAES."
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `INSTRUCCIONES CRÍTICAS:
          1. Transcribe el texto de cada pregunta exactamente como aparece. Incluye fórmulas LaTeX con $.
          2. Generar JSON con este esquema: Array<{id, pageIndex, box: [ymin, xmin, ymax, xmax], text, options, correctOptionIndex, explanation}>.
          3. 'pageIndex' es el índice de la imagen (empezando en 0).
          4. El 'box' son coordenadas normalizadas 0-1000 que encierran el texto y dibujos de la pregunta.`
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
      response_format: { type: "json_object" }
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  
  const rawContent = data.choices[0].message.content;
  try {
    const parsed = JSON.parse(rawContent);
    return parsed.questions || parsed;
  } catch (e) {
    console.error("Failed to parse AI response", rawContent);
    throw new Error("La IA respondió en un formato inválido. Intenta con un PDF más corto.");
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
