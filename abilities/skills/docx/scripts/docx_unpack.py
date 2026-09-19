#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""docx_unpack.py - Unzip a .docx into a working directory for XML editing.

Usage:
    python3 docx_unpack.py input.docx /tmp/work

The resulting directory mirrors the OPC package (word/document.xml,
word/styles.xml, word/header*.xml, [Content_Types].xml, etc.). Edit the XML
with the docx_* editor scripts, then repack with docx_pack.py.
"""
import sys
import os
import zipfile


def main():
    if len(sys.argv) != 3:
        print("usage: docx_unpack.py input.docx WORKDIR", file=sys.stderr)
        return 2
    src, workdir = sys.argv[1], sys.argv[2]
    os.makedirs(workdir, exist_ok=True)
    with zipfile.ZipFile(src) as z:
        names = z.namelist()
        z.extractall(workdir)
    print("unpacked " + str(len(names)) + " parts to " + workdir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
