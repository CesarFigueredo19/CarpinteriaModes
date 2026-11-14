import React, { useEffect, useRef, useState } from 'react';
import {
  Bot,
  Loader2,
  MessageSquareText,
  RotateCcw,
  Send,
  Sparkles,
  X,
} from 'lucide-react';
import { appService } from '../services/appService';

interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
}

const INITIAL_SUGGESTIONS = [
  '¿Qué maderas tienen y cuál dura más?',
  '¿Cuánto cuesta un ropero o comedor?',
  '¿Cómo funciona el anticipo del 50%?',
  '¿Hacen envíos a domicilio en Oruro?',
];

interface AiAssistantWidgetProps {
  open: boolean;
  onToggle: (next: boolean) => void;
}

function renderFormattedReply(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={idx} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <React.Fragment key={idx}>{part}</React.Fragment>;
  });
}

export function AiAssistantWidget({ open, onToggle }: AiAssistantWidgetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      role: 'model',
      text: '¡Hola! Soy el **Asistente IA de Mueblería Modes** en Oruro. Pregúntame lo que necesites sobre nuestros muebles, maderas (Mara, Cedro, Tajibo, Roble), medidas personalizadas, precios en Bs. o envíos.',
    },
  ]);
  const [suggestions, setSuggestions] = useState<string[]>(INITIAL_SUGGESTIONS);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      scrollEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, open, loading]);

  const handleSend = async (promptText?: string) => {
    const clean = (promptText ?? input).trim();
    if (!clean || loading) return;

    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: clean,
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    if (!promptText) setInput('');
    setLoading(true);

    try {
      const result = await appService.enviarMensajeAsistente(
        clean,
        nextHistory.map((m) => ({ role: m.role, text: m.text }))
      );
      const replyMsg: ChatMessage = {
        id: `m-${Date.now()}`,
        role: 'model',
        text:
          result.reply ||
          'Estoy aquí para ayudarte con cualquier consulta sobre Mueblería Modes en Oruro (+591 72418920).',
      };
      setMessages((prev) => [...prev, replyMsg]);
      if (result.suggestions && result.suggestions.length > 0) {
        setSuggestions(result.suggestions);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          role: 'model',
          text: 'Disculpa, ocurrió un inconveniente al responder. Puedes intentar de nuevo o consultarnos por Mara, Cedro, Tajibo, Roble, precios o entregas en Oruro.',
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: `welcome-${Date.now()}`,
        role: 'model',
        text: 'Conversación reiniciada. ¿En qué mueble, madera o medida personalizada te puedo asesorar hoy?',
      },
    ]);
    setSuggestions(INITIAL_SUGGESTIONS);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => onToggle(true)}
        aria-label="Abrir chat del Asistente IA"
        className="fixed bottom-4 right-4 z-[45] flex items-center gap-2.5 px-3.5 py-2.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white border border-amber-500/60 shadow-2xl cursor-pointer transition-transform hover:-translate-y-0.5"
      >
        <div className="w-8 h-8 rounded-xl bg-amber-600 flex items-center justify-center text-white shrink-0">
          <Bot className="w-4 h-4" />
        </div>
        <div className="text-left leading-tight">
          <div className="text-xs font-semibold text-amber-300 flex items-center gap-1">
            <span>Asistente IA</span>
            <Sparkles className="w-3 h-3" />
          </div>
          <div className="text-[10px] text-slate-300">Preguntar ahora</div>
        </div>
      </button>
    );
  }

  return (
    <aside
      role="dialog"
      aria-label="Chat del Asistente IA de Mueblería Modes"
      className="fixed bottom-4 right-4 z-[60] w-[min(94vw,395px)] h-[min(78vh,540px)] bg-[#fbf8f3] border border-stone-300 rounded-2xl shadow-2xl flex flex-col overflow-hidden"
    >
      {/* Header */}
      <div className="px-4 py-3 bg-slate-900 text-white flex items-center justify-between gap-2 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-amber-600 text-white flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-amber-300 flex items-center gap-1">
              <span>Asistente IA · Mueblería Modes</span>
            </div>
            <div className="text-[11px] text-slate-300 truncate">
              Consultas sobre muebles, precios y medidas
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleResetChat}
            title="Reiniciar conversación"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onToggle(false)}
            aria-label="Cerrar chat del Asistente IA"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3.5 space-y-3 bg-[#f7f2ea]">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed shadow-xs ${
                msg.role === 'user'
                  ? 'bg-slate-900 text-amber-100 rounded-br-sm'
                  : 'bg-white border border-stone-200 text-stone-700 rounded-bl-sm'
              }`}
            >
              {msg.role === 'model' ? renderFormattedReply(msg.text) : msg.text}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-stone-200 rounded-2xl rounded-bl-sm px-3.5 py-2 text-xs text-stone-500 flex items-center gap-2">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-700" />
              <span>Escribiendo respuesta...</span>
            </div>
          </div>
        )}
        <div ref={scrollEndRef} />
      </div>

      {/* Clickable Suggested Questions ("Posibles respuestas / preguntas") */}
      <div className="px-3 py-2 bg-white border-t border-stone-200 space-y-1.5 shrink-0">
        <div className="text-[10px] font-semibold text-stone-500 flex items-center gap-1">
          <MessageSquareText className="w-3 h-3 text-amber-800" />
          <span>Opciones rápidas y posibles respuestas:</span>
        </div>
        <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
          {suggestions.map((sug) => (
            <button
              key={sug}
              type="button"
              disabled={loading}
              onClick={() => handleSend(sug)}
              className="text-left px-2.5 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-[11px] font-medium text-amber-950 cursor-pointer transition-colors"
            >
              {sug}
            </button>
          ))}
        </div>
      </div>

      {/* Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="p-2.5 bg-white border-t border-stone-200 flex items-center gap-2 shrink-0"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Pregunta cualquier duda sobre muebles..."
          className="flex-1 min-w-0 px-3 py-2 rounded-xl border border-stone-300 bg-stone-50 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-700"
        />
        <button
          type="submit"
          disabled={loading || !input.trim()}
          aria-label="Enviar consulta"
          className="p-2.5 rounded-xl bg-amber-800 hover:bg-amber-700 disabled:opacity-50 text-white cursor-pointer shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </aside>
  );
}
