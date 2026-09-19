#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""docx_merge_runs.py - Consolidate adjacent runs with identical formatting.

Usage:
    python3 docx_merge_runs.py /tmp/work [--parts all]

Word (and naive edits) often fragment a sentence into many runs that share the
exact same rPr. Merging them yields cleaner XML, smaller files, and makes
subsequent find/replace and style edits far more reliable. Only plain-text runs
with byte-identical rPr are merged; runs with breaks, tabs, fields or tracked
changes are left untouched. Optionally run before validation.
"""
import sys
import os
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _docx_common as D


def main():
    ap = argparse.ArgumentParser(description="Merge adjacent equal-format runs")
    ap.add_argument("workdir")
    ap.add_argument("--parts", choices=["document", "all"], default="document")
    args = ap.parse_args()

    total = 0
    for path in D.part_paths(args.workdir, args.parts):
        tree = D.parse(path)
        root = tree.getroot()
        n = 0
        for p in D.paragraphs(root):
            n += D.merge_runs(p)
        if n:
            D.write(tree, path)
        total += n
    print("merged " + str(total) + " run pair(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
