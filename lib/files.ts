import "server-only";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { UPLOAD_DIR } from "./db";
import { ApiError } from "./auth";
import { MAX_PROOF_BYTES } from "./constants";

const KINDS: { mime: string; ext: string; check: (b: Buffer) => boolean }[] = [
  { mime: "image/png", ext: "png", check: (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
  { mime: "image/jpeg", ext: "jpg", check: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  { mime: "image/webp", ext: "webp", check: (b) => b.subarray(0, 4).toString() === "RIFF" && b.subarray(8, 12).toString() === "WEBP" },
  { mime: "application/pdf", ext: "pdf", check: (b) => b.subarray(0, 5).toString() === "%PDF-" },
];

/** Validates type (by content, not just the name) and size, then stores the proof. */
export async function saveProof(file: FormDataEntryValue | null, required: boolean) {
  if (!file || typeof file === "string" || file.size === 0) {
    if (required) throw new ApiError(400, "Upload the payment proof (PNG, JPG, WEBP or PDF).");
    return null;
  }
  if (file.size > MAX_PROOF_BYTES) throw new ApiError(400, "Proof file is larger than 1.5 MB.");
  const buf = Buffer.from(await file.arrayBuffer());
  const kind = KINDS.find((k) => k.check(buf));
  if (!kind) throw new ApiError(400, "Proof must be a PNG, JPG, WEBP or PDF file.");
  const name = `${crypto.randomUUID()}.${kind.ext}`;
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf, { mode: 0o600 });
  const original = (file.name || `proof.${kind.ext}`).replace(/[^\w.\- ]+/g, "_").slice(0, 120);
  return { path: name, name: original, mime: kind.mime };
}

export function readProof(stored: string) {
  if (!/^[0-9a-f-]{36}\.(png|jpg|webp|pdf)$/.test(stored)) throw new ApiError(404, "File not found.");
  const p = path.join(UPLOAD_DIR, stored);
  if (!fs.existsSync(p)) throw new ApiError(404, "File not found.");
  return fs.readFileSync(p);
}
