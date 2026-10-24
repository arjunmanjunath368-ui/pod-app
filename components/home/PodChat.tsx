"use client";

import { useEffect, useRef, useState } from "react";

// Demo: quick messages with the pod, inside the pod card, so nobody has to
// leave Pod to coordinate. Messages only change on screen.

export type ChatMessage = {
  from: string; // "Maya", or "You"
  initials: string;
  color: string;
  text: string;
  ago: string;
};

const QUICK = ["Count me in", "Nice work!", "On my way"];

export default function PodChat({
  initial,
  reply,
}: {
  initial: ChatMessage[];
  reply: ChatMessage; // the pod-mate who answers your first message
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [text, setText] = useState("");
  const [typing, setTyping] = useState(false);
  const [unread, setUnread] = useState(initial.length);
  const replied = useRef(false);
  const listRef = useRef<HTMLUListElement | null>(null);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, typing]);

  function send(body: string) {
    const t = body.trim();
    if (!t) return;
    setUnread(0);
    setMessages((m) => m.concat([{ from: "You", initials: "", color: "", text: t, ago: "now" }]));
    setText("");
    if (!replied.current) {
      replied.current = true;
      setTyping(true);
      setTimeout(() => {
        setTyping(false);
        setMessages((m) => m.concat([reply]));
      }, 1400);
    }
  }

  return (
    <div className="mt-3 rounded-2xl border border-line bg-paper/60 p-3.5">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[16px] font-semibold text-ink">Pod chat</h3>
        {unread > 0 && (
          <span className="rounded-full bg-terra px-2.5 py-0.5 text-[13px] font-semibold text-paper">{unread} new</span>
        )}
      </div>

      <ul ref={listRef} className="mt-2.5 flex max-h-[340px] flex-col gap-2 overflow-y-auto" aria-live="polite">
        {messages.map((m, i) =>
          m.from === "You" ? (
            <li key={i} className="flex justify-end">
              <span className="max-w-[80%] rounded-2xl rounded-br-md bg-terra px-3.5 py-2 text-[16px] leading-snug text-paper">
                {m.text}
              </span>
            </li>
          ) : (
            <li key={i} className="flex items-end gap-2">
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-paper"
                style={{ backgroundColor: m.color }}
                aria-hidden
              >
                {m.initials}
              </span>
              <span className="max-w-[80%] rounded-2xl rounded-bl-md bg-card px-3.5 py-2 text-[16px] leading-snug text-ink shadow-[0_1px_0_rgba(26,46,31,0.06)]">
                <span className="flex items-baseline justify-between gap-3">
                  <b className="text-[14px] font-semibold text-ink">{m.from}</b>
                  <span className="text-[13px] text-muted">{m.ago}</span>
                </span>
                {m.text}
              </span>
            </li>
          )
        )}
        {typing && (
          <li className="pl-9 text-[14px] text-muted" aria-label={`${reply.from} is typing`}>
            {reply.from} is typing…
          </li>
        )}
      </ul>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {QUICK.map((q) => (
          <button
            key={q}
            onClick={() => send(q)}
            className="rounded-full border border-line bg-card px-3 py-1.5 text-[15px] font-semibold text-ink-soft transition active:scale-95"
          >
            {q}
          </button>
        ))}
      </div>

      <form
        className="mt-2.5 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          send(text);
        }}
      >
        <label htmlFor="pod-chat" className="sr-only">
          Message the pod
        </label>
        <input
          id="pod-chat"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message the pod"
          className="min-w-0 flex-1 rounded-full border border-line bg-card px-4 py-2.5 text-[16px] text-ink outline-none placeholder:text-muted focus:border-terra"
        />
        <button
          type="submit"
          disabled={!text.trim()}
          className="shrink-0 rounded-full bg-ink px-4 py-2.5 text-[16px] font-semibold text-paper transition active:scale-95 disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}
