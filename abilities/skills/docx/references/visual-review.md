# Visual review — always LOOK at the result

Structural validation cannot see layout. A file can be perfectly valid yet have
overflowing tables, missing CJK glyphs (tofu boxes), wrong fonts, or broken page
breaks. After every create/edit, render and actually inspect the image.

```bash
python3 scripts/docx_render.py file.docx --out /tmp/rev
python3 scripts/docx_render.py file.docx --pages 1-3 --out /tmp/rev   # subset
```
Produces a PDF (LibreOffice) and one PNG per page (poppler). Open the PNGs.

## Checklist
- **Fonts**: CJK text renders as real characters, not boxes. Headings/body use
  the intended typeface (LibreOffice may substitute — see `cjk-guide.md`).
- **Layout**: margins, columns and page size look right (A4 for most CN docs).
- **Tables**: no content spilling outside cells or off the page.
- **Headings/TOC**: heading hierarchy looks correct; a generated TOC shows
  entries (if the TOC field hasn't recalculated, open in Word once — LibreOffice
  may not auto-update fields).
- **Headers/footers & page numbers**: present on the right pages; first-page /
  section differences respected.
- **Spacing**: no giant gaps or overlapping lines.

## Compare before / after
Render both the input and your output and eyeball them side by side, and run
`docx_reader.py out.docx --diff-against in.docx` to confirm only the intended
text changed and no tables/sections/images were lost.

## Notes
- Default raster is 110 DPI; raise it by editing the `-r` flag in the script if
  you need to read fine print.
- A render is mandatory for anything formal (公文, contracts, reports) before
  you hand the file back.
