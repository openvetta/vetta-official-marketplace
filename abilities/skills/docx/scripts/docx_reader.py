#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""docx_reader.py - Inspect a .docx without opening the raw XML.

Usage:
    python3 docx_reader.py file.docx                 # structural overview
    python3 docx_reader.py file.docx --preview 20     # first 20 paragraphs
    python3 docx_reader.py file.docx --outline        # heading tree (TOC)
    python3 docx_reader.py file.docx --diff-against old.docx

Reads directly from the .docx ZIP (no unpack needed). The --diff-against mode
verifies an edit caused no structural damage and lists changed paragraphs.
"""
import sys
import os
import argparse
import tempfile
import zipfile
import shutil

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import _docx_common as D
from _docx_common import W


def _extract(path):
    d = tempfile.mkdtemp(prefix="docxread_")
    with zipfile.ZipFile(path) as z:
        z.extractall(d)
    return d


def _counts(workdir):
    root = D.parse(D.document_path(workdir)).getroot()
    body = D.get_body(root)
    paras = D.paragraphs(root)
    texts = [D.para_text(p) for p in paras]
    nonempty = [t for t in texts if t.strip()]
    tables = list(root.iter(W + "tbl"))
    drawings = list(root.iter(W + "drawing"))
    sect = list(root.iter(W + "sectPr"))
    inserts = list(root.iter(W + "ins"))
    deletes = list(root.iter(W + "del"))
    headings = [(D.heading_outline(p), D.para_text(p)) for p in paras
                if D.heading_outline(p) is not None]
    wdir = os.path.join(workdir, "word")
    headers = [f for f in os.listdir(wdir)] if os.path.isdir(wdir) else []
    nheader = len([f for f in headers if f.startswith("header")])
    nfooter = len([f for f in headers if f.startswith("footer")])
    words = sum(len(t.split()) for t in nonempty)
    chars = sum(len(t) for t in nonempty)
    return {
        "paras": len(paras), "nonempty": len(nonempty), "tables": len(tables),
        "drawings": len(drawings), "sections": len(sect),
        "ins": len(inserts), "del": len(deletes), "headers": nheader,
        "footers": nfooter, "words": words, "chars": chars,
        "headings": headings, "texts": texts,
    }


def overview(path, c):
    print("File: " + os.path.basename(path))
    print("Paragraphs : %d (%d non-empty)" % (c["paras"], c["nonempty"]))
    print("Tables     : %d" % c["tables"])
    print("Images     : %d" % c["drawings"])
    print("Sections   : %d" % c["sections"])
    print("Headers    : %d   Footers: %d" % (c["headers"], c["footers"]))
    print("Headings   : %d" % len(c["headings"]))
    print("Tracked    : %d insertion(s), %d deletion(s)" % (c["ins"], c["del"]))
    print("Word count : %d (chars incl. CJK: %d)" % (c["words"], c["chars"]))


def print_outline(c):
    if not c["headings"]:
        print("(no headings with outline levels found)")
        return
    for lvl, text in c["headings"]:
        print("  " * (lvl or 0) + "- " + text.strip())


def print_preview(c, n):
    shown = 0
    for t in c["texts"]:
        if t.strip() == "":
            continue
        print(t)
        shown += 1
        if shown >= n:
            break


def diff(new_path, old_path):
    wa = _extract(old_path)
    wb = _extract(new_path)
    try:
        ca, cb = _counts(wa), _counts(wb)
    finally:
        pass
    keys = ["tables", "drawings", "sections", "headers", "footers"]
    damage = [k for k in keys if ca[k] != cb[k]]
    print("DIFF  old=%s  new=%s" % (os.path.basename(old_path),
                                    os.path.basename(new_path)))
    if damage:
        print("RESULT: STRUCTURAL CHANGE in: " + ", ".join(
            "%s %d->%d" % (k, ca[k], cb[k]) for k in damage))
    else:
        print("RESULT: OK (no structural damage detected)")
    ta, tb = [t for t in ca["texts"]], [t for t in cb["texts"]]
    import difflib
    sm = difflib.SequenceMatcher(a=ta, b=tb)
    changed = 0
    lines = []
    for tag, i1, i2, j1, j2 in sm.get_opcodes():
        if tag == "equal":
            continue
        if tag in ("replace", "delete"):
            for t in ta[i1:i2]:
                if t.strip():
                    lines.append("  - " + t.strip()[:80]); changed += 1
        if tag in ("replace", "insert"):
            for t in tb[j1:j2]:
                if t.strip():
                    lines.append("  + " + t.strip()[:80]); changed += 1
    print("  %d changed paragraph line(s)" % changed)
    for ln in lines[:40]:
        print(ln)
    shutil.rmtree(wa, ignore_errors=True)
    shutil.rmtree(wb, ignore_errors=True)


def main():
    ap = argparse.ArgumentParser(description="Inspect a .docx")
    ap.add_argument("docx")
    ap.add_argument("--preview", type=int)
    ap.add_argument("--outline", action="store_true")
    ap.add_argument("--diff-against")
    args = ap.parse_args()

    if args.diff_against:
        diff(args.docx, args.diff_against)
        return 0

    wd = _extract(args.docx)
    try:
        c = _counts(wd)
        overview(args.docx, c)
        if args.outline:
            print("\nOutline:")
            print_outline(c)
        if args.preview:
            print("\nPreview (first %d non-empty paragraphs):" % args.preview)
            print_preview(c, args.preview)
    finally:
        shutil.rmtree(wd, ignore_errors=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
