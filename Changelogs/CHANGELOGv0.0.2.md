# 📋 Light Browser — Changelog

---

## v0.0.2 Beta — *u razvoju*

> Ova verzija donosi značajna poboljšanja u stabilnosti, sigurnosti i proširuje podršku na Android platformu.

---

### 🆕 Novo

#### 🤖 Android verzija (Beta)
- Započet razvoj Android verzije Light Browsera
- Browser je napravljen koristeći **Android WebView** unutar Android Studia (Java)
- HTML/CSS/JS frontend se učitava direktno iz `assets/` foldera kao `file:///android_asset/index.html`
- Implementiran **AndroidBridge** — Java klasa koja omogućava komunikaciju između JavaScript koda i nativnog Android koda (navigacija, goBack, goForward, reload, stopLoading)
- Dodat `android-bridge.js` koji kreira lažni `window.electronAPI` na Androidu kako bi `renderer.js` radio bez ikakvih izmjena
- Android verzija ima vlastiti **bottom navigation bar** sa dugmadima: nazad, naprijed, home, podešavanja
- Implementiran **ad blocker** na Java strani koji blokira poznate reklamne domene prije učitavanja
- Spoofovan Chrome Mobile user-agent da sajtovi ne blokiraju browser
- Omogućeno remote debugging putem `chrome://inspect`
- ⚠️ **Poznati bug:** WebView još uvijek zauzima cijeli ekran i prekriva bottom bar — bit će popravljeno u v0.0.3

#### 🧩 Extensions stranica
- Dodana nova stranica `extensions.html` u podešavanjima
- Prikazuje ugrađene zaštite kao "ekstenzije": Light AdBlocker, Fingerprint Shield, Privacy Headers, HTTPS Upgrader
- Svaka zaštita ima toggle (on/off) koji se čuva u `localStorage`
- Dodat link na Chrome Web Store za pregledanje ekstenzija (instalacija planirana za v0.0.3)

#### 🖥️ Title bar sa window kontrolama
- Dodat custom title bar sa **minimize / maximize / close** dugmadima
- Prozor je frameless (`frame: false`) — title bar je potpuno custom dizajniran
- Dugme za zatvaranje postaje crveno pri hoveru (Windows stil)
- Title bar je draggable (prozor se može pomicati držanjem title bara)

#### 📡 Offline stranica
- Kada nema internet konekcije, prikazuje se custom offline stranica umjesto default Chromium greške
- Stranica prikazuje: ikonu, poruku greške, URL koji nije uspio učitati, dugmad "Pokušaj ponovo" i "Idi kući", te savjete za rješavanje problema
- Automatski se detektuje putem `did-fail-load` eventa u Electronu

#### 🛡️ Fingerprint zaštita
- Dodata zaštita od browser fingerprintinga u `main.js`
- Briše Client Hints headere koji otkrivaju pravi hardver: `Sec-CH-UA-Arch`, `Sec-CH-UA-Bitness`, `Sec-CH-UA-Model`, `Sec-CH-Device-Memory` i ostali
- Spoofa `Sec-CH-UA` headerima da odgovaraju lažnom Chrome user-agentu

#### 📊 Resource Monitor
- Dodat panel za praćenje resursa (CPU i RAM korištenje)
- Otvara se klikom na ikonu mikrochipa u sidebaru
- Prikazuje: postotak CPU korištenja, RAM u MB sa progress barom, listu aktivnih procesa
- Automatski se osvježava svake 2 sekunde
- Boja bara se mijenja: plava (normalno) → žuta (upozorenje) → crvena (kritično)
  
---

### 🔧 Popravci

- **Settings stranica** — `fetch()` zamijenjen sa `XMLHttpRequest` koji radi na `file://` protokolu; više se ne prikazuje poruka *"Make sure you're using Live Server"*
- **Skaliranje na velikom monitoru** — BrowserView bounds se sada računaju i pri `maximize`, `unmaximize`, `enter-full-screen` i `leave-full-screen` eventima
- **Ikone nestaju na velikim ekranima** — dodan `min-width: 0` fix i `overflow: visible` za sve ikone u sidebaru i tab baru
- **URL bar boja** — search bar pozadina promijenjena sa `rgba(255,255,255,0.95)` (bijela) na `rgba(255,255,255,0.06)` (tamna, čitljiva)
- **Tekst u URL baru** — boja inputa promijenjena sa `#111` na `#fff` da bude vidljiv na tamnoj pozadini
- **BrowserView offset** — TOP_OFFSET povećan za visinu title bara (32px) da stranica ne prekriva UI

---

### 🗓️ Planirano za v0.0.3

- Popravak WebView problema na Androidu (zauzima cijeli ekran)
- Napraviti da predinstalirane ekstenzije rade
- Instalacija Chrome ekstenzija (.crx) nativno
- Bookmarks funkcionalnost
- Historija pretraživanja
- Poboljšan tab management (favicons, više tabova)
---

*Razvio: amar_avda | Licenca: GPLv3 | GitHub: [LightBrowser1/Light-Browser](https://github.com/LightBrowser1/Light-Browser)*
