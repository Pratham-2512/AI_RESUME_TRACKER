"use client";

import { useRef, useState } from "react";
import { SectionCard } from "@/components/shared/ui";
import { cn } from "@/lib/utils";

type Msg = { role: "user" | "assistant"; content: string };

const PROMPTS = ["What should I learn next?", "How's my readiness?", "Improve my résumé", "How do I prep interviews?"];

export function CoachChat() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi — I'm your career coach. Ask about your skill gap, learning roadmap, résumé, interview prep, or overall readiness, and I'll give you a concrete next step grounded in your data." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || busy) return;
    setMessages((m) => [...m, { role: "user", content: msg }]);
    setInput(""); setBusy(true);
    try {
      const r = await fetch("/api/coach/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: msg, sessionId }) });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message);
      setSessionId(j.data.sessionId);
      setMessages((m) => [...m, { role: "assistant", content: j.data.reply }]);
    } catch (e) {
      setMessages((m) => [...m, { role: "assistant", content: e instanceof Error ? `Sorry — ${e.message}` : "Something went wrong." }]);
    } finally {
      setBusy(false);
      requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }));
    }
  }

  return (
    <SectionCard title="Career Coach" desc="Grounded, rule-based guidance — no API key required.">
      <div ref={scrollRef} className="max-h-80 space-y-3 overflow-y-auto pr-1">
        {messages.map((m, i) => (
          <div key={i} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2 text-sm",
              m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted")}>
              {m.content}
            </div>
          </div>
        ))}
        {busy && <div className="flex justify-start"><div className="rounded-2xl bg-muted px-3.5 py-2 text-sm text-muted-foreground">Thinking…</div></div>}
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {PROMPTS.map((p) => (
          <button key={p} onClick={() => send(p)} disabled={busy}
            className="rounded-full border px-3 py-1 text-xs hover:bg-muted disabled:opacity-50">{p}</button>
        ))}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="mt-3 flex gap-2">
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask your coach…"
          className="flex-1 rounded-md border bg-background px-3 py-2 text-sm" />
        <button type="submit" disabled={busy || input.trim().length === 0}
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50">Send</button>
      </form>
    </SectionCard>
  );
}
