type MessageBubbleProps = {
  role: "user" | "assistant";
  content: string;
};

export function MessageBubble({ role, content }: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div className={isUser ? "ml-auto max-w-[85%]" : "mr-auto max-w-[85%]"}>
      <p className={`mb-1 text-xs text-ink-soft ${isUser ? "text-right" : "text-left"}`}>
        {isUser ? "You" : "Bookly"}
      </p>
      <div
        className={
          isUser
            ? "rounded-2xl rounded-br-md bg-forest px-4 py-3 text-paper"
            : "rounded-2xl rounded-bl-md border border-line bg-card px-4 py-3 text-ink"
        }
      >
        <p className="whitespace-pre-wrap text-[15px] leading-6">{content}</p>
      </div>
    </div>
  );
}
