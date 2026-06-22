# STEP.md — Entwicklungsdokumentation Food Selector

Dieses Dokument beschreibt den Entwicklungsverlauf, die Architekturentscheidungen
und die Verifikation pro Schritt. Es wird gemäß Projektprompt nach jedem größeren
Entwicklungsschritt aktualisiert.

---

## Projektziel

Eine Web-App, die hilft, ein Restaurant vorzuschlagen, ohne selbst entscheiden zu
müssen: Restaurants verwalten, analysieren, klassifizieren, Präferenzen
berücksichtigen und nachvollziehbar begründete Vorschläge liefern. Daten liegen in
einer externen PostgreSQL-Datenbank (Neon), Zugriff ausschließlich über die
Backend-API.

## Scope (umgesetzt)

- Restaurant-Datenbank (Neon PostgreSQL über Prisma)
- Restaurant-CRUD (API + UI)
- Restaurant-Analyse über austauschbare Analyzer
- Google-Maps-Link-Parser (Identifikator, kein Scraping)
- Manual-Paste-Analyzer (regelbasiert, ohne API-Key)
- OSM/Overpass-Analyzer (kostenlos)
- optionaler Google-Places-Analyzer (serverseitig, nur mit Key)
- optionaler OpenAI-Analyzer (serverseitig, nur mit Key)
- Datenqualität: Feldvorschau mit Konfidenz, Quellen, Begründung, Nutzerbestätigung
- Entscheidungslogik („Entscheide für mich") mit Modi, Filtern, Scoring, Begründung
- Konfiguration (Kategorien, Tags, Profile, Defaults)
- JSON Import/Export
- Dashboard

## Nicht-Ziele (bewusst ausgelassen)

- Authentifizierung / Multi-User (siehe „Spätere Schritte")
- Google-Maps-Scraping (ausdrücklich verboten)
- automatische Übernahme analysierter Daten ohne Bestätigung
- bezahlte APIs als Pflichtvoraussetzung — App ist ohne sie nutzbar
- Website-HTML-Crawler (Endpoint `/api/analyze/website` ist nicht implementiert;
  bewusst ausgelassen, siehe „Bekannte Einschränkungen")

---

## Architekturentscheidungen

### Warum kein Supabase
Projektvorgabe. Supabase wird weder als DB noch als Auth/Storage genutzt. Es gibt
keine Supabase-Abhängigkeit im Code oder in den `package.json`-Dateien.

### Warum externe DB / Neon PostgreSQL
Vorgabe „externe Datenbank, bevorzugt Neon PostgreSQL". Neon ist serverless,
kostenlos im Free-Tier, Standard-PostgreSQL-kompatibel und über eine einzige
`DATABASE_URL` ansteuerbar. Der Nutzer hat einen echten Neon-Connection-String
bereitgestellt; Migration und Seed wurden gegen diese reale DB ausgeführt.

### Warum Backend/API-Schicht
Vorgaben: Das Frontend darf nicht direkt auf die DB zugreifen, Secrets dürfen nie
ins Frontend. Daher kapselt ein Node/Express-Backend alle DB-Zugriffe (Prisma),
optionale externe APIs (Google Places, OpenAI, Overpass) und die Analyse-Logik.
Secrets liegen ausschließlich serverseitig in Environment-Variablen.

### Warum keine DB-Zugriffe direkt aus dem Frontend
Sicherheit: Ein direkter DB-Zugriff würde Credentials im Client erzwingen und jede
serverseitige Validierung umgehen. Stattdessen spricht das Frontend nur die
REST-API unter `/api/*` an (im Dev über Vite-Proxy auf `localhost:4000`).

### Warum keine API-Keys im Frontend
`OPENAI_API_KEY` und `GOOGLE_PLACES_API_KEY` würden im Browser-Bundle landen und
wären öffentlich abgreifbar. Beide Analyzer laufen daher nur im Backend; ohne Key
liefern sie eine klare Warnung und die App funktioniert weiter.

### Warum Prisma als ORM
Vom Nutzer gewählt (Alternative war Drizzle). Prisma bietet ein integriertes
Migrationssystem, einen typsicheren Client und einfaches Seeding. Schema unter
`backend/prisma/schema.prisma`, Migration `20260622112951_init`.

### Warum Analyzer-Interface
Vorgabe „austauschbare Analyzer über Interfaces". Alle Analyzer implementieren
`RestaurantAnalyzer` (`analyze(input) => RestaurantAnalysisResult`). Dadurch sind
Manual/OSM/Google-Places/OpenAI uniform aufrufbar, einzeln testbar und ohne
Änderung der Aufrufer austauschbar. Der gemeinsame Ergebnistyp transportiert
Quellen, Konfidenz pro Feld, Begründung, Warnungen und ExtractedFacts.

---

## Datenbankauswahl & Datenmodell

PostgreSQL (Neon). Tabellen (Prisma-Modelle → `@@map`):

- `restaurants` — Stammdaten inkl. `fieldStatuses`, `confidenceByField` (JSON)
- `restaurant_sources` — Quellen pro Restaurant
- `extracted_facts` — analysierte Fakten mit Status/Konfidenz
- `restaurant_visits` — Besuchshistorie
- `decision_profiles` — Entscheidungsprofile
- `categories`, `tags`, `classifications`
- `app_settings` — Key/Value-Konfiguration
- `analysis_runs` — (Modell vorhanden für spätere Analyse-Protokollierung)
- `suggestion_history` — generierte Vorschläge + akzeptiert/abgelehnt

Enums: `FieldStatus`, `SourceType`, `SourceReliability`.

## API-Design

Restaurants: `GET/POST /api/restaurants`, `GET/PUT/DELETE /api/restaurants/:id`,
`POST /api/restaurants/:id/visit|favorite|blacklist`.
Analyse: `POST /api/analyze/manual|osm|google-places|openai`.
Google Maps: `POST /api/parse/google-maps-link`.
Entscheidung: `POST /api/decide`, `POST /api/decide/respond`.
Konfiguration: `GET/PUT /api/config`, `GET/POST/DELETE /api/categories`,
`GET/POST/DELETE /api/tags`, `GET/POST/PUT/DELETE /api/decision-profiles`.
Import/Export: `GET /api/export`, `POST /api/import`.

Eingaben werden serverseitig mit Zod validiert; Fehler über zentralen
`errorHandler` (400 bei Zod, 404/500 sonst).

## ORM/Migrationskonzept

`prisma migrate dev --name init` erzeugte die Migration und legte alle Tabellen in
Neon an. `prisma db seed` (Skript `prisma/seed.ts`) füllt Kategorien, Tags,
Klassifizierungen, ein Standard-Entscheidungsprofil und drei klar als „(Demo)"
gekennzeichnete Beispielrestaurants. Demo-Daten sind manuell verfasste
Entwicklungsdaten, keine recherchierten Fakten über echte Restaurants.

---

## Analyzer-Konzept

Gemeinsames Interface in `backend/src/analyzers/types.ts`. Jeder Analyzer gibt
`suggestedRestaurant`, `sources`, `confidence.{overall,fields}`, `reasoning`,
`warnings` und `extractedFacts` zurück. Confidence-Werte sind bewusst moderat:
nichts wird automatisch als Wahrheit gespeichert.

### Google-Maps-Link-Konzept
`googleMapsParser.ts` erkennt Linktyp (`google_maps_place|search|shortlink|share`),
normalisiert den Link und extrahiert — soweit ohne Scraping möglich — Name,
Koordinaten (`@lat,lng` oder `q=`), Place-ID/CID und Suchquery. Google Maps wird
**nicht** gescraped; der Link dient als Identifikator. Alle abgeleiteten Werte
erhalten eine Warnung „erst nach Bestätigung durch eine weitere Quelle gesichert".

#### Kurzlinks/Redirects
`maps.app.goo.gl`/`goo.gl/maps` werden serverseitig per `fetch(redirect:"manual")`
entlang der `Location`-Header bis zur kanonischen Maps-URL aufgelöst. Es wird
ausschließlich die Redirect-Kette betrachtet, nie der HTML-Inhalt der Zielseite —
das ist kein Scraping. Der Mechanismus wurde gegen einen lokalen Mock-Redirect
verifiziert.

### Google-Places-Konzept
`googlePlacesAnalyzer.ts` nutzt die Places API (New) `places:searchText`
serverseitig mit `X-Goog-Api-Key` und Field-Mask. Wird nur aktiv, wenn
`GOOGLE_PLACES_API_KEY` gesetzt ist; sonst Warnung + Skip. Liefert Name, Adresse,
Koordinaten, Place-ID, Website, Telefon, Öffnungszeiten, Rating, Preisniveau,
Kategorien. Verifiziert: No-Key-Pfad live, Parsing-Logik gegen Mock-Server.

### OpenAI/API-Hinweise
`openaiAnalyzer.ts` nutzt `chat/completions` mit Structured Outputs
(`response_format: json_schema, strict`). Nur aktiv mit `OPENAI_API_KEY`.
Ausdrücklicher Hinweis im Warntext: Ein ChatGPT-Abo ersetzt **keinen**
OpenAI-API-Key — getrennte Produkte. Verifiziert: No-Key-Pfad live,
Strukturierte-Ausgabe-Parsing gegen Mock-Server.

### Warum OSM/Overpass als Fallback
Kostenlos und ohne Key nutzbar. `osmAnalyzer.ts` fragt die Overpass-API per GET ab
(Koordinaten-Umkreis bevorzugt, Stadt-`area` als Fallback) und mappt OSM-Tags
(`name`, `addr:*`, `cuisine`, `website`, `phone`, `opening_hours`, `diet:*`,
`delivery`, `takeaway`) auf Restaurantfelder. Verifiziert mit realen Berliner
OSM-Daten (Treffer „Nordsee" mit vollständigen Feldern).

### Manual-Paste-Fallback
`manualPasteAnalyzer.ts` extrahiert regelbasiert (Regex/Keywords) Telefon, URL,
Adresse, Stadt, Öffnungszeiten (inkl. Wochentagsbereiche „Mo-Fr"), Küchen,
Diät-/Service-Hinweise und einen geratenen Namen. Funktioniert garantiert ohne
jede bezahlte API. Drei beim Testen gefundene Bugs (fehlende `www.`-URLs,
nicht-expandierte Tagesbereiche, zeilenübergreifende Adress-Treffer) wurden
behoben und durch Unit-Tests abgesichert.

---

## Entscheidungslogik

`backend/src/decide/engine.ts` (reine Funktion, ohne DB). Modi: safe, new, cheap,
near, group, date, quick, cozy, surprise, balanced. Ablauf:

1. Harte Filter: Blacklist schließt immer aus (Priorität 1). Wiederholungssperre
   (`repeatBlockDays`), `maxPriceLevel`, `maxDistance`, `requiredTags`.
2. Normalisierte Signale [0,1] (personalRating, externalRating, novelty,
   cheapness, proximity, favorite, group/date/quick/cozy-Eignung, random).
3. Pro Modus gewichtete Summe + Recency-Penalty (kürzlich besucht wird abgewertet)
   + kleiner Zufalls-Jitter. Optional Favoriten-Bonus.
4. Bestes Ergebnis als Hauptvorschlag, weitere als Alternativen.
5. Jeder Vorschlag trägt eine `reasons`-Liste (nachvollziehbare Begründung).
6. Vorschläge und Akzeptanz/Ablehnung werden in `suggestion_history` gespeichert.

Determinismus: optionaler `seed` (mulberry32-PRNG) für reproduzierbare Tests.

## Datenqualität

Jedes analysierte Feld bekommt Status (`RECOGNIZED|UNCERTAIN|CONFLICTING|CONFIRMED|
MODIFIED|DISCARDED`). Die Analyse-UI zeigt vor dem Speichern eine Tabelle mit
Feldname, Wert, Quelle, Konfidenz (%), Begründung und Checkbox. Buttons: „Alle
sicheren Felder übernehmen", „Alle Vorschläge prüfen", „Verwerfen". Nur bestätigte
Felder werden gespeichert (`fieldStatuses=CONFIRMED`, `confidenceByField`). Damit
wird die Vorgabe erfüllt, dass automatisch erkannte Daten nicht ungeprüft als
Wahrheit gespeichert werden.

### Datenpriorität
Implementiert über Confidence-Werte der Quellen (Blacklist/Nutzerbestätigung >
Google Places > Website/OSM > Manual-Paste > Heuristik > Maps-Link-Hinweise) und
über die verpflichtende Nutzerbestätigung, die jede automatische Übernahme
überschreibt.

---

## Umsetzungsschritte (chronologisch, je mit Verifikation)

1. Projektstruktur (npm-Workspaces backend/frontend, .gitignore) → verifiziert per
   Verzeichnis-Listing.
2. Backend-Grundgerüst (Express, CORS, JSON, errorHandler, /health) → `/health`
   liefert `{status:"ok"}`.
3. Prisma-Schema (alle Tabellen/Enums) → `prisma migrate dev` erfolgreich.
4. Migration gegen Neon → `prisma db pull --print` zeigt alle 11 Tabellen live.
5. Seed → 3 Demo-Restaurants, 3 Kategorien, 1 Profil; per Query bestätigt.
6. Restaurants-CRUD → kompletter Lebenszyklus (create/get/update/favorite/visit/
   delete/404) live gegen Neon getestet.
7. Frontend-Grundgerüst (Vite/React/TS, Tailwind v4, Router, App-Shell) → Build +
   Dev-Proxy auf `/api` verifiziert.
8. API-Client + Typen.
9. Analyzer-Interfaces (`types.ts`).
10. Google-Maps-Parser → 6 URL-Formen live getestet + 7 Unit-Tests; Redirect gegen
    Mock verifiziert.
11. Manual-Paste-Analyzer → live getestet, 3 Bugs gefixt, 5 Unit-Tests.
12. OSM/Overpass-Analyzer → reale Berliner Daten; 406-Ursache (fehlender
    User-Agent) gefunden und behoben; Timeout/Retry ergänzt.
13. Google-Places-Analyzer → No-Key live, Parsing gegen Mock.
14. OpenAI-Analyzer → No-Key live, Structured-Output-Parsing gegen Mock.
15. Restaurants-UI (Liste/Filter/Form) → Browser-Walkthrough (Playwright), Create →
    DB → Redirect verifiziert, 0 Console-Errors.
16. Analyse-UI → Browser-Walkthrough: Maps-Link parsen → Manual-Analyse → Felder
    bestätigen → speichern → Restaurant persistiert. 0 Console-Errors.
17. Entscheidungslogik → 8 Unit-Tests + Live-API; UI mit Begründung/Alternativen.
18. Konfiguration (Config-Route + UI) → GET/PUT/Kategorien/Tags/Profile live.
19. Import/Export → Export- und Import-Round-Trip live verifiziert.
20. UI-Polish (Dashboard) → Browser-Walkthrough aller Seiten, 0 Console-Errors.
21. Verifikation → Backend typecheck + 20 Tests + Backend-Build + Frontend-Build
    + Browser-Walkthrough, alles grün.
22. STEP.md / README.md.

## Geänderte/erstellte Dateien (Auswahl)

- `backend/prisma/schema.prisma`, `backend/prisma/seed.ts`
- `backend/src/app.ts`, `index.ts`, `lib/prisma.ts`, `middleware/errorHandler.ts`
- `backend/src/routes/*` (restaurants, analyze, googleMaps, decide, config,
  importExport)
- `backend/src/analyzers/*` (types, googleMapsParser, manualPasteAnalyzer,
  osmAnalyzer, googlePlacesAnalyzer, openaiAnalyzer)
- `backend/src/decide/engine.ts`
- `backend/src/**/*.test.ts` (20 Tests)
- `frontend/src/pages/*` (Dashboard, Restaurants, RestaurantForm, Analyze, Decide,
  Config, ImportExport)
- `frontend/src/lib/*`, `frontend/src/types/*`
- `.env.example`, `backend/.env.example`, `README.md`, `STEP.md`

## Testhinweise

- Backend-Tests: `cd backend && npm test` (Node test runner über tsx, 20 Tests).
- Backend-Typecheck: `cd backend && npx tsc --noEmit`.
- Frontend-Build/Typecheck: `cd frontend && npm run build`.
- Manuelle Browser-Verifikation erfolgte mit Playwright/Chromium (nicht als
  Projekt-Dependency aufgenommen; reines Verifikationswerkzeug).

## Deployment

- Frontend: Vercel/Netlify/Cloudflare Pages (statischer Vite-Build aus
  `frontend/dist`). `VITE_API_URL` auf die Backend-URL setzen.
- Backend: Render/Railway/Vercel Functions (Express). Env: `DATABASE_URL`, `PORT`,
  `CORS_ORIGIN`, optional `OPENAI_API_KEY`, `GOOGLE_PLACES_API_KEY`,
  `OVERPASS_API_URL`. Migrationen via `prisma migrate deploy`.
- DB: Neon PostgreSQL (bereits angebunden).

## Bekannte Einschränkungen

- **CORS-Grenzen / Website-Analyse:** Der Spec-Endpoint `/api/analyze/website`
  (HTML einer Restaurant-Website serverseitig abrufen und parsen) ist bewusst
  **nicht** implementiert. Begründung: zuverlässiges, rechtssicheres Crawling
  (robots.txt, Rate-Limits, sehr heterogenes HTML) sprengt den minimalen,
  verifizierbaren Rahmen. Stattdessen deckt Manual-Paste denselben Bedarf ohne
  rechtliche/technische Grauzonen ab. Direkter Website-Abruf aus dem Browser
  scheitert ohnehin an CORS — deshalb müsste er serverseitig laufen; das ist als
  späterer Schritt vorgesehen.
- Overpass (öffentlicher Mirror) ist unter Last unzuverlässig; Koordinaten-Suche
  ist robust, die Stadt-`area`-Suche kann ins Timeout laufen (degradiert sauber).
- Google-Places- und OpenAI-Analyzer wurden mangels bezahlter Keys nur über den
  No-Key-Pfad (live) und Mock-Server (Parsing) verifiziert, nicht gegen die echten
  Endpunkte.
- Klassifizierungen sind als Tabelle/Seed angelegt, aber noch nicht als eigene
  Regel-Engine in der UI ausgewertet (Entscheidungsmodi decken den praktischen
  Bedarf ab).

## Spätere Schritte

- Authentifizierung & Multi-User-Fähigkeit (aktuell Single-Tenant; Schema ist
  erweiterbar um `userId`-Spalten).
- Serverseitiger Website-Analyzer mit robots.txt-Beachtung.
- Skalierung: Connection-Pooling (Neon Pooler), Caching von Overpass-Ergebnissen.
- Klassifizierungs-Regel-Engine in der UI sichtbar machen.

## Annahmen (gemäß CLAUDE.md dokumentiert)

- Demo-Seed-Restaurants sind als „(Demo)" markierte Entwicklungsdaten, kein
  Verstoß gegen „keine Restaurantdaten hardcoden" (keine recherchierten Fakten).
- `RestaurantAnalysisInput` wurde um optionale `coordinates` ergänzt, um den in
  Abschnitt 9.4 beschriebenen Fluss (Maps-Link-Koordinate → OSM) umzusetzen.
- Single-User ohne Auth, da nicht gefordert; bewusst einfach gehalten.
- Tailwind v4 (Vite-Plugin) statt v3-Config, da aktuelle Standardvariante.
