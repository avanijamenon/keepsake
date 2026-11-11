"use client";

import { useMutation, useQuery } from "convex/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { THEMES } from "@convex/shared/themes";
import {
  Avatars,
  Chip,
  Choices,
  Field,
  ScrapbookButton,
  Sheet,
  TextArea,
  TextInput,
  errorMessage,
  useToast,
} from "@/components/ui";
import s from "./sheets.module.css";

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

function periods(now = new Date()) {
  const y = now.getFullYear();
  const m = now.getMonth();
  const startOfMonth = new Date(y, m, 1).getTime();
  const startOfLast = new Date(y, m - 1, 1).getTime();
  const startOfToday = new Date(y, m, now.getDate()).getTime();
  const tomorrow = startOfToday + 86400000;
  return [
    { id: "this-month", label: <>this <em>month</em></>, name: `${MONTHS[m]}, so far`, start: startOfMonth, end: tomorrow },
    { id: "last-month", label: <>last <em>month</em></>, name: MONTHS[(m + 11) % 12], start: startOfLast, end: startOfMonth },
    { id: "last-week", label: <>the last <em>7 days</em></>, name: "this week", start: tomorrow - 7 * 86400000, end: tomorrow },
    { id: "all", label: <>all of <em>it</em></>, name: "the whole story", start: 0, end: tomorrow },
  ];
}

export function GenerateSheet({
  open,
  onClose,
  collectionId,
}: {
  open: boolean;
  onClose: () => void;
  collectionId: Id<"collections">;
}) {
  const start = useMutation(api.generation.start);
  const router = useRouter();
  const toast = useToast();
  const options = useMemo(() => periods(), []);
  const [choice, setChoice] = useState("this-month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);

  async function go() {
    let range: { start: number; end: number; name: string };
    if (choice === "custom") {
      if (!from || !to) return toast("Pick both dates first.");
      const a = new Date(`${from}T00:00`).getTime();
      const b = new Date(`${to}T00:00`).getTime() + 86400000;
      range = { start: a, end: b, name: `${from} → ${to}` };
    } else {
      const p = options.find((o) => o.id === choice)!;
      range = { start: p.start, end: p.end, name: p.name };
    }
    setBusy(true);
    try {
      const jobId = await start({
        collectionId,
        periodStart: range.start,
        periodEnd: range.end,
        label: range.name,
        tzOffsetMinutes: new Date().getTimezoneOffset(),
      });
      router.push(`/c/${collectionId}/review/${jobId}`);
    } catch (e) {
      toast(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={<>make a <em>scrapbook</em></>}>
      <div className={s.stack}>
        <p className={s.lede}>Which stretch of time should it cover? We&rsquo;ll pick the good bits — you get the final say.</p>
        <Choices>
          {options.map((o) => (
            <Chip key={o.id} pressed={choice === o.id} onClick={() => setChoice(o.id)}>
              {o.label}
            </Chip>
          ))}
          <Chip pressed={choice === "custom"} onClick={() => setChoice("custom")}>
            pick <em>dates</em>
          </Chip>
        </Choices>
        {choice === "custom" && (
          <div className={s.dates}>
            <Field label="from">
              <TextInput type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </Field>
            <Field label="to">
              <TextInput type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </Field>
          </div>
        )}
        <ScrapbookButton color="tomato" onClick={go} disabled={busy}>
          {busy ? "gathering…" : "pick my photos →"}
        </ScrapbookButton>
      </div>
    </Sheet>
  );
}

type Member = { _id: Id<"members">; role: "owner" | "contributor" | "viewer"; name: string; color: string; isMe: boolean };

export function ShareSheet({
  open,
  onClose,
  collectionId,
  members,
  isOwner,
}: {
  open: boolean;
  onClose: () => void;
  collectionId: Id<"collections">;
  members: Member[];
  isOwner: boolean;
}) {
  const invites = useQuery(api.members.listInvites, open ? { collectionId } : "skip");
  const createInvite = useMutation(api.members.createInvite);
  const revoke = useMutation(api.members.revokeInvite);
  const setRole = useMutation(api.members.setRole);
  const removeMember = useMutation(api.members.remove);
  const toast = useToast();

  async function copy(role: "contributor" | "viewer") {
    try {
      const token = await createInvite({ collectionId, role });
      const url = `${window.location.origin}/join/${token}`;
      await navigator.clipboard.writeText(url).catch(() => {});
      toast(`Invite link copied — ${role === "contributor" ? "they can add photos" : "they can look"}`);
    } catch (e) {
      toast(errorMessage(e));
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={<>who&rsquo;s <em>in the box</em></>}>
      <div className={s.stack}>
        <ul className={s.members}>
          {members.map((m) => (
            <li key={m._id} className={s.member}>
              <Avatars people={[m]} size={36} />
              <span className={s.memberName}>
                {m.name}
                {m.isMe && <span className="hand"> (you)</span>}
              </span>
              {isOwner && m.role !== "owner" ? (
                <select
                  className={s.select}
                  value={m.role}
                  aria-label={`${m.name}'s role`}
                  onChange={(e) =>
                    setRole({ memberId: m._id, role: e.target.value as "contributor" | "viewer" }).catch((err) => toast(errorMessage(err)))
                  }
                >
                  <option value="contributor">contributor</option>
                  <option value="viewer">viewer</option>
                </select>
              ) : (
                <span className="mono">{m.role}</span>
              )}
              {isOwner && m.role !== "owner" && (
                <button className={s.remove} onClick={() => removeMember({ memberId: m._id }).catch((e) => toast(errorMessage(e)))} aria-label={`Remove ${m.name}`}>
                  remove
                </button>
              )}
            </li>
          ))}
        </ul>
        {isOwner ? (
          <>
            <div className={s.inviteRow}>
              <ScrapbookButton size="small" color="pistachio" onClick={() => copy("contributor")}>
                copy invite · can add photos
              </ScrapbookButton>
              <ScrapbookButton size="small" color="sky" onClick={() => copy("viewer")}>
                copy invite · can look
              </ScrapbookButton>
            </div>
            {invites && invites.length > 0 && (
              <div className={s.live}>
                <span className="mono">live invite links</span>
                {invites.map((i) => (
                  <div key={i._id} className={s.liveRow}>
                    <span>{i.role === "contributor" ? "add photos" : "look only"}</span>
                    <button className={s.remove} onClick={() => revoke({ inviteId: i._id })}>
                      turn off
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className={s.fine}>
              Viewers only ever see published scrapbooks — never the raw photos or drafts.
            </p>
          </>
        ) : (
          <p className={s.fine}>Only the owner can invite people.</p>
        )}
      </div>
    </Sheet>
  );
}

export function SettingsSheet({
  open,
  onClose,
  collection,
}: {
  open: boolean;
  onClose: () => void;
  collection: { _id: Id<"collections">; name: string; description?: string; frequency: "weekly" | "monthly" | "manual"; theme: string };
}) {
  const update = useMutation(api.collections.update);
  const toast = useToast();
  const [name, setName] = useState(collection.name);
  const [description, setDescription] = useState(collection.description ?? "");
  const [frequency, setFrequency] = useState(collection.frequency);
  const [theme, setTheme] = useState(collection.theme);

  async function save() {
    try {
      await update({ collectionId: collection._id, name, description, frequency, theme });
      toast("Saved ✿");
      onClose();
    } catch (e) {
      toast(errorMessage(e));
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={<>box <em>settings</em></>}>
      <div className={s.stack}>
        <Field label="name">
          <TextInput big value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </Field>
        <Field label="a little description">
          <TextArea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={280} />
        </Field>
        <Field label="how often">
          <Choices>
            {(["monthly", "weekly", "manual"] as const).map((f) => (
              <Chip key={f} pressed={frequency === f} onClick={() => setFrequency(f)}>
                {f === "manual" ? "whenever I ask" : f}
              </Chip>
            ))}
          </Choices>
          <span className={s.fine}>Automatic weekly/monthly drafts are coming soon — for now, make one whenever you like.</span>
        </Field>
        <Field label="colour personality">
          <Choices>
            {Object.values(THEMES).map((t) => (
              <Chip key={t.id} pressed={theme === t.id} onClick={() => setTheme(t.id)}>
                <span className={s.dot} style={{ background: t.blobs[0], boxShadow: `6px 0 0 ${t.blobs[1]}` }} />
                &nbsp;&nbsp;{t.label.toLowerCase()}
              </Chip>
            ))}
          </Choices>
        </Field>
        <ScrapbookButton onClick={save}>save</ScrapbookButton>
      </div>
    </Sheet>
  );
}
