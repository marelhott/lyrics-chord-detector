# Lyrics & Chord Detector

Webová aplikace pro detekci textu písní a akordů z audio souborů (MP3/WAV).

**🚀 100% Client-Side - Vše běží v prohlížeči, žádný server není potřeba!**

## Funkce

- 🎵 Upload MP3 a WAV souborů
- 📝 Automatický přepis textu (speech-to-text) pomocí Whisper AI
- 🎸 Detekce základních akordů pomocí Web Audio API
- 📄 Generování PDF s textem a akordy
- ⏱️ Zobrazení časových značek pro synchronizaci
- 🔒 Privacy-first - žádná data neopouštějí tvůj počítač
- 💰 Zcela zdarma - bez serverových nákladů

## Lokální spuštění

```bash
cd frontend
npm install
npm run dev
```

Aplikace poběží na `http://localhost:5173`

**První použití:** Při prvním spuštění se stáhne Whisper model (~40MB), což může trvat chvíli. Model se ukládá do cache prohlížeče pro budoucí použití.

## Deployment na Netlify

### Automatický deploy z GitHubu:

1. **Pushni kód na GitHub** (už máš hotovo ✓)

2. **Připoj repozitář na Netlify:**
   - Jdi na https://app.netlify.com/
   - Klikni "Add new site" → "Import an existing project"
   - Vyber GitHub a autorizuj
   - Vyber repozitář `lyrics-chord-detector`

3. **Nastav build settings:**
   - Base directory: `frontend`
   - Build command: `npm run build`
   - Publish directory: `frontend/dist`

4. **Deploy:**
   - Klikni "Deploy site"
   - Hotovo! 🎉

### Manuální deploy (alternativa):

```bash
cd frontend
npm run build
# Nahraj obsah složky dist/ na Netlify
```

## Technologie

- **React 18** - UI framework
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Transformers.js** - Whisper AI v prohlížeči
- **Meyda** - Audio feature extraction
- **Web Audio API** - Chord detection
- **jsPDF** - PDF generování

## Použití

1. Otevři aplikaci v prohlížeči
2. Klikni na "Select Audio File" a vyber MP3 nebo WAV soubor
3. Klikni na "Process Audio"
4. Počkej na zpracování (může trvat 30s - 2min podle délky souboru)
5. Zobrazí se text, akordy a timeline
6. Klikni na "Download PDF" pro stažení výsledků

## Omezení

- Kvalita detekce závisí na kvalitě nahrávky
- Nejlépe funguje s čistým zpěvem a nástroji
- Detekce akordů je základní (dur, moll, může mít nepřesnosti)
- Doporučená délka souboru: do 5 minut

## License

MIT
