"""Create fixture-only v1 cache entries using the writer's on-disk contract."""
import hashlib
import json
import os
import sys
import unicodedata
from pathlib import Path


def digest(data):
    return hashlib.sha256(data).hexdigest()


def fixture_pdf():
    objects = [
        b"<< /Type /Catalog /Pages 2 0 R >>",
        b"<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 960 540] /Resources << /Font << /F1 7 0 R >> >> /Contents 5 0 R >>",
        b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 960 540] /Resources << /Font << /F1 7 0 R >> >> /Contents 6 0 R >>",
    ]
    for drawing in (
        b"0.8 0.15 0.2 rg 0 0 480 540 re f 0.1 0.25 0.8 rg 480 0 480 540 re f "
        b"1 1 1 rg BT /F1 64 Tf 175 250 Td (PROOF SLIDE ONE) Tj ET",
        b"0.1 0.7 0.3 rg 0 0 960 540 re f 1 1 1 rg BT /F1 64 Tf 175 250 Td (PROOF SLIDE TWO) Tj ET",
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


def seed(root, fixtures):
    pdf = fixture_pdf()
    (fixtures / "expected.pdf").write_bytes(pdf)
    for name in ("café", "small", "stale", "mixed", "linked-file", "linked-entry", "oversize", "oversize-manifest", "missing"):
        source = fixtures / f"{name}.rtms"
        original = b"# Fixture\n\nPROOF ORIGINAL SOURCE\n"
        source.write_bytes(original)
        if name == "missing":
            continue
        path = unicodedata.normalize("NFC", os.path.realpath(source))
        entry = root / digest(path.encode("utf-8"))
        entry.mkdir(parents=True)
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
    seed(Path(sys.argv[1]), Path(sys.argv[2]))
