export default function TypingDots() {
  return (
    <span className="inline-flex items-center gap-1 align-middle">
      <span className="sr-only">…</span>
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 animate-bounce [animation-delay:-0.2s]" />
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 animate-bounce" />
      <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 animate-bounce [animation-delay:0.2s]" />
    </span>
  );
}
