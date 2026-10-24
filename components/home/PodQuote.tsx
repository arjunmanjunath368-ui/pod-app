// A short line for the pod, written from its week (lib/podQuote). It eases in
// just after the notification preview on the demo.

export default function PodQuote({ text, podName }: { text: string; podName: string }) {
  return (
    <figure className="podquote mt-3 rounded-[22px] bg-paper-2 px-5 py-4">
      <style>{`
        @keyframes podQuoteIn { 0% { opacity: 0; transform: translateY(-10px) } 100% { opacity: 1; transform: none } }
        .podquote { animation: podQuoteIn .5s cubic-bezier(.2,.8,.2,1) 1.2s both }
        @media (prefers-reduced-motion: reduce) { .podquote { animation: none } }
      `}</style>
      <blockquote className="font-serif text-[22px] font-semibold leading-snug text-ink">
        <span aria-hidden className="mr-0.5 text-terra">“</span>
        {text}
        <span aria-hidden className="text-terra">”</span>
      </blockquote>
      <figcaption className="mt-1.5 text-[14px] text-muted">For {podName}, from this week</figcaption>
    </figure>
  );
}
