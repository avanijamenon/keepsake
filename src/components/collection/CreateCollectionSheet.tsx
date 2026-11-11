"use client";

import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { THEMES, type ThemeId } from "@convex/shared/themes";
import { Chip, Choices, Field, ScrapbookButton, Sheet, TextInput, errorMessage, useToast } from "@/components/ui";
import s from "./collection.module.css";

const IDEAS = ["our little adventures", "summer with the girls", "the everyday archive", "us, lately", "november memories"];

export function CreateCollectionSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const create = useMutation(api.collections.create);
  const router = useRouter();
  const toast = useToast();
  const [name, setName] = useState("");
  const [frequency, setFrequency] = useState<"monthly" | "weekly" | "manual">("monthly");
  const [theme, setTheme] = useState<ThemeId>("sunny-afternoon");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      const id = await create({ name, frequency, theme });
      onClose();
      router.push(`/c/${id}`);
    } catch (err) {
      toast(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={<>start a new <em>memory box</em></>}>
      <form onSubmit={submit} className={s.form}>
        <Field label="what's it called?">
          <TextInput big value={name} onChange={(e) => setName(e.target.value)} placeholder="us, lately" maxLength={80} autoFocus />
        </Field>
        <div className={s.ideas}>
          {IDEAS.map((idea) => (
            <Chip key={idea} onClick={() => setName(idea)}>
              {idea}
            </Chip>
          ))}
        </div>
        <Field label="make a scrapbook">
          <Choices>
            {(["monthly", "weekly", "manual"] as const).map((f) => (
              <Chip key={f} pressed={frequency === f} onClick={() => setFrequency(f)}>
                {f === "manual" ? <>whenever <em>I ask</em></> : <>every <em>{f === "monthly" ? "month" : "week"}</em></>}
              </Chip>
            ))}
          </Choices>
        </Field>
        <Field label="colour personality">
          <div className={s.swatches} role="radiogroup">
            {Object.values(THEMES).map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={theme === t.id}
                aria-label={t.label}
                title={t.label}
                className={s.swatch}
                onClick={() => setTheme(t.id)}
                style={{ background: `radial-gradient(circle at 30% 30%, ${t.blobs[0]}, ${t.blobs[1]} 55%, ${t.blobs[2]})` }}
              />
            ))}
          </div>
          <span className="hand" style={{ fontSize: "1.25rem" }}>{THEMES[theme].label.toLowerCase()}</span>
        </Field>
        <ScrapbookButton color="tomato" type="submit" disabled={busy || !name.trim()}>
          {busy ? "making it…" : "make the box →"}
        </ScrapbookButton>
      </form>
    </Sheet>
  );
}
