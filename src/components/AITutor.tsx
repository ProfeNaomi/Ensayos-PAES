import React, { useState, useRef, useEffect } from "react";
import { QuizQuestion, chatWithTutor } from "../lib/gemini";
import { Send, Bot, User, Loader2, Sparkles, Mic, MicOff } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { cn } from "../lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface AITutorProps {
  question: QuizQuestion;
  userWrongAnswerIndex: number;
}

interface Message {
  role: "user" | "model";
  text: string;
}

export function AITutor({ question, userWrongAnswerIndex }: AITutorProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  // Initialize Speech Recognition
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'es-CL';

      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
        setIsListening(false);
      };

      recognitionRef.current.onerror = () => setIsListening(false);
      recognitionRef.current.onend = () => setIsListening(false);
    }
  }, []);

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
    } else {
      setIsListening(true);
      recognitionRef.current?.start();
    }
  };

  // Initial message from the tutor
  useEffect(() => {
    const fetchAndStream = async (history: Message[], userMsg: string) => {
      try {
        const response = await chatWithTutor(question, userWrongAnswerIndex, history, userMsg);
        const reader = response.body?.getReader();
        if (!reader) throw new Error("No se pudo conectar");

        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = ""; 

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || ""; 

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || !trimmedLine.startsWith("data: ")) continue;
            
            const data = trimmedLine.slice(6);
            if (data === "[DONE]") break;
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content || "";
              fullText += content;
              
              setMessages((prev) => {
                const newMessages = [...prev];
                if (newMessages.length > 0) {
                  newMessages[newMessages.length - 1].text = fullText;
                }
                return newMessages;
              });
            } catch (e) { }
          }
        }
      } catch (error) {
        console.error(error);
        setMessages((prev) => {
          const newMessages = [...prev];
          if (newMessages.length > 0) {
            newMessages[newMessages.length - 1].text = "Hubo un error al conectar. Inténtalo de nuevo.";
          }
          return newMessages;
        });
      } finally {
        setIsLoading(false);
      }
    };

    const initTutor = async () => {
      setIsLoading(true);
      const welcomeMsg = "¡Hola! Me equivoqué en esta pregunta. ¿Me ayudas?";
      setMessages([{ role: "user", text: welcomeMsg }, { role: "model", text: "" }]);
      await fetchAndStream([], welcomeMsg);
    };

    initTutor();
  }, [question, userWrongAnswerIndex]);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput("");
    
    const historyToSend = [...messages];
    
    setMessages((prev) => [...prev, { role: "user", text: userMsg }, { role: "model", text: "" }]);
    setIsLoading(true);

    const fetchAndStream = async (history: Message[], userMsg: string) => {
      try {
        const response = await chatWithTutor(question, userWrongAnswerIndex, history, userMsg);
        const reader = response.body?.getReader();
        if (!reader) throw new Error("No pudo conectarse al stream");

        const decoder = new TextDecoder();
        let fullText = "";
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || !trimmedLine.startsWith("data: ")) continue;
            
            const data = trimmedLine.slice(6);
            if (data === "[DONE]") break;
            
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices[0]?.delta?.content || "";
              fullText += content;
              
              setMessages((prev) => {
                const newMessages = [...prev];
                if (newMessages.length > 0) {
                  newMessages[newMessages.length - 1].text = fullText;
                }
                return newMessages;
              });
            } catch (e) { }
          }
        }
      } catch (error) {
        console.error(error);
        setMessages((prev) => {
          const newMessages = [...prev];
          if (newMessages.length > 0) {
            newMessages[newMessages.length - 1].text = "Error al responder. Revisa tu conexión.";
          }
          return newMessages;
        });
      } finally {
        setIsLoading(false);
      }
    };

    await fetchAndStream(historyToSend, userMsg);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 overflow-hidden relative">


      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-5 space-y-6 bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px] scroll-smooth"
      >
        <AnimatePresence initial={false}>
          {messages.map((msg, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={cn(
                "flex w-full",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[90%] p-4 rounded-3xl shadow-sm",
                  msg.role === "user"
                    ? "bg-indigo-600 text-white rounded-br-none"
                    : "bg-white border border-slate-200 text-slate-800 rounded-bl-none"
                )}
              >
                <div
                  className={cn(
                    "prose prose-sm max-w-none break-words",
                    msg.role === "user" ? "prose-invert" : "prose-slate"
                  )}
                >
                  <ReactMarkdown
                    remarkPlugins={[remarkMath]}
                    rehypePlugins={[rehypeKatex]}
                  >
                    {msg.text || "..."}
                  </ReactMarkdown>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isLoading && messages[messages.length - 1]?.role === "user" && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-start"
          >
            <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-sm flex items-center space-x-3">
              <div className="flex space-x-1">
                 <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                 <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                 <div className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-bounce" />
              </div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">IA pensando</span>
            </div>
          </motion.div>
        )}
      </div>

      <div className="p-4 bg-white border-t border-slate-200 shadow-[0_-4px_12px_rgba(0,0,0,0.03)]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          className="flex items-center space-x-2 bg-slate-50 p-1.5 rounded-[2rem] border border-slate-200 focus-within:border-indigo-500 transition-colors"
        >
          <motion.button
            type="button"
            whileTap={{ scale: 0.9 }}
            onClick={toggleListening}
            className={cn(
               "p-3 rounded-full transition-all",
               isListening ? "bg-red-500 text-white animate-pulse" : "bg-white text-slate-400 border border-slate-200 hover:text-indigo-600"
            )}
          >
            {isListening ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
          </motion.button>

          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={isListening ? "Escuchando..." : "Pregunta algo..."}
            className="flex-1 px-4 py-2.5 bg-transparent border-none focus:ring-0 text-sm font-medium outline-none placeholder:text-slate-400"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-3 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:bg-slate-200 disabled:text-slate-400 transition-all active:scale-90 shadow-lg shadow-indigo-100"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
      </div>
    </div>
  );
}
