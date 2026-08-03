#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Shared helpers for the DOCX XML-editing scripts.

Philosophy: a .docx is a ZIP of XML parts. We unpack -> edit the XML in place
with lxml -> repack, so nothing the tools don't touch is ever rewritten
(zero format loss: styles, headers/footers, sections, track-changes, images,
numbering all preserved). All XML stays UTF-8.

Used by docx_reader / docx_replace_text / docx_fill_placeholders /
docx_add_paragraph / docx_validate / docx_merge_runs.
"""
import os
from lxml import etree

# OpenXML WordprocessingML namespaces
WNS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
RNS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
XMLNS = "http://www.w3.org/XML/1998/namespace"
W = "{" + WNS + "}"
R = "{" + RNS + "}"
NS = {"w": WNS, "r": RNS}


def parse(path):
    return etree.parse(path, etree.XMLParser(remove_blank_text=False))


def write(tree, path):
    tree.write(path, xml_declaration=True, encoding="UTF-8", standalone=True)


def document_path(workdir):
    return os.path.join(workdir, "word", "document.xml")


def part_paths(workdir, parts="document"):
    """Return XML part paths to operate on.
    parts='document' -> just word/document.xml
    parts='all'      -> document + every header*.xml / footer*.xml
    """
    out = [document_path(workdir)]
    if parts == "all":
        wdir = os.path.join(workdir, "word")
        if os.path.isdir(wdir):
            for f in sorted(os.listdir(wdir)):
                if (f.startswith("header") or f.startswith("footer")) \
                        and f.endswith(".xml"):
                    out.append(os.path.join(wdir, f))
    return [p for p in out if os.path.exists(p)]


def get_body(root):
    return root.find(W + "body")


def paragraphs(root):
    return list(root.iter(W + "p"))


def runs(p):
    return p.findall(W + "r")


def para_text(p):
    """Concatenate visible text of a paragraph (w:t and w:tab/w:br)."""
    buf = []
    for node in p.iter():
        tag = node.tag
        if tag == W + "t":
            buf.append(node.text or "")
        elif tag == W + "tab":
            buf.append("\t")
        elif tag == W + "br" or tag == W + "cr":
            buf.append("\n")
    return "".join(buf)


def _set_preserve(t):
    t.set("{" + XMLNS + "}space", "preserve")


def set_para_text(p, text):
    """Replace all run text in a paragraph with `text`, preserving the first
    run's run-properties (rPr). Other runs are removed. This is the standard,
    safe way to do text replacement that may span multiple runs."""
    rs = runs(p)
    if not rs:
        r = etree.SubElement(p, W + "r")
        t = etree.SubElement(r, W + "t")
        _set_preserve(t)
        t.text = text
        return
    first = rs[0]
    # drop extra runs
    for r in rs[1:]:
        p.remove(r)
    # clear first run's text-bearing children, keep rPr
    for child in list(first):
        if child.tag != W + "rPr":
            first.remove(child)
    t = etree.SubElement(first, W + "t")
    _set_preserve(t)
    t.text = text


def make_run(text, rpr=None):
    r = etree.Element(W + "r")
    if rpr is not None:
        r.append(rpr)
    t = etree.SubElement(r, W + "t")
    _set_preserve(t)
    t.text = text
    return r


def make_paragraph(text="", style=None, outline=None):
    p = etree.Element(W + "p")
    if style is not None or outline is not None:
        ppr = etree.SubElement(p, W + "pPr")
        if style is not None:
            ps = etree.SubElement(ppr, W + "pStyle")
            ps.set(W + "val", style)
        if outline is not None:
            ol = etree.SubElement(ppr, W + "outlineLvl")
            ol.set(W + "val", str(outline))
    if text:
        p.append(make_run(text))
    return p


def ensure_ppr_first(p):
    """pPr must be the first child of w:p."""
    ppr = p.find(W + "pPr")
    if ppr is not None and list(p).index(ppr) != 0:
        p.remove(ppr)
        p.insert(0, ppr)
    return ppr


def ensure_rpr_first(r):
    """rPr must be the first child of w:r."""
    rpr = r.find(W + "rPr")
    if rpr is not None and list(r).index(rpr) != 0:
        r.remove(rpr)
        r.insert(0, rpr)
    return rpr


def rpr_signature(r):
    rpr = r.find(W + "rPr")
    if rpr is None:
        return ""
    return etree.tostring(rpr)


def merge_runs(p):
    """Merge adjacent runs that share identical run-properties and carry only
    plain text (no breaks/tabs/fields). Returns number of merges."""
    merged = 0
    rs = runs(p)
    i = 0
    while i < len(rs) - 1:
        a, b = rs[i], rs[i + 1]
        a_t = a.findall(W + "t")
        b_t = b.findall(W + "t")
        plain_a = len(a) - (1 if a.find(W + "rPr") is not None else 0) == len(a_t)
        plain_b = len(b) - (1 if b.find(W + "rPr") is not None else 0) == len(b_t)
        if a_t and b_t and plain_a and plain_b \
                and rpr_signature(a) == rpr_signature(b):
            txt = "".join(t.text or "" for t in a_t) \
                + "".join(t.text or "" for t in b_t)
            for t in a_t[1:]:
                a.remove(t)
            a_t[0].text = txt
            _set_preserve(a_t[0])
            p.remove(b)
            merged += 1
            rs = runs(p)
        else:
            i += 1
    return merged


def strip_direct_formatting(p, keep_pstyle=True):
    """Remove direct character/paragraph formatting so template styles win.
    Keeps the pStyle reference (and numPr) and rStyle; drops inline fonts,
    color, shading, borders, spacing, etc."""
    ppr = p.find(W + "pPr")
    if ppr is not None:
        for child in list(ppr):
            local = child.tag.split("}")[-1]
            if local in ("pStyle", "numPr", "sectPr") and keep_pstyle:
                continue
            ppr.remove(child)
        if len(ppr) == 0:
            p.remove(ppr)
    for r in runs(p):
        rpr = r.find(W + "rPr")
        if rpr is not None:
            for child in list(rpr):
                local = child.tag.split("}")[-1]
                if local == "rStyle":
                    continue
                rpr.remove(child)
            if len(rpr) == 0:
                r.remove(rpr)


def heading_outline(p):
    """Return outline level int if the paragraph is a heading, else None."""
    ppr = p.find(W + "pPr")
    if ppr is None:
        return None
    ol = ppr.find(W + "outlineLvl")
    if ol is not None:
        try:
            return int(ol.get(W + "val"))
        except (TypeError, ValueError):
            return None
    ps = ppr.find(W + "pStyle")
    if ps is not None:
        val = (ps.get(W + "val") or "").lower()
        if val.startswith("heading") or val in ("1", "2", "3", "4", "5", "6"):
            digits = "".join(ch for ch in val if ch.isdigit())
            if digits:
                return int(digits) - 1
    return None


def paragraph_style(p):
    ppr = p.find(W + "pPr")
    if ppr is None:
        return None
    ps = ppr.find(W + "pStyle")
    return ps.get(W + "val") if ps is not None else None
