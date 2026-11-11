"use client";

/**
 * Manual-upload ingestion source. Other sources (Google Photos Picker, iOS)
 * will produce the same `record` call with a different `source`.
 */
import { useConvex, useMutation } from "convex/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { prepare, PrepError, type Prepared } from "./preprocess";

export type UploadItem = {
  key: string;
  name: string;
  status: "preparing" | "uploading" | "done" | "duplicate" | "failed";
  progress: number;
  previewUrl?: string;
  error?: string;
  rotation: number;
  file: File;
};

const CONCURRENCY = 3;
const RETRIES = 2;

/** Convex file storage: POST, returns a storage id. */
async function post(url: string, body: Blob) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": body.type || "application/octet-stream" },
    body,
  });
  if (!res.ok) throw new Error(`upload failed (${res.status})`);
  const { storageId } = (await res.json()) as { storageId: Id<"_storage"> };
  return storageId;
}

/** R2: PUT to a presigned URL. */
async function put(url: string, body: Blob) {
  const res = await fetch(url, {
    method: "PUT",
    headers: { "Content-Type": body.type || "application/octet-stream" },
    body,
  });
  if (!res.ok) throw new Error(`upload failed (${res.status})`);
}

export function useUploader(collectionId: Id<"collections">) {
  const convex = useConvex();
  const getUrls = useMutation(api.photos.generateUploadUrls);
  const record = useMutation(api.photos.record);
  const [items, setItems] = useState<UploadItem[]>([]);
  const queue = useRef<UploadItem[]>([]);
  const active = useRef(0);

  const update = useCallback((key: string, patch: Partial<UploadItem>) => {
    setItems((xs) => xs.map((x) => (x.key === key ? { ...x, ...patch } : x)));
  }, []);

  const process = useCallback(
    async (item: UploadItem) => {
      let prepared: Prepared;
      try {
        prepared = await prepare(item.file);
      } catch (e) {
        update(item.key, {
          status: "failed",
          error: e instanceof PrepError ? e.message : "Couldn't read this one",
        });
        return;
      }
      update(item.key, { status: "uploading", previewUrl: prepared.previewUrl, progress: 0.15 });

      const existing = await convex.query(api.photos.findBySha, { collectionId, sha256: prepared.sha256 });
      if (existing) {
        update(item.key, { status: "duplicate", progress: 1 });
        return;
      }

      for (let attempt = 0; attempt <= RETRIES; attempt++) {
        try {
          const bytes = prepared.file.size + prepared.display.size + prepared.thumb.size;
          const urls = await getUrls({ collectionId, bytes });
          update(item.key, { progress: 0.3 });
          let storage: Doc<"photos">["storage"];
          if (urls.provider === "r2") {
            await Promise.all([
              put(urls.original.url, prepared.file),
              put(urls.display.url, prepared.display),
              put(urls.thumb.url, prepared.thumb),
            ]);
            storage = { provider: "r2", original: urls.original.key, display: urls.display.key, thumb: urls.thumb.key };
          } else {
            const [original, display, thumb] = await Promise.all([
              post(urls.original, prepared.file),
              post(urls.display, prepared.display),
              post(urls.thumb, prepared.thumb),
            ]);
            storage = { provider: "convex", original, display, thumb };
          }
          update(item.key, { progress: 0.85 });
          const res = await record({
            collectionId,
            storage,
            bytes,
            fileName: prepared.file.name,
            sha256: prepared.sha256,
            width: prepared.width,
            height: prepared.height,
            takenAt: prepared.takenAt,
            takenAtSource: prepared.takenAtSource,
            location: prepared.location,
            analysis: prepared.analysis,
          });
          update(item.key, { status: res.duplicate ? "duplicate" : "done", progress: 1, error: undefined });
          return;
        } catch (e) {
          if (attempt === RETRIES) {
            const data = (e as { data?: unknown }).data;
            update(item.key, {
              status: "failed",
              error: typeof data === "string" ? data : "Upload interrupted",
            });
            return;
          }
          update(item.key, { error: `retrying (${attempt + 1})…` });
          await new Promise((r) => setTimeout(r, 800 * 2 ** attempt));
        }
      }
    },
    [collectionId, convex, getUrls, record, update],
  );

  const pumpRef = useRef<() => void>(() => {});
  const pump = useCallback(() => {
    while (active.current < CONCURRENCY && queue.current.length) {
      const next = queue.current.shift()!;
      active.current++;
      process(next).finally(() => {
        active.current--;
        pumpRef.current();
      });
    }
  }, [process]);
  useEffect(() => {
    pumpRef.current = pump;
  }, [pump]);

  const add = useCallback(
    (files: FileList | File[]) => {
      const fresh: UploadItem[] = Array.from(files).map((file, i) => ({
        key: `${Date.now()}_${i}_${file.name}`,
        name: file.name,
        status: "preparing",
        progress: 0.05,
        rotation: Math.round((Math.random() - 0.5) * 16),
        file,
      }));
      setItems((xs) => [...fresh, ...xs]);
      queue.current.push(...fresh);
      pump();
    },
    [pump],
  );

  const retry = useCallback(
    (key: string) => {
      const item = items.find((x) => x.key === key);
      if (!item) return;
      update(key, { status: "preparing", error: undefined, progress: 0.05 });
      queue.current.push(item);
      pump();
    },
    [items, pump, update],
  );

  const clearFinished = useCallback(() => {
    setItems((xs) => xs.filter((x) => x.status !== "done" && x.status !== "duplicate"));
  }, []);

  return { items, add, retry, clearFinished };
}
