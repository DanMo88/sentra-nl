#!/usr/bin/env python3
"""Dutch word -> Persian-letter reading (approximate, Sentra NL rules; same as the hand-written sample lesson).
g/ch -> خ, sch -> سخ, ui -> اُئو, ij/ei -> َی, ee -> ِی, oo/o -> ُ, oe -> و, ie -> ی, eu -> ؤ, ou/au -> آئو,
uu -> و, short u -> ُ, aa/a -> ا (آ at word start), schwa/short e -> ِ, final -en/-e -> ِه, v- -> ف at word start,
w -> و, j -> ی, tj -> چ, sj -> ش, final d/b -> ت/پ.  Overrides: content/pron.txt (word = reading)."""
import re, unicodedata
V = "aeiouy"
def fold(t):
    t = t.replace("ĳ", "ij").replace("ÿ", "ij")
    return "".join(c for c in unicodedata.normalize("NFD", t) if unicodedata.category(c) != "Mn")
PREF = ("ge", "be", "ver", "te", "her", "ont", "er")
# vowel units, longest first
UNITS = ["ə", "aai", "ooi", "oei", "eeuw", "ieuw", "uw", "eau", "aa", "ee", "oo", "uu", "oe", "ie", "ij", "ei", "ui", "eu", "ou", "au", "a", "e", "i", "o", "u", "y"]
CONS = [("sch", "SX"), ("ch", "X"), ("tj", "C"), ("sj", "S"), ("ng", "NG"), ("nk", "NK"), ("th", "t"), ("qu", "kw"), ("ck", "k"), ("c", "c")]
def tokenize(w):
    out, i = [], 0
    while i < len(w):
        for u in UNITS:
            if w.startswith(u, i):
                if u == "y" and (i == 0 or i + 1 < len(w) and w[i + 1] in V): continue  # consonant y -> handled below
                out.append(("V", u)); i += len(u); break
        else:
            for a, b in CONS:
                if w.startswith(a, i): out.append(("C", b)); i += len(a); break
            else:
                out.append(("C", w[i])); i += 1
    return out
def word(w0):
    if w0.lower() in ("één", "eén"): return "اِین"
    w = fold(w0.lower()).replace("’", "'")
    w = re.sub(r"[^a-z']", "", w)
    if not w: return ""
    special = {"'t": "اِت", "'s": "اِس", "'n": "اِن", "'k": "اِک", "'m": "اِم"}
    if w in special: return special[w]
    w = w.replace("'", "")
    w = re.sub(r"([bcdfgklmnprstvz])\1", r"§\1", w)  # double consonants sound single; § keeps the syllable closed (short vowel)
    w = re.sub(r"ig(e|en|er|heid|st)?$", lambda m: "əch" + (m.group(1) or ""), w)  # -ig -> schwa + ch
    if w.endswith("tie") and len(w) > 4: w = w[:-3] + "tsie"
    w = re.sub(r"tion(s?)$", r"sjon\1", w)
    if w.endswith("isch"): w = w[:-4] + "ies"
    if not re.match(r"^(on|te|ins|ver|ver)?gelijk", w): w = re.sub(r"lijk(?=(e|en|er|ere|ers|erd|st|ste|heid|heden|s)?$)", "lək", w)  # -lijk = schwa (natuurlijk, maatschappelijke)
    w = re.sub(r"gie(s|ën)?$", lambda m: "ʒie" + (m.group(1) or ""), w)  # energie, technologie -> ژی
    w = re.sub(r"sc(?=[eiy])", "s", w)  # scenario
    if w.startswith("ph"): w = "f" + w[2:]
    T = tokenize(w)
    # stress-ish: schwa for unstressed prefix e and for -e/-en/-el/-er/-es/-em endings; we write both short e and schwa as ِ
    res = []
    n = len(T)
    vidx = [k for k, (t, _) in enumerate(T) if t == "V"]
    pre = next((p for p in ("ver", "ge", "be", "her", "ont", "terug") if w.startswith(p) and len(w) > len(p) + 2 and w not in ("beter", "beker", "geven", "geld", "gele", "gebed")), None)
    firstv = vidx[1] if pre and len(vidx) > 1 else (vidx[0] if vidx else -1)
    for k, (t, u) in enumerate(T):
        first = k == 0
        last = k == n - 1
        nxt = T[k + 1] if k + 1 < n else None
        nxt2 = T[k + 2] if k + 2 < n else None
        if t == "C":
            prevV = k > 0 and T[k - 1][0] == "V"
            if u == "§": res.append(""); continue
            if u == "ʒ": res.append("ژ"); continue
            if u == "SX": res.append("سخ" if not last else "س"); continue
            if u == "X": res.append("خ"); continue
            if u == "C": res.append("چ"); continue
            if u == "S": res.append("ش"); continue
            if u == "NG": res.append("نگ"); continue
            if u == "NK": res.append("نک"); continue
            if u == "c": res.append("س" if nxt and nxt[1][0] in "eiy" else "ک"); continue
            if u == "n" and last and k >= 2 and T[k - 1] == ("V", "e") and n > 3 and not (k == 1): res.append("__EN__"); continue
            m = {"b": "پ" if last else "ب", "d": "ت" if last or (nxt and nxt[0] == "C" and nxt[1] in ("s", "t", "k", "p", "f", "X", "SX")) else "د", "f": "ف", "g": "خ", "h": "ه", "j": "ی", "k": "ک", "l": "ل", "m": "م", "n": "ن",
                 "p": "پ", "r": "ر", "s": "س", "t": "ت", "v": "ف" if first else "و", "w": "و", "x": "کس", "z": "ز", "y": "ی", "q": "ک"}
            res.append(m.get(u, "")); continue
        # vowels
        openS = nxt is not None and nxt[0] == "C" and len(nxt[1]) == 1 and nxt2 is not None and nxt2[0] == "V"
        if last: openS = True
        init = first
        if u == "ə": r = "اِ" if init else "ِ"
        elif u in ("aa", "a"): r = "آ" if init else "ا"
        elif u == "ee": r = "اِی" if init else "ِی"
        elif u == "e":
            if last: r = "ِه"
            elif openS and k == firstv: r = "ِی"
            else: r = "ِ"
            if init: r = {"ِه": "اِه", "ِی": "اِی", "ِ": "اِ"}[r]
        elif u == "i": r = "ای" if init else "ی"
        elif u in ("ie",): r = "ای" if init else "ی"
        elif u in ("oo", "o"): r = ("او" if last else "اُ") if init else ("و" if last else "ُ")
        elif u == "oe": r = "او" if init else "و"
        elif u == "uu": r = "او" if init else "و"
        elif u == "u": r = ("او" if init else "و") if openS else ("اُ" if init else "ُ")
        elif u in ("ij", "ei"): r = "اَی" if init else "َی"
        elif u == "ui": r = "اُئو" if init else "ُئو"
        elif u == "eu": r = "اؤ" if init else "ؤ"
        elif u in ("ou", "au"): r = "آئو" if init else "ائو"
        elif u == "aai": r = "آی" if init else "ای"
        elif u == "ooi": r = "اُی" if init else "ُی"
        elif u == "oei": r = "اوی" if init else "وی"
        elif u in ("eeuw",): r = "اِیو" if init else "ِیو"
        elif u in ("ieuw",): r = "ایو" if init else "یو"
        elif u == "uw": r = "اوو" if init else "وو"
        elif u == "eau": r = "او" if init else "و"
        elif u == "y": r = "ای" if init else "ی"
        else: r = u
        res.append(r)
    s = "".join(res)
    s = s.replace("ِ__EN__", "ِه").replace("__EN__", "ن")
    return s
if __name__ == "__main__":
    import sys
    for a in sys.argv[1:]: print(a, word(a))
