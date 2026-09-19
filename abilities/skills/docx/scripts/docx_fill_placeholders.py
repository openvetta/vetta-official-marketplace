#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""docx_fill_placeholders.py - Replace {key} placeholders with data values.

Usage:
    python3 docx_fill_placeholders.py /tmp/work --data '{"name":"\u5f20\u4e09"}'
    python3 docx_fill_placeholders.py /tmp/work --data-file data.json --open '[[' --close ']]'

Default delimiters are double curly braces; override with --open/--close.
Placeholders may span multiple runs (common in Word) - each paragraph's runs
are collapsed only when a placeholder is present, preserving the first run's
formatting. Values are inserted as plain text (UTF-8, CJK-safe).
"""
import sys
import os
import json
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _docx_common as D


def main():
    ap = argparse.ArgumentParser(description="Fill placeholders in a docx dir")
    ap.add_argument("workdir")
    ap.add_argument("--data", help="inline JSON object of key->value")
    ap.add_argument("--data-file", help="path to a JSON file")
    ap.add_argument("--open", dest="open_d", default=("{" * 2))
    ap.add_argument("--close", dest="close_d", default=("}" * 2))
    ap.add_argument("--parts", choices=["document", "all"], default="all")
    args = ap.parse_args()

    if args.data_file:
        with open(args.data_file, encoding="utf-8") as f:
            data = json.load(f)
    elif args.data:
        data = json.loads(args.data)
    else:
        raise SystemExit("provide --data or --data-file")

    mapping = {(args.open_d + str(k) + args.close_d): str(v)
               for k, v in data.items()}
    total = 0
    filled_keys = set()
    for path in D.part_paths(args.workdir, args.parts):
        tree = D.parse(path)
        root = tree.getroot()
        changed = False
        for p in D.paragraphs(root):
            text = D.para_text(p)
            if not text:
                continue
            new = text
            for ph, val in mapping.items():
                if ph in new:
                    new = new.replace(ph, val)
                    filled_keys.add(ph)
                    total += 1
            if new != text:
                D.set_para_text(p, new)
                changed = True
        if changed:
            D.write(tree, path)
    missing = [k for k in mapping if k not in filled_keys]
    print("filled " + str(total) + " placeholder occurrence(s)")
    if missing:
        print("WARNING: never matched: " + ", ".join(missing))
    return 0


if __name__ == "__main__":
    sys.exit(main())
