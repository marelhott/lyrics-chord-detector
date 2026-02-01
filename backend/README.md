# 🎵 Lyrics & Chord Detector v2.0 - Backend

## 📦 Instalace

Používá se `requirements.txt` v rootu repozitáře:

```bash
pip3 install -r requirements.txt
```

Vyžaduje nastavit `OPENAI_API_KEY` (transkripce).

## 🚀 Spuštění

```bash
cd backend
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000
```

API poběží na `http://localhost:8000/api`.

## 🧪 Testy endpointů

```bash
curl http://localhost:8000/api/health
```

```bash
curl -X POST http://localhost:8000/api/process-audio \
  -F "file=@path/to/your/song.mp3" \
  -F "language=en" \
  -F "vocal_heavy=false"
```

---

## 📊 API Response Format

```json
{
  "success": true,
  "filename": "song.mp3",
  "title": "Song",
  "artist": "Artist",
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
