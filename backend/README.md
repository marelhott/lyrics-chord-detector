# 🎵 Lyrics & Chord Detector v2.0 - Backend Setup

## ✨ New Features

- ✅ **Multi-language support** (Czech, Slovak, English, auto-detect)
- ✅ **Word-level timestamps** for precise chord alignment
- ✅ **Advanced chord detection** (7th, sus, dim, aug chords)
- ✅ **Song structure detection** (Intro, Verse, Chorus, Bridge, Outro)
- ✅ **Ultimate Guitar style formatting** with chords above lyrics

---

## 📦 Installation

### 1. Install Python Dependencies

```bash
cd backend
pip install -r requirements.txt
```

**Note:** This will install:
- `stable-ts` - For word-level timestamps (requires ~5 minutes first time)
- `madmom` - For advanced chord detection (requires ~10 minutes first time)
- Whisper `medium` model (~1.5GB download on first run)

### 2. Test Installation

```bash
python -c "import stable_whisper; import madmom; print('✅ All dependencies installed!')"
```

---

## 🚀 Running the Backend

```bash
cd backend
python main.py
```

The API will start on `http://localhost:8000`

**First startup will take 5-10 minutes** to download models:
- Whisper medium model (~1.5GB)
- Madmom chord recognition models (~500MB)

---

## 🧪 Testing the API

### Test 1: Basic Health Check

```bash
curl http://localhost:8000/health
```

Expected response:
```json
{
  "status": "healthy",
  "whisper_model": "medium",
  "chord_detection": "madmom",
  "version": "2.0.0"
}
```

### Test 2: Language Detection

```bash
curl -X POST http://localhost:8000/detect-language \
  -F "file=@path/to/your/song.mp3"
```

### Test 3: Full Processing (English)

```bash
curl -X POST http://localhost:8000/process-audio \
  -F "file=@path/to/your/song.mp3" \
  -F "language=en"
```

### Test 4: Full Processing (Czech - Auto-detect)

```bash
curl -X POST http://localhost:8000/process-audio \
  -F "file=@path/to/your/song.mp3"
```

---

## 📊 API Response Format

```json
{
  "success": true,
  "filename": "song.mp3",
  "text": "Full transcribed lyrics...",
  "language": "en",
  "segments": [
    {
      "text": "When you were here before",
      "start": 8.2,
      "end": 10.5,
      "words": [
        {"word": "When", "start": 8.2, "end": 8.4},
        {"word": "you", "start": 8.5, "end": 8.6},
        ...
      ]
    }
  ],
  "chords": [
    {"chord": "G", "time": 8.3, "confidence": 0.85},
    {"chord": "B", "time": 10.1, "confidence": 0.92}
  ],
  "structure": [
    {
      "type": "intro",
      "start": 0,
      "end": 8,
      "segments": []
    },
    {
      "type": "verse",
      "number": 1,
      "start": 8,
      "end": 32,
      "segments": [...]
    },
    {
      "type": "chorus",
      "start": 32,
      "end": 48,
      "segments": [...]
    }
  ],
  "aligned_chords": [
    {
      "chord": "G",
      "time": 8.3,
      "word": "When",
      "word_index": 0,
      "segment_index": 0
    }
  ],
  "formatted_output": "[Intro]\nG  B  C  Cm\n\n[Verse 1]\n       G                                    B\nWhen you were here before, couldn't look you in the eyes\n..."
}
```

---

## ⚙️ Configuration

### Change Whisper Model

Edit `backend/main.py` line 37:

```python
# Options: "tiny", "base", "small", "medium", "large", "large-v3"
whisper_service = get_whisper_service(model_size="medium")
```

**Model comparison:**
- `tiny` (150MB) - Fast, lower quality
- `medium` (1.5GB) - **Recommended** - Good balance
- `large-v3` (3GB) - Best quality, slower

### Disable Madmom (Use Librosa Fallback)

Edit `backend/main.py` line 38:

```python
chord_service = get_chord_service(use_madmom=False)
```

---

## 🐛 Troubleshooting

### Error: "stable-ts not installed"

```bash
pip install -U stable-ts
```

### Error: "madmom not installed"

```bash
pip install madmom
```

**Note:** Madmom requires system dependencies on some platforms:

**macOS:**
```bash
brew install ffmpeg
```

**Linux:**
```bash
sudo apt-get install ffmpeg libsndfile1
```

### Error: "Model download failed"

Check your internet connection. Models are downloaded from:
- Whisper: OpenAI servers
- Madmom: GitHub releases

### Performance Issues

If processing is too slow:
1. Use smaller Whisper model (`small` or `tiny`)
2. Disable Madmom: `use_madmom=False`
3. Increase server resources (RAM, CPU)

---

## 📝 Supported Languages

Whisper supports 99 languages. Common ones:

- `en` - English
- `cs` - Czech
- `sk` - Slovak
- `de` - German
- `fr` - French
- `es` - Spanish
- `it` - Italian
- `pl` - Polish
- `ru` - Russian
- `ja` - Japanese
- `ko` - Korean
- `zh` - Chinese

Use `null` or omit `language` parameter for auto-detection.

---

## 🎯 Next Steps

1. ✅ Backend is ready
2. ⏳ Update frontend to use new API features
3. ⏳ Add language selector UI
4. ⏳ Add Ultimate Guitar preview component
5. ⏳ Add editing capabilities

---

## 📚 Service Architecture

```
backend/
├── main.py                          # Main FastAPI app
├── services/
│   ├── whisper_service.py          # Enhanced Whisper with word timestamps
│   ├── chord_detection.py          # Madmom chord detection
│   ├── structure_detection.py      # Song structure recognition
│   └── alignment_service.py        # Chord-to-lyric alignment
└── requirements.txt                 # Dependencies
```

---

**Ready to test! 🚀**
