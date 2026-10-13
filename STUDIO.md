# Stem Studio

Soukromé hudební studio s Railway backendem. `ios/` obsahuje nativní SwiftUI klient pro iPhone (iOS 17+), `frontend/` webový klient. Nativní klient stahuje stopy do cache a spouští AVAudioPlayerNode stopy v jednom AVAudioEngine se společným AVAudioUnitTimePitch; mute, solo, seek a rychlost se ovládají lokálně. Podporuje soubory, odkazy, hledání a přehrávání na pozadí. Podpis a instalace na zařízení vyžadují zvolenou distribuční cestu (TestFlight nebo sideload); nepodepsaný build není instalovaná aplikace.

Stemy jsou dostupné hned po separaci a exportu, ještě před přepisem a akordy. `partial.json` uchovává checkpointy, `result.json` hotový výsledek, `timings` měří fáze a `processing.log` obsahuje jejich časy. Po restartu se hotové fáze neopakují. Separace používá původní dekódované audio, float32 výstup, segment 7 s a překryv 25 %. Všechny stemy mají stejný exportní gain, takže se jednotlivě nenormalizují a nemění vzájemný poměr hlasitosti.

## Provoz

- Railway projekt `Lyrics & chord detector`: backend hostuje FastAPI, front-end build a jediného CPU workera. Stávající frontend služba používá Caddy jako proxy na backend a zachovává původní URL.
- Kořenový `Dockerfile` a `railway.json` jsou produkční konfigurace. Runtime se spouští Docker CMD; společný startCommand by nesprávně přepsal také Caddy službu.
- `/data` je persistentní volume: SQLite knihovna, audio, logy úloh a cache Whisper modelu. Rozpracované úlohy se po restartu vrátí do fronty.
- `STUDIO_PASSWORD` je serverové přístupové heslo; lokální kopie je pouze v gitignorovaném `.local/access.txt`. Nevkládat heslo do GitHubu ani frontendového buildu.
- Modely: Demucs `htdemucs_6s` (CPU, 6 stop), faster-whisper `small` int8, lokální chroma/HMM odhad základních dur/moll akordů. Žádné placené modelové API.
- Maximálně jedna běžící úloha, tři úlohy ve frontě včetně běžící, 80 MB / 10 minut na audio; knihovna omezená na 4 GB. Po dokončení se mažou mezisoubory WAV. Log je `/data/<id>/processing.log`.

## Ovládání

Originál / stemy, hlasitost přes Web Audio gain, mute / solo, samostatný MP3 export, zpomalení se zachováním výšky, opakování úseku, přeskok přes akord nebo slovo. Vlny pocházejí ze skutečných oddělených stop. Mobilní layout a omezení animací dle `prefers-reduced-motion`.

## Přesnost a omezení

Oddělení stop může mít přeslechy; model má zejména slabší piano. Akordy nejsou přesný přepis kytary: rozpoznávají základní major/minor harmonii celého doprovodu. Přepis zpěvu ani jeho časování nelze slíbit jako bezchybné. Rozšířené akordy, hmaty, tabulatury a ruční opravy nejsou implementované.

Import obsahuje hledání YouTube/SoundCloud (6 výsledků, výběr jedním klepnutím), soubory a HTTPS odkazy. Hledání používá yt-dlp bez placeného API klíče; výsledky mají 5minutovou cache. YouTube import má Node 22 runtime a yt-dlp EJS komponenty dle oficiálního návodu https://github.com/yt-dlp/yt-dlp/wiki/EJS. Cloudové IP mohou být blokované poskytovatelem; Spotify ani libovolná stránka neposkytují univerzálně stažitelné audio. Odkazy nenahrazujeme jinou skladbou. Soubor je nejspolehlivější cesta.

Webový klient používá HTML audio streamy; průběžné přeskakování jednotlivých stop bylo odstraněno, protože způsobovalo záseky. Nativní klient používá lokální soubory a společný čas spuštění AVAudioPlayerNode v AVAudioEngine se společným zpomalením. Přehrávání v integrovaném prohlížeči a responzivní náhled nenahrazují test na fyzickém iPhonu, zvláště uspání aplikace a audio na pozadí.

## Vývoj a nasazení

```sh
cd frontend
npm ci
npm run lint
npm run build
```

```sh
.venv/bin/python -m unittest discover -s tests -v
railway up --service backend --detach
railway up --service 'Lyrics & chord frontend' --detach
```

Po nasazení ověř `/api/health`, přihlášení, skutečnou separaci a dostupnost všech sedmi audio souborů. Úspěšný build není ověření modelů. Původní backend a starší komponenty zůstávají v historii/repozitáři; produkční vstup je `backend/studio.py`.

Nativní build a ověření:

```sh
xcodegen generate --spec ios/project.yml
xcodebuild -project ios/StemStudio.xcodeproj -scheme StemStudio -sdk iphoneos -configuration Release -derivedDataPath .local/ios-build CODE_SIGNING_ALLOWED=NO build
```

Nepodepsaný build slouží k ověření kompilace. Pro TestFlight je potřeba Apple Developer tým a App Store Connect. Simulátor a skutečný iPhone musí ověřit dotykové ovládání, synchronizaci, zamčení telefonu a audio přerušení; kompilace tato ověření nenahrazuje.

Ověření 2026-10-13: cloudová skladba alt-J (3:46) zpřístupnila všechny audio stopy za 86,45 s, celý výsledek za 147,47 s. Separace/export 84,256 s, akordy 14,374 s, text 46,045 s. Tyto časy patří tomuto konkrétnímu vstupu, nejsou garancí jiné skladby. iOS test prošel se sedmi stopami při startu, seeku, změně rychlosti a pauze (rozdíl pozic pod 20 ms); živý UI test ověřil přihlášení, skutečnou knihovnu, stažení stop, play/pause a solo v simulátoru iPhone 17e. Fyzický iPhone a poslechová kvalita separace nejsou tímto testem potvrzené.

Instalační balíček je dostupný za stávajícím přihlášením na `/api/app/ios`. Je nepodepsaný a musí jej podepsat SideStore/iloader s uživatelovým běžným Apple účtem. Postup je v `ios/INSTALL.md`.

CPU benchmark na stejném 30s úseku, stejný model a parametry: zahřátý běh se 4 vlákny 7,695 s, 6 vlákny 6,707 s, 8 vlákny 5,709 s. Výchozí separace proto používá 8 vláken (lze snížit přes `STEM_CPU_THREADS`). Tento mikrobenchmark není celkový čas hotové skladby.
