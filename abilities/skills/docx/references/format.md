# Pipeline C: Format-Apply (restyle / apply a template)

Goal: make a document follow a target style/template. Two strategies — pick by
whether the template carries only styles or also structure.

## C-1 OVERLAY — template is pure style (no sample content)
Apply the template's look to the source's existing content.
1. Unpack both the source and the template.
2. Copy the template's `word/styles.xml` (and `theme/theme1.xml`,
   `numbering.xml` if present) into the source package.
3. Ensure `[Content_Types].xml` and `word/_rels/document.xml.rels` reference
   those parts (they normally already do).
4. Strip direct (inline) formatting from the body so the styles actually win.
   Use the helper:
   ```python
   import _docx_common as D
   tree = D.parse("/tmp/wd/word/document.xml"); root = tree.getroot()
   for p in D.paragraphs(root):
       D.strip_direct_formatting(p, keep_pstyle=True)  # keeps pStyle/numPr + rStyle
   D.write(tree, "/tmp/wd/word/document.xml")
   ```
5. Pack → validate → render.

Why strip: direct rPr/pPr on runs and paragraphs overrides styles, so without
stripping the template appears to "not apply". Keep only the style references.

## C-2 BASE-REPLACE — template has structure (cover / TOC / sections)
Use the TEMPLATE as the output base and pour the source content into it. This
is the safest way to inherit multi-section layouts, differing headers/footers,
title pages and page numbering.
1. Work from a copy of the template.
2. Map source sections to the template's sample sections.
3. Replace sample body text with real content via `docx_replace_text.py` /
   `docx_fill_placeholders.py`, or by swapping the body paragraphs while keeping
   the trailing `sectPr` of each section intact.
4. Keep each section's final `sectPr` (it stores page size, margins,
   header/footer references) — never delete it.
5. Pack → validate → render every page.

## Heading styles must stay navigable
When restyling, ensure heading styles keep their `w:outlineLvl` (H1→0, H2→1,
H3→2 …). If the template's heading styles lack it, the TOC/navigation breaks —
see `troubleshooting.md`.

## CJK / 公文 templates
For Chinese government/【公文】or academic templates, font substitution and
字号 sizing matter — read `cjk-guide.md` before applying.
