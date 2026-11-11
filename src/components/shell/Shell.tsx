"use client";

import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import type { ReactNode } from "react";
import { api } from "@convex/_generated/api";
import { useSession } from "@/app/providers";
import { GradientCanvas, ScrapbookButton } from "@/components/ui";
import { Pip } from "@/components/art/Doodles";
import { Sticker } from "@/components/art/Sticker";
import s from "./shell.module.css";

export function Wordmark() {
  return (
    <Link href="/" className={s.wordmark} aria-label="keepsake, home">
      {"keepsake".split("").map((c, i) => (
        <span key={i}>{c}</span>
      ))}
      <i className={s.dot} aria-hidden />
    </Link>
  );
}

export function TopBar({ back, children }: { back?: { href: string; label: string }; children?: ReactNode }) {
  const session = useSession();
  const me = useQuery(api.users.me);
  return (
    <header className={s.bar}>
      <div className={s.right}>
        <Wordmark />
        {back && (
          <Link href={back.href} className={s.crumb}>
            <span aria-hidden>←</span> {back.label}
          </Link>
        )}
      </div>
      <div className={s.right}>
        {children}
        {session.mode === "clerk" ? (
          <UserButton />
        ) : (
          me && (
            <span className={s.me} style={{ background: me.color }} title="local dev user">
              {me.name.slice(0, 1)}
            </span>
          )
        )}
      </div>
    </header>
  );
}

export function Loading({ label = "rummaging through the box…" }: { label?: string }) {
  return (
    <div className={s.loading} role="status">
      <div style={{ display: "grid", justifyItems: "center", gap: "1rem" }}>
        <Pip mood="busy" size={90} className={s.loadingPip} />
        <p className="hand" style={{ fontSize: "1.5rem" }}>{label}</p>
      </div>
    </div>
  );
}

/** Shows a playful welcome to signed-out visitors, the app to everyone else. */
export function Gate({ children }: { children: ReactNode }) {
  const session = useSession();
  const path = usePathname();
  const qs = path && path !== "/" ? `?redirect_url=${encodeURIComponent(path)}` : "";
  if (session.loading) return <Loading label="opening the lid…" />;
  if (session.signedIn) return <>{children}</>;
  return (
    <main className={s.welcome}>
      <GradientCanvas colors={["#F7E88A", "#FFB89A", "#F5A9D0", "#B7AAF2", "#A9D8F2"]} blur={70} />
      <div className={s.welcomeInner}>
        <Sticker name="sparkle" size={56} style={{ rotate: "-12deg" }} />
        <h1 className={s.welcomeTitle}>
          a little box <br />
          of <em>memories</em>
        </h1>
        <p className={s.welcomeLede}>
          Drop in your photos. We&rsquo;ll pick the good bits and paste them into a scrapbook you make
          with the people you love.
        </p>
        <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap", justifyContent: "center" }}>
          <ScrapbookButton color="tomato" href={`/sign-up${qs}`}>
            make your box →
          </ScrapbookButton>
          <ScrapbookButton variant="ghost" href={`/sign-in${qs}`}>
            I have one
          </ScrapbookButton>
        </div>
        <Pip mood="happy" size={110} />
      </div>
    </main>
  );
}
