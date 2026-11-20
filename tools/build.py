#!/usr/bin/env python3
"""Build js/data.js + tools/tts_jobs.json for Sentra NL (full course).
Lesson A1-1 = content/a1-01.txt ("Dutch | Persian | hand reading").
Other lessons: content/levels/<lv>.txt — "## <Persian title>" blocks, then "Dutch | Persian [| reading]".
Per level the blocks are concatenated, deduped course-wide and cut into lessons of 25 (A1 24, A2 24, B1 26, B2 26, C1 22, C2 20).
Readings: content/pron.txt overrides, else tools/nl_fa.py rules.  Sentence voice: odd global number = f, even = m.
Usage: python3 tools/build.py [--max-level B1]"""
import json, os, re, sys, unicodedata
from collections import Counter
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import nl_fa
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"]
COUNT = {"A1": 24, "A2": 24, "B1": 26, "B2": 26, "C1": 22, "C2": 20}
PER = 25
ZW = "\u200c"
APOS = re.compile(r"^'[a-z]{1,2}$", re.I)
APOS_TTS = {"'t": "het", "'s": "es", "'n": "een", "'k": "ik", "'m": "hem"}
def fold(t):  # must match fold() in js/app.js
    t = t.replace("ĳ", "ij").replace("Ĳ", "IJ").replace("ÿ", "ij")
    return "".join(c for c in unicodedata.normalize("NFD", t) if unicodedata.category(c) != "Mn")
def slug(t): return re.sub(r"[^a-z0-9]+", "-", re.sub(r"^'", "apos-", fold(t).lower())).strip("-")[:80].strip("-")
def bare(w):  # must match bareW() in js/app.js
    b = re.sub(r"[^\w'\-]|[\d_]", "", w.replace("’", "'").replace("‘", "'"))
    if APOS.match(b): return b
    return b.strip("-'") or re.sub(r"[^\w]|[\d_]", "", w)
def key(nl): return re.sub(r"[^a-z]", "", fold(nl).lower())
def fa_fix(t):
    t = t.replace("~", ZW)
    t = re.sub(r"(^|[\s«(])(ن?می) (?=[\u0600-\u06FF])", lambda m: m.group(1) + m.group(2) + ZW, t)
    t = t.replace("?", "؟").replace(",", "،").replace(";", "؛")
    return re.sub(r"\s+", " ", t).strip()
def nl_fix(t): return re.sub(r"\s+", " ", t.replace("’", "'").replace("‘", "'").replace("“", '"').replace("”", '"')).strip()
PRON = {}
for ln in open(os.path.join(ROOT, "content", "pron.txt"), encoding="utf-8"):
    ln = ln.strip()
    if ln and not ln.startswith("#") and " = " in ln:
        k, v = ln.split(" = ", 1); PRON[k.strip().lower()] = v.strip()
PUN = {",": "،", "?": "؟", ";": "؛", ".": ".", "!": "!", ":": ":"}
errors = []
def reading(nl):
    out = []
    for tok in nl.split():
        core = re.sub(r"^[^\w']+|[^\w]+$", "", tok)
        tail = tok[len(tok.rstrip('.,!?;:"”)')):]
        c = core.lower()
        parts = c.split("-")
        r = PRON.get(c) or "\u200c".join(PRON.get(p) or nl_fa.word(p) for p in parts if p)
        if not r: errors.append(f"no reading for {tok!r} in {nl!r}"); r = "?"
        out.append(r + "".join(PUN.get(ch, "") for ch in tail))
    return " ".join(out)
def blocks(path):
    cur, res = None, []
    for ln in open(path, encoding="utf-8"):
        ln = ln.strip()
        if ln.startswith("## "): cur = [ln[3:].strip(), []]; res.append(cur); continue
        if not ln or ln.startswith("#"): continue
        p = [x.strip() for x in ln.split("|")]
        if len(p) not in (2, 3) or not p[0] or not p[1]: errors.append(f"{os.path.basename(path)}: bad line {ln!r}"); continue
        cur[1].append(p)
    return res
def main():
    cap = ORDER.index(sys.argv[sys.argv.index("--max-level") + 1]) if "--max-level" in sys.argv else 5
    gseen, lessons, jobs, n = {}, [], {}, 0
    for lv in ORDER[:cap + 1]:
        units = []  # (title, row)
        if lv == "A1":
            rows = [[x.strip() for x in l.split("|")] for l in open(os.path.join(ROOT, "content", "a1-01.txt"), encoding="utf-8").read().splitlines() if l.strip() and not l.startswith("#")]
            first = [("سلام و آشنایی", r) for r in rows]
        else: first = []
        path = os.path.join(ROOT, "content", "levels", lv.lower() + ".txt")
        for title, rows in blocks(path):
            units += [(title, r) for r in rows]
        chunks, cur = [], list(first)
        if first:
            for _, r in first: gseen[key(r[0])] = "a1-01"
            chunks.append(cur); cur = []
        for t, r in units:
            r[0] = nl_fix(r[0]); k = key(r[0])
            if k in gseen: continue
            gseen[k] = lv; cur.append((t, r))
            if len(cur) == PER: chunks.append(cur); cur = []
        if len(chunks) < COUNT[lv]:
            errors.append(f"{lv}: only {len(chunks)} full lessons + {len(cur)} sentences; need {COUNT[lv] * PER - len(chunks) * PER - len(cur)} more")
        chunks = chunks[:COUNT[lv]]
        for num, ch in enumerate(chunks, 1):
            tc = Counter(t for t, _ in ch); order = [t for t, _ in ch]
            top = [t for t, c in sorted(tc.items(), key=lambda x: (-x[1], order.index(x[0])))][:2]
            top = sorted(top, key=order.index)
            title = top[0] if len(top) == 1 or tc[top[1]] < 8 else top[0] + " · " + top[1]
            out, n0 = [], n + 1
            for _, r in ch:
                nl, fa = r[0], r[1]; n += 1
                rd = r[2] if len(r) > 2 and r[2] else reading(nl)
                if len(nl.split()) != len(rd.split()): errors.append(f"token mismatch {nl} / {rd}")
                for w in nl.split():
                    bw = bare(w)
                    if not bw: errors.append(f"empty word in {nl!r}"); continue
                    jobs.setdefault(f"audio/w-{slug(bw)}.mp3", {"text": APOS_TTS.get(bw.lower(), bw), "voice": "w"})
                jobs[f"audio/s{n:04d}.mp3"] = {"text": nl, "voice": "f" if n % 2 else "m"}
                out.append([nl, fa_fix(fa), rd])
            lessons.append({"id": f"{lv.lower()}-{num:02d}", "level": lv, "num": num, "title": title, "n0": n0, "s": out})
    if errors: print("ERRORS:", *errors[:80], sep="\n"); print(len(errors), "errors")
    if errors and "--force" not in sys.argv: sys.exit(1)
    open(os.path.join(ROOT, "js", "data.js"), "w", encoding="utf-8").write(
        "/* generated by tools/build.py */\nwindow.SENTRA_LESSONS = " + json.dumps(lessons, ensure_ascii=False, separators=(",", ":")) + ";\n")
    json.dump(jobs, open(os.path.join(ROOT, "tools", "tts_jobs.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=0)
    c = Counter(l["level"] for l in lessons); s = Counter()
    for l in lessons: s[l["level"]] += len(l["s"])
    print(dict(c), dict(s), "sentences", n, "audio jobs", len(jobs))
main()
