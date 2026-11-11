"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { useState, type CSSProperties } from "react";
import { api } from "@convex/_generated/api";
import { getTheme } from "@convex/shared/themes";
import { Gate, Loading, TopBar } from "@/components/shell/Shell";
import { Avatars, COLOR_VARS, GradientCanvas, ScallopedBadge, ScrapbookButton } from "@/components/ui";
import { Pip, Squiggle, Underline } from "@/components/art/Doodles";
import { Sticker } from "@/components/art/Sticker";
import { MemoryCover } from "@/components/scrapbook/MemoryCover";
import { CreateCollectionSheet } from "@/components/collection/CreateCollectionSheet";
import { InstallHint } from "@/components/shell/InstallHint";
import { EditName } from "@/components/shell/EditName";
import s from "./home.module.css";

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return "still up";
  if (h < 12) return "good morning";
  if (h < 17) return "good afternoon";
  return "good evening";
}

const TILTS = [-2.5, 1.8, -1.2, 2.6, -1.8, 1.1];

function Home() {
  const boxes = useQuery(api.collections.listMine);
  const me = useQuery(api.users.me);
  const [creating, setCreating] = useState(false);

  if (boxes === undefined) return <Loading />;
  const books = boxes.flatMap((b) => b.scrapbooks.map((sb) => ({ ...sb, box: b.name })));

  return (
    <>
      <TopBar />
      <main className={s.main}>
        <section className={s.hero}>
          <GradientCanvas colors={["#F7E88A", "#FFB89A", "#F5A9D0", "#B7AAF2"]} seed={3} blur={64} opacity={0.75} />
          <p className={`mono ${s.kicker}`}>your little archive · {new Date().toLocaleDateString(undefined, { month: "long", year: "numeric" }).toLowerCase()}</p>
          <h1 className={s.hello}>
            {greeting()},
            <br />
            <EditName current={me?.name ?? "friend"} className={s.nameButton} label="Change your name">
              <em>
                {me?.name ?? "friend"}
                <Underline className={s.underline} />
              </em>
            </EditName>
          </h1>
          <p className={s.lede}>
            {boxes.length === 0
              ? "Nothing in here yet. Start a box, drop in some photos, and we’ll paste together the good bits."
              : `${boxes.length} ${boxes.length === 1 ? "box" : "boxes"} of memories, ${books.length} ${books.length === 1 ? "scrapbook" : "scrapbooks"} so far.`}
          </p>
          {me?.needsName && (
            <EditName current={me.name} className={s.namePrompt}>
              ✎ what should we call you?
            </EditName>
          )}
          <div className={s.heroActions}>
            <ScrapbookButton color="tomato" onClick={() => setCreating(true)}>
              + new memory box
            </ScrapbookButton>
          </div>
          <Pip mood={boxes.length ? "happy" : "wow"} size={118} className={s.pip} />
          <Sticker name="sparkle" size={44} className={s.spark1} />
          <Sticker name="flower" size={52} className={s.spark2} />
        </section>

        {books.length > 0 && (
          <section className={s.shelfWrap} aria-labelledby="shelf-h">
            <h2 id="shelf-h" className={s.sectionTitle}>
              on the <em>shelf</em>
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
                  tilt={TILTS[i % TILTS.length]}
                />
              ))}
            </div>
            <div className={s.plank} aria-hidden />
          </section>
        )}

        <section aria-labelledby="boxes-h" className={s.boxesSection}>
          <h2 id="boxes-h" className={s.sectionTitle}>
            memory <em>boxes</em>
          </h2>
          <ul className={s.boxes}>
            {boxes.map((b, i) => {
              const theme = getTheme(b.theme);
              return (
                <li key={b._id} style={{ "--tilt": `${TILTS[(i + 2) % TILTS.length] * 0.6}deg` } as CSSProperties}>
                  <Link href={`/c/${b._id}`} className={s.box} style={{ "--tab": COLOR_VARS[b.cover] ?? "var(--butter)", "--glow": theme.blobs[0], "--glow2": theme.blobs[1] } as CSSProperties}>
                    <span className={s.boxTab} aria-hidden />
                    <span className={s.peeks} aria-hidden>
                      {b.previews.slice(0, 3).map((url, j) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img key={j} src={url} alt="" className={s.peek} style={{ "--j": j } as CSSProperties} />
                      ))}
                    </span>
                    <span className={s.boxBody}>
                      <span className={`mono ${s.boxMeta}`}>
                        {b.photoCount} photos · {b.role}
                      </span>
                      <span className={s.boxName}>{b.name}</span>
                      <span className={s.boxFoot}>
                        <Avatars people={b.people} size={30} />
                        <span className="hand" style={{ fontSize: "1.2rem" }}>
                          {b.frequency === "manual" ? "whenever" : b.frequency}
                        </span>
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
            <li style={{ "--tilt": "1.5deg" } as CSSProperties}>
              <button className={s.newBox} onClick={() => setCreating(true)}>
                <ScallopedBadge color="pistachio" size={74} tilt={-8}>
                  new!
                </ScallopedBadge>
                <span className={s.newBoxText}>
                  start a <em>new box</em>
                </span>
                <Squiggle className={s.newSquiggle} />
              </button>
            </li>
          </ul>
        </section>
      </main>
      <CreateCollectionSheet open={creating} onClose={() => setCreating(false)} />
      <InstallHint />
    </>
  );
}

export default function Page() {
  return (
    <Gate>
      <Home />
    </Gate>
  );
}
