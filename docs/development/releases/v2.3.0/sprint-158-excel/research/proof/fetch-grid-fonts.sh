#!/bin/bash
# Carlito and Caladea (SIL OFL) from google/fonts, with their licences, into $1
set -euo pipefail
out="$1"
base='https://raw.githubusercontent.com/google/fonts/main/ofl'
for pair in carlito:Carlito caladea:Caladea; do
  fam="${pair%%:*}"; Fam="${pair##*:}"
  mkdir -p "$out/$fam"
  for n in "$Fam-Regular.ttf" "$Fam-Bold.ttf" "$Fam-Italic.ttf" "$Fam-BoldItalic.ttf" OFL.txt upstream_info.md METADATA.pb; do
    curl -sSfL -o "$out/$fam/$n" "$base/$fam/$n"
  done
done
ls -l "$out"/*
