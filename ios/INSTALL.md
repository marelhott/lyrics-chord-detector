# Instalace Stem Studio na iPhone bez placeného vývojářského účtu

Balíček `StemStudio.ipa` je skutečný nativní SwiftUI klient. Zpracování hudby běží na Railway; výpočty na počítači pro provoz nepotřebuješ. IPA je nepodepsaná, podpis obstará SideStore prostřednictvím běžného Apple ID. Bez podpisu ji iPhone neotevře.

1. Na iPhonu je potřeba běžný Apple účet (Apple ID), kód zámku telefonu a iOS 17 nebo novější pro tuto aplikaci.
2. Jednorázově připrav SideStore podle [oficiálních požadavků](https://docs.sidestore.io/docs/installation/prerequisites) a [návodu instalace](https://docs.sidestore.io/docs/installation/install). Je potřeba počítač, kabel a aplikace iloader. Přihlášení k Apple účtu a případné dvoufázové ověření provádí uživatel; heslo se nevkládá do této aplikace ani zdrojového kódu.
3. SideStore používá LocalDevVPN. Jeho konfiguraci na telefonu musí povolit uživatel. Wi-Fi a aktivní LocalDevVPN jsou potřeba při instalaci a obnovování podpisů.
4. Po prvním přihlášení nejdřív obnov samotný SideStore podle jeho návodu. Pak otevři [stávající studio](https://lyrics-and-chord-frontend-production.up.railway.app/), přihlas se svým stávajícím heslem a stáhni [StemStudio.ipa](https://lyrics-and-chord-frontend-production.up.railway.app/api/app/ios).
5. V SideStore přes **+** vyber stažený balíček v Souborech. Při prvním spuštění případně dokonči důvěru vývojáři / Developer Mode podle pokynů telefonu a SideStore.
6. Stem Studio se otevře samostatně z plochy. Použij stejné heslo studia; knihovna i zpracované skladby zůstávají na stejném backendu.

Bezplatný podpis platí 7 dní a SideStore jej musí včas obnovovat. Bezplatný účet umožňuje tři aktivní sideload aplikace včetně SideStore. Podrobnosti: [oficiální FAQ](https://docs.sidestore.io/docs/faq). Při prvním načtení skladby klient stáhne MP3 stopy do cache, potom jsou hlasitost, solo a přehrávání lokální. Nové zpracování a knihovna potřebují síť.

Ověřeno: release build pro arm64 iPhone, skutečný backend v UI testu na simulátoru, synchronizace sedmi stop při změně rychlosti a seeku. Instalace, audio přerušení a poslech na fyzickém iPhonu zbývají ověřit. Pouhá kompilace ani tento balíček nepotvrzují bezchybnou separaci či přepis.
