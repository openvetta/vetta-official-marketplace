#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""docx_validate.py - Structure/element-order gate-check for a .docx.

Usage:
    python3 docx_validate.py file.docx            # summary, exit 0/1
    python3 docx_validate.py file.docx --report   # list every issue

Checks the rules OpenXML is strict about (violations corrupt the file in Word):
  * w:p   -> pPr must be the FIRST child
  * w:r   -> rPr must be the FIRST child
  * w:tc  -> tcPr first, and at least one w:p
  * w:body-> sectPr must be the LAST child
  * w:del -> uses w:delText (never w:t);  w:ins -> uses w:t (never w:delText)
  * every XML part is well-formed
Exit code 0 = clean, 1 = issues found. Run after every write operation.
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
from lxml import etree


def check_part(path, issues):
    try:
        root = D.parse(path).getroot()
    except etree.XMLSyntaxError as e:
        issues.append("[not-well-formed] %s: %s" % (os.path.basename(path), e))
        return
    rel = os.path.basename(path)
    for p in root.iter(W + "p"):
        kids = list(p)
        if kids and kids[0].tag == W + "pPr" and \
                any(k.tag == W + "pPr" for k in kids[1:]):
            issues.append("[order] %s: w:p has multiple pPr" % rel)
        ppr = p.find(W + "pPr")
        if ppr is not None and kids.index(ppr) != 0:
            issues.append("[order] %s: pPr is not first child of w:p" % rel)
    for r in root.iter(W + "r"):
        rpr = r.find(W + "rPr")
        if rpr is not None and list(r).index(rpr) != 0:
            issues.append("[order] %s: rPr is not first child of w:r" % rel)
    for tc in root.iter(W + "tc"):
        kids = list(tc)
        tcpr = tc.find(W + "tcPr")
        if tcpr is not None and kids.index(tcpr) != 0:
            issues.append("[order] %s: tcPr is not first child of w:tc" % rel)
        if tc.find(W + "p") is None:
            issues.append("[empty-cell] %s: w:tc has no w:p (min 1 required)" % rel)
    body = root.find(W + "body")
    if body is not None:
        kids = list(body)
        sect = [k for k in kids if k.tag == W + "sectPr"]
        if sect and kids[-1].tag != W + "sectPr":
            issues.append("[order] %s: body sectPr is not the last child" % rel)
    for d in root.iter(W + "del"):
        if d.find(".//" + W + "t") is not None:
            issues.append("[track] %s: w:del contains w:t (must use w:delText)" % rel)
    for ins in root.iter(W + "ins"):
        if ins.find(".//" + W + "delText") is not None:
            issues.append("[track] %s: w:ins contains w:delText (must use w:t)" % rel)


def main():
    ap = argparse.ArgumentParser(description="Validate docx structure")
    ap.add_argument("docx")
    ap.add_argument("--report", action="store_true")
    args = ap.parse_args()

    wd = tempfile.mkdtemp(prefix="docxval_")
    try:
        with zipfile.ZipFile(args.docx) as z:
            z.extractall(wd)
        issues = []
        wdir = os.path.join(wd, "word")
        targets = [D.document_path(wd)]
        if os.path.isdir(wdir):
            for f in sorted(os.listdir(wdir)):
                if f.endswith(".xml") and (f.startswith("header")
                        or f.startswith("footer") or f == "styles.xml"
                        or f == "numbering.xml"):
                    targets.append(os.path.join(wdir, f))
        for t in targets:
            if os.path.exists(t):
                check_part(t, issues)
    finally:
        shutil.rmtree(wd, ignore_errors=True)

    if not issues:
        print("OK: no structure/order issues found in "
              + os.path.basename(args.docx))
        return 0
    print("FOUND %d issue(s) in %s:" % (len(issues), os.path.basename(args.docx)))
    if args.report:
        for i in issues:
            print("  " + i)
    else:
        for i in issues[:10]:
            print("  " + i)
        if len(issues) > 10:
            print("  ... (%d more; use --report)" % (len(issues) - 10))
    return 1


if __name__ == "__main__":
    sys.exit(main())
