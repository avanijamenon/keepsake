"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { useRef, useState, type DragEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { getTheme } from "@convex/shared/themes";
import { Gate, Loading, TopBar } from "@/components/shell/Shell";
import { Avatars, GradientCanvas, HandwrittenNote, ScallopedBadge, ScrapbookButton, StickerButton } from "@/components/ui";
import { Pip, Squiggle } from "@/components/art/Doodles";
import { Sticker } from "@/components/art/Sticker";
import { MemoryCover } from "@/components/scrapbook/MemoryCover";
import { PhotoDesk } from "@/components/collection/PhotoDesk";
import { GenerateSheet, SettingsSheet, ShareSheet } from "@/components/collection/Sheets";
import { useUploader } from "@/lib/useUploader";
import s from "./collection.module.css";

function Collection({ id }: { id: Id<"collections"> }) {
  const collection = useQuery(api.collections.get, { collectionId: id });
  const canContribute = collection ? collection.role !== "viewer" : false;
  const photos = useQuery(api.photos.list, canContribute ? { collectionId: id } : "skip");
  const books = useQuery(api.scrapbooks.listForCollection, { collectionId: id });
  const job = useQuery(api.generation.latestForCollection, canContribute ? { collectionId: id } : "skip");
  const uploader = useUploader(id);
  const fileInput = useRef<HTMLInputElement>(null);
  const [sheet, setSheet] = useState<null | "generate" | "share" | "settings">(null);
  const [dragging, setDragging] = useState(false);

  if (collection === undefined) return <Loading />;
  if (collection === null)
    return (
      <>
        <TopBar back={{ href: "/", label: "home" }} />
        <div className={s.missing}>
          <Pip mood="sleepy" size={110} />
          <p className="hand" style={{ fontSize: "1.8rem" }}>this box isn&rsquo;t shared with you (or it&rsquo;s gone)</p>
          <ScrapbookButton href="/">back home</ScrapbookButton>
        </div>
      </>
    );

  const theme = getTheme(collection.theme);
  const isOwner = collection.role === "owner";
  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    if (canContribute && e.dataTransfer.files.length) uploader.add(e.dataTransfer.files);
  };

  return (
    <div
      onDragOver={(e) => {
        if (!canContribute) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragging(false);
      }}
      onDrop={onDrop}
      className={s.root}
    >
      <TopBar back={{ href: "/", label: "all boxes" }}>
        <StickerButton label="Share and members" color="sky" size={50} onClick={() => setSheet("share")}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
            <circle cx="8" cy="9" r="3.4" fill="none" stroke="#292620" strokeWidth="2.2" />
            <circle cx="16.5" cy="9.5" r="2.8" fill="none" stroke="#292620" strokeWidth="2.2" />
            <path d="M2.5 19c.8-3.6 3-5.4 5.5-5.4s4.7 1.8 5.5 5.4M14 14.4c2.6-.4 5.6 1 6.4 4.6" fill="none" stroke="#292620" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </StickerButton>
        {isOwner && (
          <StickerButton label="Box settings" color="lavender" size={50} onClick={() => setSheet("settings")}>
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
              <path d="M4 7h10M18 7h2M4 17h4M12 17h8" stroke="#292620" strokeWidth="2.2" strokeLinecap="round" />
              <circle cx="16" cy="7" r="2.4" fill="#FFFDF6" stroke="#292620" strokeWidth="2.2" />
              <circle cx="10" cy="17" r="2.4" fill="#FFFDF6" stroke="#292620" strokeWidth="2.2" />
            </svg>
          </StickerButton>
        )}
      </TopBar>

      <main className={s.main}>
        <header className={s.header}>
          <GradientCanvas colors={[...theme.blobs, "#FAF5E9"]} seed={collection.name.length} blur={56} opacity={0.9} />
          <div className={s.headerText}>
            <span className={`mono ${s.kicker}`}>a memory box · {collection.photoCount} photos</span>
            <h1 className={s.title}>{collection.name}</h1>
            {collection.description && <p className={s.description}>{collection.description}</p>}
            <div className={s.people}>
              <Avatars people={collection.members} size={40} />
              <button className={s.invite} onClick={() => setSheet("share")}>
                {collection.members.length === 1 ? "+ invite someone" : `${collection.members.length} of you`}
              </button>
            </div>
          </div>
          {canContribute && (
            <div className={s.headerActions}>
              <ScrapbookButton color="tomato" onClick={() => fileInput.current?.click()}>
                + add photos
              </ScrapbookButton>
              <ScrapbookButton variant="ink" onClick={() => setSheet("generate")} disabled={!photos?.length}>
                ✶ make a scrapbook
              </ScrapbookButton>
            </div>
          )}
          <Pip mood={dragging ? "wow" : "happy"} size={100} color={theme.blobs[1]} className={s.pip} />
          <Sticker name="sparkle" size={40} className={s.spark} />
        </header>

        {job && (
          <Link href={`/c/${id}/review/${job._id}`} className={s.jobBanner}>
            <ScallopedBadge color={job.status === "failed" ? "tomato" : "butter"} size={64} tilt={-10}>
              {job.status === "review" ? "ready!" : job.status === "failed" ? "oops" : "busy"}
            </ScallopedBadge>
            <span>
              <strong>{job.label}</strong>{" "}
              {job.status === "review"
                ? "— your photos are picked. Have a look →"
                : job.status === "failed"
                  ? `— ${job.error ?? "something went wrong"} →`
                  : "— sorting through your photos…"}
            </span>
          </Link>
        )}

        {books && books.length > 0 && (
          <section className={s.section} aria-labelledby="eds">
            <h2 id="eds" className={s.h2}>
              the <em>scrapbooks</em>
            </h2>
            <div className={s.shelf}>
              {books.map((b, i) => (
                <MemoryCover
                  key={b._id}
                  href={`/s/${b._id}`}
                  title={b.title}
                  subtitle={b.subtitle}
                  theme={b.theme}
                  coverUrl={b.coverUrl}
                  status={b.status}
                  pageCount={b.pageCount}
                  tilt={i % 2 ? 2 : -2}
                />
              ))}
            </div>
          </section>
        )}

        {canContribute ? (
          <section className={s.section} aria-labelledby="photos-h">
            <h2 id="photos-h" className={s.h2}>
              on the <em>desk</em>
            </h2>
            {photos && photos.length === 0 && uploader.items.length === 0 ? (
              <button className={`${s.dropzone} ${dragging ? s.dropActive : ""}`} onClick={() => fileInput.current?.click()}>
                <Pip mood="wow" size={96} />
                <span className={s.dropTitle}>
                  tip your photos <em>in here</em>
                </span>
                <span className={s.dropSub}>drag them onto the page, or tap to choose · jpeg, png, heic, webp</span>
                <Squiggle className={s.dropSquiggle} />
              </button>
            ) : (
              <PhotoDesk
                photos={photos ?? []}
                uploads={uploader.items}
                canDeleteAll={isOwner}
                onRetry={uploader.retry}
              />
            )}
          </section>
        ) : (
          (!books || books.length === 0) && (
            <HandwrittenNote tilt={-2} className={s.viewerNote}>
              nothing published here yet — check back soon!
            </HandwrittenNote>
          )
        )}
      </main>

      {dragging && (
        <div className={s.dropOverlay} aria-hidden>
          <span>drop them on the desk ✿</span>
        </div>
      )}

      <input
        ref={fileInput}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        hidden
        onChange={(e) => {
          if (e.target.files?.length) uploader.add(e.target.files);
          e.target.value = "";
        }}
      />

      <GenerateSheet open={sheet === "generate"} onClose={() => setSheet(null)} collectionId={id} />
      <ShareSheet
        open={sheet === "share"}
        onClose={() => setSheet(null)}
        collectionId={id}
        members={collection.members}
        isOwner={isOwner}
      />
      {isOwner && sheet === "settings" && (
        <SettingsSheet open onClose={() => setSheet(null)} collection={collection} />
      )}
    </div>
  );
}

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return (
    <Gate>
      <Collection id={id as Id<"collections">} />
    </Gate>
  );
}
