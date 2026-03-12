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
  let cleaned = text.trim();
  
  // 1. Quitar bloques de código markdown si los hay
  cleaned = cleaned.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/i, "").trim();
  
  // 2. Intentar encontrar el objeto o array JSON real si hay texto extra
  const startBrace = cleaned.indexOf('{');
  const startBracket = cleaned.indexOf('[');
  const endBrace = cleaned.lastIndexOf('}');
  const endBracket = cleaned.lastIndexOf(']');

  let start = -1;
  let end = -1;

  if (startBrace !== -1 && (startBracket === -1 || (startBrace < startBracket && startBrace !== -1))) {
    start = startBrace;
    end = endBrace;
  } else if (startBracket !== -1) {
    start = startBracket;
    end = endBracket;
  }

  if (start !== -1 && end !== -1 && end > start) {
    cleaned = cleaned.substring(start, end + 1);
  }

  // 3. CORRECCIÓN PARA CONTROL CHARACTERS: Eliminar caracteres invisibles que rompen JSON.parse
  // Conservamos \n, \r, \t
  cleaned = cleaned.replace(/[\u0000-\u0009\u000B-\u000C\u000E-\u001F\u007F-\u009F]/g, "");

  try {
    return JSON.parse(cleaned);
  } catch (error) {
    console.error("Fallo parseo inicial, intentando corrección de escapes...", error);
    try {
      // Intento final: corregir backslashes perdidos si la IA no los escapó bien
      // Pero solo si no están ya escapados
      const fixed = cleaned.replace(/(?<!\\)\\(?!["\\\/bfnrtu])/g, "\\\\");
      return JSON.parse(fixed);
    } catch (e2) {
      throw error;
    }
  }
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
      content: `Eres un experto en digitalizar ensayos PAES de Matemáticas y RESOLVERLOS.
      TU MISIÓN: Extraer cada pregunta con su número original, texto, opciones y ubicación exacta.
      
      REGLAS DE ORO:
      1. RESOLVER: Debes resolver matemáticamente cada ejercicio para encontrar la respuesta correcta.
      2. MARCAS DEL USUARIO: Si en la imagen hay un círculo, una cruz o un visto sobre una alternativa, esa MANDA y es la "correcta".
      3. IDENTIFICACIÓN: Usa el número real de la pregunta como "id".
      4. ÁREA DE CAPTURA (box): Incluye enunciado y TODAS las opciones.
      5. LATEX: Usa $ para TODA expresión matemática, fórmula, símbolo o número solo (Ej: $x$, $\frac{1}{2}$, $5$). NO uses doble barra \\\\ a menos que sea estrictamente necesario para el JSON.
      6. JSON PURO: Responde solo con el objeto JSON válido.`
    },
    {
      role: "user",
      content: [
        {
          type: "text",
          text: `Extrae las preguntas de las imágenes adjuntas siguiendo este esquema JSON:
          {
            "questions": [
              {
                "id": number,
                "pageIndex": number,
                "box": [ymin, xmin, ymax, xmax],
                "text": "Texto con LaTeX $...$",
                "options": ["Opción A con $...$", "Opción B", "Opción C", "Opción D"],
                "correctOptionIndex": number
              }
            ]
          }`
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
      max_tokens: 8192 
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
    throw new Error(`Error de formato en la respuesta de la IA: ${e.message}.`);
  }
}

export async function chatWithTutor(
  question: QuizQuestion,
  userWrongAnswerIndex: number,
  chatHistory: { role: "user" | "model"; text: string }[],
  newMessage: string
) {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  
  const systemInstruction = `Eres un tutor experto en matemáticas para la PAES (Chile), con un estilo SOCRÁTICO, empático y MUY amigable.
  
  CONTEXTO DE LA PREGUNTA:
  - Pregunta original: "${question.text}"
  - Opciones disponibles: ${question.options.join(", ")}
  - Respuesta correcta (Índice): ${question.correctOptionIndex}
  - Opción que marcó el alumno: ${userWrongAnswerIndex}
  
  TU OBJETIVO: Empatiza con el error del alumno. NO des la respuesta correcta directamente. Guía al alumno con preguntas para que él mismo descubra su error o el camino correcto.
  
  REGLAS DE ESTILO:
  - USA LATEX: Envuelve TODA fórmula, símbolo matemático, variable o número entre símbolos de peso simples: $...$ (Ej: $x$, $y$, $\\frac{a}{b}$, $5$).
  - NUNCA uses doble barra invertida fuera de LaTeX.
  - Habla en español general de manera clara, cercana y motivadora. Evita usar modismos o jergas locales.
  - Sé breve y directo en cada mensaje para fomentar el diálogo.`;

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
      model: "google/gemini-2.0-flash-001",
      messages: messages,
      stream: true,
      max_tokens: 1500,
      temperature: 0.7
    })
  });

  return response;
}
