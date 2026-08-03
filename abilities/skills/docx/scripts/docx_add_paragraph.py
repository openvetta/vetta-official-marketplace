#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""docx_add_paragraph.py - Insert a paragraph into an unpacked docx dir.

Usage:
    python3 docx_add_paragraph.py /tmp/work --text "\u7b2c\u4e00\u7ae0" --style Heading1
    python3 docx_add_paragraph.py /tmp/work --text "..." --after-text "Introduction"
    python3 docx_add_paragraph.py /tmp/work --text "..." --style Normal --at end

Placement:
  --at end (default)   append before the body sectPr (so layout is preserved)
  --at start           insert as the first body paragraph
  --after-text STR     insert immediately after the first paragraph whose text
                       contains STR
--style names an existing style id (e.g. Heading1, Normal, a Chinese 公文 id).
If the style is a heading, pass --outline to also set the outline level so the
TOC / navigation pane pick it up.
"""
import sys
import os
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _docx_common as D
from _docx_common import W


def main():
    ap = argparse.ArgumentParser(description="Insert a paragraph")
    ap.add_argument("workdir")
    ap.add_argument("--text", required=True)
    ap.add_argument("--style")
    ap.add_argument("--outline", type=int)
    ap.add_argument("--at", choices=["end", "start"], default="end")
    ap.add_argument("--after-text")
    args = ap.parse_args()

    path = D.document_path(args.workdir)
    tree = D.parse(path)
    root = tree.getroot()
    body = D.get_body(root)
    if body is None:
        raise SystemExit("no w:body found")

    new_p = D.make_paragraph(args.text, style=args.style, outline=args.outline)

    if args.after_text:
        anchor = None
        for p in body.findall(W + "p"):
            if args.after_text in D.para_text(p):
                anchor = p
                break
        if anchor is None:
            raise SystemExit("anchor text not found: " + args.after_text)
        anchor.addnext(new_p)
    elif args.at == "start":
        first = body.find(W + "p")
        if first is not None:
            first.addprevious(new_p)
        else:
            body.insert(0, new_p)
    else:  # end: before trailing sectPr if present
        sect = body.find(W + "sectPr")
        if sect is not None:
            sect.addprevious(new_p)
        else:
            body.append(new_p)

    D.write(tree, path)
    print("inserted paragraph (" + (args.style or "Normal") + ")")
    return 0


if __name__ == "__main__":
    sys.exit(main())
