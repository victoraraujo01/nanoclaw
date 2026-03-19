#!/usr/bin/env python3
import sys
from faster_whisper import WhisperModel

audio_path = sys.argv[1]
model = WhisperModel("base", device="cpu", compute_type="int8")
segments, info = model.transcribe(audio_path, beam_size=5)
print("".join(segment.text for segment in segments).strip())
