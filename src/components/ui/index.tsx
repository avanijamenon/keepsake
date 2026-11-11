"use client";

/**
 * keepsake's internal design system. Bespoke components on CSS modules —
 * accessible native elements underneath, our own look on top.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type CSSProperties,
  type InputHTMLAttributes,
  type ReactNode,
  type TextareaHTMLAttributes,
} from "react";
import Link from "next/link";
import s from "./ui.module.css";
import { scallopPath } from "../art/Doodles";

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export const COLOR_VARS: Record<string, string> = {
  butter: "var(--butter)",
  peach: "var(--peach)",
  bubblegum: "var(--bubblegum)",
  lavender: "var(--lavender)",
  pistachio: "var(--pistachio)",
  sky: "var(--sky)",
  tomato: "var(--tomato)",
  cream: "var(--cream)",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  color?: keyof typeof COLOR_VARS;
  variant?: "solid" | "ghost" | "ink";
  size?: "md" | "small";
  href?: string;
};

export function ScrapbookButton({
  color = "butter",
  variant = "solid",
  size = "md",
  className,
  style,
  href,
  children,
  ...rest
}: ButtonProps) {
  const cls = cx(s.button, variant === "ghost" && s.ghost, variant === "ink" && s.ink, size === "small" && s.small, className);
  const st = { ...(variant === "solid" ? { "--bg": COLOR_VARS[color] } : {}), ...style } as CSSProperties;
  if (href) {
    return (
      <Link href={href} className={cls} style={st}>
        {children}
      </Link>
    );
  }
  return (
    <button className={cls} style={st} {...rest}>
      {children}
    </button>
  );
}

export function StickerButton({
  color = "bubblegum",
  size = 64,
  label,
  children,
  className,
  style,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  color?: keyof typeof COLOR_VARS;
  size?: number;
  label: string;
}) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cx(s.sticker, className)}
      style={{ "--size": `${size}px`, ...style } as CSSProperties}
      {...rest}
    >
      <svg className={s.scallop} viewBox="0 0 100 100" aria-hidden>
        <path d={scallopPath(50, 50, 47, 11, 0.14)} fill={COLOR_VARS[color]} stroke="#292620" strokeWidth={3.5} />
      </svg>
      <span className={s.stickerIcon}>{children}</span>
    </button>
  );
}

export function Chip({
  children,
  color,
  pressed,
  onClick,
  className,
}: {
  children: ReactNode;
  color?: keyof typeof COLOR_VARS;
  pressed?: boolean;
  onClick?: () => void;
  className?: string;
}) {
  const st = { "--chip": color ? COLOR_VARS[color] : undefined } as CSSProperties;
  if (onClick) {
    return (
      <button type="button" className={cx(s.chip, className)} style={st} aria-pressed={pressed} onClick={onClick}>
        {children}
      </button>
    );
  }
  return (
    <span className={cx(s.chip, className)} style={st}>
      {children}
    </span>
  );
}

export function ScallopedBadge({
  children,
  color = "butter",
  size = 84,
  tilt = 8,
  className,
  style,
}: {
  children: ReactNode;
  color?: keyof typeof COLOR_VARS;
  size?: number;
  tilt?: number;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={cx(s.badge, className)}
      style={{ "--size": `${size}px`, "--tilt": `${tilt}deg`, ...style } as CSSProperties}
    >
      <svg viewBox="0 0 100 100" aria-hidden>
        <path d={scallopPath(50, 50, 47, 14, 0.12)} fill={COLOR_VARS[color]} stroke="#292620" strokeWidth={3} />
      </svg>
      <span className={s.badgeText}>{children}</span>
    </span>
  );
}

export function PaperCard({
  children,
  tab,
  tilt = 0,
  color,
  className,
  style,
}: {
  children: ReactNode;
  tab?: keyof typeof COLOR_VARS;
  tilt?: number;
  color?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cx(s.card, className)}
      style={{ "--tilt": `${tilt}deg`, "--tab": tab ? COLOR_VARS[tab] : undefined, "--card": color, ...style } as CSSProperties}
    >
      {tab && <span className={s.tab} aria-hidden />}
      {children}
    </div>
  );
}

const DEFAULT_BLOBS = ["#F7E88A", "#FFB89A", "#F5A9D0", "#B7AAF2"];

/** Dreamy blurred colour fields that drift slowly behind content. */
export function GradientCanvas({
  colors = DEFAULT_BLOBS,
  seed = 1,
  blur = 60,
  opacity = 0.85,
  className,
}: {
  colors?: string[];
  seed?: number;
  blur?: number;
  opacity?: number;
  className?: string;
}) {
  const rand = (n: number) => {
    const v = Math.sin(seed * 127.1 + n * 311.7) * 43758.5453;
    return v - Math.floor(v);
  };
  return (
    <div className={cx(s.gradient, className)} aria-hidden>
      {colors.map((c, i) => {
        let k = i * 8;
        const r = () => rand(k++);
        // Fixed precision so server HTML and client render match exactly.
        const n = (v: number) => v.toFixed(2);
        const size = 38 + r() * 34;
        return (
          <span
            key={i}
            className={s.blob}
            style={
              {
                backgroundImage: `radial-gradient(circle at 40% 40%, ${c}, ${c}00 70%)`,
                width: `${n(size)}%`,
                left: `${n(-10 + r() * 80)}%`,
                top: `${n(-15 + r() * 75)}%`,
                "--blur": `${blur}px`,
                "--opacity": String(opacity),
                "--dur": `${n(16 + r() * 14)}s`,
                "--dx": `${n((r() - 0.5) * 24)}%`,
                "--dy": `${n((r() - 0.5) * 24)}%`,
                animationDelay: `${n(-r() * 20)}s`,
              } as CSSProperties
            }
          />
        );
      })}
      <span className={s.gradientGrain} />
    </div>
  );
}

export function HandwrittenNote({
  children,
  tilt = -1.5,
  color,
  tape,
  className,
  style,
}: {
  children: ReactNode;
  tilt?: number;
  color?: string;
  tape?: string;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cx(s.note, className)}
      style={{ "--tilt": `${tilt}deg`, "--note": color, "--tape": tape, ...style } as CSSProperties}
    >
      <span className={s.tape} aria-hidden />
      {children}
    </div>
  );
}

export function Avatars({
  people,
  size = 38,
  max = 5,
}: {
  people: { name: string; color: string }[];
  size?: number;
  max?: number;
}) {
  return (
    <div className={s.avatars} aria-label={people.map((p) => p.name).join(", ")}>
      {people.slice(0, max).map((p, i) => (
        <span
          key={i}
          className={s.avatar}
          title={p.name}
          style={{ "--bg": p.color, "--size": `${size}px`, rotate: `${(i % 2 ? 1 : -1) * 6}deg` } as CSSProperties}
        >
          {p.name.slice(0, 1)}
        </span>
      ))}
      {people.length > max && (
        <span className={s.avatar} style={{ "--bg": "var(--cream)", "--size": `${size}px` } as CSSProperties}>
          +{people.length - max}
        </span>
      )}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className={s.field}>
      <span className={s.fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

export function TextInput({ big, className, ...rest }: InputHTMLAttributes<HTMLInputElement> & { big?: boolean }) {
  return <input className={cx(s.input, big && s.big, className)} {...rest} />;
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(s.input, className)} {...rest} />;
}

export function Choices({ children }: { children: ReactNode }) {
  return <div className={s.choices}>{children}</div>;
}

/** Bottom sheet on mobile, floating card on desktop. Built on <dialog>. */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      className={s.sheet}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className={s.sheetInner}>
          <StickerButton label="Close" color="cream" size={48} className={s.sheetClose} onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
              <path d="M3 3l10 10M13 3L3 13" stroke="#292620" strokeWidth="2.6" strokeLinecap="round" />
            </svg>
          </StickerButton>
          <h2 className={s.sheetTitle}>{title}</h2>
          {children}
        </div>
      )}
    </dialog>
  );
}

const ToastContext = createContext<(msg: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setMsg(null), 3200);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      {msg && (
        <div className={s.toast} role="status">
          {msg}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/** Pull a friendly message out of a Convex error. */
export function errorMessage(e: unknown) {
  const data = (e as { data?: unknown })?.data;
  if (typeof data === "string") return data;
  return "Something went a bit wrong — try again?";
}
