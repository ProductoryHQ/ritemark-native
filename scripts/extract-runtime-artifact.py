#!/usr/bin/env python3
"""Extract a runtime archive without allowing links or paths outside output."""

from __future__ import annotations

import os
import pathlib
import shutil
import stat
import sys
import tarfile
import zipfile


def safe_name(name: str) -> pathlib.PurePosixPath:
    normalized = name.replace("\\", "/")
    path = pathlib.PurePosixPath(normalized)
    if path.is_absolute() or ".." in path.parts or not path.parts:
        raise ValueError(f"unsafe archive path: {name}")
    return path


def output_path(root: pathlib.Path, name: str) -> pathlib.Path:
    path = safe_name(name)
    destination = root.joinpath(*path.parts)
    destination.parent.mkdir(parents=True, exist_ok=True)
    return destination


def extract_tar(archive: pathlib.Path, root: pathlib.Path) -> None:
    with tarfile.open(archive, "r:*") as source:
        for member in source.getmembers():
            destination = output_path(root, member.name)
            if member.isdir():
                destination.mkdir(parents=True, exist_ok=True)
                continue
            if not member.isfile():
                raise ValueError(f"unsupported tar member type: {member.name}")
            extracted = source.extractfile(member)
            if extracted is None:
                raise ValueError(f"could not read tar member: {member.name}")
            with extracted, destination.open("wb") as target:
                shutil.copyfileobj(extracted, target)
            os.chmod(destination, member.mode & 0o777)


def extract_zip(archive: pathlib.Path, root: pathlib.Path) -> None:
    with zipfile.ZipFile(archive) as source:
        for member in source.infolist():
            destination = output_path(root, member.filename)
            mode = member.external_attr >> 16
            if stat.S_ISLNK(mode):
                raise ValueError(f"unsupported zip symlink: {member.filename}")
            if member.is_dir():
                destination.mkdir(parents=True, exist_ok=True)
                continue
            with source.open(member) as extracted, destination.open("wb") as target:
                shutil.copyfileobj(extracted, target)
            if mode:
                os.chmod(destination, mode & 0o777)


def main() -> int:
    if len(sys.argv) != 4:
        print("usage: extract-runtime-artifact.py <tar.gz|zip> <archive> <output>", file=sys.stderr)
        return 2
    archive_format, archive_name, output_name = sys.argv[1:]
    archive = pathlib.Path(archive_name)
    output = pathlib.Path(output_name)
    output.mkdir(parents=True, exist_ok=True)
    if archive_format == "tar.gz":
        extract_tar(archive, output)
    elif archive_format == "zip":
        extract_zip(archive, output)
    else:
        raise ValueError(f"unsupported archive format: {archive_format}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
