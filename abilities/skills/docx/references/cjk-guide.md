# CJK & 中文公文 Handbook

This skill is built to work reliably on Chinese (and Japanese/Korean) documents.
Everything in the package is UTF-8 end to end, so CJK text round-trips through
unpack → edit → pack with zero corruption. The points below are what actually
matters when producing professional Chinese documents.

## 1. Fonts: you MUST set the East-Asian font
In OpenXML a run font is set with `w:rFonts`. For CJK you must set the
`w:eastAsia` attribute — setting only `w:ascii` leaves Chinese characters on the
default font.
```xml
<w:rPr><w:rFonts w:ascii="Times New Roman" w:eastAsia="仿宋" w:hAnsi="Times New Roman"/></w:rPr>
```
python-docx equivalent:
```python
from docx.oxml.ns import qn
rpr = run._element.get_or_add_rPr()
rf = rpr.get_or_add_rFonts()
rf.set(qn("w:eastAsia"), "仿宋")          # or 黑体 / 楷体 / 宋体
rf.set(qn("w:ascii"), "Times New Roman")
```

### Font availability in this sandbox
Installed: **Noto Sans CJK SC/TC/JP/KR** and **Noto Serif CJK**. NOT installed:
SimSun(宋体), FangSong(仿宋), SimHei(黑体), KaiTi(楷体), Microsoft YaHei.
- It is correct to *specify* the real Chinese font names (仿宋/黑体/楷体) in the
  XML — a user opening the file in Word on Windows gets the true font.
- For rendering/PDF here, LibreOffice automatically substitutes a Noto CJK face,
  so the PNG/PDF is readable. Don't be alarmed that the preview font differs
  slightly from Windows; the stored font name is still correct.

## 2. 字号 ↔ point ↔ half-point (`w:sz`) table
`w:sz` is in HALF-points, so `w:sz w:val` = points × 2.

| 字号 | 磅值(pt) | `w:sz` | | 字号 | 磅值(pt) | `w:sz` |
|------|---------|--------|---|------|---------|--------|
| 初号 | 42 | 84 | | 小四 | 12 | 24 |
| 小初 | 36 | 72 | | 五号 | 10.5 | 21 |
| 一号 | 26 | 52 | | 小五 | 9 | 18 |
| 小一 | 24 | 48 | | 六号 | 7.5 | 15 |
| 二号 | 22 | 44 | | 小六 | 6.5 | 13 |
| 小二 | 18 | 36 | | 七号 | 5.5 | 11 |
| 三号 | 16 | 32 | | 八号 | 5 | 10 |
| 小三 | 15 | 30 | | | | |
| 四号 | 14 | 28 | | | | |

## 3. GB/T 9704 — 党政机关公文 layout
Standard for Chinese official documents:
- **Page**: A4 (210×297mm). Margins — 上 37mm, 下 35mm, 左 28mm, 右 26mm
  (版心 156×225mm).
- **标题 (title)**: 方正小标宋 / 黑体, 二号 (`w:sz` 44), centered.
- **正文 (body)**: 仿宋_GB2312, 三号 (`w:sz` 32).
- **一级标题**: 黑体 三号; **二级**: 楷体 三号; **三级/四级**: 仿宋 三号 (加粗).
- **行距**: typically 28—30 磅 fixed line spacing (每页 22 lines).
- **页码**: 宋体/仿宋 四号, bottom outer.

Set line spacing as fixed (`w:spacing w:line="560" w:lineRule="exact"`; line is
in twentieths of a point, so 28pt = 560).

## 4. Full-width / half-width normalization
Mixed-width digits and punctuation are common in pasted Chinese text. Normalize
with NFKC when you need consistency:
```python
import unicodedata
clean = unicodedata.normalize("NFKC", raw)   # Ａ２３ -> A23, ，； stay as CJK punct
```
Apply judiciously — NFKC converts full-width Latin/digits to half-width but keeps
CJK punctuation, which is usually what you want for numbers but not for prose.

## 5. XML text-escaping
Text goes into `w:t`. The editor scripts handle escaping via lxml, but if you
hand-edit XML, escape `&` `<` `>` and keep `xml:space="preserve"` on runs whose
text has leading/trailing spaces.

## 6. Always render CJK output
Missing-glyph (tofu) problems only show in a render. After any CJK edit run
`docx_render.py` and confirm characters display — see `visual-review.md`.
