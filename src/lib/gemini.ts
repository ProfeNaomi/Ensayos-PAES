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

export async function generateQuizFromPDFs(
  questionsPdfBase64: string,
  solutionsPdfBase64: string | null
): Promise<QuizQuestion[]> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("VITE_OPENROUTER_API_KEY no configurada");

  const messages: any[] = [
    {
      role: "system",
      content: "Eres un experto transcriptor y docente de matemáticas chileno. Extrae TODAS las preguntas de opción múltiple del ensayo PAES."
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `INSTRUCCIONES CRÍTICAS:
          1. Transcribe el texto de cada pregunta exactamente como aparece.
          2. Si hay gráficas o tablas, inclúyelas en el 'box'.
          3. Todas las fórmulas en LaTeX con $.
          4. Generar JSON con este esquema: Array<{id, pageIndex, box: [ymin, xmin, ymax, xmax], text, options, correctOptionIndex, explanation}>.
          5. El 'box' son coordenadas normalizadas 0-1000.`
        },
        {
          type: "image_url",
          image_url: {
            url: `data:application/pdf;base64,${questionsPdfBase64}`
          }
        }
      ]
    }
  ];

  if (solutionsPdfBase64) {
    messages[1].content.push({
      type: "image_url",
      image_url: {
        url: `data:application/pdf;base64,${solutionsPdfBase64}`
      }
    });
    messages[1].content.push({
      type: "text",
      text: "Usa el segundo PDF solo para claves y explicaciones."
    });
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://paes-tutor.vercel.app", // Opcional
      "X-Title": "PAES Tutor IA"
    },
    body: JSON.stringify({
      model: "google/gemini-2.0-flash-001", // Versión 2.0 más estable en OpenRouter
      messages: messages,
      response_format: { type: "json_object" }
    })
  });

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  
  const rawContent = data.choices[0].message.content;
  return JSON.parse(rawContent).questions || JSON.parse(rawContent);
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
      model: "deepseek/deepseek-r1", // DeepSeek R1 original
      messages: messages,
      stream: true
    })
  });

  return response; // Devolvemos el stream para que la UI lo maneje
}
