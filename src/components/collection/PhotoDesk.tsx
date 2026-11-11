"use client";

import { useMutation } from "convex/react";
import { useState, type CSSProperties } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Chip, errorMessage, useToast } from "@/components/ui";
import type { UploadItem } from "@/lib/useUploader";
import s from "./desk.module.css";

type Photo = {
  _id: Id<"photos">;
  thumbUrl: string | null;
  takenAt: number;
  favourite: boolean;
  fileName: string;
  contributor: { name: string; color: string };
  mine: boolean;
  caption?: string;
};

function jitter(id: string) {
  let h = 0;
  for (const c of id) h = (h * 33 + c.charCodeAt(0)) | 0;
  return { r: ((h % 13) - 6) * 0.9, y: (Math.abs(h >> 3) % 18) - 9 };
}

const STATUS_COPY: Record<UploadItem["status"], string> = {
  preparing: "developing…",
  uploading: "tucking it in…",
  done: "in the box!",
  duplicate: "already in here",
  failed: "hmm",
};

export function PhotoDesk({
  photos,
  uploads,
  canDeleteAll,
  onRetry,
}: {
  photos: Photo[];
  uploads: UploadItem[];
  canDeleteAll: boolean;
  onRetry: (key: string) => void;
}) {
  const [view, setView] = useState<"desk" | "grid">("desk");
  const setFav = useMutation(api.photos.setFavourite);
  const remove = useMutation(api.photos.remove);
  const toast = useToast();
  const pendingUploads = uploads.filter((u) => u.status !== "done");

  return (
    <div>
      <div className={s.toolbar}>
        <span className="mono" style={{ color: "var(--ink-soft)" }}>
          {photos.length} photos
        </span>
        <div className={s.toggle} role="group" aria-label="View">
          <Chip pressed={view === "desk"} onClick={() => setView("desk")}>
            scattered <em>desk</em>
          </Chip>
          <Chip pressed={view === "grid"} onClick={() => setView("grid")}>
            tidy <em>grid</em>
          </Chip>
        </div>
      </div>

      <ul className={view === "desk" ? s.desk : s.grid}>
        {pendingUploads.map((u) => (
          <li key={u.key} className={s.item} style={{ "--r": `${u.rotation}deg`, "--y": "0px" } as CSSProperties}>
            <figure className={`${s.print} ${s.uploading}`} style={{ "--p": u.progress } as CSSProperties}>
              <div className={s.imgWrap}>
                {u.previewUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={u.previewUrl} alt="" className={s.img} />
                ) : (
                  <span className={s.blank} />
                )}
              </div>
              <figcaption className={s.caption}>
                {u.status === "failed" ? (
                  <button className={s.retry} onClick={() => onRetry(u.key)}>
                    {u.error ?? "failed"} · retry
                  </button>
                ) : (
                  u.error ?? STATUS_COPY[u.status]
                )}
              </figcaption>
              {u.status !== "failed" && u.status !== "duplicate" && (
                <span className={s.progress} role="progressbar" aria-valuenow={Math.round(u.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`uploading ${u.name}`} />
              )}
            </figure>
          </li>
        ))}
        {photos.map((p, i) => {
          const j = jitter(p._id);
          return (
            <li
              key={p._id}
              className={s.item}
              style={{ "--r": `${j.r}deg`, "--y": `${j.y}px`, "--i": Math.min(i, 20) } as CSSProperties}
            >
              <figure className={s.print}>
                <div className={s.imgWrap}>
                  {p.thumbUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.thumbUrl} alt={p.caption ?? `photo from ${new Date(p.takenAt).toLocaleDateString()}`} className={s.img} loading="lazy" />
                  )}
                </div>
                <figcaption className={s.caption}>
                  <span>{new Date(p.takenAt).toLocaleDateString(undefined, { day: "numeric", month: "short" }).toLowerCase()}</span>
                  <span className={s.by} style={{ background: p.contributor.color }} title={`added by ${p.contributor.name}`}>
                    {p.contributor.name.slice(0, 1)}
                  </span>
                </figcaption>
                <div className={s.actions}>
                  <button
                    className={s.fav}
                    aria-pressed={p.favourite}
                    aria-label={p.favourite ? "Unmark favourite" : "Mark as favourite"}
                    onClick={() => setFav({ photoId: p._id, favourite: !p.favourite }).catch((e) => toast(errorMessage(e)))}
                  >
                    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                      <path d="M12 21C5 16 2 12.5 2.6 8.6 3.2 5 7.4 3.6 10 6.2L12 8l2-1.8c2.6-2.6 6.8-1.2 7.4 2.4.6 3.9-2.4 7.4-9.4 12.4Z" fill={p.favourite ? "#EF6956" : "#FFFDF6"} stroke="#292620" strokeWidth="2" strokeLinejoin="round" />
                    </svg>
                  </button>
                  {(p.mine || canDeleteAll) && (
                    <button
                      className={s.del}
                      aria-label="Remove photo"
                      onClick={() => {
                        if (confirm("Remove this photo from the box? This deletes it for everyone.")) {
                          remove({ photoId: p._id }).catch((e) => toast(errorMessage(e)));
                        }
                      }}
                    >
                      <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
                        <path d="M3 3l10 10M13 3L3 13" stroke="#292620" strokeWidth="2.4" strokeLinecap="round" />
                      </svg>
                    </button>
                  )}
                </div>
              </figure>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
