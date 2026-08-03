# Pipeline A: Create a new document

No input file → build from scratch. Use **python-docx** for simple-to-moderate
documents; drop to lxml/XML only for structures python-docx can't express.

## Minimal scaffold
```python
import docx
from docx.shared import Pt, Cm, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH

d = docx.Document()                 # or docx.Document("templates/...") to inherit styles
d.add_heading("报告标题", level=0)
d.add_heading("一、背景", level=1)
d.add_paragraph("正文段落。")

# table
t = d.add_table(rows=2, cols=2); t.style = "Table Grid"
t.cell(0,0).text = "科目"; t.cell(0,1).text = "金额"

d.save("output.docx")
```

## Page setup (per section)
```python
sec = d.sections[0]
sec.page_height, sec.page_width = Cm(29.7), Cm(21.0)   # A4 portrait
sec.top_margin = sec.bottom_margin = Cm(2.54)
sec.left_margin = sec.right_margin = Cm(3.18)
```

## Headings must be navigable
`add_heading(text, level=n)` already applies a Heading style with the right
outline level, so the TOC / navigation pane works. If you build heading styles
by hand, you MUST set the outline level (see `openxml-element-order.md` and
`troubleshooting.md`), or Word treats them as plain styled text.

## CJK documents
For Chinese/Japanese/Korean text set BOTH the ASCII and East-Asian font, page
size A4, and proper line spacing. See `cjk-guide.md` for the full handbook
(GB/T 9704 公文 layout, 字号 size table, 仿宋/黑体/楷体 mapping).

## Then VERIFY
```bash
python3 scripts/docx_validate.py output.docx --report
python3 scripts/docx_render.py  output.docx --out /tmp/rev
```
Validation should be clean; the render PNG should look right. For anything
formal, treat the render as mandatory.

## When to go structural (lxml)
Multi-section layouts with differing headers/footers, complex merged-cell
tables, precise field codes (TOC/SEQ/STYLEREF), or copying parts between
documents — build the base with python-docx, then unpack and edit the XML, or
use C-2 Base-Replace from a template. See `format.md`.
