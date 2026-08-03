# OpenXML units cheat-sheet (WordprocessingML)

Word uses several different unit systems. Using the wrong one is a frequent
source of "why is my margin huge / font tiny" bugs.

## Font size — half-points (`w:sz`, `w:szCs`)
`val` = points × 2.
- 12pt → 24, 10.5pt(五号) → 21, 16pt(三号) → 32, 22pt(二号) → 44.
See `cjk-guide.md` for the full 字号 table.

## Lengths — twips / DXA (1/20 point)
Used by margins, indents, spacing, table widths, page size.
- 1 inch  = 1440 dxa
- 1 point = 20 dxa
- 1 cm    ≈ 567 dxa  (566.93)
- 1 mm    ≈ 56.7 dxa
Examples: A4 page = 11906 × 16838 dxa; 2.54cm margin ≈ 1440 dxa.

## Line spacing (`w:spacing`)
- `w:line` is in twentieths of a point when `w:lineRule="exact"` or `"atLeast"`.
  28pt fixed line = 560.
- When `w:lineRule="auto"`, `w:line` is in 240ths (240 = single, 360 = 1.5,
  480 = double).
- `w:before` / `w:after` (space above/below paragraph) are in dxa (twips).

## Images / drawings — EMU (English Metric Unit)
- 1 inch = 914400 EMU
- 1 cm   = 360000 EMU
- 1 point = 12700 EMU
- 1 pixel @96dpi = 9525 EMU
python-docx `Inches`, `Cm`, `Pt`, `Emu` helpers do this for you:
```python
from docx.shared import Inches, Cm, Pt, Emu
run.add_picture("img.png", width=Cm(8))
```

## Percentages (table width `w:tblW w:type="pct"`)
Fiftieths of a percent: 5000 = 100%.

## Colors
Hex RGB without `#`: `w:color w:val="FF0000"` = red. `auto` = automatic.

## Booleans
Toggle properties (`w:b`, `w:i`, `w:strike`) are on when present; set
`w:val="0"` / `"false"` to force off (e.g. to override a style).

## Quick Python conversions
```python
def pt_to_sz(pt):  return int(round(pt * 2))        # font half-points
def cm_to_dxa(cm): return int(round(cm * 567))       # length twips
def in_to_dxa(i):  return int(round(i * 1440))
def cm_to_emu(cm): return int(round(cm * 360000))    # image
```
