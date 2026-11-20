#!/usr/bin/env python3
"""Trim leading/trailing silence from audio/*.mp3 (edge-tts adds ~0.23s lead, ~1s tail).
Keeps ~30ms lead and ~80ms tail. Idempotent: files already trimmed are skipped.
Usage: python3 tools/trim.py [files...]"""
import glob, os, re, subprocess, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def lead(path):
    out = subprocess.run(["ffmpeg", "-hide_banner", "-i", path, "-af", "silencedetect=n=-45dB:d=0.02", "-f", "null", "-"],
                         capture_output=True, text=True).stderr
    m = re.search(r"silence_start: 0(?:\.0+)?\n.*?silence_end: ([\d.]+)", out, re.S)
    return float(m.group(1)) if m else 0.0

def trim(path):
    if lead(path) < 0.08:
        return False
    tmp = path + ".trim.mp3"
    af = ("silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.03,"
          "areverse,silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08,areverse")
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-i", path, "-af", af,
                    "-ac", "1", "-ar", "24000", "-c:a", "libmp3lame", "-b:a", "48k", tmp], check=True)
    os.replace(tmp, path)
    return True

files = sys.argv[1:] or sorted(glob.glob(os.path.join(ROOT, "audio", "*.mp3")))
from concurrent.futures import ThreadPoolExecutor
with ThreadPoolExecutor(8) as ex:
    n = sum(ex.map(trim, files))
print(f"trimmed {n}/{len(files)}")
