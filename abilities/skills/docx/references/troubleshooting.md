# Troubleshooting

## File won't open in Word / "unreadable content"
Almost always an element-order or content-model violation. Run
`docx_validate.py file.docx --report` and fix what it lists. Most common:
- `pPr`/`rPr` not the first child → `D.ensure_ppr_first` / `D.ensure_rpr_first`.
- body `sectPr` not last → move it to the end; insert content before it.
- empty table cell (`w:tc` with no `w:p`) → add an empty paragraph.
- bad XML escaping after a hand edit → escape `&` `<` `>`; re-run validate.

## Find/replace matched nothing
The phrase is split across runs with differing formatting, OR you passed shell
`\uXXXX` escapes literally. Fixes:
- Pass real characters on the CLI (the terminal is UTF-8): `--find “旧稿”` not
  `--find '\u65e7'`.
- Run `docx_merge_runs.py /tmp/wd` first to consolidate runs, then replace.
- For data passed as JSON (`--data`), `\uXXXX` IS valid — JSON decodes it.

## Placeholder never matched
`docx_fill_placeholders.py` prints which keys it didn't find. Causes: delimiter
mismatch (use `--open`/`--close`), the placeholder is split across runs (run
`docx_merge_runs.py` first), or it lives in a header/footer (default already
scans `--parts all`).

## Headings don't show in the navigation pane / TOC
The heading style is missing `w:outlineLvl`. Add it (H1→0…) — see
`openxml-element-order.md`. When inserting headings use
`docx_add_paragraph.py --style Heading1 --outline 0`.

## Chinese shows as boxes (tofu) in the render
The glyph's font isn't available to LibreOffice. The stored font name can still
be correct for Windows users; for the local render, rely on the bundled Noto CJK
substitution. If boxes persist, set `w:eastAsia` explicitly (see `cjk-guide.md`)
— a run with no eastAsia font can fall back to a non-CJK face.

## Fonts look wrong in the PDF but the file is correct
LibreOffice substitutes missing Windows fonts (SimSun/FangSong/SimHei) with Noto
CJK. This is expected in the sandbox; the `.docx` keeps the real font name. Open
in Word on a machine with the fonts to see the true rendering.

## TOC field is empty after generating
LibreOffice may not auto-recalculate field codes. The TOC populates when the
document is opened/updated in Word (or force a field update). The TOC field
itself is present and correct.

## Legacy .doc won't unpack
`.doc` is the old binary format, not a ZIP. Convert first:
`python3 scripts/libreoffice_convert.py old.doc --to docx`.

## Tracked-changes validation error
`w:ins` must contain `w:t`; `w:del` must contain `w:delText`. Don't move text
between them without switching the element type.

## Render step fails
Run `docx_doctor.py`. If soffice/pdftoppm are missing the env isn't ready. A
stray `soffice` lock can block conversion — retry, or remove `~/.config`
LibreOffice profile locks.

## Harmless noise
`Exception ignored in: <function ZipFile.__del__ ...>` on interpreter shutdown
is cosmetic and does not affect output.
