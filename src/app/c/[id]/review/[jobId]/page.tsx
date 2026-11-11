"use client";

import { useParams, useRouter } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState, type CSSProperties } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Gate, Loading, TopBar } from "@/components/shell/Shell";
import { HandwrittenNote, ScallopedBadge, ScrapbookButton, errorMessage, useToast } from "@/components/ui";
import { SortingScene } from "@/components/generation/SortingScene";
import s from "./review.module.css";

const MIN_SCENE_MS = 2600;

const DECISION_TAG: Record<string, string> = {
  duplicate: "near-twin",
  low_quality: "a bit off",
  not_chosen: "set aside",
};

function Review({ collectionId, jobId }: { collectionId: Id<"collections">; jobId: Id<"generationJobs"> }) {
  const job = useQuery(api.generation.get, { jobId });
  const photos = useQuery(api.photos.list, { collectionId });
  const setDecision = useMutation(api.generation.setDecision);
  const compose = useMutation(api.generation.compose);
  const retry = useMutation(api.generation.retry);
  const dismiss = useMutation(api.generation.dismiss);
  const router = useRouter();
  const toast = useToast();
  // Keep the sorting scene up for a moment even when the work is instant.
  const [sceneRun, setSceneRun] = useState(0);
  const [doneRun, setDoneRun] = useState(-1);
  const [showAside, setShowAside] = useState(false);
  const restartScene = () => setSceneRun((n) => n + 1);

  useEffect(() => {
    const t = setTimeout(() => setDoneRun(sceneRun), MIN_SCENE_MS);
    return () => clearTimeout(t);
  }, [sceneRun]);

  const sceneDone = doneRun === sceneRun;

  useEffect(() => {
    if (job?.status === "done" && job.scrapbookId && sceneDone) {
      router.replace(`/s/${job.scrapbookId}`);
    }
  }, [job?.status, job?.scrapbookId, sceneDone, router]);

  if (job === undefined) return <Loading />;
  if (job === null) {
    return (
      <>
        <TopBar back={{ href: `/c/${collectionId}`, label: "back to the box" }} />
        <HandwrittenNote className={s.note}>this selection has been tidied away.</HandwrittenNote>
      </>
    );
  }

  const thumbs = (job.candidates.length ? job.candidates.map((c) => c.thumbUrl) : (photos ?? []).map((p) => p.thumbUrl)).filter(
    (u): u is string => !!u,
  );
  const busy = job.status === "curating" || job.status === "analysing" || job.status === "composing" || (job.status === "done");
  if (busy || (!sceneDone && job.status === "review")) {
    return (
      <>
        <TopBar back={{ href: `/c/${collectionId}`, label: "back to the box" }} />
        <SortingScene
          thumbs={thumbs}
          title={job.status === "composing" || job.status === "done" ? "pasting it all in" : "picking the good bits"}
          step={job.status === "review" ? "almost there" : job.step}
        />
      </>
    );
  }

  if (job.status === "failed") {
    return (
      <>
        <TopBar back={{ href: `/c/${collectionId}`, label: "back to the box" }} />
        <div className={s.failed}>
          <HandwrittenNote tilt={-2}>{job.error ?? "Something went wrong."}</HandwrittenNote>
          <div className={s.row}>
            <ScrapbookButton onClick={() => retry({ jobId }).then(restartScene)}>try again</ScrapbookButton>
            <ScrapbookButton variant="ghost" onClick={() => dismiss({ jobId }).then(() => router.push(`/c/${collectionId}`))}>
              never mind
            </ScrapbookButton>
          </div>
        </div>
      </>
    );
  }

  const selected = job.candidates.filter((c) => c.decision === "selected");
  const toggle = (photoId: Id<"photos">, include: boolean) =>
    setDecision({ jobId, photoId, include }).catch((e) => toast(errorMessage(e)));

  return (
    <>
      <TopBar back={{ href: `/c/${collectionId}`, label: "back to the box" }} />
      <main className={s.main}>
        <header className={s.header}>
          <span className="mono">{job.label}</span>
          <h1 className={s.title}>
            we picked <em>{selected.length}</em> of {job.candidates.length}
          </h1>
          <p className={s.lede}>
            Grouped into {job.events.length} {job.events.length === 1 ? "moment" : "moments"}. Tap a photo to put it in or take it out — favourites are always kept.
          </p>
          <label className={s.asideToggle}>
            <input type="checkbox" checked={showAside} onChange={(e) => setShowAside(e.target.checked)} />
            show the ones we set aside
          </label>
        </header>

        {job.events.map((event) => {
          const items = job.candidates.filter((c) => c.event === event.index && (showAside || c.decision === "selected"));
          if (!items.length) return null;
          return (
            <section key={event.index} className={s.event}>
              <h2 className={s.eventTitle}>
                <span className={s.eventDot} aria-hidden />
                {event.label.toLowerCase()}
              </h2>
              <ul className={s.prints}>
                {items.map((c, i) => {
                  const inBook = c.decision === "selected";
                  return (
                    <li key={c.photoId} style={{ "--r": `${((i * 7) % 9) - 4}deg` } as CSSProperties}>
                      <button
                        className={`${s.print} ${inBook ? s.in : s.out}`}
                        aria-pressed={inBook}
                        aria-label={`${inBook ? "In the scrapbook" : "Set aside"}: ${c.reason}. ${inBook ? "Remove" : "Add"}`}
                        onClick={() => toggle(c.photoId, !inBook)}
                      >
                        {c.thumbUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.thumbUrl} alt="" loading="lazy" />
                        )}
                        <span className={s.reason}>{c.caption && inBook ? c.caption : c.reason}</span>
                        {inBook ? (
                          <ScallopedBadge color={c.favourite ? "tomato" : "pistachio"} size={46} tilt={12} className={s.badge}>
                            {c.favourite ? "♥" : "in"}
                          </ScallopedBadge>
                        ) : (
                          <span className={s.tag}>{DECISION_TAG[c.decision]}</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </main>
      <div className={s.dock}>
        <span className="hand" style={{ fontSize: "1.4rem" }}>
          {selected.length} photos → about {Math.max(2, Math.ceil(selected.length / 3) + 2)} pages
        </span>
        <ScrapbookButton
          color="tomato"
          disabled={!selected.length}
          onClick={() => {
            restartScene();
            compose({ jobId }).catch((e) => toast(errorMessage(e)));
          }}
        >
          make the scrapbook →
        </ScrapbookButton>
      </div>
    </>
  );
}

export default function Page() {
  const { id, jobId } = useParams<{ id: string; jobId: string }>();
  return (
    <Gate>
      <Review collectionId={id as Id<"collections">} jobId={jobId as Id<"generationJobs">} />
    </Gate>
  );
}
