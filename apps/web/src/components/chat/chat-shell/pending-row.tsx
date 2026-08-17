"use client";

export const AssistantPendingRow = () => {
  return (
    <li className="flex justify-start" aria-live="polite">
      <div className="flex items-center gap-2 rounded-2xl border border-[#e5e7eb] bg-white px-4 py-2.5 text-[14px] text-[#6b7280] shadow-sm">
        <span
          className="inline-block h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-[#e5e7eb] border-t-[#4f46e5]"
          aria-hidden
        />
        <span>正在生成回复</span>
        <span className="inline-flex items-center gap-0.5" aria-hidden>
          {[0, 120, 240].map((delayMs) => (
            <span
              key={delayMs}
              className="inline-block h-1 w-1 animate-pulse rounded-full bg-[#9ca3af]"
              style={{ animationDelay: `${delayMs}ms` }}
            />
          ))}
        </span>
      </div>
    </li>
  );
};
