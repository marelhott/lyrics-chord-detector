from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import whisper
import librosa
import numpy as np
import tempfile
import os
from typing import List, Dict
import warnings
warnings.filterwarnings('ignore')

app = FastAPI(title="Lyrics & Chord Detector API")

# CORS middleware pro připojení z frontendu
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # V produkci nastavit konkrétní domény
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Načtení Whisper modelu při startu
print("Loading Whisper model...")
whisper_model = whisper.load_model("base")
print("Whisper model loaded!")


def detect_chords(audio_path: str) -> List[Dict]:
    """
    Detekce akordů z audio souboru pomocí librosa.
    Vrací seznam akordů s jejich časovými značkami.
    """
    try:
        # Načtení audio
        y, sr = librosa.load(audio_path, sr=22050)

        # Extrakce chroma features (pro detekci výšky tónů)
        chroma = librosa.feature.chroma_cqt(y=y, sr=sr, hop_length=512)

        # Agregace přes malé časové okno
        hop_length = 512
        frame_duration = hop_length / sr

        # Definice základních akordů (zjednodušená verze)
        chord_templates = {
            'C': [1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0],
            'C#': [0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
            'D': [0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 0],
            'D#': [0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0],
            'E': [0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
            'F': [1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0],
            'F#': [0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0],
            'G': [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1],
            'G#': [1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0],
            'A': [0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0],
            'A#': [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1, 0],
            'B': [0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1],
            'Cm': [1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
            'Dm': [0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 0],
            'Em': [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 1],
            'Fm': [1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0],
            'Gm': [0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0],
            'Am': [0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0],
        }

        chords = []

        # Detekce akordů pro každý frame
        for i in range(0, chroma.shape[1], 20):  # Každých 20 frames (cca každé 0.5s)
            if i + 20 > chroma.shape[1]:
                break

            # Průměrná chroma pro tento úsek
            avg_chroma = np.mean(chroma[:, i:i+20], axis=1)

            # Najdi nejlepší shodu s akordovými templaty
            best_match = None
            best_score = -1

            for chord_name, template in chord_templates.items():
                # Kosinová podobnost
                score = np.dot(avg_chroma, template) / (
                    np.linalg.norm(avg_chroma) * np.linalg.norm(template) + 1e-10
                )

                if score > best_score:
                    best_score = score
                    best_match = chord_name

            # Pouze pokud je dostatečná jistota (threshold)
            if best_score > 0.5:
                time = i * frame_duration
                chords.append({
                    "chord": best_match,
                    "time": round(time, 2),
                    "confidence": round(float(best_score), 2)
                })

        # Sloučení duplicitních akordů vedle sebe
        merged_chords = []
        if chords:
            current = chords[0]
            for next_chord in chords[1:]:
                if next_chord["chord"] == current["chord"]:
                    # Stejný akord pokračuje
                    continue
                else:
                    merged_chords.append(current)
                    current = next_chord
            merged_chords.append(current)

        return merged_chords

    except Exception as e:
        print(f"Error in chord detection: {str(e)}")
        return []


@app.get("/")
async def root():
    return {"message": "Lyrics & Chord Detector API is running!"}


@app.post("/process-audio")
async def process_audio(file: UploadFile = File(...)):
    """
    Zpracuje audio soubor (MP3/WAV) a vrátí text + akordy.
    """
    # Kontrola typu souboru
    if not file.content_type in ["audio/mpeg", "audio/wav", "audio/mp3"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only MP3 and WAV files are supported."
        )

    # Uložení do dočasného souboru
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_file:
        content = await file.read()
        temp_file.write(content)
        temp_path = temp_file.name

    try:
        # 1. Přepis textu pomocí Whisper
        print("Transcribing audio...")
        result = whisper_model.transcribe(temp_path, language="en")

        # Extrakce textu s časovými značkami
        segments = []
        for segment in result["segments"]:
            segments.append({
                "text": segment["text"].strip(),
                "start": round(segment["start"], 2),
                "end": round(segment["end"], 2)
            })

        full_text = result["text"].strip()

        # 2. Detekce akordů
        print("Detecting chords...")
        chords = detect_chords(temp_path)

        return JSONResponse(content={
            "success": True,
            "text": full_text,
            "segments": segments,
            "chords": chords,
            "filename": file.filename
        })

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")

    finally:
        # Smazání dočasného souboru
        if os.path.exists(temp_path):
            os.unlink(temp_path)


@app.get("/health")
async def health_check():
    return {"status": "healthy", "whisper_model": "base"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
