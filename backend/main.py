from fastapi import FastAPI, File, UploadFile, HTTPException, Form, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
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
from services.audio_utils import trim_audio_to_duration, calculate_audio_hash
from services.spotify_service import get_spotify_service

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

# Create API router with /api prefix
api_router = APIRouter(prefix="/api")

# Initialize services at startup
print("=" * 60)
print("🎵 Lyrics & Chord Detector API v2.0 (Fast)")
print("=" * 60)

# Load services - using OpenAI API for speed
whisper_service = get_fast_whisper_service()  # Fast! 5-10s instead of 5-10min
chord_service = get_chord_service(use_madmom=False)  # Librosa fallback for Railway
structure_service = get_structure_service()
alignment_service = get_alignment_service()


print("✅ All services loaded successfully!")
print("=" * 60)


@api_router.get("/")
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


@api_router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "whisper_model": whisper_service.model_size,
        "chord_detection": "madmom" if chord_service.use_madmom else "librosa",
        "version": "2.0.0"
    }


@api_router.post("/process-demo")
async def process_demo(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
    quality: str = Form("free")  # 'free' or 'premium'
):
    """
    Process audio file (demo mode - first 30 seconds only).
    
    Args:
        file: Audio file (MP3, WAV, etc.)
        language: Optional language code (e.g., 'cs', 'en')
        quality: Chord detection quality ('free' or 'premium')
    
    Returns:
        JSON with demo results (is_demo: true)
    """
    # Validate quality
    if quality not in ["free", "premium"]:
        raise HTTPException(status_code=400, detail="Invalid quality. Use 'free' or 'premium'")
    
    print(f"\n{'='*60}")
    print(f"📥 Processing DEMO (30s) - Quality: {quality.upper()}")
    print(f"{'='*60}")
    
    # Validate file type
    if not file.content_type in ["audio/mpeg", "audio/wav", "audio/mp3", "audio/x-wav"]:
        raise HTTPException(
            status_code=400,
            detail="Invalid file type. Only MP3 and WAV files are supported."
        )
    
    # Save to temporary file
    with tempfile.NamedTemporaryFile(delete=False, suffix=os.path.splitext(file.filename)[1]) as temp_file:
        content = await file.read()
        
        # Check file size (max 50MB)
        MAX_FILE_SIZE = 50 * 1024 * 1024
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size is {MAX_FILE_SIZE / 1024 / 1024}MB"
            )
        
        temp_file.write(content)
        temp_path = temp_file.name
    
    try:
        print(f"\n{'='*60}")
        print(f"Processing DEMO: {file.filename}")
        print(f"{'='*60}\n")
        
        # Calculate audio hash for duplicate detection
        audio_hash = calculate_audio_hash(temp_path)
        print(f"Audio hash: {audio_hash[:16]}...")
        
        # Trim to 30 seconds
        print("Trimming to 30 seconds...")
        trimmed_path = trim_audio_to_duration(temp_path, duration_seconds=30)
        
        # Process trimmed audio
        print("Step 1/5: Transcribing audio (30s)...")
        transcription = whisper_service.transcribe(trimmed_path, language=language)
        
        print("Step 2/5: Detecting chords...")
        chords = chord_service.detect_chords(trimmed_path)
        
        # Detect key
        key = chord_service.detect_key(trimmed_path)
        
        print("Step 3/5: Detecting song structure...")
        structure = structure_service.detect_structure(
            trimmed_path,
            transcription["segments"],
            chords
        )
        
        print("Step 4/5: Aligning chords with lyrics...")
        aligned_chords = alignment_service.align_chords_with_lyrics(
            transcription["segments"],
            chords
        )
        
        print("Step 5/5: Formatting output...")
        title = os.path.splitext(file.filename)[0].replace("_", " ").replace("-", " ").title()
        
        formatted_output = alignment_service.format_ultimate_guitar_style(
            structure,
            aligned_chords,
            title=title,
            key=key
        )
        
        print(f"\n✅ Demo processing complete!")
        print(f"{'='*60}\n")
        
        # Clean up trimmed file
        if os.path.exists(trimmed_path):
            os.unlink(trimmed_path)
        
        return JSONResponse(content={
            "success": True,
            "is_demo": True,
            "audio_hash": audio_hash,
            "filename": file.filename,
            "text": transcription["text"],
            "language": transcription["language"],
            "segments": transcription["segments"],
            "chords": chords,
            "structure": structure,
            "aligned_chords": aligned_chords,
            "formatted_output": formatted_output,
            "title": title,
            "key": key,
            "demo_duration": 30
        })
    
    except Exception as e:
        print(f"\n❌ Error processing demo: {str(e)}")
        import traceback
        traceback.print_exc()
        
        raise HTTPException(
            status_code=500,
            detail=f"Processing error: {str(e)}"
        )
    
    finally:
        # Clean up original temp file
        if os.path.exists(temp_path):
            os.unlink(temp_path)


@api_router.post("/process-audio")
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


@api_router.post("/download-spotify")
async def download_spotify(spotify_url: str = Form(...)):
    """
    Download song from Spotify URL and process it.
    
    Args:
        spotify_url: Spotify track URL
    
    Returns:
        JSON with processing results
    """
    try:
        print(f"\n{'='*60}")
        print(f"📥 Downloading from Spotify: {spotify_url}")
        print(f"{'='*60}\n")
        
        # Download from Spotify
        spotify_service = get_spotify_service()
        audio_path = spotify_service.download_from_url(spotify_url)
        
        try:
            # Process the downloaded file
            print("Step 1/5: Transcribing audio...")
            transcription = whisper_service.transcribe(audio_path)
            
            print("Step 2/5: Detecting chords...")
            chords = chord_service.detect_chords(audio_path)
            
            # Detect key
            key = chord_service.detect_key(audio_path)
            
            print("Step 3/5: Detecting song structure...")
            structure = structure_service.detect_structure(
                audio_path,
                transcription["segments"],
                chords
            )
            
            print("Step 4/5: Aligning chords with lyrics...")
            aligned_chords = alignment_service.align_chords_with_lyrics(
                transcription["segments"],
                chords
            )
            
            print("Step 5/5: Formatting output...")
            
            # Extract title from Spotify metadata if available
            title = os.path.splitext(os.path.basename(audio_path))[0].replace("_", " ").replace("-", " ").title()
            
            formatted_output = alignment_service.format_ultimate_guitar_style(
                structure,
                aligned_chords,
                title=title,
                key=key
            )
            
            print(f"\n✅ Processing complete!")
            print(f"{'='*60}\n")
            
            return JSONResponse(content={
                "success": True,
                "filename": os.path.basename(audio_path),
                "text": transcription["text"],
                "language": transcription["language"],
                "segments": transcription["segments"],
                "words": transcription.get("words", []),
                "chords": chords,
                "structure": structure,
                "aligned_chords": aligned_chords,
                "formatted_output": formatted_output,
                "title": title,
                "key": key
            })
        
        finally:
            # Clean up downloaded file
            if os.path.exists(audio_path):
                os.unlink(audio_path)
    
    except Exception as e:
        print(f"\n❌ Error downloading/processing Spotify URL: {str(e)}")
        import traceback
        traceback.print_exc()
        
        raise HTTPException(
            status_code=500,
            detail=f"Spotify download error: {str(e)}"
        )


@api_router.post("/detect-language")
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


# Include API router
app.include_router(api_router)

# Serve frontend static files (for Railway deployment)
frontend_dist_path = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
print(f"\n{'='*20} DEBUG: FILESYSTEM CHECK {'='*20}")
print(f"Current Working Directory: {os.getcwd()}")
print(f"Backend Main File Path: {__file__}")
print(f"Expected Frontend Dist Path: {frontend_dist_path}")

try:
    parent_dir = os.path.join(os.path.dirname(__file__), "..")
    print(f"Listing contents of parent dir ({parent_dir}):")
    print(os.listdir(parent_dir))
    
    frontend_dir = os.path.join(parent_dir, "frontend")
    if os.path.exists(frontend_dir):
        print(f"Listing contents of frontend dir ({frontend_dir}):")
        print(os.listdir(frontend_dir))
    else:
        print("❌ Frontend dir does not exist!")
except Exception as e:
    print(f"Error checking filesystem: {e}")
print(f"{'='*60}\n")

if os.path.exists(frontend_dist_path):
    print(f"✅ Frontend found! Serving static files from {frontend_dist_path}")

    # Mount static assets (JS, CSS, images, etc.)
    assets_path = os.path.join(frontend_dist_path, "assets")
    if os.path.exists(assets_path):
        app.mount("/assets", StaticFiles(directory=assets_path), name="assets")

    @app.get("/")
    async def serve_root():
        """Serve index.html at root."""
        index_path = os.path.join(frontend_dist_path, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)
        raise HTTPException(status_code=404, detail="Index not found")

    # Serve index.html for root and all other routes (SPA support)
    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        """Serve frontend for all non-API routes."""
        # If requesting a static file that exists, serve it
        file_path = os.path.join(frontend_dist_path, full_path)
        if os.path.exists(file_path) and os.path.isfile(file_path):
            return FileResponse(file_path)

        # Otherwise, serve index.html (for SPA routing)
        index_path = os.path.join(frontend_dist_path, "index.html")
        if os.path.exists(index_path):
            return FileResponse(index_path)

        raise HTTPException(status_code=404, detail="Frontend not found")
else:
    print(f"⚠️ Frontend dist not found at: {frontend_dist_path}")
    print("   Frontend will not be served. API-only mode.")

print("=" * 60)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
