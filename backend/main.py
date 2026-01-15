from fastapi import FastAPI, File, UploadFile, HTTPException, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import tempfile
import os
from typing import Optional
import warnings
warnings.filterwarnings('ignore')

# Load environment variables from .env file
from dotenv import load_dotenv
load_dotenv()

# Import our new services
from services.fast_whisper_service import get_fast_whisper_service  # Fast OpenAI API
from services.chord_detection import get_chord_service
from services.structure_detection import get_structure_service
from services.alignment_service import get_alignment_service

app = FastAPI(
    title="Lyrics & Chord Detector API",
    description="Professional lyrics and chord detection with song structure recognition",
    version="2.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production: set specific domains
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize services at startup
print("=" * 60)
print("🎵 Lyrics & Chord Detector API v2.0 (Fast)")
print("=" * 60)

# Load services - using OpenAI API for speed
whisper_service = get_fast_whisper_service()  # Fast! 5-10s instead of 5-10min
chord_service = get_chord_service(use_madmom=False)  # Using librosa
structure_service = get_structure_service()
alignment_service = get_alignment_service()

print("✅ All services loaded successfully!")
print("=" * 60)


@app.get("/")
async def root():
    """API root endpoint."""
    return {
        "message": "Lyrics & Chord Detector API v2.0",
        "status": "running",
        "features": [
            "Multi-language support (CS, SK, EN, auto-detect)",
            "Word-level timestamps",
            "Advanced chord detection (7th, sus, dim, aug)",
            "Song structure detection (Intro, Verse, Chorus, etc.)",
            "Ultimate Guitar style formatting"
        ]
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "whisper_model": whisper_service.model_size,
        "chord_detection": "madmom" if chord_service.use_madmom else "librosa",
        "version": "2.0.0"
    }


@app.post("/process-audio")
async def process_audio(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None)
):
    """
    Process audio file - transcribe lyrics and detect chords.
    
    Args:
        file: Audio file (MP3/WAV)
        language: Language code ("en", "cs", "sk", etc.) or None for auto-detect
    
    Returns:
        JSON with:
        - text: Full transcribed text
        - language: Detected/specified language
        - segments: Segments with word-level timestamps
        - chords: Detected chords
        - structure: Song structure (Intro, Verse, Chorus, etc.)
        - aligned_chords: Chords aligned with specific words
        - formatted_output: Ultimate Guitar style text
    """
    # Validate file type
    if not file.content_type in ["audio/mpeg", "audio/wav", "audio/mp3", "audio/x-wav"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only MP3 and WAV files are supported."
        )
    
    # Validate file size (max 50MB)
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50MB
    
    # Save to temporary file
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_file:
        content = await file.read()
        
        # Check file size
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size is {MAX_FILE_SIZE / 1024 / 1024}MB"
            )
        
        temp_file.write(content)
        temp_path = temp_file.name
    
    try:
        print(f"\n{'='*60}")
        print(f"Processing: {file.filename}")
        print(f"Size: {len(content) / 1024 / 1024:.2f}MB")
        print(f"Language: {language or 'auto-detect'}")
        print(f"{'='*60}\n")
        
        # Step 1: Transcribe with Whisper (word-level timestamps)
        print("Step 1/5: Transcribing audio...")
        transcription = whisper_service.transcribe(
            temp_path,
            language=language
        )
        
        # Step 2: Detect chords
        print("Step 2/5: Detecting chords...")
        chords = chord_service.detect_chords(temp_path)
        
        # Detect key
        key = chord_service.detect_key(temp_path)
        
        # Step 3: Detect song structure
        print("Step 3/5: Detecting song structure...")
        structure = structure_service.detect_structure(
            temp_path,
            transcription["segments"],
            chords
        )
        
        # Step 4: Align chords with lyrics
        print("Step 4/5: Aligning chords with lyrics...")
        aligned_chords = alignment_service.align_chords_with_lyrics(
            transcription["segments"],
            chords
        )
        
        # Step 5: Format output (Ultimate Guitar style)
        print("Step 5/5: Formatting output...")
        
        # Extract title from filename (remove extension and replace underscores)
        title = os.path.splitext(file.filename)[0].replace("_", " ").replace("-", " ").title()
        
        formatted_output = alignment_service.format_ultimate_guitar_style(
            structure,
            aligned_chords,
            title=title,
            key=key
        )
        
        print(f"\n✅ Processing complete!")
        print(f"   - Detected language: {transcription['language']}")
        print(f"   - Segments: {len(transcription['segments'])}")
        print(f"   - Words: {len(transcription.get('words', []))}")
        print(f"   - Chords: {len(chords)}")
        print(f"   - Structure sections: {len(structure)}")
        print(f"{'='*60}\n")
        
        return JSONResponse(content={
            "success": True,
            "filename": file.filename,
            "text": transcription["text"],
            "language": transcription["language"],
            "segments": transcription["segments"],
            "words": transcription.get("words", []),
            "chords": chords,
            "structure": structure,
            "aligned_chords": aligned_chords,
            "formatted_output": formatted_output
        })
    
    except Exception as e:
        print(f"\n❌ Error processing file: {str(e)}")
        import traceback
        traceback.print_exc()
        
        raise HTTPException(
            status_code=500,
            detail=f"Processing error: {str(e)}"
        )
    
    finally:
        # Clean up temporary file
        if os.path.exists(temp_path):
            os.unlink(temp_path)


@app.post("/detect-language")
async def detect_language(file: UploadFile = File(...)):
    """
    Detect the language of an audio file.
    
    Args:
        file: Audio file (MP3/WAV)
    
    Returns:
        Detected language code
    """
    # Save to temporary file
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_file:
        content = await file.read()
        temp_file.write(content)
        temp_path = temp_file.name
    
    try:
        language = whisper_service.detect_language(temp_path)
        
        return JSONResponse(content={
            "success": True,
            "language": language,
            "filename": file.filename
        })
    
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Language detection error: {str(e)}"
        )
    
    finally:
        if os.path.exists(temp_path):
            os.unlink(temp_path)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
