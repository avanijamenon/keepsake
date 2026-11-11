/**
 * Browser-side preprocessing for each photo before upload:
 * validate → orient → extract metadata → renditions → perceptual hash →
 * basic quality signals. Keeps the server cheap and avoids re-processing.
 * (A Sharp worker can take this over later behind the same output shape.)
 */
import exifr from "exifr";

export type Prepared = {
  file: File;
  sha256: string;
  width: number;
  height: number;
  takenAt: number;
  takenAtSource: "exif" | "file" | "upload";
  location?: { lat: number; lng: number };
  display: Blob;
  thumb: Blob;
  previewUrl: string;
  analysis: {
    dhash: string;
    sharpness: number;
    brightness: number;
    contrast: number;
    colorfulness: number;
    quality: number;
    dominant: string;
  };
};

const ACCEPTED = /^image\/(jpeg|png|webp|heic|heif|avif|gif)$/;
const MAX_BYTES = 40 * 1024 * 1024;

export class PrepError extends Error {}

async function sha256(file: File) {
  const buf = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  return { c, ctx };
}

function scaled(bitmap: ImageBitmap, max: number) {
  const k = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * k));
  const h = Math.max(1, Math.round(bitmap.height * k));
  const { c, ctx } = canvas(w, h);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, w, h);
  return { c, ctx, w, h };
}

const toBlob = (c: HTMLCanvasElement, q: number) =>
  new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new PrepError("Couldn't encode image"))), "image/jpeg", q));

function dhash(bitmap: ImageBitmap) {
  const { ctx } = scaled2(bitmap, 9, 8);
  const d = ctx.getImageData(0, 0, 9, 8).data;
  let bits = "";
  for (let y = 0; y < 8; y++) {
    for (let x = 0; x < 8; x++) {
      const i = (y * 9 + x) * 4;
      const j = i + 4;
      const a = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
      const b = d[j] * 0.299 + d[j + 1] * 0.587 + d[j + 2] * 0.114;
      bits += a > b ? "1" : "0";
    }
  }
  let hex = "";
  for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
  return hex;
}

function scaled2(bitmap: ImageBitmap, w: number, h: number) {
  const { c, ctx } = canvas(w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  return { c, ctx };
}

function signals(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const d = ctx.getImageData(0, 0, w, h).data;
  const n = w * h;
  const gray = new Float32Array(n);
  let sum = 0;
  let rg = 0;
  let yb = 0;
  let rg2 = 0;
  let yb2 = 0;
  let r0 = 0;
  let g0 = 0;
  let b0 = 0;
  for (let i = 0, p = 0; p < n; i += 4, p++) {
    const r = d[i];
    const g = d[i + 1];
    const b = d[i + 2];
    const y = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    gray[p] = y;
    sum += y;
    const a1 = r - g;
    const a2 = 0.5 * (r + g) - b;
    rg += a1;
    yb += a2;
    rg2 += a1 * a1;
    yb2 += a2 * a2;
    r0 += r;
    g0 += g;
    b0 += b;
  }
  const mean = sum / n;
  let varSum = 0;
  for (let p = 0; p < n; p++) varSum += (gray[p] - mean) ** 2;
  const std = Math.sqrt(varSum / n);

  // Variance of the Laplacian — a classic focus measure.
  let lapSum = 0;
  let lapSq = 0;
  let count = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      const lap = 4 * gray[p] - gray[p - 1] - gray[p + 1] - gray[p - w] - gray[p + w];
      lapSum += lap;
      lapSq += lap * lap;
      count++;
    }
  }
  const lapMean = lapSum / count;
  const lapVar = lapSq / count - lapMean * lapMean;

  const mrg = rg / n;
  const myb = yb / n;
  const srg = Math.sqrt(Math.max(0, rg2 / n - mrg * mrg));
  const syb = Math.sqrt(Math.max(0, yb2 / n - myb * myb));
  const colorfulness = Math.sqrt(srg * srg + syb * syb) + 0.3 * Math.sqrt(mrg * mrg + myb * myb);

  const sharpness = Math.min(1, Math.max(0, (Math.log10(1 + lapVar * 10000) - 0.5) / 2));
  const brightness = mean;
  const contrast = Math.min(1, std / 0.28);
  const color = Math.min(1, colorfulness / 90);
  const exposure = Math.max(0, 1 - Math.abs(brightness - 0.5) * 2.1);
  const quality = Math.round((0.55 * sharpness + 0.25 * exposure + 0.2 * contrast) * 1000) / 1000;
  const hex = (v: number) => Math.round(v / n).toString(16).padStart(2, "0");

  return {
    sharpness: Math.round(sharpness * 1000) / 1000,
    brightness: Math.round(brightness * 1000) / 1000,
    contrast: Math.round(contrast * 1000) / 1000,
    colorfulness: Math.round(color * 1000) / 1000,
    quality,
    dominant: `#${hex(r0)}${hex(g0)}${hex(b0)}`,
  };
}

export async function prepare(file: File): Promise<Prepared> {
  if (!ACCEPTED.test(file.type) && !/\.(heic|heif)$/i.test(file.name)) {
    throw new PrepError("Not a photo we can read");
  }
  if (file.size > MAX_BYTES) throw new PrepError("Larger than 40MB");

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new PrepError(
      /heic|heif/i.test(file.type + file.name)
        ? "This browser can't open HEIC yet — try Safari, or export as JPEG"
        : "Couldn't open this image",
    );
  }

  const [hash, exif] = await Promise.all([
    sha256(file),
    exifr
      .parse(file, { pick: ["DateTimeOriginal", "CreateDate", "latitude", "longitude"], gps: true })
      .catch(() => null) as Promise<Record<string, unknown> | null>,
  ]);

  const exifDate = (exif?.DateTimeOriginal ?? exif?.CreateDate) as Date | undefined;
  const takenAt =
    exifDate instanceof Date && !isNaN(exifDate.getTime())
      ? { at: exifDate.getTime(), src: "exif" as const }
      : file.lastModified
        ? { at: file.lastModified, src: "file" as const }
        : { at: Date.now(), src: "upload" as const };
  const lat = exif?.latitude as number | undefined;
  const lng = exif?.longitude as number | undefined;

  const display = scaled(bitmap, 1800);
  const thumb = scaled(bitmap, 520);
  const probe = scaled(bitmap, 256);
  const analysis = { dhash: dhash(bitmap), ...signals(probe.ctx, probe.w, probe.h) };
  const [displayBlob, thumbBlob] = await Promise.all([toBlob(display.c, 0.86), toBlob(thumb.c, 0.8)]);
  const result: Prepared = {
    file,
    sha256: hash,
    width: bitmap.width,
    height: bitmap.height,
    takenAt: takenAt.at,
    takenAtSource: takenAt.src,
    location: typeof lat === "number" && typeof lng === "number" ? { lat, lng } : undefined,
    display: displayBlob,
    thumb: thumbBlob,
    previewUrl: URL.createObjectURL(thumbBlob),
    analysis,
  };
  bitmap.close();
  return result;
}
