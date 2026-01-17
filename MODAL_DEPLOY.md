# Modal.com Premium Chord Detection

## Quick Start

### 1. Install Modal CLI

```bash
pip install modal
```

### 2. Authenticate

```bash
modal token new
```

This will open a browser for authentication.

### 3. Deploy to Modal

```bash
modal deploy modal_chord_service.py
```

**Output:**
```
✓ Created web function chord_detection_endpoint
  URL: https://your-username--lyrics-chord-detector-premium-endpoint.modal.run
```

### 4. Add URL to Railway

In Railway dashboard → Environment Variables:

```
MODAL_CHORD_ENDPOINT=https://your-username--lyrics-chord-detector-premium-endpoint.modal.run
```

### 5. Test Locally (Optional)

```bash
modal run modal_chord_service.py test_song.mp3
```

---

## Cost Estimate

**Modal.com Pricing:**
- **Free tier:** 30 vCPU hours/month
- **GPU (T4):** $0.00045/second
- **Average song (3 min):** ~60s processing = **$0.027/song**

**Free tier capacity:**
- ~100-200 songs/month FREE
- After that: ~$0.03 per song

---

## How It Works

1. **User selects "Premium" quality** in frontend
2. **Railway backend** receives request
3. **Railway calls Modal.com** endpoint with audio file
4. **Modal.com:**
   - Spins up GPU container (T4)
   - Runs Demucs to separate guitar
   - Runs Madmom on isolated guitar
   - Returns chords
5. **Railway** returns results to frontend

**Processing time:** ~45-90 seconds per song

---

## Monitoring

View logs and usage:
```bash
modal app logs lyrics-chord-detector-premium
```

View costs:
```bash
modal profile current
```

---

## Troubleshooting

### "No module named 'modal'"
```bash
pip install modal
```

### "Authentication required"
```bash
modal token new
```

### "GPU quota exceeded"
Upgrade to Modal Pro plan or wait for free tier reset (monthly).

### Test endpoint manually
```bash
curl -X POST https://your-modal-url.modal.run \
  -F "audio_file=@test.mp3"
```
