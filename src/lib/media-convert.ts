// Browser-only converters: any photo → WebP (canvas), any video/audio → WebM (MediaRecorder).
// Nothing is uploaded here; callers decide what to do with the result.

export type Converted = { blob: Blob; type: string; ext: string; originalBytes: number; optimizedBytes: number };

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function savedPercent(before: number, after: number) {
  if (!before) return 0;
  return Math.round(((before - after) / before) * 100);
}

function loadImage(src: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(src);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Could not read this image")); };
    img.src = url;
  });
}

/** Re-encode a photo (or a canvas-ready blob) as WebP, max `maxWidth` wide. Keeps the original when WebP is bigger. */
export async function toWebp(file: Blob, maxWidth = 1920, quality = 0.82): Promise<Converted> {
  const img = await loadImage(file);
  const scale = Math.min(1, maxWidth / img.naturalWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  URL.revokeObjectURL(img.src);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", quality));
  if (!blob || blob.type !== "image/webp") throw new Error("This browser cannot create WebP images");
  return { blob, type: "image/webp", ext: "webp", originalBytes: file.size, optimizedBytes: blob.size };
}

function pickMime(kind: "video" | "audio") {
  const list = kind === "video"
    ? ["video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"]
    : ["audio/webm;codecs=opus", "audio/webm"];
  return list.find((m) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m));
}

/** Plays the file silently in the background and records it as WebM. Takes about as long as the clip. */
export async function toWebm(file: File, onProgress?: (p: number) => void): Promise<Converted> {
  const kind = file.type.startsWith("audio/") ? "audio" : "video";
  const mime = pickMime(kind);
  if (!mime) throw new Error("This browser cannot create WebM files — try Chrome or Firefox");
  const el = document.createElement(kind) as HTMLMediaElement;
  el.src = URL.createObjectURL(file);
  el.muted = false;
  el.volume = 0.0001;
  (el as HTMLVideoElement).playsInline = true;
  await new Promise<void>((res, rej) => { el.onloadedmetadata = () => res(); el.onerror = () => rej(new Error("Could not read this file")); });
  const stream: MediaStream = (el as any).captureStream?.() ?? (el as any).mozCaptureStream?.();
  if (!stream) throw new Error("This browser cannot convert media — try Chrome");
  const bitrate = kind === "video" ? 1_500_000 : 96_000;
  const rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: bitrate, audioBitsPerSecond: 96_000 });
  const chunks: Blob[] = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const done = new Promise<void>((res) => (rec.onstop = () => res()));
  el.ontimeupdate = () => el.duration && onProgress?.(Math.min(99, Math.round((el.currentTime / el.duration) * 100)));
  el.onended = () => rec.state !== "inactive" && rec.stop();
  rec.start(1000);
  await el.play();
  await done;
  URL.revokeObjectURL(el.src);
  onProgress?.(100);
  const type = kind === "video" ? "video/webm" : "audio/webm";
  const blob = new Blob(chunks, { type });
  return { blob, type, ext: "webm", originalBytes: file.size, optimizedBytes: blob.size };
}

export async function convertAny(file: File, onProgress?: (p: number) => void) {
  if (file.type.startsWith("image/")) return toWebp(file);
  if (file.type.startsWith("video/") || file.type.startsWith("audio/")) return toWebm(file, onProgress);
  throw new Error("Choose an image, video or audio file");
}
