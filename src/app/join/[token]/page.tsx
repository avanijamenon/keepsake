"use client";

import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { Gate, Loading, TopBar } from "@/components/shell/Shell";
import { GradientCanvas, HandwrittenNote, ScrapbookButton, errorMessage, useToast } from "@/components/ui";
import { Pip } from "@/components/art/Doodles";

function Join({ token }: { token: string }) {
  const invite = useQuery(api.members.peekInvite, { token });
  const accept = useMutation(api.members.acceptInvite);
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  if (invite === undefined) return <Loading />;
  return (
    <>
      <TopBar />
      <main style={{ position: "relative", display: "grid", justifyItems: "center", gap: "1.5rem", padding: "3rem 1rem", textAlign: "center", overflow: "hidden" }}>
        <GradientCanvas seed={5} />
        {invite ? (
          <>
            <Pip mood="wow" size={110} style={{ position: "relative" }} />
            <HandwrittenNote tilt={-2} style={{ maxWidth: 440 }}>
              {invite.from} invited you to <strong>{invite.collectionName}</strong>
              {invite.role === "contributor" ? " — add your photos and help make the scrapbooks!" : " — to flip through the scrapbooks."}
            </HandwrittenNote>
            <ScrapbookButton
              color="tomato"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  const id = await accept({ token });
                  router.replace(`/c/${id}`);
                } catch (e) {
                  toast(errorMessage(e));
                  setBusy(false);
                }
              }}
            >
              open the box →
            </ScrapbookButton>
          </>
        ) : (
          <>
            <Pip mood="sleepy" size={110} style={{ position: "relative" }} />
            <HandwrittenNote style={{ maxWidth: 400 }}>this invite has been turned off or expired.</HandwrittenNote>
            <ScrapbookButton href="/">go home</ScrapbookButton>
          </>
        )}
      </main>
    </>
  );
}

export default function Page() {
  const { token } = useParams<{ token: string }>();
  return (
    <Gate>
      <Join token={token} />
    </Gate>
  );
}
