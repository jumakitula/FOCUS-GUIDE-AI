// Generates solid-colour PNG icons for the Chrome extension using pure Node.js
// Run with: node generate-icons.mjs
import { mkdirSync, writeFileSync } from "fs";
import { createHash } from "crypto";
import zlib from "zlib";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function u32be(n) {
  const b = Buffer.alloc(4);
  b.writeUInt32BE(n, 0);
  return b;
}

function crc32(buf) {
  // Simple CRC32 without external deps
  let crc = 0xffffffff;
  const table = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let j = 0; j < 8; j++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c;
    }
    return t;
  })();
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(tag, data) {
  const tagBuf = Buffer.from(tag);
  const crcInput = Buffer.concat([tagBuf, data]);
  return Buffer.concat([u32be(data.length), tagBuf, data, u32be(crc32(crcInput))]);
}

function makePng(size, r, g, b) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); // width
  ihdr.writeUInt32BE(size, 4); // height
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // colour type: RGB
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Each row: filter byte 0x00 + RGB pixels
  const row = Buffer.alloc(1 + size * 3);
  row[0] = 0;
  for (let x = 0; x < size; x++) {
    row[1 + x * 3] = r;
    row[2 + x * 3] = g;
    row[3 + x * 3] = b;
  }
  const raw = Buffer.concat(Array(size).fill(row));
  const idat = zlib.deflateSync(raw);

  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), // PNG signature
    pngChunk("IHDR", ihdr),
    pngChunk("IDAT", idat),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

// Indigo: #6366f1
const [R, G, B] = [99, 102, 241];
const iconsDir = path.join(__dirname, "icons");
mkdirSync(iconsDir, { recursive: true });

for (const size of [16, 48, 128]) {
  const file = path.join(iconsDir, `icon${size}.png`);
  writeFileSync(file, makePng(size, R, G, B));
  console.log(`  Created ${file}`);
}
console.log("Done.");
