# Validation gate

OpenXML is strict about element ORDER and a few content rules. Violations make
Word refuse to open the file or silently drop content. `docx_validate.py` is the
gate every edited/created file must pass before delivery.

```bash
python3 scripts/docx_validate.py file.docx            # summary, exit 0 / 1
python3 scripts/docx_validate.py file.docx --report   # list every issue
```

## What it checks
| Rule | Why |
|------|-----|
| `w:p` → `pPr` is the FIRST child (and only one) | misordered pPr corrupts the paragraph |
| `w:r` → `rPr` is the FIRST child | misordered rPr drops run formatting |
| `w:tc` → `tcPr` first, and ≥ 1 `w:p` | a cell with no paragraph is invalid |
| `w:body` → `sectPr` is the LAST child | section props must close the body |
| `w:del` uses `w:delText`; `w:ins` uses `w:t` | tracked-change text-element asymmetry |
| every XML part is well-formed | catches broken escapes / encoding |

It scans `word/document.xml` plus every `header*.xml`, `footer*.xml`,
`styles.xml`, and `numbering.xml`.

## Exit codes
- `0` — clean. Safe to proceed.
- `1` — issues found. Fix them; do not deliver.

## Typical fixes
- pPr/rPr not first → use the helpers `D.ensure_ppr_first(p)` /
  `D.ensure_rpr_first(r)`, or rebuild the element with the property block first.
- empty `w:tc` → add an empty `w:p` to the cell.
- sectPr not last → move it to the end of the body (insertions should go
  *before* it; `docx_add_paragraph.py --at end` already does this).
- del/ins mismatch → convert `w:t`↔`w:delText` to match the wrapper.

Validation proves structural integrity, not visual correctness — always pair it
with a render (`visual-review.md`).
