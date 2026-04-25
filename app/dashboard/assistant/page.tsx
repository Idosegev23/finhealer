'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { Send, Loader2, Sparkles } from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at?: string;
}

export default function AssistantPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/ai/chat');
      if (res.ok) {
        const data = await res.json();
        setMessages(data.messages || []);
      }
    } catch { /* ignore */ }
    setLoadingHistory(false);
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  async function send() {
    const msg = input.trim();
    if (!msg || sending) return;

    const userMsg: ChatMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: msg,
    };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();
      const reply: ChatMessage = {
        id: `local-${Date.now()}-r`,
        role: 'assistant',
        content: res.ok ? (data.reply || '🤔') : `שגיאה: ${data.error || 'לא ברור'}`,
      };
      setMessages(prev => [...prev, reply]);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        id: `local-${Date.now()}-err`,
        role: 'assistant',
        content: `שגיאת רשת: ${err.message || 'לא ברור'}`,
      }]);
    }
    setSending(false);
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col" dir="rtl">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">φ — מאמן פיננסי</h1>
            <p className="text-xs text-gray-500">אותו בוט שבוואטסאפ. כל פעולה מסונכרנת.</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {loadingHistory && (
            <div className="text-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500 mx-auto" />
              <p className="text-sm text-gray-500 mt-2">טוען היסטוריה...</p>
            </div>
          )}

          {!loadingHistory && messages.length === 0 && (
            <div className="text-center py-12">
              <div className="w-16 h-16 rounded-full bg-amber-50 flex items-center justify-center mx-auto mb-4">
                <Sparkles className="w-8 h-8 text-amber-500" />
              </div>
              <p className="text-gray-700 font-medium mb-1">היי! אני φ.</p>
              <p className="text-sm text-gray-500 mb-6">שאל אותי כל שאלה על הכסף שלך.</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {[
                  'איך אני עומד החודש?',
                  'מה ההלוואות שלי?',
                  'יש מנויים שאני לא צריך?',
                  'הכי הרבה הוצאתי על מה?',
                ].map(q => (
                  <button
                    key={q}
                    onClick={() => setInput(q)}
                    className="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm text-gray-700 hover:bg-gray-50"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map(m => (
            <div
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-start' : 'justify-end'}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-amber-500 text-white rounded-tr-sm'
                    : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm'
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}

          {sending && (
            <div className="flex justify-end">
              <div className="bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-2.5">
                <div className="flex gap-1">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="bg-white border-t border-gray-200 px-4 py-3">
        <div className="max-w-3xl mx-auto flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="הקלד הודעה... (Enter לשליחה, Shift+Enter לשורה חדשה)"
            rows={1}
            disabled={sending}
            className="flex-1 px-4 py-2.5 border border-gray-200 rounded-2xl text-sm resize-none max-h-32 focus:outline-none focus:ring-2 focus:ring-amber-500/30 disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={sending || !input.trim()}
            className="w-10 h-10 rounded-full bg-amber-500 text-white flex items-center justify-center disabled:opacity-50 hover:bg-amber-600"
            aria-label="שלח"
          >
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </div>
  );
}
