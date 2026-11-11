"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Pip } from "@/components/art/Doodles";
import { ScrapbookButton } from "@/components/ui";
import s from "./install.module.css";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

const DISMISS_KEY = "keepsake:install-hint-dismissed";

/** Snapshot of "what kind of device is this" — read once on the client. */
function platform() {
  if (typeof window === "undefined") return "server";
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "installed";
  if (localStorage.getItem(DISMISS_KEY)) return "dismissed";
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  if (ios) return "ios";
  return /Android|Mobi/.test(ua) ? "mobile" : "desktop";
}

const noop = () => () => {};

/** A gentle nudge to add keepsake to the home screen, on phones only. */
export function InstallHint() {
  const kind = useSyncExternalStore(noop, platform, () => "server");
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallEvent);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setHidden(true);
  };

  const showIos = kind === "ios";
  const showAndroid = kind === "mobile" && prompt;
  if (hidden || (!showIos && !showAndroid)) return null;

  return (
    <aside className={s.hint} aria-label="Install keepsake">
      <Pip mood="wow" size={52} className={s.pip} />
      <div className={s.text}>
        <strong>keep keepsake on your home screen</strong>
        {showIos ? (
          <span>
            Tap{" "}
            <svg viewBox="0 0 20 24" width="15" height="18" aria-label="Share" className={s.share}>
              <path d="M10 15V2M5.5 6.5 10 2l4.5 4.5M6 10H3.5v11.5h13V10H14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>{" "}
            <b>Share</b>, then <b>Add to Home Screen</b>.
          </span>
        ) : (
          <span>It opens full-screen, just like an app.</span>
        )}
      </div>
      <div className={s.actions}>
        {showAndroid && (
          <ScrapbookButton
            size="small"
            color="tomato"
            onClick={async () => {
              await prompt!.prompt();
              const choice = await prompt!.userChoice;
              if (choice.outcome === "accepted") setHidden(true);
              setPrompt(null);
            }}
          >
            install
          </ScrapbookButton>
        )}
        <button className={s.close} onClick={dismiss} aria-label="Dismiss">
          not now
        </button>
      </div>
    </aside>
  );
}
