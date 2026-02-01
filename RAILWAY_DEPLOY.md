# Railway Deployment Guide

## Quick Start

### 1. Create New Railway Project

1. Go to [railway.app](https://railway.app)
2. Click "New Project"
3. Select "Deploy from GitHub repo"
4. Choose `lyrics-chord-detector` repository
5. Railway will use Nixpacks config (`nixpacks.toml`)

### 2. Configure Build

This repo ships a working Nixpacks setup:
- `nixpacks.toml` installs Python + Node + ffmpeg and builds the frontend.
- `railway.json` sets builder to Nixpacks.

### 3. Add Environment Variables

In Railway dashboard → Variables:

```
OPENAI_API_KEY=sk-proj-your-key-here
```

### 4. Deploy

Click "Deploy" and wait ~5-10 minutes for build.

### 5. Get URL

After successful deployment:
- Copy the public URL (e.g., `https://lyrics-backend-production.up.railway.app`)
- Use this URL in Netlify as `VITE_API_URL`

---

## Troubleshooting

### Build fails with "Out of memory"

**Solution:** Railway free tier has 512MB RAM limit during build.
- Use `requirements.railway.txt` (minimal dependencies)
- Upgrade to Railway Pro ($5/month) for more RAM

### Build timeout

**Solution:** Build takes >10 minutes
- Railway will retry automatically
- Check logs for specific error

### "Module not found" error

**Solution:** Missing dependency
- Check `requirements.railway.txt` includes all needed packages
- Verify `Aptfile` has system dependencies

### Application crashes on startup

**Solution:** Missing `OPENAI_API_KEY`
- Add environment variable in Railway dashboard
- Redeploy

---

## Incremental Upgrade Path

### Phase 1: Basic Deployment (Current)
- ✅ Librosa chord detection
- ✅ OpenAI Whisper transcription
- ✅ Fast deployment (~5-10 min build)

### Phase 2: Add Madmom (Later)
```bash
# Update requirements.railway.txt:
+ Cython==3.0.0
+ madmom==0.16.1
```

### Phase 3: Add Demucs (Optional)
```bash
# Update requirements.railway.txt:
+ torch==2.1.0
+ torchaudio==2.1.0
+ demucs==4.0.1
```

**Note:** Phase 2 & 3 require Railway Pro due to memory requirements.

---

## Current Configuration Files

### ✅ nixpacks.toml
Defines packages (Python 3.11, Node 20, ffmpeg) + install/build/start phases.

### ✅ Procfile (optional)
Railway uses Nixpacks start command, Procfile is optional.

---

## Success Criteria

✅ Build completes in <10 minutes
✅ Application starts without errors
✅ `/health` endpoint returns 200
✅ Demo processing works
✅ No "out of memory" errors

---

## Next Steps After Successful Deploy

1. Test `/health` endpoint
2. Test `/process-demo` with sample MP3
3. Update Netlify `VITE_API_URL`
4. Test full flow from frontend
5. Consider upgrading to add Madmom (Phase 2)
