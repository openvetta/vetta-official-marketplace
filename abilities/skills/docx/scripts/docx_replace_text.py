#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""docx_replace_text.py - Run-aware find/replace on an unpacked workbook dir.

Usage:
    python3 docx_replace_text.py /tmp/work --find OLD --replace NEW
    python3 docx_replace_text.py /tmp/work --find '\\bv1\\b' --replace v2 --regex
    python3 docx_replace_text.py /tmp/work --find X --replace Y --parts all

Word often splits a phrase across several runs, so a naive per-run replace
misses matches. This collapses each paragraph's runs only when a match is
found, writing the result into the first run (its formatting is kept) and
clearing the rest. CJK text is handled natively (UTF-8 throughout).

--parts document (default) edits word/document.xml only;
--parts all also edits every header*.xml / footer*.xml.
"""
import sys
import os
import re
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _docx_common as D


def main():
    ap = argparse.ArgumentParser(description="Find/replace text in a docx dir")
    ap.add_argument("workdir")
    ap.add_argument("--find", required=True)
    ap.add_argument("--replace", required=True)
    ap.add_argument("--regex", action="store_true")
    ap.add_argument("--parts", choices=["document", "all"], default="document")
    args = ap.parse_args()

    pat = re.compile(args.find) if args.regex else None
    total = 0
    for path in D.part_paths(args.workdir, args.parts):
        tree = D.parse(path)
        root = tree.getroot()
        changed = False
        for p in D.paragraphs(root):
            text = D.para_text(p)
            if not text:
                continue
            if args.regex:
                new, n = pat.subn(args.replace, text)
            else:
                n = text.count(args.find)
                new = text.replace(args.find, args.replace) if n else text
            if n:
                D.set_para_text(p, new)
                total += n
                changed = True
        if changed:
            D.write(tree, path)
    print("replaced " + str(total) + " occurrence(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
