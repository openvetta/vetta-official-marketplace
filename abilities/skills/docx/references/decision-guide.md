# Decision Guide — pick the right pipeline

Route by one question: **do you have an input `.docx`?**

```
User task
├─ No input file  → Pipeline A: CREATE
│    signals: "write / create / draft / generate / new / make a report|proposal|memo"
│    → read create.md  (build with python-docx, then VERIFY)
│
└─ Has input .docx
     ├─ Replace / fill / modify content → Pipeline B: FILL-EDIT
     │    signals: "fill in / replace / update / change text / add section / edit"
     │    → read edit.md  (unpack → edit → pack → VERIFY)
     │
     └─ Reformat / apply style / match a template → Pipeline C: FORMAT-APPLY
          signals: "reformat / apply template / restyle / 套模板 / 排版"
          ├─ Template is pure style (no content) → C-1 OVERLAY
          │    copy template styles.xml into the source package; strip direct
          │    formatting from body paragraphs so styles win.
          └─ Template has structure (cover / TOC / sample sections) → C-2 BASE-REPLACE
               use the TEMPLATE as the output base and replace its sample
               content — this preserves every section, header/footer and
               titlePg automatically.
          → read format.md
```

If a request spans pipelines, run them in order (e.g. CREATE then FORMAT-APPLY).

## Simple vs structural
Within any pipeline, choose the lightest tool that does the job:

| Situation | Approach |
|-----------|----------|
| Plain text edits, placeholder fill | `docx_replace_text.py` / `docx_fill_placeholders.py` |
| Add a heading/paragraph | `docx_add_paragraph.py` |
| Brand-new document, simple-to-moderate layout | python-docx (`create.md`) |
| Surgical structural change preserving everything else | unpack → lxml edit → pack |
| Multi-section thesis / 10+ headers-footers / 公文 | C-2 Base-Replace + `cjk-guide.md` |

## Golden rules
- Prefer editing XML in an unpacked package over regenerating the file — it is
  the only way to guarantee zero format loss.
- Never hand-write ``-style raw XML you haven't validated; always run
  `docx_validate.py` after.
- Always finish with a render (`docx_render.py`) and actually look at it.
