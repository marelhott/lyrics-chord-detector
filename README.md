# 🎵 Lyrics & Chord Detector v2.0

Professional lyrics and chord detection application with AI-powered transcription and song structure recognition.

## ✨ Features

- 🌍 **Multi-language support** - Czech, Slovak, English, and 99+ languages with auto-detection
- 🎯 **Word-level precision** - Chords aligned to specific words
- 📋 **Song structure detection** - Automatic Intro/Verse/Chorus/Bridge/Outro recognition
- 🎸 **Advanced chord detection** - Supports 7th, sus, dim, aug chords
- 🎼 **Ultimate Guitar formatting** - Professional output with chords above lyrics
- 📄 **Multiple export formats** - TXT, PDF, JSON

---

## 🚀 Quick Start

### Backend

```bash
cd backend
pip3 install -r requirements.txt
python3 main.py
```

Backend runs on `http://localhost:8000`

Requires `OPENAI_API_KEY` for transcription.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`

---

## 📖 Full Documentation

- **Backend Setup:** [`backend/README.md`](backend/README.md)
- **API Documentation:** See backend README

---

## 🏗️ Architecture

### Backend (Python FastAPI)
- **OpenAI Whisper API** - Speech-to-text (requires `OPENAI_API_KEY`)
- **Chord detection** - Local chord estimation (chroma + Viterbi smoothing)
- **Librosa** - Audio analysis for song structure
- **Multi-language** - 99+ languages supported

### Frontend (React + Vite)
- **Ultimate Guitar Preview** - Professional lyrics display
- **Export Options** - TXT, PDF, JSON formats
- **Responsive Design** - Works on desktop and mobile

---

## 🎯 Usage

1. **Select Language** - Choose language or use auto-detect
2. **Upload Audio** - Drag & drop MP3/WAV file (max 50MB)
3. **Analyze** - Click "Analyzovat" and wait 30-60s
4. **View Results** - See lyrics with chords in Ultimate Guitar style
5. **Export** - Download as TXT, PDF, or JSON

---

## 📊 Example Output

```
[Intro]
G  B  C  Cm

[Verse 1]
       G                                    B
When you were here before, couldn't look you in the eyes
     C                        Cm
You're just like an angel, your skin makes me cry

[Chorus]
Cm
(x3, very short)
    G                B
But I'm a creep, I'm a weirdo
              C                Cm
What the hell am I doing here? I don't belong here
```

---

## 🛠️ Tech Stack

**Backend:**
- FastAPI 0.109.0
- OpenAI (Whisper API)
- Librosa 0.10.1

**Frontend:**
- React 19.2
- Vite 7.2.4
- Tailwind CSS 3.4.19
- jsPDF 3.0.4

---

## 🌐 Deployment

### Backend Options
- **Railway** - Recommended for easy setup
- **Render** - Free tier available
- **AWS/GCP** - For production scale

### Frontend Options
- **Netlify** - Recommended
- **Vercel** - Alternative
- **Cloudflare Pages** - Fast CDN


---

## 📝 API Endpoints

### `POST /api/process-audio`
Process audio file with lyrics and chord detection.

**Parameters:**
- `file` - Audio file (MP3/WAV, max 50MB)
- `language` - Optional language code (cs, sk, en, etc.)

**Response:**
```json
{
  "success": true,
  "text": "Full lyrics...",
  "language": "en",
  "structure": [...],
  "chords": [...],
  "aligned_chords": [...],
  "formatted_output": "[Intro]\nG B C..."
}
```

### `POST /api/detect-language`
Detect language without full processing.

### `GET /api/health`
Health check endpoint.

---

## 🎓 Supported Languages

Auto-detect or manually select from:
- 🇨🇿 Czech (cs)
- 🇸🇰 Slovak (sk)
- 🇬🇧 English (en)
- 🇩🇪 German (de)
- 🇫🇷 French (fr)
- 🇪🇸 Spanish (es)
- 🇮🇹 Italian (it)
- 🇵🇱 Polish (pl)
- And 90+ more languages

---

## ⚙️ Configuration

### Change Whisper Model

Edit `backend/main.py`:
```python
whisper_service = get_whisper_service(model_size="large-v3")  # Best quality
```

Options: `tiny`, `base`, `small`, `medium`, `large`, `large-v3`

---

## 🐛 Troubleshooting

### Backend won't start
```bash
# Install system dependencies (macOS)
brew install ffmpeg

# Install system dependencies (Linux)
sudo apt-get install ffmpeg libsndfile1
```

### Frontend build errors
```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Processing too slow
- Use smaller Whisper model (`small` or `tiny`)
- Disable Madmom chord detection
- Increase server resources

---

## 📄 License

MIT

---

## 🙏 Credits

- **OpenAI Whisper** - Speech-to-text
- **Madmom** - Chord detection
- **Librosa** - Audio analysis
- **FastAPI** - Backend framework
- **React** - Frontend framework

---

**Made with ❤️ for musicians**
