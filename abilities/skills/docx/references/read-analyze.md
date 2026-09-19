# Read & Analyze

Always understand a document before editing it. Reading the raw XML is slow and
error-prone — use `docx_reader.py`, which reads straight from the `.docx` ZIP.

## Overview
```bash
python3 scripts/docx_reader.py file.docx
```
Reports: paragraph count (and non-empty), tables, images, sections,
headers/footers, number of headings, tracked insertions/deletions, and a word /
CJK-character count.

## Heading tree (acts like a TOC)
```bash
python3 scripts/docx_reader.py file.docx --outline
```
A paragraph counts as a heading when it has a `w:outlineLvl` or a `pStyle` like
`Heading1`/`1`. If the outline is empty but the document clearly has headings,
the heading styles are missing `outlineLvl` — see `troubleshooting.md`.

## Text preview
```bash
python3 scripts/docx_reader.py file.docx --preview 30
```
Prints the first 30 non-empty paragraphs as plain text (CJK shown natively).

## Verify an edit (diff)
```bash
python3 scripts/docx_reader.py new.docx --diff-against old.docx
```
- Flags structural change in table / image / section / header / footer counts
  (this is your damage detector).
- Lists changed paragraph lines (`-` old, `+` new) so you can confirm you
  changed only what you intended.

## What it does NOT do
It is a read tool. To change anything, unpack and use the editor scripts. It
intentionally never writes to the input file.
