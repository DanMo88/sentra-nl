#!/usr/bin/env python3
"""Generate MP3s from tools/tts_jobs.json with edge-tts, then trim silence (tools/trim.py).
Voices: f = nl-NL-FennaNeural, m = nl-NL-MaartenNeural (sentences, -8%), w = FennaNeural -15% (word tiles)."""
import asyncio, json, os, subprocess, sys
import edge_tts
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V = {"f": ("nl-NL-FennaNeural", "-8%"), "m": ("nl-NL-MaartenNeural", "-8%"), "w": ("nl-NL-FennaNeural", "-15%")}
MAN = os.path.join(ROOT, "tools", "tts_manifest.json")
man = json.load(open(MAN, encoding="utf-8")) if os.path.exists(MAN) else {}
NEW = []
sig = lambda j: j["voice"] + "|" + j["text"]
async def one(sem, fn, job, fails):
    path = os.path.join(ROOT, fn)
    if os.path.exists(path) and man.setdefault(fn, sig(job)) == sig(job): return
    voice, rate = V[job["voice"]]
    async with sem:
        for a in range(5):
            try:
                await edge_tts.Communicate(job["text"], voice, rate=rate).save(path + ".part")
                assert os.path.getsize(path + ".part") > 1000
                os.replace(path + ".part", path); man[fn] = sig(job); NEW.append(path); return
            except Exception:
                await asyncio.sleep(2 + 3 * a)
        fails.append(fn)
async def main():
    jobs = json.load(open(os.path.join(ROOT, "tools", "tts_jobs.json"), encoding="utf-8"))
    sem, fails = asyncio.Semaphore(8), []
    items = list(jobs.items())
    for k in range(0, len(items), 400):
        await asyncio.gather(*[one(sem, f, j, fails) for f, j in items[k:k + 400]])
        json.dump(man, open(MAN, "w", encoding="utf-8"), ensure_ascii=False, indent=0, sort_keys=True)
        print("progress", min(k + 400, len(items)), "/", len(items), flush=True)
    return fails
FAILS = asyncio.run(main())
if NEW: subprocess.run([sys.executable, os.path.join(ROOT, "tools", "trim.py")] + NEW, check=True)  # trim only new files
if FAILS: print("FAILED", FAILS); sys.exit(1)
