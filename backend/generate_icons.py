"""
Run this script once to generate placeholder PNG icons for the Chrome extension.
Usage: python generate_icons.py
"""
import os
import struct
import zlib


def _make_png(size: int, r: int, g: int, b: int) -> bytes:
    """Build a minimal PNG with a solid colour — no external deps required."""
    def u32(n: int) -> bytes:
        return struct.pack(">I", n)

    def chunk(tag: bytes, data: bytes) -> bytes:
        return u32(len(data)) + tag + data + u32(zlib.crc32(tag + data) & 0xFFFFFFFF)

    # IHDR
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)

    # Raw pixel rows: filter byte 0x00 + RGB triplets
    row = bytes([0]) + bytes([r, g, b] * size)
    raw = row * size
    idat = zlib.compress(raw, 9)

    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", idat)
        + chunk(b"IEND", b"")
    )


def main():
    out_dir = os.path.join(os.path.dirname(__file__), "..", "extension", "icons")
    os.makedirs(out_dir, exist_ok=True)

    # Indigo #6366f1 → r=99 g=102 b=241
    r, g, b = 99, 102, 241

    for size in (16, 48, 128):
        path = os.path.join(out_dir, f"icon{size}.png")
        with open(path, "wb") as f:
            f.write(_make_png(size, r, g, b))
        print(f"  Created {path}")

    # Update manifest to reference the icons
    import json
    manifest_path = os.path.join(os.path.dirname(__file__), "..", "extension", "manifest.json")
    with open(manifest_path) as f:
        manifest = json.load(f)

    manifest["icons"] = {
        "16": "icons/icon16.png",
        "48": "icons/icon48.png",
        "128": "icons/icon128.png",
    }
    manifest.setdefault("action", {})["default_icon"] = {
        "16": "icons/icon16.png",
        "48": "icons/icon48.png",
    }
    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print("  Updated manifest.json with icon paths")
    print("Done! Load /extension in chrome://extensions.")


if __name__ == "__main__":
    main()
