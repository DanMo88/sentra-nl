#!/bin/bash
# build + tts (retry) + verify + commit/push one level: tools/stage.sh B1 "message"
set -e; cd "$(dirname "$0")/.."
LV=$1; MSG=$2
python3 tools/build.py --max-level $LV
for i in 1 2 3 4 5 6; do python3 tools/tts.py && break; rm -f audio/*.part; sleep 20; done
rm -f audio/*.part
python3 - <<'PY'
import json,subprocess,os,sys
j=json.load(open('tools/tts_jobs.json'));bad=[f for f in j if not os.path.exists(f) or os.path.getsize(f) < 1500]
print('audio', len(j), 'bad', bad[:5]); sys.exit(1 if bad else 0)
PY
git add -A && git commit -qm "$MSG" && git push -q && git log --oneline -1
