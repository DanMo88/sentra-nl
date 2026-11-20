# Sentra NL (sample)

Dutch (Nederlands) sentence by sentence for Persian speakers (A1–C2). Same app as Sentra: six modes, placement test, bookmarks.
Sample: A1 Les 1 (25 sentences) + 20-question Dutch placement test.

- Content: `content/<level>-<nn>.txt` (Dutch | Persian | Persian-letter reading) → `python3 tools/build.py` → `js/data.js`
- Audio: `python3 tools/tts.py` (edge-tts: nl-NL-FennaNeural / nl-NL-MaartenNeural alternating, words FennaNeural), silence-trimmed by `tools/trim.py`

ساخته شده توسط Daniel Mozafari
