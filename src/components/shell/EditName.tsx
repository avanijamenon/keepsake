"use client";

import { useMutation } from "convex/react";
import { useState, type ReactNode } from "react";
import { api } from "@convex/_generated/api";
import { Field, ScrapbookButton, Sheet, TextInput, errorMessage, useToast } from "@/components/ui";

/** A button (any content) that opens a little "what should we call you?" sheet. */
export function EditName({
  current,
  className,
  children,
  label,
}: {
  current: string;
  className?: string;
  children: ReactNode;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)} aria-label={label} title={label}>
        {children}
      </button>
      {open && <NameSheet current={current} onClose={() => setOpen(false)} />}
    </>
  );
}

function NameSheet({ current, onClose }: { current: string; onClose: () => void }) {
  const setName = useMutation(api.users.setName);
  const toast = useToast();
  const [name, setNameValue] = useState(current === "friend" ? "" : current);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await setName({ name });
      toast(`Hello, ${name.trim()} ✿`);
      onClose();
    } catch (err) {
      toast(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Sheet open onClose={onClose} title={<>what should we <em>call you?</em></>}>
      <form onSubmit={save} style={{ display: "grid", gap: "1.1rem" }}>
        <Field label="your name">
          <TextInput
            big
            autoFocus
            value={name}
            maxLength={40}
            placeholder="e.g. sam"
            autoComplete="given-name"
            onChange={(e) => setNameValue(e.target.value)}
          />
        </Field>
        <p style={{ fontSize: "0.9rem", color: "var(--ink-soft)", margin: 0 }}>
          This is what everyone in your memory boxes sees, and what goes on the last page of your scrapbooks.
        </p>
        <ScrapbookButton color="tomato" type="submit" disabled={busy || !name.trim()}>
          {busy ? "saving…" : "that's me →"}
        </ScrapbookButton>
      </form>
    </Sheet>
  );
}
