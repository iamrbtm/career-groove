"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Bot, LoaderCircle, MessageCircleMore, Send, Sparkles, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Msg = {
  role: "user" | "assistant";
  content: string;
};

type TargetInfo = {
  title: string;
  company: string;
  description: string;
};

const WELCOME: Msg = {
  role: "assistant",
  content:
    "Hey there! 🎵 I'm your Groove Assistant. Drop a job posting URL or a company name and I'll research it, break down the role, and help you craft a killer application. What are we working on today?",
};

function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s]+/);
  return match?.[0] || null;
}

function stripUrl(text: string): string {
  return text.replace(/https?:\/\/[^\s]+/g, "").trim();
}

export function ResearchChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [target, setTarget] = useState<TargetInfo | null>(null);
  const [generatingDoc, setGeneratingDoc] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const send = useCallback(
    async (event?: FormEvent) => {
      event?.preventDefault();
      if (!input.trim() || loading) return;

      const url = extractUrl(input);
      const cleanMessage = url ? stripUrl(input) || `Research this company` : input.trim();

      const userMsg: Msg = { role: "user", content: input.trim() };
      const next = [...messages, userMsg];
      setMessages(next);
      setInput("");
      setLoading(true);
      setError("");
      setTarget(null);

      try {
        const body = JSON.stringify({
          message: cleanMessage,
          url: url || undefined,
          messages: next.map((m) => ({ role: m.role, content: m.content })),
        });

        const response = await fetch("/api/research-bot", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        });

        if (response.status === 401) throw new Error("Sign in to use the research assistant.");

        const targetTitle = response.headers.get("X-Target-Title");
        const targetCompany = response.headers.get("X-Target-Company");
        const targetDescription = response.headers.get("X-Target-Description");

        if (targetTitle && targetCompany) {
          setTarget({
            title: decodeURIComponent(targetTitle),
            company: decodeURIComponent(targetCompany),
            description: targetDescription ? decodeURIComponent(targetDescription) : "",
          });
        } else if (url) {
          setTarget({ title: "", company: "", description: "" });
          try {
            const parseRes = await fetch("/api/applications/parse-url", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ url }),
            });
            if (parseRes.ok) {
              const parsed = await parseRes.json();
              if (parsed.parsed?.title || parsed.parsed?.company) {
                setTarget({
                  title: parsed.parsed.title || "",
                  company: parsed.parsed.company || "",
                  description: parsed.parsed.summary || "",
                });
              }
            }
          } catch {
            // parse-url is best-effort here
          }
        }

        if (!response.ok || !response.body) {
          const errText = await response.text().catch(() => "The assistant is unavailable.");
          throw new Error(errText || "The assistant is unavailable.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let text = "";
        setMessages([...next, { role: "assistant", content: "" }]);

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          text += decoder.decode(value, { stream: true });
          setMessages([...next, { role: "assistant", content: text }]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    },
    [input, loading, messages],
  );

  async function generateDocument(kind: "resume" | "cover_letter" | "both") {
    if (!target) return;
    setGeneratingDoc(true);
    setError("");
    try {
      const response = await fetch("/api/document-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          target: {
            title: target.title || "Untitled Role",
            company: target.company || "Unknown Company",
            description: target.description || "No description available.",
          },
        }),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(typeof data.error === "string" ? data.error : "Could not queue draft.");

      const label = kind === "both" ? "Resume and Cover Letter" : kind === "resume" ? "Resume" : "Cover Letter";
      const confirm: Msg = {
        role: "assistant",
        content: `🎉 **${label} draft queued!** Head over to the **Document Studio** to view and download it when it's ready.`,
      };
      setMessages((prev) => [...prev, confirm]);
      setTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not queue draft.");
    } finally {
      setGeneratingDoc(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-24 right-5 z-40 grid size-14 place-items-center rounded-full border-2 border-ink bg-coral shadow-[0_4px_0_#26312c] transition-transform active:translate-y-0.5 active:shadow-none md:bottom-8"
        aria-label={open ? "Close research chat" : "Open research chat"}
      >
        {open ? <X size={24} className="text-ink" /> : <MessageCircleMore size={24} className="text-ink" />}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="fixed bottom-40 right-4 z-40 flex max-h-[600px] w-[calc(100vw-2rem)] max-w-[420px] flex-col rounded-3xl border-2 border-ink bg-white shadow-[0_8px_0_#26312c] md:bottom-24 md:right-5"
          >
            <div className="flex items-center gap-3 border-b-2 border-ink/10 px-5 py-4">
              <div className="grid size-9 place-items-center rounded-xl bg-sun">
                <Bot size={18} className="text-ink" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black">Groove Assistant</p>
                <p className="text-[10px] font-bold text-mint">Online</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid size-8 place-items-center rounded-xl bg-ink/5 hover:bg-coral/20"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[90%] rounded-3xl px-4 py-3 text-sm leading-6 ${
                      msg.role === "user"
                        ? "bg-coral/20 text-ink"
                        : "bg-cream text-ink"
                    }`}
                  >
                    {msg.content || <span className="italic text-ink/40">Thinking...</span>}
                  </div>
                </div>
              ))}

              {loading && !messages[messages.length - 1]?.content && (
                <div className="flex justify-start">
                  <div className="rounded-3xl bg-cream px-4 py-3 text-sm text-ink/60">
                    <div className="flex items-center gap-2">
                      <LoaderCircle size={14} className="animate-spin" />
                      Researching...
                    </div>
                  </div>
                </div>
              )}

              {error && (
                <div className="rounded-2xl bg-coral/15 p-3 text-sm font-bold text-coral">
                  {error}
                </div>
              )}

              {target && !loading && (
                <div className="flex flex-wrap gap-2 pt-2">
                  <button
                    type="button"
                    disabled={generatingDoc}
                    onClick={() => generateDocument("resume")}
                    className="flex items-center gap-1.5 rounded-2xl border-2 border-ink bg-sun px-4 py-2 text-xs font-black shadow-[0_3px_0_#26312c] active:translate-y-0.5 active:shadow-none disabled:opacity-50"
                  >
                    {generatingDoc ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    Resume
                  </button>
                  <button
                    type="button"
                    disabled={generatingDoc}
                    onClick={() => generateDocument("cover_letter")}
                    className="flex items-center gap-1.5 rounded-2xl border-2 border-ink bg-mint px-4 py-2 text-xs font-black shadow-[0_3px_0_#26312c] active:translate-y-0.5 active:shadow-none disabled:opacity-50"
                  >
                    {generatingDoc ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    Cover Letter
                  </button>
                  <button
                    type="button"
                    disabled={generatingDoc}
                    onClick={() => generateDocument("both")}
                    className="flex items-center gap-1.5 rounded-2xl border-2 border-ink bg-white px-4 py-2 text-xs font-black shadow-[0_3px_0_#26312c] active:translate-y-0.5 active:shadow-none disabled:opacity-50"
                  >
                    {generatingDoc ? <LoaderCircle size={14} className="animate-spin" /> : <Sparkles size={14} />}
                    Both
                  </button>
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            <form onSubmit={send} className="flex items-end gap-2 border-t-2 border-ink/10 px-4 py-3">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder="Paste a job URL or ask about a company..."
                rows={2}
                className="min-h-10 flex-1 resize-none rounded-2xl bg-cream px-4 py-3 text-sm outline-none placeholder:text-ink/30"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="grid size-11 shrink-0 place-items-center rounded-2xl border-2 border-ink bg-mint shadow-[0_3px_0_#26312c] disabled:opacity-40"
              >
                {loading ? <LoaderCircle size={18} className="animate-spin" /> : <Send size={18} />}
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
