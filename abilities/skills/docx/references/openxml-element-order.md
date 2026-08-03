# OpenXML element order (WordprocessingML)

Word is strict about child-element order. Wrong order = corrupt file or dropped
formatting. `docx_validate.py` enforces the critical cases; this is the
reference.

## Paragraph `w:p`
```
w:p
 ├─ w:pPr        (OPTIONAL, but if present MUST be FIRST and only one)
 └─ content     w:r | w:hyperlink | w:ins | w:del | w:bookmarkStart/End | ...
```
`w:pPr` children also have an order; the common ones:
```
w:pPr
 ├─ w:pStyle
 ├─ w:numPr
 ├─ w:spacing
 ├─ w:ind
 ├─ w:jc
 └─ w:outlineLvl     (REQUIRED on heading styles for TOC/navigation)
```

## Run `w:r`
```
w:r
 ├─ w:rPr        (OPTIONAL, but if present MUST be FIRST)
 └─ content     w:t | w:br | w:tab | w:cr | w:drawing | w:delText | ...
```
Keep `xml:space="preserve"` on `w:t` whose text has significant leading/trailing
whitespace.

## Table `w:tbl`
```
w:tbl
 ├─ w:tblPr      (FIRST)
 ├─ w:tblGrid    (defines columns; must match cells per row)
 └─ w:tr ...
```
```
w:tr
 ├─ w:trPr       (optional, first)
 └─ w:tc ...
```
```
w:tc
 ├─ w:tcPr       (optional, first)
 └─ w:p ...       (AT LEAST ONE required — a cell may not be paragraph-less)
```

## Body `w:body`
```
w:body
 ├─ content      paragraphs, tables, ...
 └─ w:sectPr     (MUST be the LAST child of the body)
```
Insert new trailing content BEFORE the body `sectPr`. Each mid-document section
break is a `w:sectPr` inside the last paragraph's `w:pPr` of that section — leave
those in place when restructuring.

## Heading styles need an outline level
A heading is recognized by `w:outlineLvl w:val` (H1→0, H2→1, H3→2, …). A style
named "Heading 1" WITHOUT an outline level renders bold but does NOT appear in
the navigation pane / TOC. Always set it (the editor's `make_paragraph(...,
outline=n)` does this for you).

## Golden rule
When in doubt, build the element with its property block first, then children,
and run `docx_validate.py`. The helpers `ensure_ppr_first` / `ensure_rpr_first`
fix the two most common order mistakes.
