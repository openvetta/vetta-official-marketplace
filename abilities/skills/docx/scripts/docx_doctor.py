#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""docx_doctor.py - One-shot environment self-check for the docx skill.

Usage:  python3 docx_doctor.py

Verifies Python deps (python-docx, lxml, Pillow), the LibreOffice + poppler
rendering chain, and the presence of CJK fonts. Run this as the FIRST action
in a session; do not proceed past a FAIL on a capability you need.
"""
import shutil
import subprocess
import sys


def ok(label, good, detail=""):
    mark = "PASS" if good else "FAIL"
    print("[%s] %s%s" % (mark, label, ("  " + detail) if detail else ""))
    return good


def main():
    allok = True

    for mod, label in [("docx", "python-docx"), ("lxml", "lxml"),
                       ("PIL", "Pillow")]:
        try:
            m = __import__(mod)
            ver = getattr(m, "__version__", "ok")
            ok(label, True, str(ver))
        except Exception as e:  # noqa
            allok = ok(label, False, str(e)) and allok

    soffice = shutil.which("soffice") or shutil.which("libreoffice")
    allok = ok("LibreOffice (soffice)", bool(soffice), soffice or "not found") \
        and allok
    pdftoppm = shutil.which("pdftoppm")
    allok = ok("poppler (pdftoppm)", bool(pdftoppm), pdftoppm or "not found") \
        and allok

    # CJK fonts
    cjk = ""
    try:
        out = subprocess.run(["fc-list"], capture_output=True, text=True,
                             timeout=20).stdout
        names = []
        for want in ["Noto Sans CJK", "Noto Serif CJK", "Noto Sans SC",
                     "SimSun", "FangSong", "SimHei", "Microsoft YaHei"]:
            if want.lower() in out.lower():
                names.append(want)
        cjk = ", ".join(names)
        ok("CJK fonts", bool(names), cjk or "none (LibreOffice will substitute)")
    except Exception as e:  # noqa
        ok("CJK fonts", False, str(e))

    print("\n" + ("READY" if allok else "NOT READY (see FAIL above)"))
    return 0 if allok else 1


if __name__ == "__main__":
    sys.exit(main())
