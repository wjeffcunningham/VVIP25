#!/usr/bin/env python3
import os, json, re
from datetime import datetime

# --- CONFIG ---
EXTRAS_DIR = "media/extras"        # local path to extras
MANIFEST_FILE = "manifest.json"    # existing manifest in same folder
OUTPUT_FILE = "extras.json"        # output path
DATE_RE = re.compile(r"^(\d{2})[.\-_](\d{2})[.\-_](\d{2})")

def parse_date(name):
    """Parse YY.MM.DD -> datetime.date"""
    m = DATE_RE.match(name)
    if not m: return None
    yy, mm, dd = map(int, m.groups())
    year = 2000 + yy
    try:
        return datetime(year, mm, dd).date()
    except ValueError:
        return None

# --- 1. Load manifest and collect track dates ---
with open(MANIFEST_FILE, "r", encoding="utf-8") as f:
    manifest = json.load(f)
tracks = manifest.get("tracks", manifest)
# list of (date, base)
track_dates = []
for t in tracks:
    d = None
    if isinstance(t.get("date"), str):
        try:
            d = datetime.fromisoformat(t["date"]).date()
        except ValueError:
            pass
    if not d:
        d = parse_date(t.get("name",""))
    if d:
        track_dates.append((d, t.get("name")))
track_dates.sort(key=lambda x: x[0])

# --- 2. Gather extras files ---
extras = [f for f in os.listdir(EXTRAS_DIR)
          if re.search(r"\.(jpg|jpeg|png|gif|webp|mp4|mov)$", f, re.I)]

# --- 3. Build mapping ---
out = {}
for fname in sorted(extras):
    d = parse_date(fname)
    if not d: continue
    # find next later track date
    next_track = next(((td, name) for td, name in track_dates if td > d), None)
    if not next_track: continue
    date_str = next_track[0].strftime("%y.%m.%d")
    out.setdefault(date_str, []).append(fname)

# --- 4. Save JSON ---
with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
    json.dump(out, f, indent=2, ensure_ascii=False)

print(f"✅ Wrote {OUTPUT_FILE} with {len(out)} entries")