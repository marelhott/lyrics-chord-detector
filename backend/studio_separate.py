"""Demucs 4.0 API export without per-stem clipping or normalization."""
from pathlib import Path
import sys
import torch
import soundfile as sf
from demucs.pretrained import get_model
from demucs.apply import apply_model
from demucs.separate import load_track


def separate(source, target):
    torch.set_num_threads(4)
    model = get_model("htdemucs_6s").cpu().eval()
    wav = load_track(source, model.audio_channels, model.samplerate)
    ref = wav.mean(0)
    mean = ref.mean()
    std = ref.std().clamp_min(1e-8)
    wav = (wav - mean) / std
    with torch.inference_mode():
        sources = apply_model(model, wav[None], device="cpu", shifts=0, split=True,
                              overlap=0.25, progress=True, num_workers=0, segment=7)[0]
        sources = sources * std + mean
    target.mkdir(parents=True, exist_ok=True)
    for name, samples in zip(model.sources, sources):
        # FLOAT preserves overshoots. The pipeline applies one common safe export gain later.
        sf.write(target / f"{name}.wav", samples.cpu().numpy().T, model.samplerate, subtype="FLOAT")


if __name__ == "__main__":
    separate(Path(sys.argv[1]), Path(sys.argv[2]))
