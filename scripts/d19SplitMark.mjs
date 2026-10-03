// D19 — split the mark's art into its SLASH and its LETTERS, so each takes a colour from a token.
//
// The mark is artwork (StampLogo: wordmark.png "/draft", monogram.png "/d"), drawn in one orange. D19
// makes the "/" the accent and "draft" ink in light mode — a TOKEN change, which a single-colour PNG
// cannot take. So each PNG is split, by connected shape, into two ALPHA masks of the same size:
//   <name>-slash.png    the "/" alone       → drawn with var(--c-logo-slash)
//   <name>-letters.png  everything else     → drawn with var(--c-logo-word)
// The alpha is copied byte for byte; RGB is set to black (a mask reads alpha only). The two masks sum
// to the original alpha exactly, so a theme where both tokens are the art's orange renders the mark
// as it was (dark mode, D19: unchanged — checked by a pixel diff of the shots, see the commit).
//
// The slash is the connected shape (8-neighbour, alpha > 0) holding the art's bottom-left-most
// pixel. The script REFUSES if that shape is not a clean slash — if it reaches past the first third
// of the image or touches another glyph — rather than writing a mask with a letter fused to it.
//
// Usage: node scripts/d19SplitMark.mjs [--check]   (--check: exit 1 if the committed masks are stale)
import fs from "node:fs";
import zlib from "node:zlib";
import path from "node:path";

const DIR = "client/src/assets/brand";
const SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

export function decode(buf) {
  if (!buf.subarray(0, 8).equals(SIG)) throw new Error("not a PNG");
  let off = 8, w, h, idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString("ascii", off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === "IHDR") {
      w = data.readUInt32BE(0); h = data.readUInt32BE(4);
      if (data[8] !== 8 || data[9] !== 6 || data[12] !== 0) throw new Error("expected 8-bit RGBA, not interlaced");
    } else if (type === "IDAT") idat.push(data);
    off += 12 + len;
  }
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const bpp = 4, stride = w * bpp, px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0, b = y ? px[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
      let v = line[x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      px[y * stride + x] = v & 255;
    }
  }
  return { w, h, px };
}

const crcTable = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
const crc = (b) => { let c = 0xffffffff; for (const x of b) c = crcTable[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
function chunk(type, data) {
  const t = Buffer.from(type, "ascii"), len = Buffer.alloc(4), c = Buffer.alloc(4);
  len.writeUInt32BE(data.length); c.writeUInt32BE(crc(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, c]);
}
export function encode({ w, h, px }) {
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6;
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) px.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4);
  return Buffer.concat([SIG, chunk("IHDR", ihdr), chunk("IDAT", zlib.deflateSync(raw, { level: 9 })), chunk("IEND", Buffer.alloc(0))]);
}

export function split({ w, h, px }) {
  const alpha = (x, y) => px[(y * w + x) * 4 + 3];
  // The bottom-left-most inked pixel: smallest x + (h - y).
  let seed = null, best = Infinity;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
    if (alpha(x, y) > 0 && x + (h - 1 - y) < best) { best = x + (h - 1 - y); seed = [x, y]; }
  const inSlash = new Uint8Array(w * h), stack = [seed];
  inSlash[seed[1] * w + seed[0]] = 1;
  let maxX = 0;
  while (stack.length) {
    const [x, y] = stack.pop(); maxX = Math.max(maxX, x);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h || inSlash[ny * w + nx] || !alpha(nx, ny)) continue;
      inSlash[ny * w + nx] = 1; stack.push([nx, ny]);
    }
  }
  // A slash spans the full height and stays in the left part of the art. If the flood reached a
  // letter, the shape runs right across the image: refuse rather than paint a letter orange.
  if (maxX > w * 0.75) throw new Error(`the slash shape reaches x=${maxX} of ${w}: it is fused to a letter`);
  const slash = Buffer.alloc(px.length), letters = Buffer.alloc(px.length);
  let slashPx = 0, letterPx = 0;
  for (let i = 0; i < w * h; i++) {
    const a = px[i * 4 + 3];
    if (!a) continue;
    if (inSlash[i]) { slash[i * 4 + 3] = a; slashPx++; } else { letters[i * 4 + 3] = a; letterPx++; }
  }
  if (!slashPx || !letterPx) throw new Error("one of the two masks is empty");
  return { slash: { w, h, px: slash }, letters: { w, h, px: letters }, slashPx, letterPx, maxX };
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/d19SplitMark.mjs")) {
  const check = process.argv.includes("--check");
  let stale = 0;
  for (const name of ["wordmark", "monogram"]) {
    const art = decode(fs.readFileSync(path.join(DIR, `${name}.png`)));
    const s = split(art);
    for (const [part, img] of [["slash", s.slash], ["letters", s.letters]]) {
      const file = path.join(DIR, `${name}-${part}.png`), bytes = encode(img);
      if (check) { if (!fs.existsSync(file) || !fs.readFileSync(file).equals(bytes)) { stale++; console.error(`stale: ${file}`); } }
      else fs.writeFileSync(file, bytes);
    }
    console.log(`${name}: ${art.w}x${art.h} — slash ${s.slashPx} px (to x=${s.maxX}), letters ${s.letterPx} px`);
  }
  if (stale) process.exit(1);
}
