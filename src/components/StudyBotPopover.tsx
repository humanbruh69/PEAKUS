import React, { useState, useEffect, useRef } from 'react';
import { Icon } from './Icons';
import { Task, TimerState, LanguageCode } from '../types';
import { t } from '../lib/i18n';
import { Store } from '../lib/store';

export type StudyBotMode = 'standard' | 'fast' | 'deep';

export interface StudyBotMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  mode?: StudyBotMode;
  modelName?: string;
}

interface StudyBotPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  activeTask?: Task;
  timerState: {
    status: string;
    phase: string;
    remainingMs: number;
    durationMs: number;
    cycle: number;
  };
  onAppendToNotes?: (text: string) => void;
  onToast: (msg: string, type?: 'err' | '') => void;
  language?: LanguageCode;
}

const STORAGE_KEY = 'peakus.studybot.messages';

const QUICK_PROMPTS = [
  { label: 'Explain simply (ELI5)', prompt: 'Explain this concept simply as if I am 12 years old, with an intuitive real-world analogy:' },
  { label: 'Summarize in 3 points', prompt: 'Summarize the core concepts of this in 3 crisp, memorable bullet points:' },
  { label: 'Step-by-step solve', prompt: 'Break down how to solve this problem step-by-step with clear explanations of each step:' },
  { label: 'Quiz me (2 questions)', prompt: 'Test my understanding by giving me 2 quick multiple-choice or short-answer practice questions with hidden answers:' },
  { label: 'Memory mnemonic', prompt: 'Give me an effective mnemonic or memory trick to easily remember this:' },
];

export const StudyBotPopover: React.FC<StudyBotPopoverProps> = ({
  isOpen,
  onClose,
  activeTask,
  timerState,
  onAppendToNotes,
  onToast,
  language = 'en',
}) => {
  const [messages, setMessages] = useState<StudyBotMessage[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return JSON.parse(saved);
    } catch {
      // ignore
    }
    return [
      {
        id: 'welcome',
        role: 'assistant',
        content: `👋 **Welcome to Peakus Study Bot!**\n\nI'm your distraction-free study companion and tutor powered by Gemini. Ask me anything about your coursework, math problems, code, essays, or complex concepts—without leaving your focus flow or juggling extra browser tabs!\n\n💡 *Tip: Click any quick prompt below or ask about your active task.*`,
        timestamp: Date.now(),
        mode: 'standard',
        modelName: 'gemini-3.8-flash',
      },
    ];
  });

  const [input, setInput] = useState('');
  const [mode, setMode] = useState<StudyBotMode>('standard');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Auto-scroll to bottom of messages
  const scrollToBottom = (smooth = true) => {
    messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom(false);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom(true);
  }, [messages, isGenerating]);

  // Persist messages
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsGenerating(false);
  };

  const handleClearChat = () => {
    handleStop();
    const initialMsg: StudyBotMessage = {
      id: 'welcome-' + Date.now(),
      role: 'assistant',
      content: `Chat cleared. Ready for your next study topic! 📚`,
      timestamp: Date.now(),
      mode,
    };
    setMessages([initialMsg]);
    setShowClearConfirm(false);
    onToast('Chat history cleared');
  };

  const handleSend = async (customPrompt?: string) => {
    const textToSend = (customPrompt || input).trim();
    if (!textToSend || isGenerating) return;

    setInput('');
    const userMessageId = 'u-' + Date.now();
    const assistantMessageId = 'a-' + (Date.now() + 1);

    const newMessages: StudyBotMessage[] = [
      ...messages,
      {
        id: userMessageId,
        role: 'user',
        content: textToSend,
        timestamp: Date.now(),
      },
    ];

    setMessages(newMessages);
    setIsGenerating(true);

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Build context
    const context = {
      activeTask: activeTask ? activeTask.title : undefined,
      timerPhase: timerState.phase,
      timerMinutes: Math.round(timerState.durationMs / 60000),
    };

    // Prepare payload
    const payload = {
      messages: newMessages.map(m => ({
        role: m.role,
        content: m.content,
      })),
      mode,
      context,
    };

    let assistantText = '';
    const assignedModel =
      mode === 'fast'
        ? 'gemini-3.1-flash-lite'
        : mode === 'deep'
          ? 'gemini-4-argon'
          : 'gemini-3.8-flash';

    try {
      // Try streaming endpoint first
      const res = await fetch('/api/study-bot/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || `Server responded with ${res.status}`);
      }

      // Initialize empty assistant bubble
      setMessages(prev => [
        ...prev,
        {
          id: assistantMessageId,
          role: 'assistant',
          content: '',
          timestamp: Date.now(),
          mode,
          modelName: assignedModel,
        },
      ]);

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error('ReadableStream not supported.');
      }

      let done = false;
      let buffer = '';

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith('data:')) continue;
            const dataStr = trimmed.replace(/^data:\s*/, '');
            if (dataStr === '[DONE]') break;

            try {
              const parsed = JSON.parse(dataStr);
              if (parsed.error) {
                throw new Error(parsed.error);
              }
              if (parsed.text) {
                assistantText += parsed.text;
                setMessages(prev =>
                  prev.map(m =>
                    m.id === assistantMessageId ? { ...m, content: assistantText } : m
                  )
                );
              }
            } catch {
              // ignore malformed chunks
            }
          }
        }
      }

      // If streaming didn't output anything, try fallback chat endpoint
      if (!assistantText.trim()) {
        const fallbackRes = await fetch('/api/study-bot/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: abortController.signal,
        });
        const fallbackData = await fallbackRes.json();
        if (fallbackData.text) {
          assistantText = fallbackData.text;
          setMessages(prev =>
            prev.map(m =>
              m.id === assistantMessageId ? { ...m, content: assistantText } : m
            )
          );
        }
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // User stopped generation manually
        if (!assistantText) {
          setMessages(prev => prev.filter(m => m.id !== assistantMessageId));
        }
      } else {
        console.error('Study bot chat error:', err);
        const errMsg = err.message || 'An error occurred while contacting Study Bot.';
        setMessages(prev => [
          ...prev.filter(m => m.id !== assistantMessageId),
          {
            id: 'err-' + Date.now(),
            role: 'assistant',
            content: `⚠️ **Unable to get answer:** ${errMsg}\n\n*Check that your GEMINI_API_KEY is configured in Settings > Secrets.*`,
            timestamp: Date.now(),
            mode,
          },
        ]);
      }
    } finally {
      setIsGenerating(false);
      abortControllerRef.current = null;
    }
  };

  const handleCopyText = (content: string, id: string) => {
    try {
      navigator.clipboard.writeText(content);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
      onToast('Answer copied to clipboard! 📋');
    } catch {
      onToast('Failed to copy', 'err');
    }
  };

  const handleSaveToNotes = (content: string) => {
    const existing = Store.loadNotesDoc();
    const dateStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const noteEntry = `\n\n--- 🤖 Study Bot Note (${dateStr}) ---\n${content.trim()}\n`;
    const updated = (existing.text || '') + noteEntry;
    Store.saveNotes(updated, Date.now());
    if (onAppendToNotes) onAppendToNotes(updated);
    onToast('Saved directly to Peakus Notes! 📝');
  };

  // Render markdown formatting
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let inCodeBlock = false;
    let codeBlockLang = '';
    let codeBlockLines: string[] = [];
    let blockIndex = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Code block start / end
      if (line.trim().startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeBlockLang = line.trim().slice(3).trim();
          codeBlockLines = [];
        } else {
          inCodeBlock = false;
          const fullCode = codeBlockLines.join('\n');
          const codeId = `code-${blockIndex++}`;
          elements.push(
            <div
              key={codeId}
              className="my-3 rounded-xl overflow-hidden bg-black/60 border border-white/10 text-xs font-mono"
            >
              <div className="flex items-center justify-between px-3 py-1.5 bg-white/5 border-b border-white/10 text-white/50 text-[11px]">
                <span>{codeBlockLang || 'code'}</span>
                <button
                  type="button"
                  onClick={() => handleCopyText(fullCode, codeId)}
                  className="hover:text-white transition-colors flex items-center gap-1"
                >
                  {copiedId === codeId ? '✓ Copied' : 'Copy'}
                </button>
              </div>
              <pre className="p-3 overflow-x-auto text-emerald-300 leading-relaxed font-mono whitespace-pre">
                {fullCode}
              </pre>
            </div>
          );
        }
        continue;
      }

      if (inCodeBlock) {
        codeBlockLines.push(line);
        continue;
      }

      // Heading 3
      if (line.startsWith('### ')) {
        elements.push(
          <h4 key={`h3-${i}`} className="text-sm font-bold text-white mt-3 mb-1.5 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
            {renderInlineMarkdown(line.slice(4))}
          </h4>
        );
        continue;
      }

      // Heading 2
      if (line.startsWith('## ')) {
        elements.push(
          <h3 key={`h2-${i}`} className="text-base font-bold text-white mt-4 mb-2 pb-1 border-b border-white/10">
            {renderInlineMarkdown(line.slice(3))}
          </h3>
        );
        continue;
      }

      // Bullet lists
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        elements.push(
          <div key={`li-${i}`} className="flex items-start gap-2 my-1 pl-1 text-white/90">
            <span className="text-[var(--accent)] font-bold text-xs select-none mt-1">•</span>
            <span className="leading-relaxed flex-1">
              {renderInlineMarkdown(line.trim().slice(2))}
            </span>
          </div>
        );
        continue;
      }

      // Numbered lists
      const numMatch = line.trim().match(/^(\d+)\.\s+(.*)$/);
      if (numMatch) {
        elements.push(
          <div key={`num-${i}`} className="flex items-start gap-2 my-1 pl-1 text-white/90">
            <span className="text-[var(--accent)] font-mono text-xs font-bold select-none mt-0.5">
              {numMatch[1]}.
            </span>
            <span className="leading-relaxed flex-1">
              {renderInlineMarkdown(numMatch[2])}
            </span>
          </div>
        );
        continue;
      }

      // Blockquotes
      if (line.trim().startsWith('> ')) {
        elements.push(
          <blockquote
            key={`bq-${i}`}
            className="my-2 pl-3 border-l-2 border-[var(--accent)] text-white/75 italic bg-white/[0.02] py-1 rounded-r-lg"
          >
            {renderInlineMarkdown(line.trim().slice(2))}
          </blockquote>
        );
        continue;
      }

      // Empty line / paragraph
      if (!line.trim()) {
        elements.push(<div key={`sp-${i}`} className="h-2" />);
        continue;
      }

      elements.push(
        <p key={`p-${i}`} className="my-1 leading-relaxed text-white/90">
          {renderInlineMarkdown(line)}
        </p>
      );
    }

    return elements;
  };

  // Helper for inline styles (bold, italics, inline code)
  const renderInlineMarkdown = (text: string) => {
    // Split by inline code, bold, etc.
    const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code
            key={idx}
            className="px-1.5 py-0.5 rounded bg-black/40 border border-white/15 text-emerald-300 font-mono text-[11px] mx-0.5"
          >
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={idx} className="font-semibold text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-md animate-fadeIn"
      onClick={e => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl bg-[#12131a]/95 border border-white/10 rounded-2xl shadow-2xl flex flex-col overflow-hidden text-white animate-scaleUp"
        style={{ height: '88vh', maxHeight: '780px' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/10 bg-white/[0.02] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-[var(--accent)] to-amber-500 flex items-center justify-center shadow-lg shadow-[var(--accent)]/20 shrink-0 text-black">
              <span className="text-xl">🤖</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm sm:text-base text-white tracking-wide">
                  {t('studyBotTitle', language)}
                </h3>
                <span className="text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-[var(--accent)]/20 text-[var(--accent)] border border-[var(--accent)]/30">
                  Gemini 3.8
                </span>
              </div>
              <p className="text-[11px] text-white/50 truncate">
                {t('studyBotDesc', language)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Clear Chat Button */}
            {showClearConfirm ? (
              <div className="flex items-center gap-1 bg-rose-500/10 border border-rose-500/30 rounded-lg p-1">
                <span className="text-[11px] text-rose-300 px-1">Clear?</span>
                <button
                  type="button"
                  onClick={handleClearChat}
                  className="px-2 py-0.5 text-[10px] font-bold rounded bg-rose-500 text-white hover:bg-rose-600 transition-colors"
                >
                  Yes
                </button>
                <button
                  type="button"
                  onClick={() => setShowClearConfirm(false)}
                  className="px-1.5 py-0.5 text-[10px] rounded hover:bg-white/10 text-white/60 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowClearConfirm(true)}
                title="Clear conversation history"
                className="p-2 text-white/40 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                <Icon name="trash" className="w-4 h-4" />
              </button>
            )}

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-white/40 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Close"
            >
              <Icon name="x" className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Model Mode Selection Bar */}
        <div className="px-5 py-2 border-b border-white/5 bg-white/[0.01] flex items-center justify-between gap-2 shrink-0 flex-wrap">
          <div className="flex items-center gap-1.5 text-xs text-white/60">
            <span className="text-[11px] font-medium text-white/40 mr-1">Tutor Mode:</span>
            <button
              type="button"
              onClick={() => setMode('standard')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                mode === 'standard'
                  ? 'bg-[var(--accent)] text-black shadow-md shadow-[var(--accent)]/20'
                  : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              <span>💡</span> Balanced (3.8 Flash)
            </button>
            <button
              type="button"
              onClick={() => setMode('fast')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                mode === 'fast'
                  ? 'bg-[var(--accent)] text-black shadow-md shadow-[var(--accent)]/20'
                  : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              <span>⚡</span> Fast (3.1 Lite)
            </button>
            <button
              type="button"
              onClick={() => setMode('deep')}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                mode === 'deep'
                  ? 'bg-[var(--accent)] text-black shadow-md shadow-[var(--accent)]/20'
                  : 'bg-white/5 text-white/70 hover:bg-white/10'
              }`}
            >
              <span>🧠</span> Deep STEM (Argon)
            </button>
          </div>

          {/* Active Task Context Badge */}
          {activeTask && (
            <button
              type="button"
              onClick={() => handleSend(`Can you guide me on working on this study task: "${activeTask.title}"?`)}
              className="text-[11px] px-2.5 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white transition-colors truncate max-w-xs flex items-center gap-1"
              title="Click to ask about current task"
            >
              <span className="text-[var(--accent)]">📌</span>
              <span className="truncate">{activeTask.title}</span>
            </button>
          )}
        </div>

        {/* Messages Thread Container */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs sm:text-sm">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex flex-col ${
                msg.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <div
                className={`max-w-[88%] sm:max-w-[84%] rounded-2xl p-4 shadow-md leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-[var(--accent)] text-black font-medium rounded-tr-sm ml-auto'
                    : 'bg-white/[0.06] border border-white/10 text-white/90 rounded-tl-sm'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <div>
                    {renderFormattedContent(msg.content)}
                    {isGenerating && msg.content.length === 0 && (
                      <div className="flex items-center gap-2 text-white/40 italic py-1">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-[var(--accent)] animate-ping" />
                        <span>Study Bot is thinking...</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>

              {/* Bot Action Buttons: Copy & Save to Notes */}
              {msg.role === 'assistant' && msg.content && (
                <div className="flex items-center gap-2 mt-1.5 ml-1 text-[11px] text-white/40">
                  <button
                    type="button"
                    onClick={() => handleCopyText(msg.content, msg.id)}
                    className="hover:text-white transition-colors flex items-center gap-1 hover:underline"
                  >
                    <span>{copiedId === msg.id ? '✓ Copied' : '📋 Copy'}</span>
                  </button>
                  <span>•</span>
                  <button
                    type="button"
                    onClick={() => handleSaveToNotes(msg.content)}
                    className="hover:text-[var(--accent)] transition-colors flex items-center gap-1 hover:underline"
                    title="Append this explanation to your Peakus Notes"
                  >
                    <span>📝 Save to Notes</span>
                  </button>
                  {msg.modelName && (
                    <>
                      <span>•</span>
                      <span className="text-[10px] text-white/30">{msg.modelName}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestion Chips */}
        <div className="px-5 py-2 border-t border-white/5 bg-white/[0.01] flex items-center gap-1.5 overflow-x-auto shrink-0 no-scrollbar">
          <span className="text-[10px] uppercase font-bold text-white/30 shrink-0">Prompts:</span>
          {QUICK_PROMPTS.map((qp, i) => (
            <button
              key={i}
              type="button"
              disabled={isGenerating}
              onClick={() => {
                if (input.trim()) {
                  handleSend(`${qp.prompt}\n\n${input.trim()}`);
                } else {
                  setInput(qp.prompt + ' ');
                  textareaRef.current?.focus();
                }
              }}
              className="shrink-0 px-2.5 py-1 text-[11px] font-medium rounded-full bg-white/5 hover:bg-white/10 text-white/70 hover:text-white border border-white/10 transition-all active:scale-95 disabled:opacity-40"
            >
              {qp.label}
            </button>
          ))}
        </div>

        {/* Input Form Bar */}
        <div className="p-4 border-t border-white/10 bg-black/40 shrink-0">
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-end gap-2"
          >
            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Ask any question, paste a problem or concept... (Enter to send)"
                rows={2}
                disabled={isGenerating}
                className="w-full px-3.5 py-2.5 bg-white/5 border border-white/15 rounded-xl text-xs sm:text-sm text-white placeholder:text-white/30 focus:outline-none focus:border-[var(--accent)] resize-none transition-colors"
              />
            </div>

            {isGenerating ? (
              <button
                type="button"
                onClick={handleStop}
                className="h-[46px] px-4 rounded-xl bg-rose-500 hover:bg-rose-600 text-white font-semibold text-xs transition-all flex items-center gap-1.5 shrink-0 shadow-lg shadow-rose-500/20"
              >
                <span className="w-2.5 h-2.5 rounded-sm bg-white" />
                <span>Stop</span>
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="h-[46px] px-4 rounded-xl bg-[var(--accent)] hover:brightness-110 active:scale-95 text-black font-bold text-xs transition-all flex items-center gap-1.5 shrink-0 shadow-lg shadow-[var(--accent)]/20 disabled:opacity-40 disabled:cursor-not-allowed"
                title="Send question to Study Bot"
              >
                <span>Ask</span>
                <span className="text-base leading-none">➜</span>
              </button>
            )}
          </form>
          <div className="flex items-center justify-between mt-2 px-1 text-[10px] text-white/30">
            <span>Powered by Gemini • Study without tab juggling</span>
            <span>Shift + Enter for new line</span>
          </div>
        </div>
      </div>
    </div>
  );
};
