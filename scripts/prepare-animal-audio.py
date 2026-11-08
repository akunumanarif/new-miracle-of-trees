"""Prepare source-verified animal clips. Requires curl, ffmpeg and ffprobe.

Usage: python3 scripts/prepare-animal-audio.py --cache /private/tmp/animal-sources
Sources, licenses and exact excerpts are recorded in audio-recordings.json.
No pitch shifting, time stretching, synthesis or animal substitutions are used.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import re
import subprocess
import tempfile
import zipfile

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("--cache", type=Path)
args = parser.parse_args()
root = Path(__file__).resolve().parents[1]
manifest_path = root / "public/dunia-hewan/audio-recordings.json"
manifest = json.loads(manifest_path.read_text())
temporary = tempfile.TemporaryDirectory(prefix="mot-animal-audio-")
cache = args.cache or Path(temporary.name)
cache.mkdir(parents=True, exist_ok=True)

for entry in manifest["recordings"]:
    source = cache / (entry["id"] + "-source" + entry["sourceExtension"])
    if not source.exists():
        download = cache / (entry["id"] + "-download")
        subprocess.run(["curl", "--fail", "--location", "--max-time", "90",
                        "--retry", "2", entry["downloadUrl"], "-o", str(download)], check=True)
        if "archiveMember" in entry:
            with zipfile.ZipFile(download) as archive:
                source.write_bytes(archive.read(entry["archiveMember"]))
        else:
            download.replace(source)
    clip = ["-ss", str(entry["start"]), "-i", str(source), "-t", str(entry["duration"])]
    # Measure the excerpt, not the full soundscape. Peak normalization also
    # works for very short calls where integrated loudness is undefined.
    analysis = subprocess.run(["ffmpeg", "-hide_banner", *clip, "-vn", "-ac", "1",
                               "-af", "highpass=f=40,volumedetect", "-f", "null", "-"],
                              check=True, capture_output=True, text=True)
    peak = re.search(r"max_volume: ([-\d.]+) dB", analysis.stderr)
    if not peak:
        raise ValueError(f"No audible recording for {entry['id']}")
    mean = re.search(r"mean_volume: ([-\d.]+) dB", analysis.stderr)
    if not mean:
        raise ValueError(f"No measurable recording for {entry['id']}")
    # Keep loud roars comfortable, but allow quiet field recordings to become
    # audible without exceeding the peak ceiling or altering their pitch.
    gain = min(30, -8 - float(peak[1]), -22 - float(mean[1]))
    fade_in = min(.008, entry["duration"] / 20)
    fade_out = min(.04, entry["duration"] / 10)
    filters = (f"highpass=f=40,volume={gain:.3f}dB,"
               f"afade=t=in:d={fade_in},"
               f"afade=t=out:st={max(0, entry['duration'] - fade_out)}:d={fade_out}")
    output = root / "public/dunia-hewan/audio" / entry["file"]
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *clip,
                    "-vn", "-ac", "1", "-ar", "44100", "-af", filters,
                    "-codec:a", "libmp3lame", "-b:a", "128k", "-map_metadata", "-1",
                    str(output)], check=True)
    duration = float(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries",
                      "format=duration", "-of", "csv=p=0", str(output)], text=True))
    if not math.isfinite(duration) or duration < .2 or duration > 12:
        raise ValueError(f"Unexpected clip duration: {entry['id']} {duration}")
    entry["outputDurationSeconds"] = round(duration, 4)
    entry["sha256"] = hashlib.sha256(output.read_bytes()).hexdigest()
    entry["processing"] = "Excerpt; mono 44.1 kHz MP3; 40 Hz rumble filter; peak normalization; short fades. Original pitch and speed preserved."
    print(f"{entry['id']}: {duration:.2f}s, gain {gain:+.1f}dB")

manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n")
temporary.cleanup()
