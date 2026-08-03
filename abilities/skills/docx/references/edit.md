# Pipeline B: Fill & Edit an existing document

Goal: change content while preserving everything else exactly. Always work on
an unpacked package and edit the XML in place — never regenerate the file.

## The loop
```bash
python3 scripts/docx_reader.py in.docx --preview 30   # see what's there
python3 scripts/docx_unpack.py in.docx /tmp/wd
# ... edits ...
python3 scripts/docx_pack.py /tmp/wd out.docx
python3 scripts/docx_validate.py out.docx --report
python3 scripts/docx_reader.py out.docx --diff-against in.docx
python3 scripts/docx_render.py out.docx --out /tmp/rev
```

## Text replacement (run-aware)
```bash
python3 scripts/docx_replace_text.py /tmp/wd --find "2024" --replace "2025"
python3 scripts/docx_replace_text.py /tmp/wd --find "v[0-9]+" --replace "v2" --regex
python3 scripts/docx_replace_text.py /tmp/wd --find "公司" --replace "本公司" --parts all
```
Word splits text across runs, so per-run replace misses matches. This collapses
a paragraph's runs only when there is a hit and keeps the first run's
formatting. `--parts all` also covers headers/footers.

## Template placeholder fill
Given a template containing placeholders (default delimiter: a pair of curly
braces, configurable with `--open`/`--close`):
```bash
python3 scripts/docx_fill_placeholders.py /tmp/wd \
    --data '{"name":"张三","date":"2026-06-09","amount":"¥100,000"}'
# or from a file, with custom delimiters:
python3 scripts/docx_fill_placeholders.py /tmp/wd --data-file vals.json --open "[[" --close "]]"
```
It reports any placeholder it never matched — investigate those (often a typo or
a placeholder split oddly across runs that needs `docx_merge_runs.py` first).

## Add content
```bash
python3 scripts/docx_add_paragraph.py /tmp/wd --text "五、附则" --style Heading1 --outline 0
python3 scripts/docx_add_paragraph.py /tmp/wd --text "补充说明……" --after-text "附则"
python3 scripts/docx_add_paragraph.py /tmp/wd --text "前言" --at start
```
`--at end` inserts before the trailing `sectPr` so page layout is preserved.

## Tracked changes
When editing a document under review, remember the asymmetry: `w:ins` carries
`w:t`, `w:del` carries `w:delText`. `docx_validate.py` enforces this. Don't move
text between them by hand without fixing the element type.

## Tidy before validating
`docx_merge_runs.py` collapses fragmented same-format runs — useful after heavy
editing and before delivering. It never touches runs with breaks/tabs/fields.
