# Deployment na Hugging Face Spaces

## 🚀 Rychlý deployment (2 minuty)

1. **Jdi na:** https://huggingface.co/spaces
2. **Klikni:** "Create new Space"
3. **Nastav:**
   - Space name: `lyrics-chord-detector`
   - License: `mit`
   - Space SDK: **Gradio**
   - Space hardware: **CPU basic** (zdarma)
4. **Klikni:** "Create Space"

## 📤 Upload souborů

Nahraj tyto soubory:
- `app.py` (hlavní aplikace)
- `requirements-hf.txt` → přejmenuj na `requirements.txt`

## ✅ Hotovo!

Za ~5 minut bude aplikace živá na: `https://huggingface.co/spaces/YOUR-USERNAME/lyrics-chord-detector`

## 🔗 Propojení s Netlify frontendem

V Netlify environment variables nastav:
- `VITE_API_URL` = `https://YOUR-USERNAME-lyrics-chord-detector.hf.space`
