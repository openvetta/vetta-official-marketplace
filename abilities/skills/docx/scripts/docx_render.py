#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""docx_render.py - Render a .docx to PDF + PNG for visual review.

Usage:
    python3 docx_render.py file.docx --out /tmp/rev
    python3 docx_render.py file.docx --pages 1-3 --out /tmp/rev

Uses LibreOffice headless to make a faithful PDF (CJK fonts are auto-selected),
then poppler (pdftoppm) to rasterize pages to PNG so the result can actually be
looked at. Always eyeball the PNG after an edit - validation catches structural
errors, but only a render catches layout/font/overflow problems.
"""
import sys
import os
import argparse
import subprocess
import shutil
import glob


def soffice():
    return shutil.which("soffice") or shutil.which("libreoffice")


def to_pdf(docx, outdir):
    exe = soffice()
    if not exe:
        raise SystemExit("LibreOffice (soffice) not found")
    subprocess.run([exe, "--headless", "--convert-to", "pdf", "--outdir",
                    outdir, docx], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    base = os.path.splitext(os.path.basename(docx))[0]
    pdf = os.path.join(outdir, base + ".pdf")
    if not os.path.exists(pdf):
        raise SystemExit("PDF was not produced")
    return pdf


def to_png(pdf, outdir, pages=None):
    exe = shutil.which("pdftoppm")
    if not exe:
        print("WARNING: pdftoppm not found; PDF only")
        return []
    base = os.path.splitext(os.path.basename(pdf))[0]
    prefix = os.path.join(outdir, base + "_p")
    cmd = [exe, "-png", "-r", "110"]
    if pages:
        a, _, b = pages.partition("-")
        cmd += ["-f", a, "-l", (b or a)]
    cmd += [pdf, prefix]
    subprocess.run(cmd, check=True)
    return sorted(glob.glob(prefix + "*.png"))


def main():
    ap = argparse.ArgumentParser(description="Render docx to PDF + PNG")
    ap.add_argument("docx")
    ap.add_argument("--out", default="/tmp/docx_render")
    ap.add_argument("--pages", help="page range like 1-3")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)
    pdf = to_pdf(args.docx, args.out)
    print("PDF: " + pdf)
    for png in to_png(pdf, args.out, args.pages):
        print("PNG: " + png)
    return 0


if __name__ == "__main__":
    sys.exit(main())
