"use client";

import { useEffect, useState } from "react";

const DISMISS_KEY = "pod-install-dismissed";

export default function PWAInstallPrompt() {
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [deferred, setDeferred] = useState<any>(null);

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISS_KEY) === "1") return;
    } catch {}

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (standalone) return; // already installed

    const ua = window.navigator.userAgent.toLowerCase();
    const ios = /iphone|ipad|ipod/.test(ua);
    // On iOS, install only works in Safari (not Chrome/other in-app browsers).
    const iosSafari = ios && /safari/.test(ua) && !/crios|fxios/.test(ua);

    if (iosSafari) {
      setIsIOS(true);
      setShow(true);
      return;
    }

    // Android / desktop Chrome: capture the native install prompt.
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e);
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  function dismiss() {
    setShow(false);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {}
  }

  async function install() {
    if (!deferred) return;
    deferred.prompt();
    try {
      await deferred.userChoice;
    } catch {}
    setDeferred(null);
    dismiss();
  }

  if (!show) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[100] flex justify-center px-4 pt-[max(12px,env(safe-area-inset-top))]">
      <div className="w-full max-w-[420px] rounded-2xl border border-line bg-card p-4 shadow-pod-lg">
        <div className="flex items-start gap-3">
          <img
            src="/icon-192.png"
            alt=""
            className="h-11 w-11 shrink-0 rounded-xl"
          />
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold text-ink">
              Add Pod to your home screen
            </div>
            {isIOS ? (
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                In Safari, tap the Share button{" "}
                <span className="font-semibold text-ink-soft">⎙</span> (bottom
                of the screen), scroll down, then choose{" "}
                <span className="font-semibold text-ink-soft">
                  Add to Home Screen
                </span>
                .
              </p>
            ) : (
              <p className="mt-1 text-[13px] leading-relaxed text-muted">
                Install Pod for a full-screen, app-like experience.
              </p>
            )}
            <div className="mt-3 flex gap-2">
              {!isIOS && (
                <button
                  onClick={install}
                  className="rounded-full bg-terra px-4 py-1.5 text-[13px] font-semibold text-white"
                >
                  Install
                </button>
              )}
              <button
                onClick={dismiss}
                className="rounded-full bg-paper-2 px-4 py-1.5 text-[13px] font-semibold text-muted"
              >
                {isIOS ? "Got it" : "Not now"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
