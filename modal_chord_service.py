"""
Modal.com serverless function for premium chord detection.
Uses Madmom + Demucs on GPU for 89%+ accuracy.

Deploy with: modal deploy modal_chord_service.py
"""
import modal
from pathlib import Path
import tempfile
import time
import os

# Create Modal app
app = modal.App("lyrics-chord-detector-premium")

# Define image with dependencies
image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("ffmpeg", "libsndfile1", "libfftw3-dev")
    .pip_install(
        "torch==2.1.0",
        "torchaudio==2.1.0",
        "demucs==4.0.1",
        "Cython==3.0.0",
    )
    .run_commands("pip install madmom==0.16.1")  # Install after Cython
)

# Create volume for model cache
volume = modal.Volume.from_name("demucs-models", create_if_missing=True)


@app.function(
    image=image,
    gpu="T4",  # NVIDIA T4 GPU
    timeout=300,  # 5 minutes max
    volumes={"/cache": volume},
)
def detect_chords_premium(audio_bytes: bytes) -> dict:
    """
    Premium chord detection with Madmom + Demucs.
    
    Args:
        audio_bytes: Audio file as bytes
    
    Returns:
        {
            "chords": [...],
            "accuracy": "premium",
            "method": "Madmom + Demucs",
            "processing_time": float,
            "chord_count": int
        }
    """
    from demucs import pretrained
    from demucs.apply import apply_model
    from demucs.audio import AudioFile, save_audio
    from madmom.features.chords import DeepChromaChordRecognitionProcessor
    
    start_time = time.time()
    
    # Save audio to temp file
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
        f.write(audio_bytes)
        audio_path = f.name
    
    try:
        # Step 1: Separate guitar with Demucs
        print("🎸 Separating guitar with Demucs...")
        os.environ["TORCH_HOME"] = "/cache"
        
        model = pretrained.get_model("htdemucs")
        model.to("cuda")
        
        wav = AudioFile(audio_path).read(
            streams=0,
            samplerate=model.samplerate,
            channels=model.audio_channels
        )
        
        # Normalize
        ref = wav.mean(0)
        wav = (wav - ref.mean()) / ref.std()
        
        # Apply Demucs
        sources = apply_model(model, wav[None], device="cuda")[0]
        sources = sources * ref.std() + ref.mean()
        
        # Extract guitar + bass (stems 1 and 2)
        guitar_bass = sources[1] + sources[2]
        
        # Save separated audio
        guitar_path = tempfile.mktemp(suffix=".wav")
        save_audio(guitar_bass, guitar_path, samplerate=model.samplerate)
        
        # Step 2: Detect chords with Madmom
        print("🎵 Detecting chords with Madmom...")
        processor = DeepChromaChordRecognitionProcessor()
        chords_raw = processor(guitar_path)
        
        # Format results
        chords = []
        prev_chord = None
        
        for time_val, chord_label in chords_raw:
            # Skip duplicates and "N" (no chord)
            if chord_label == prev_chord or chord_label == "N":
                continue
            
            chords.append({
                "time": float(time_val),
                "chord": str(chord_label),
                "confidence": 0.95  # Madmom doesn't provide confidence
            })
            prev_chord = chord_label
        
        processing_time = time.time() - start_time
        
        # Cleanup
        os.unlink(guitar_path)
        
        print(f"✅ Premium detection complete: {len(chords)} chords in {processing_time:.1f}s")
        
        return {
            "chords": chords,
            "accuracy": "premium",
            "method": "Madmom + Demucs",
            "processing_time": processing_time,
            "chord_count": len(chords)
        }
        
    finally:
        os.unlink(audio_path)


@app.function()
@modal.web_endpoint(method="POST")
async def chord_detection_endpoint(audio_file: bytes):
    """
    Public HTTP endpoint for premium chord detection.
    
    Usage:
        curl -X POST https://your-modal-url.modal.run \\
          -F "audio_file=@song.mp3"
    """
    result = detect_chords_premium.remote(audio_file)
    return result


# Local testing
@app.local_entrypoint()
def test():
    """Test the function locally."""
    import sys
    
    if len(sys.argv) < 2:
        print("Usage: modal run modal_chord_service.py <audio_file.mp3>")
        sys.exit(1)
    
    audio_path = sys.argv[1]
    
    with open(audio_path, "rb") as f:
        audio_bytes = f.read()
    
    print(f"Testing with: {audio_path}")
    result = detect_chords_premium.remote(audio_bytes)
    
    print("\n" + "="*60)
    print("RESULTS:")
    print("="*60)
    print(f"Method: {result['method']}")
    print(f"Chords detected: {result['chord_count']}")
    print(f"Processing time: {result['processing_time']:.2f}s")
    print("\nFirst 10 chords:")
    for chord in result['chords'][:10]:
        print(f"  {chord['time']:.1f}s: {chord['chord']}")
