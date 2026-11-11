"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useMutation, useQuery } from "convex/react";
import { Suspense, useState, type CSSProperties } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { TEMPLATES, type TemplateId } from "@convex/shared/templates";
import { STICKERS, THEMES, getTheme } from "@convex/shared/themes";
import { Gate, Loading, TopBar } from "@/components/shell/Shell";
import { Chip, ScrapbookButton, Sheet, TextInput, errorMessage, useToast } from "@/components/ui";
import { PageView, type PageData, type PageElement } from "@/components/scrapbook/PageView";
import { Sticker, STICKER_LABELS } from "@/components/art/Sticker";
import s from "./editor.module.css";

type Tray = null | "layout" | "stickers" | "paper" | "photo" | "book";

function TemplateThumb({ id }: { id: TemplateId }) {
  const t = TEMPLATES[id];
  return (
    <span className={s.tplThumb} aria-hidden>
      {t.photos.map((p) => (
        <span key={p.name} className={s.tplPhoto} style={{ left: `${p.x}%`, top: `${p.y}%`, width: `${p.w}%`, height: `${p.h}%`, rotate: `${p.rotate}deg`, zIndex: p.z }} />
      ))}
      {t.texts.map((x) => (
        <span key={x.name} className={s.tplText} style={{ left: `${x.x}%`, top: `${x.y}%`, width: `${x.w * 0.8}%`, height: x.style === "title" ? "7%" : "3%" }} />
      ))}
    </span>
  );
}

function Editor({ id }: { id: Id<"scrapbooks"> }) {
  const book = useQuery(api.scrapbooks.get, { scrapbookId: id });
  const photos = useQuery(api.photos.list, book ? { collectionId: book.collectionId } : "skip");
  const params = useSearchParams();
  const toast = useToast();

  const [pageId, setPageId] = useState<string | null>(params.get("page"));
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [tray, setTray] = useState<Tray>(null);
  const [swapFrom, setSwapFrom] = useState<string | null>(null);

  const setSlotText = useMutation(api.pages.setSlotText);
  const setPhoto = useMutation(api.pages.setPhoto);
  const rotate = useMutation(api.pages.rotate);
  const swap = useMutation(api.pages.swapPhotos);
  const addSticker = useMutation(api.pages.addSticker);
  const removeEl = useMutation(api.pages.removeElement);
  const setTemplate = useMutation(api.pages.setTemplate);
  const setPaper = useMutation(api.pages.setPaper);
  const addPage = useMutation(api.pages.addPage);
  const removePage = useMutation(api.pages.removePage);
  const movePage = useMutation(api.pages.movePage);
  const updateMeta = useMutation(api.scrapbooks.updateMeta);
  const moveSticker = useMutation(api.pages.moveSticker).withOptimisticUpdate((store, args) => {
    const current = store.getQuery(api.scrapbooks.get, { scrapbookId: id });
    if (!current) return;
    store.setQuery(api.scrapbooks.get, { scrapbookId: id }, {
      ...current,
      pages: current.pages.map((p) =>
        p._id !== args.pageId
          ? p
          : {
              ...p,
              elements: p.elements.map((e) =>
                e.id === args.elementId && e.kind === "sticker" ? { ...e, x: args.x, y: args.y, scale: args.scale ?? e.scale } : e,
              ),
            },
      ),
    });
  });

  const pages = (book?.pages ?? []) as PageData[];
  const page = pages.find((p) => p._id === pageId) ?? pages[0];
  const el: PageElement | undefined = page?.elements.find((e) => e.id === selected);

  if (book === undefined) return <Loading label="laying out the pages…" />;
  if (book === null || !book.canEdit) {
    return (
      <>
        <TopBar back={{ href: `/s/${id}`, label: "back" }} />
        <p className="hand" style={{ textAlign: "center", fontSize: "1.6rem", padding: "4rem 1rem" }}>
          you can look, but not edit this one.
        </p>
      </>
    );
  }
  if (!page) return <Loading />;

  const pid = page._id as Id<"pages">;
  const run = (p: Promise<unknown>) => p.catch((e) => toast(errorMessage(e)));
  const theme = getTheme(book.theme);
  const select = (eid: string | null, slot?: string) => {
    if (swapFrom && eid && eid !== swapFrom && page.elements.find((e) => e.id === eid)?.kind === "photo") {
      run(swap({ pageId: pid, a: swapFrom, b: eid }));
      setSwapFrom(null);
      setSelected(eid);
      return;
    }
    setSwapFrom(null);
    setSelected(eid);
    setSelectedSlot(slot ?? null);
    if (tray === "photo") setTray(null);
  };
  const textSlot = el?.kind === "text" ? el.slot : selectedSlot;

  const pageIndex = pages.indexOf(page);

  return (
    <div className={s.root}>
      <TopBar back={{ href: `/s/${id}`, label: "done editing" }}>
        <ScrapbookButton size="small" color="cream" onClick={() => setTray(tray === "book" ? null : "book")}>
          book & theme
        </ScrapbookButton>
        <ScrapbookButton size="small" color="pistachio" href={`/s/${id}`}>
          ✓ done
        </ScrapbookButton>
      </TopBar>

      <div className={s.layout}>
        <nav className={s.strip} aria-label="Pages">
          {pages.map((p, i) => (
            <button
              key={p._id}
              className={s.stripItem}
              aria-current={p._id === page._id ? "page" : undefined}
              onClick={() => {
                setPageId(p._id);
                setSelected(null);
              }}
            >
              <span className={s.stripNum}>{i + 1}</span>
              <span className={s.stripThumb}>
                <PageView page={p} photos={book.photos} theme={book.theme} animate={false} thumb />
              </span>
            </button>
          ))}
          <button className={s.addPage} onClick={() => run(addPage({ afterPageId: pid, template: "journal" }).then((nid) => setPageId(nid)))}>
            + page
          </button>
        </nav>

        <section className={s.canvasCol}>
          <div className={s.canvas} onClick={() => select(null)}>
            <PageView
              key={page._id}
              page={page}
              photos={book.photos}
              theme={book.theme}
              animate={false}
              editing={{
                selectedId: selected,
                onSelect: select,
                onStickerMove: (eid, x, y) => run(moveSticker({ pageId: pid, elementId: eid, x, y })),
              }}
            />
          </div>
          {swapFrom && <p className={s.hint}>now tap the photo to swap with ↺</p>}

          {/* Contextual controls */}
          <div className={s.toolbar} role="toolbar" aria-label="Edit tools">
            {!el && !selected?.startsWith("slot:") && (
              <>
                <span className={`mono ${s.toolLabel}`}>page {pageIndex + 1} · {TEMPLATES[page.template as TemplateId]?.label.toLowerCase()}</span>
                <Chip pressed={tray === "layout"} onClick={() => setTray(tray === "layout" ? null : "layout")}>layout</Chip>
                <Chip pressed={tray === "stickers"} onClick={() => setTray(tray === "stickers" ? null : "stickers")}>stickers</Chip>
                <Chip pressed={tray === "paper"} onClick={() => setTray(tray === "paper" ? null : "paper")}>paper</Chip>
                <Chip onClick={() => run(movePage({ pageId: pid, direction: -1 }))}>← move</Chip>
                <Chip onClick={() => run(movePage({ pageId: pid, direction: 1 }))}>move →</Chip>
                {page.template !== "cover" && (
                  <Chip
                    onClick={() => {
                      if (confirm("Remove this page?")) {
                        const next = pages[pageIndex + 1] ?? pages[pageIndex - 1];
                        run(removePage({ pageId: pid }).then(() => setPageId(next?._id ?? null)));
                      }
                    }}
                  >
                    remove page
                  </Chip>
                )}
              </>
            )}

            {el?.kind === "photo" && (
              <>
                <span className={`mono ${s.toolLabel}`}>photo</span>
                <Chip pressed={tray === "photo"} onClick={() => setTray(tray === "photo" ? null : "photo")}>
                  {el.photoId ? "replace" : "choose photo"}
                </Chip>
                <Chip onClick={() => run(rotate({ pageId: pid, elementId: el.id, rotation: el.rotation - 3 }))}>↶ tilt</Chip>
                <Chip onClick={() => run(rotate({ pageId: pid, elementId: el.id, rotation: el.rotation + 3 }))}>tilt ↷</Chip>
                <Chip pressed={swapFrom === el.id} onClick={() => setSwapFrom(swapFrom ? null : el.id)}>swap places</Chip>
                {el.photoId && <Chip onClick={() => run(removeEl({ pageId: pid, elementId: el.id }))}>take out</Chip>}
              </>
            )}

            {(el?.kind === "text" || selected?.startsWith("slot:")) && (
              <TextEditor
                key={`${page._id}:${selected}`}
                initial={el?.kind === "text" ? el.content : ""}
                onCommit={(content) => {
                  if (textSlot) run(setSlotText({ pageId: pid, slot: textSlot, content }));
                }}
                onDone={() => select(null)}
              />
            )}

            {el?.kind === "sticker" && (
              <>
                <span className={`mono ${s.toolLabel}`}>{STICKER_LABELS[el.sticker]} · drag to move</span>
                <Chip onClick={() => run(moveSticker({ pageId: pid, elementId: el.id, x: el.x, y: el.y, scale: el.scale * 0.85 }))}>smaller</Chip>
                <Chip onClick={() => run(moveSticker({ pageId: pid, elementId: el.id, x: el.x, y: el.y, scale: el.scale * 1.15 }))}>bigger</Chip>
                <Chip onClick={() => run(rotate({ pageId: pid, elementId: el.id, rotation: el.rotation + 15 }))}>spin</Chip>
                <Chip
                  onClick={() => {
                    run(removeEl({ pageId: pid, elementId: el.id }));
                    select(null);
                  }}
                >
                  peel off
                </Chip>
              </>
            )}
          </div>

          {tray === "layout" && (
            <div className={s.tray}>
              {(Object.keys(TEMPLATES) as TemplateId[])
                .filter((t) => t !== "cover" || page.template === "cover")
                .map((t) => (
                  <button
                    key={t}
                    className={s.tplOption}
                    aria-pressed={page.template === t}
                    onClick={() => run(setTemplate({ pageId: pid, template: t }))}
                  >
                    <TemplateThumb id={t} />
                    <span>{TEMPLATES[t].label.toLowerCase()}</span>
                    <span className={s.tplBlurb}>{TEMPLATES[t].blurb}</span>
                  </button>
                ))}
            </div>
          )}

          {tray === "stickers" && (
            <div className={s.tray}>
              {STICKERS.map((st, i) => (
                <button
                  key={st}
                  className={s.stickerOption}
                  aria-label={`Add ${STICKER_LABELS[st]}`}
                  onClick={() => run(addSticker({ pageId: pid, sticker: st, x: 30 + ((i * 17) % 40), y: 30 + ((i * 23) % 40) }))}
                >
                  <Sticker name={st} size={48} />
                </button>
              ))}
            </div>
          )}

          {tray === "paper" && (
            <div className={s.tray}>
              {[...new Set([...theme.papers, "#FAF5E9", "#FFFDF6", "#FBF0C9", "#FCEFF5", "#EEF6FB", "#F2F5E6", "#2E2C25"])].map((c) => (
                <button
                  key={c}
                  className={s.paperOption}
                  style={{ "--c": c } as CSSProperties}
                  aria-label={`Paper ${c}`}
                  aria-pressed={page.paper.toLowerCase() === c.toLowerCase()}
                  onClick={() => run(setPaper({ pageId: pid, paper: c }))}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <Sheet open={tray === "photo"} onClose={() => setTray(null)} title={<>pick a <em>photo</em></>}>
        <ul className={s.photoGrid}>
          {(photos ?? []).map((p) => (
            <li key={p._id}>
              <button
                className={s.photoOption}
                onClick={() => {
                  if (el?.kind === "photo") run(setPhoto({ pageId: pid, elementId: el.id, photoId: p._id }));
                  setTray(null);
                }}
              >
                {p.thumbUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumbUrl} alt={p.caption ?? ""} loading="lazy" />
                )}
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet open={tray === "book"} onClose={() => setTray(null)} title={<>the <em>book</em></>}>
        <BookSettings
          title={book.title}
          theme={book.theme}
          onSave={(title, themeId) => run(updateMeta({ scrapbookId: id, title, theme: themeId }).then(() => setTray(null)))}
        />
      </Sheet>
    </div>
  );
}

function TextEditor({
  initial,
  onCommit,
  onDone,
}: {
  initial: string;
  onCommit: (content: string) => void;
  onDone: () => void;
}) {
  const [draft, setDraft] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const commit = () => {
    if (draft === saved) return;
    setSaved(draft);
    onCommit(draft);
  };
  return (
    <form
      className={s.textForm}
      onSubmit={(e) => {
        e.preventDefault();
        commit();
        onDone();
      }}
    >
      <TextInput
        autoFocus
        value={draft}
        maxLength={400}
        placeholder="write something…"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        aria-label="Text"
      />
      <ScrapbookButton size="small" type="submit">
        save
      </ScrapbookButton>
    </form>
  );
}

function BookSettings({ title, theme, onSave }: { title: string; theme: string; onSave: (title: string, theme: string) => void }) {
  const [t, setT] = useState(title);
  const [th, setTh] = useState(theme);
  return (
    <div style={{ display: "grid", gap: "1.1rem" }}>
      <TextInput big value={t} onChange={(e) => setT(e.target.value)} aria-label="Scrapbook title" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
        {Object.values(THEMES).map((x) => (
          <Chip key={x.id} pressed={th === x.id} onClick={() => setTh(x.id)}>
            {x.label.toLowerCase()}
          </Chip>
        ))}
      </div>
      <p style={{ fontSize: "0.88rem", color: "var(--ink-soft)" }}>
        The theme changes stickers&rsquo; washi tape and light leaks; page paper colours stay as you set them.
      </p>
      <ScrapbookButton onClick={() => onSave(t, th)}>save</ScrapbookButton>
    </div>
  );
}

export default function Page() {
  const { id } = useParams<{ id: string }>();
  return (
    <Gate>
      <Suspense fallback={<Loading />}>
        <Editor id={id as Id<"scrapbooks">} />
      </Suspense>
    </Gate>
  );
}
