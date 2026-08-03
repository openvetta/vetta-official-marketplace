#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""libreoffice_convert.py - Convert documents with LibreOffice headless.

Usage:
    python3 libreoffice_convert.py legacy.doc --to docx --outdir .
    python3 libreoffice_convert.py report.docx --to pdf  --outdir /tmp
    python3 libreoffice_convert.py notes.odt  --to docx

Handles the common pre-processing step of turning a legacy .doc (or .odt, .rtf,
.html) into a .docx the XML toolchain can edit, and the post step of exporting
to PDF. CJK content converts safely (everything stays UTF-8).
"""
import sys
import os
import argparse
import subprocess
import shutil


def main():
    ap = argparse.ArgumentParser(description="LibreOffice headless convert")
    ap.add_argument("src")
    ap.add_argument("--to", required=True,
                    help="target format: docx | pdf | odt | txt | html")
    ap.add_argument("--outdir", default=".")
    args = ap.parse_args()

    exe = shutil.which("soffice") or shutil.which("libreoffice")
    if not exe:
        raise SystemExit("LibreOffice (soffice) not found")
    os.makedirs(args.outdir, exist_ok=True)
    subprocess.run([exe, "--headless", "--convert-to", args.to, "--outdir",
                    args.outdir, args.src], check=True,
                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    base = os.path.splitext(os.path.basename(args.src))[0]
    out = os.path.join(args.outdir, base + "." + args.to)
    if not os.path.exists(out):
        raise SystemExit("conversion failed: expected " + out)
    print("converted -> " + out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
