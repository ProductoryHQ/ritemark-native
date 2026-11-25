"""Create fixture-only v1 cache entries using the writer's on-disk contract."""
import ctypes
import hashlib
import json
import os
import sys
import unicodedata
from pathlib import Path


# Python's posixpath.realpath walks links in Python. Use Darwin's native
# realpath, as the writer does, for filesystem spelling and /private aliases.
libc = ctypes.CDLL(None, use_errno=True)
libc.realpath.argtypes = [ctypes.c_char_p, ctypes.c_void_p]
libc.realpath.restype = ctypes.c_void_p
libc.free.argtypes = [ctypes.c_void_p]
libc.free.restype = None


def source_identity(source):
    resolved = libc.realpath(os.fsencode(source), None)
    if not resolved:
        code = ctypes.get_errno()
        raise OSError(code, os.strerror(code), source)
    try:
        path = unicodedata.normalize("NFC", ctypes.string_at(resolved).decode("utf-8"))
        return path, digest(path.encode("utf-8"))
    finally:
        libc.free(resolved)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def fixture_pdf():
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 720 405] /Resources << /Font << /F1 7 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 720 405] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>",
    ]
    for drawing in (
        b"0.8 0.15 0.2 rg 0 0 360 405 re f 0.1 0.25 0.8 rg 360 0 360 405 re f "
        b"1 1 1 rg BT /F1 48 Tf 131 188 Td (PROOF SLIDE ONE) Tj ET",
        b"0.1 0.7 0.3 rg 0 0 720 405 re f 1 1 1 rg BT /F1 48 Tf 131 188 Td (PROOF SLIDE TWO) Tj ET",
    ):
        objects.append(b"<< /Length %d >>\nstream\n" % len(drawing) + drawing + b"\nendstream")
    objects.append(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    pdf = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for index, obj in enumerate(objects, 1):
        offsets.append(len(pdf))
        pdf += b"%d 0 obj\n" % index + obj + b"\nendobj\n"
    xref = len(pdf)
    pdf += b"xref\n0 %d\n0000000000 65535 f \n" % len(offsets)
    for offset in offsets[1:]:
        pdf += b"%010d 00000 n \n" % offset
    pdf += b"trailer\n<< /Size %d /Root 1 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(offsets), xref)
    return bytes(pdf)


def seed(root, fixtures, private_fixtures):
    pdf = fixture_pdf()
    (fixtures / "expected.pdf").write_bytes(pdf)
    for name in ("café", "private", "small", "stale", "mixed", "linked-file", "linked-entry",
                 "oversize", "oversize-manifest", "large-source", "missing"):
        source = (private_fixtures if name == "private" else fixtures) / f"{name}.rtms"
        original = b"# Fixture\n\nPROOF ORIGINAL SOURCE\n"
        if name == "large-source":
            original += b" " * (16 * 1024 * 1024)
        source.write_bytes(original)
        if name == "missing":
            continue
        path, key = source_identity(source)
        if name == "private" and not path.startswith("/private/tmp/"):
            raise ValueError(f"Expected a native /private/tmp path, got {path}")
        entry = root / key
        entry.mkdir(parents=True)
        print(f"{path}\t{entry}")
        manifest = {
            "v": 1, "source": path, "sourceSha256": digest(original), "pdfSha256": digest(pdf),
            "slides": 2, "appVersion": "2.4.0", "drawnAt": "2026-11-25T12:00:00.000Z",
            "inputs": digest(original),
        }
        (entry / "entry.json").write_text(json.dumps(manifest), encoding="utf-8")
        target = entry / "slides.pdf"
        target.write_bytes(pdf)
        if name == "stale":
            source.write_bytes(b"# Fixture\n\nPROOF CURRENT SOURCE\n")
        elif name == "mixed":
            target.write_bytes(pdf + b"\n")
        elif name == "linked-file":
            target.unlink()
            target.symlink_to(fixtures / "expected.pdf")
        elif name == "linked-entry":
            moved = fixtures / "redirected-entry"
            entry.rename(moved)
            entry.symlink_to(moved, target_is_directory=True)
        elif name == "oversize":
            with target.open("r+b") as stream:
                stream.truncate(50 * 1024 * 1024 + 1)
            manifest["pdfSha256"] = digest(target.read_bytes())
            (entry / "entry.json").write_text(json.dumps(manifest), encoding="utf-8")
        elif name == "oversize-manifest":
            with (entry / "entry.json").open("ab") as stream:
                stream.write(b" " * (64 * 1024))
    (fixtures / "alias.rtms").symlink_to(fixtures / "café.rtms")


if __name__ == "__main__":
    seed(Path(sys.argv[1]), Path(sys.argv[2]), Path(sys.argv[3]))
