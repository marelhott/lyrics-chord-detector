# Audit a návrh vylepšení

## Stav aplikace (teď)

- Frontend: React + Vite + Tailwind, hlavní flow upload/Spotify → processing → výsledky/export.
- Backend: FastAPI s prefixem `/api`, pipeline transkripce → akordy → struktura → zarovnání → formát UG.
- Akordy: lokální detekce (chroma + Viterbi), volitelně se separací vokálů.
- Transkripce: OpenAI Whisper API (vyžaduje `OPENAI_API_KEY`).

## Co bylo vyčištěno / sjednoceno

- Odstraněny nepoužívané frontend komponenty (UI/figma scaffolding) a závislosti, které nebyly nikde importované.
- Opraveny rozpory v konfiguraci a dokumentaci (prefix `/api`, Railway/Nixpacks základ).
- Zjednodušen a zpřesněn build (tailwind config bez chybějících pluginů).

## Rizika a chyby (na které si dát pozor)

### Konfigurace klíčů

- Bez `OPENAI_API_KEY` backend neprovede transkripci ani detekci jazyka.
- Detekce akordů běží lokálně (chroma + Viterbi).

### Latence a UX

- Whisper má latenci úměrnou délce tracku. Pro delší skladby je lepší asynchronní režim (job/polling) a průběžný progress.

### Spotify download

- Současný přístup je „Spotify URL → oEmbed → YouTube search přes yt-dlp“.
- Kvalita a spolehlivost výsledku se liší (může se stáhnout jiná verze/cover). Pro produkci je lepší explicitní zdroj audia (YouTube link, nebo vlastní upload), případně Spotify API + legální audio zdroj.

## Návrh vylepšení (konkrétní)

### 1) Udělat pipeline robustní a pozorovatelnou

- Přidat jednotný „job model“ (id, status, progress, createdAt, error, result).
- Přepnout dlouhé operace na async processing:
  - `POST /api/jobs` vytvoří job
  - `GET /api/jobs/{id}` vrací status
  - `GET /api/jobs/{id}/result` vrací výsledek
- Přidat strukturované logování (bez citlivých dat) + korelační id.

### 2) Cache a deduplikace

- Použít hash audia (už existuje) k cache výsledků:
  - Transkripce cache
  - Akordy cache
  - Finální formátovaný output cache
- Pro Whisper držet cache klíč minimálně `audio_hash + model_version + params`.

### 3) Akordy (kvalita)

- Normalizace výstupu z různých providerů do jednoho formátu:
  - `[{ chord, time, confidence? }]` + volitelně `start/end`.
- Post-processing:
  - sloučit duplicitní sousední akordy
  - kvantizace na beat grid (volitelně) pro „čistší“ UG výstup
  - filtrování krátkých „bliknutí“ (min duration)
- Přidat „quality switch“ do UI (free/premium) s jasným popisem.

### 4) Texty (kvalita)

- U Whisperu kontrolovat konzistenci word timestamps:
  - pokud `words` chybí, přejít na segment-only alignment a zobrazit upozornění
- Přidat volby:
  - pevný jazyk vs auto
  - „vocal-heavy“ režim (agresivnější filtr šumu)

### 5) Zarovnání akordy ↔ slova

- Zlepšit mapování akordu na slovo:
  - místo „nejbližší slovo“ používat okno (time window) + penalizaci skoků
  - zvlášť řešit intra-word vs inter-word případy
- Přidat fallback, pokud akordů je extrémně mnoho (downsample).

### 6) Bezpečnost a provoz

- Nikdy nevracet klíče do klienta.
- Rate limiting na `process-*` endpointy.
- Limit velikosti souboru už existuje, doplnit i limit délky audio (např. 10 min) pro free tier.

### 7) Frontend UX

- Přidat „Upload“ a „Spotify“ jako jasný primární/sekundární tok.
- Přidat progress stav z backendu (ne jen spinner).
- Po dokončení přidat „Copy“ tlačítko pro UG text.

## Doporučené pořadí prací

1. Job model + polling + progress (největší dopad na UX a stabilitu)
2. Cache výsledků podle audio hashe (náklady + rychlost)
3. Post-processing akordů (sloučení/kvantizace/filtry)
4. Vylepšení Whisper a fallbacky pro slova
5. Zpřesnění zarovnání a struktury
