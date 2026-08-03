# Quick Start (READ → ACT → VERIFY)

The whole skill in 60 seconds. Every task follows the same loop.

## 0. Once per session
```bash
python3 scripts/docx_doctor.py    # must print READY
```

## 1. READ — understand before you touch
```bash
python3 scripts/docx_reader.py input.docx              # structure overview
python3 scripts/docx_reader.py input.docx --outline    # heading tree (TOC)
python3 scripts/docx_reader.py input.docx --preview 20 # first 20 paragraphs
```
Legacy `.doc`? Convert first:
```bash
python3 scripts/libreoffice_convert.py old.doc --to docx --outdir .
```

## 2. ACT — unpack, edit XML in place, repack
This unpack → edit → pack flow is the heart of the skill: it touches only the
bytes you ask for, so styles, headers/footers, sections, numbering,
track-changes and images are preserved exactly (zero format loss).
```bash
python3 scripts/docx_unpack.py input.docx /tmp/wd

# pick the edit(s) you need:
python3 scripts/docx_replace_text.py     /tmp/wd --find OLD --replace NEW
python3 scripts/docx_fill_placeholders.py /tmp/wd --data '{"name":"张三"}'
python3 scripts/docx_add_paragraph.py    /tmp/wd --text "第三章" --style Heading1 --outline 0
python3 scripts/docx_merge_runs.py       /tmp/wd       # optional cleanup

python3 scripts/docx_pack.py /tmp/wd output.docx
```
Creating from scratch instead of editing? See `create.md` (python-docx).

## 3. VERIFY — never deliver unverified
```bash
python3 scripts/docx_validate.py output.docx --report        # element-order gate
python3 scripts/docx_reader.py  output.docx --diff-against input.docx  # changed only what you meant
python3 scripts/docx_render.py  output.docx --out /tmp/rev    # LOOK at the PNG
```
`validate` must exit clean. `diff` must show no structural damage. The render
PNG must look right (fonts, layout, no overflow) — especially for CJK.

## Cheat sheet
| Goal | Script |
|------|--------|
| Inspect / preview / outline | `docx_reader.py` |
| `.doc`/`.odt` → `.docx`, or → PDF | `libreoffice_convert.py` |
| Open package for editing | `docx_unpack.py` |
| Find/replace (run-aware, CJK) | `docx_replace_text.py` |
| Fill template placeholders | `docx_fill_placeholders.py` |
| Add a paragraph / heading | `docx_add_paragraph.py` |
| Tidy fragmented runs | `docx_merge_runs.py` |
| Strip direct formatting | (helper in `_docx_common.py`) |
| Repack to .docx | `docx_pack.py` |
| Element-order gate-check | `docx_validate.py` |
| Render to PDF + PNG | `docx_render.py` |
| Environment self-check | `docx_doctor.py` |
