import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
// Development storage adapter: files live OUTSIDE any served folder and are only readable through serveUpload.
// For production use a managed object store (S3/Cloudinary) with signed uploads.
export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'uploads');
export const MAX_BYTES = 2 * 1024 * 1024;
const TYPES = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
// Validate actual content (magic bytes), not the filename or declared type
export function sniffImage(buf) {
  if (buf.length > 12 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg';
  if (buf.length > 12 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buf.length > 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}
export function saveImage(buf) {
  const ext = sniffImage(buf); if (!ext) return null;
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const name = `${crypto.randomBytes(16).toString('hex')}.${ext}`; // server-chosen name, never user input
  fs.writeFileSync(path.join(UPLOAD_DIR, name), buf, { mode: 0o640 });
  return name;
}
export function serveUpload(req, res) {
  const m = /^([a-f0-9]{32})\.(jpg|png|webp)$/.exec(req.params.name);
  if (!m) return res.status(404).json({ error: 'Not found.' });
  const file = path.join(UPLOAD_DIR, req.params.name);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Not found.' });
  res.set({ 'Content-Type': TYPES[m[2]], 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'public, max-age=86400', 'Cross-Origin-Resource-Policy': 'cross-origin' });
  fs.createReadStream(file).pipe(res);
}
