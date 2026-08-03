---
name: docx
version: 2.0.0
description: "Create, edit, fill, reformat and convert Microsoft Word (.docx) documents with zero format loss, via a self-contained Python toolchain (lxml + python-docx + LibreOffice). Unpack -> edit XML in place -> repack preserves styles, headers/footers, sections, numbering, track-changes and images exactly. First-class support for Chinese / CJK documents and GB/T 9704 公文 layout."
license: MIT
category: document-processing
runtime: python3
triggers:
  - Word
  - docx
  - document
  - 文档
  - Word文档
  - 报告
  - 合同
  - 公文
  - 排版
  - 套模板
  - 论文
  - report
  - contract
  - proposal
  - template
  - mail merge
  - reformat
requirements:
  python:
    - python-docx
    - lxml
    - Pillow
  system:
    - libreoffice (soffice)
    - poppler-utils (pdftoppm)
  fonts:
    - Noto Sans CJK / Noto Serif CJK (recommended for CJK rendering)
---

# DOCX Skill

A complete, runnable toolkit for working with Word documents. It treats a
`.docx` as what it really is — a ZIP of XML parts — and edits only the bytes you
ask for. That **unpack → edit XML in place → repack** approach is the core idea:
it guarantees **zero format loss**, preserving styles, themes, headers/footers,
multi-section layouts, numbering, track-changes, fields and embedded images that
full regeneration would destroy. python-docx is used for clean creation;
LibreOffice + poppler give faithful PDF/PNG rendering so you can actually look
at the result.

Designed to work reliably in **Chinese / CJK** contexts: UTF-8 throughout,
run-aware find/replace, East-Asian font handling, the 字号 size table, and GB/T
9704 公文 layout guidance.

## Quick Start
```bash
# 0. once per session
python3 scripts/docx_doctor.py            # -> READY

# 1. READ
python3 scripts/docx_reader.py in.docx --outline

# 2. ACT (edit existing)
python3 scripts/docx_unpack.py in.docx /tmp/wd
python3 scripts/docx_replace_text.py /tmp/wd --find OLD --replace NEW
python3 scripts/docx_pack.py /tmp/wd out.docx

# 3. VERIFY
python3 scripts/docx_validate.py out.docx --report
python3 scripts/docx_reader.py out.docx --diff-against in.docx
python3 scripts/docx_render.py out.docx --out /tmp/rev      # LOOK at the PNG
```
Full walkthrough: `references/quickstart.md`.

## Task routing
Decide the pipeline by asking **"is there an input .docx?"** — details and a
flowchart in `references/decision-guide.md`.

| Pipeline | When | Read |
|----------|------|------|
| **A — CREATE** | No input file; write a new document | `references/create.md` |
| **B — FILL-EDIT** | Have a .docx; replace/fill/add content | `references/edit.md` |
| **C — FORMAT-APPLY** | Restyle or apply a template | `references/format.md` |

C has two strategies: **C-1 Overlay** (template is pure style) and **C-2
Base-Replace** (template carries structure). See `format.md`.

## The non-negotiable workflow: READ → ACT → VERIFY
1. **READ** with `docx_reader.py` before touching anything.
2. **ACT** by editing the unpacked XML (or building with python-docx).
3. **VERIFY** — every output must pass:
   - `docx_validate.py` (element-order gate, exit 0), and
   - `docx_reader.py --diff-against` (changed only what you intended), and
   - `docx_render.py` (LOOK at the rendered PNG — layout/fonts/overflow).
   Never deliver a file you have not validated and rendered.

## Critical rules (full detail in references)
- **Element order** (`validate.md`, `openxml-element-order.md`): `w:pPr` first
  in `w:p`; `w:rPr` first in `w:r`; `w:tcPr` first and ≥1 `w:p` in `w:tc`;
  `w:sectPr` LAST in `w:body`. Insert trailing content before the body sectPr.
- **Headings need `w:outlineLvl`** (H1→0, H2→1, H3→2) or they vanish from the
  TOC / navigation pane.
- **Track changes**: `w:ins` holds `w:t`; `w:del` holds `w:delText`.
- **Units** (`openxml-units.md`): font `w:sz` = points×2 (half-points); lengths
  in dxa/twips (1in=1440, 1cm≈567); images in EMU (1cm=360000).
- **CJK** (`cjk-guide.md`): set `w:rFonts w:eastAsia`; use the 字号 table; for
  公文 follow GB/T 9704 (仿宋_GB2312 三号 body, 黑体 headings). LibreOffice
  substitutes missing Chinese fonts with Noto for rendering — the stored font
  name stays correct.
- **Prefer editing over regenerating** — it is the only way to keep zero format
  loss.

## Scripts (`scripts/`)
| Script | Purpose |
|--------|---------|
| `docx_doctor.py` | Environment self-check (deps, soffice, poppler, CJK fonts) |
| `docx_reader.py` | Overview / `--outline` / `--preview` / `--diff-against` |
| `docx_unpack.py` | Unzip .docx → working dir |
| `docx_pack.py` | Repack working dir → .docx |
| `docx_replace_text.py` | Run-aware find/replace (`--regex`, `--parts all`) |
| `docx_fill_placeholders.py` | Fill template placeholders from JSON |
| `docx_add_paragraph.py` | Insert paragraph/heading (`--style`,`--outline`,`--after-text`) |
| `docx_merge_runs.py` | Consolidate fragmented same-format runs |
| `docx_validate.py` | Element-order / content gate-check (exit 0/1) |
| `docx_render.py` | Render to PDF + per-page PNG |
| `libreoffice_convert.py` | Convert .doc/.odt/.rtf→.docx, or →PDF |
| `_docx_common.py` | Shared XML helpers (import, not a CLI) |

## References (`references/`)
`quickstart.md` · `decision-guide.md` · `read-analyze.md` · `create.md` ·
`edit.md` · `format.md` · `validate.md` · `visual-review.md` · `cjk-guide.md` ·
`openxml-element-order.md` · `openxml-units.md` · `troubleshooting.md`

## Templates (`templates/`)
`minimal_docx/` — a minimal valid unpacked package you can copy, edit and pack
as a starting point.
