"use client";

// Returns the reader to wherever they came from (Settings, the WHOOP card…).
// If the page was opened directly — e.g. from the link given to WHOOP — there's
// no history to go back to, so it falls back to the app's front door.
function close() {
  if (typeof window === "undefined") return;
  if (window.history.length > 1) window.history.back();
  else window.location.href = "/";
}

export default function PrivacyClose({
  variant,
}: {
  variant: "icon" | "accept";
}) {
  if (variant === "icon") {
    return (
      <button
        onClick={close}
        aria-label="Close privacy policy"
        className="flex h-9 w-9 items-center justify-center rounded-full bg-paper/10 text-[16px] text-paper active:scale-90"
      >
        ✕
      </button>
    );
  }
  return (
    <button
      onClick={close}
      className="mt-8 w-full rounded-full bg-terra py-3.5 text-[16px] font-semibold text-paper active:scale-[0.98]"
    >
      I understand
    </button>
  );
}
