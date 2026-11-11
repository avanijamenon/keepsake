"use client";

import { useParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { getTheme } from "@convex/shared/themes";
import { Gate, Loading, TopBar } from "@/components/shell/Shell";
import { GradientCanvas, HandwrittenNote, ScrapbookButton, StickerButton, errorMessage, useToast } from "@/components/ui";
import { PageView, type PageData } from "@/components/scrapbook/PageView";
import s from "./reader.module.css";

function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 980px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return wide;
}

function Reader({ id }: { id: Id<"scrapbooks"> }) {
  const book = useQuery(api.scrapbooks.get, { scrapbookId: id });
  const setStatus = useMutation(api.scrapbooks.setStatus);
  const toast = useToast();
  const wide = useWide();
  const reduce = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [dir, setDir] = useState(1);
  const [opened, setOpened] = useState(false);

  const spreads: PageData[][] = [];
  if (book) {
    const pages = book.pages as PageData[];
    if (wide) {
      spreads.push([pages[0]]);
      for (let i = 1; i < pages.length; i += 2) spreads.push(pages.slice(i, i + 2));
    } else {
      for (const p of pages) spreads.push([p]);
    }
  }
  const count = spreads.length;
  const safeIndex = Math.min(index, Math.max(0, count - 1));

  const go = useCallback(
    (d: number) => {
      setDir(d);
      setIndex((i) => Math.min(Math.max(0, i + d), Math.max(0, count - 1)));
    },
    [count],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  useEffect(() => {
    const t = setTimeout(() => setOpened(true), 250);
    return () => clearTimeout(t);
  }, []);

  if (book === undefined) return <Loading label="opening the scrapbook…" />;
  if (book === null)
    return (
      <>
        <TopBar back={{ href: "/", label: "home" }} />
        <HandwrittenNote className={s.missing}>this scrapbook isn&rsquo;t available to you (yet).</HandwrittenNote>
      </>
    );

  const theme = getTheme(book.theme);
  const spread = spreads[safeIndex] ?? [];

  return (
    <div className={s.root} style={{ background: theme.id === "film-night" ? "#1d1b16" : undefined }}>
      <GradientCanvas colors={[...theme.blobs, theme.papers[1]]} seed={7} blur={90} opacity={0.65} className={s.bg} />
      <TopBar back={{ href: `/c/${book.collectionId}`, label: book.collectionName }}>
        {book.canEdit && (
          <ScrapbookButton size="small" color="lavender" href={`/s/${id}/edit?page=${spread[0]?._id ?? ""}`}>
            ✎ edit
          </ScrapbookButton>
        )}
        {book.canPublish && (
          <ScrapbookButton
            size="small"
            color={book.status === "draft" ? "pistachio" : "cream"}
            onClick={() =>
              setStatus({ scrapbookId: id, status: book.status === "draft" ? "published" : "draft" })
                .then(() => toast(book.status === "draft" ? "Published — everyone in the box can see it ✿" : "Back to a private draft"))
                .catch((e) => toast(errorMessage(e)))
            }
          >
            {book.status === "draft" ? "publish" : "unpublish"}
          </ScrapbookButton>
        )}
      </TopBar>

      {book.status === "draft" && (
        <p className={s.draftNote}>
          <span className="mono">draft</span> only people who can add photos see this until it&rsquo;s published
        </p>
      )}

      <main className={s.stage}>
        <StickerButton label="Previous page" color="butter" size={58} className={s.prev} onClick={() => go(-1)} disabled={safeIndex === 0}>
          <span aria-hidden style={{ fontSize: "1.4rem" }}>←</span>
        </StickerButton>

        <div className={s.bookWrap} style={{ perspective: 2200 }}>
          <AnimatePresence mode="popLayout" custom={dir} initial={false}>
            <motion.div
              key={`${wide}-${safeIndex}`}
              custom={dir}
              className={`${s.spread} ${spread.length === 2 ? s.two : s.one}`}
              initial={reduce ? { opacity: 0 } : { rotateY: dir > 0 ? 70 : -70, opacity: 0, x: dir > 0 ? 80 : -80 }}
              animate={
                opened
                  ? { rotateY: 0, opacity: 1, x: 0, scale: 1 }
                  : { rotateY: reduce ? 0 : -25, opacity: 0.6, scale: 0.92 }
              }
              exit={reduce ? { opacity: 0 } : { rotateY: dir > 0 ? -60 : 60, opacity: 0, x: dir > 0 ? -60 : 60 }}
              transition={{ type: "spring", stiffness: 140, damping: 20, mass: 0.9 }}
              style={{ transformOrigin: dir > 0 ? "left center" : "right center" }}
              drag={wide ? false : "x"}
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.35}
              onDragEnd={(_, info) => {
                if (info.offset.x < -60) go(1);
                else if (info.offset.x > 60) go(-1);
              }}
            >
              {spread.map((p) => (
                <div key={p._id} className={s.pageSlot}>
                  <PageView page={p} photos={book.photos} theme={book.theme} />
                </div>
              ))}
              {spread.length === 2 && <span className={s.gutter} aria-hidden />}
            </motion.div>
          </AnimatePresence>
        </div>

        <StickerButton label="Next page" color="butter" size={58} className={s.next} onClick={() => go(1)} disabled={safeIndex >= count - 1}>
          <span aria-hidden style={{ fontSize: "1.4rem" }}>→</span>
        </StickerButton>
      </main>

      <nav className={s.dots} aria-label="Pages">
        {spreads.map((sp, i) => (
          <button
            key={i}
            className={s.dot}
            aria-current={i === safeIndex ? "page" : undefined}
            aria-label={`Go to page ${i + 1}`}
            onClick={() => {
              setDir(i > safeIndex ? 1 : -1);
              setIndex(i);
            }}
          />
        ))}
      </nav>
      <p className={s.counter} aria-live="polite">
        {safeIndex + 1} of {count}
      </p>
    </div>
  );
}

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return (
    <Gate>
      <Reader id={id as Id<"scrapbooks">} />
    </Gate>
  );
}
