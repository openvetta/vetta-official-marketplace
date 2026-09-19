#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""docx_pack.py - Repack a working directory into a valid .docx.

Usage:
    python3 docx_pack.py /tmp/work output.docx

Writes [Content_Types].xml first and keeps the rest of the package, producing a
standard OPC ZIP. Use after editing XML parts with the docx_* editor scripts.
"""
import sys
import os
import zipfile


def main():
    if len(sys.argv) != 3:
        print("usage: docx_pack.py WORKDIR output.docx", file=sys.stderr)
        return 2
    workdir, out = sys.argv[1], sys.argv[2]
    files = []
    for root, _, names in os.walk(workdir):
        for n in names:
            full = os.path.join(root, n)
            rel = os.path.relpath(full, workdir).replace(os.sep, "/")
            files.append((full, rel))

    def rank(rel):
        if rel == "[Content_Types].xml":
            return 0
        if rel.startswith("_rels/"):
            return 1
        return 2

    files.sort(key=lambda fr: (rank(fr[1]), fr[1]))
    if os.path.exists(out):
        os.remove(out)
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for full, rel in files:
            z.write(full, rel)
    print("packed " + str(len(files)) + " parts -> " + out)
    return 0


if __name__ == "__main__":
    sys.exit(main())
