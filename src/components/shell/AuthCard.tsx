"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SignIn, SignUp } from "@clerk/nextjs";
import { useSession } from "@/app/providers";
import { GradientCanvas, HandwrittenNote, ScrapbookButton } from "@/components/ui";
import { Pip } from "@/components/art/Doodles";
import { Sticker } from "@/components/art/Sticker";
import { Wordmark } from "./Shell";
import s from "./auth.module.css";

/** Only allow same-site redirects after auth (e.g. back to an invite link). */
function safeRedirect(raw: string | null) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

export function AuthCard({ mode }: { mode: "sign-in" | "sign-up" }) {
  const session = useSession();
  const params = useSearchParams();
  const next = safeRedirect(params.get("redirect_url"));
  const qs = next === "/" ? "" : `?redirect_url=${encodeURIComponent(next)}`;

  return (
    <main className={s.page}>
      <GradientCanvas colors={["#F7E88A", "#FFB89A", "#F5A9D0", "#B7AAF2"]} seed={mode === "sign-in" ? 2 : 9} blur={80} />
      <div className={s.top}>
        <Wordmark />
      </div>
      <div className={s.layout}>
        <section className={s.copy}>
          <h1 className={s.title}>
            {mode === "sign-up" ? (
              <>
                make yourself <em>a box</em>
              </>
            ) : (
              <>
                welcome <em>back</em>
              </>
            )}
          </h1>
          <p className={s.lede}>
            {mode === "sign-up"
              ? "Free, private by default. Your photos are only ever seen by the people you invite."
              : "Your memory boxes are right where you left them."}
          </p>
          <Pip mood={mode === "sign-up" ? "wow" : "happy"} size={110} className={s.pip} />
          <Sticker name="sparkle" size={44} className={s.spark} />
        </section>
        <section className={s.card}>
          {session.mode === "clerk" ? (
            mode === "sign-up" ? (
              <SignUp routing="path" path="/sign-up" signInUrl={`/sign-in${qs}`} forceRedirectUrl={next} />
            ) : (
              <SignIn routing="path" path="/sign-in" signUpUrl={`/sign-up${qs}`} forceRedirectUrl={next} />
            )
          ) : (
            <div className={s.devNote}>
              <HandwrittenNote tilt={-1.5}>
                sign-in isn&rsquo;t switched on yet — this copy is running in local dev mode as a single user.
              </HandwrittenNote>
              <ScrapbookButton href="/">carry on →</ScrapbookButton>
            </div>
          )}
          <p className={s.switch}>
            {mode === "sign-up" ? (
              <>
                already have a box? <Link href={`/sign-in${qs}`}>sign in</Link>
              </>
            ) : (
              <>
                new here? <Link href={`/sign-up${qs}`}>make an account</Link>
              </>
            )}
          </p>
        </section>
      </div>
    </main>
  );
}
