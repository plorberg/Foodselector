# Food Selector

Eine Web-App, die hilft, ein Restaurant vorzuschlagen, ohne selbst entscheiden zu
müssen. Restaurants verwalten, aus Quellen analysieren, klassifizieren,
persönliche Präferenzen berücksichtigen und nachvollziehbar begründete Vorschläge
generieren. Alle Daten liegen in einer externen PostgreSQL-Datenbank (Neon); der
Zugriff erfolgt ausschließlich über die Backend-API.

> Die ausführliche Entwicklungs- und Architekturdokumentation steht in
> [`STEP.md`](./STEP.md).

## Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS, React Router
- **Backend:** Node.js, TypeScript, Express, Zod
- **DB/ORM:** Neon PostgreSQL über Prisma
- **Tests:** Node test runner (über tsx)

## Architektur

```
frontend/  React-SPA  ──fetch /api──►  backend/  Express-API  ──Prisma──►  Neon PostgreSQL
                                          │
                                          ├─ Analyzer (manual, osm, google-places, openai)
                                          ├─ Google-Maps-Link-Parser
                                          └─ Entscheidungs-Engine
```

- Das Frontend greift **nie** direkt auf die DB zu — nur auf `/api/*`.
- Secrets (DB-URL, API-Keys) liegen ausschließlich serverseitig in Env-Variablen.
- Optionale Analyzer (Google Places, OpenAI) laufen nur serverseitig und nur, wenn
  ihr Key gesetzt ist. Ohne Key bleibt die App voll nutzbar (Manual-Paste + OSM).
- Google Maps wird **nicht** gescraped; Maps-Links dienen nur als Identifikator.

## Voraussetzungen

- Node.js ≥ 20 (entwickelt mit Node 24)
- Eine PostgreSQL-Datenbank (empfohlen: Neon)

## Lokaler Start

```bash
# 1. Abhängigkeiten installieren (npm-Workspaces, vom Repo-Root)
npm install

# 2. Backend-Env anlegen
cp backend/.env.example backend/.env
#   DATABASE_URL eintragen (Neon-Connection-String, sslmode=require)

# 3. Datenbank einrichten
cd backend
npm run prisma:migrate     # Migrationen anwenden
npm run prisma:seed        # Demo-Daten (optional)

# 4. Backend starten (Port 4000)
npm run dev

# 5. In einem zweiten Terminal: Frontend starten (Port 5173)
cd frontend
npm run dev
```

Frontend: <http://localhost:5173> · Backend: <http://localhost:4000>
(Der Vite-Dev-Server proxyt `/api` automatisch auf das Backend.)

## Datenbanksetup, Migrationen & Seed

```bash
cd backend
npm run prisma:migrate     # prisma migrate dev — erstellt/aktualisiert Tabellen
npm run prisma:deploy      # prisma migrate deploy — für Produktion
npm run prisma:seed        # Seed: Kategorien, Tags, Profil, Demo-Restaurants
npm run prisma:generate    # Prisma Client neu generieren
```

Die Demo-Restaurants sind als „(Demo)" markierte Entwicklungsdaten — keine
recherchierten Fakten über echte Restaurants.

## Environment Variables

Backend (`backend/.env`, siehe `backend/.env.example`):

| Variable                | Pflicht | Zweck                                                |
|-------------------------|---------|------------------------------------------------------|
| `DATABASE_URL`          | ja      | Neon/PostgreSQL-Connection-String (`sslmode=require`)|
| `PORT`                  | nein    | Backend-Port (Default 4000)                          |
| `CORS_ORIGIN`           | nein    | erlaubte Frontend-Origin (Default localhost:5173)    |
| `APP_ENV`               | nein    | Umgebungskennung                                     |
| `OVERPASS_API_URL`      | nein    | Overpass-Endpoint (Default öffentlicher Mirror)      |
| `GOOGLE_PLACES_API_KEY` | nein    | aktiviert den Google-Places-Analyzer                 |
| `OPENAI_API_KEY`        | nein    | aktiviert den OpenAI-Analyzer (≠ ChatGPT-Abo!)       |

Frontend (optional): `VITE_API_URL` — Basis-URL der API in Produktion (Default
`/api`, was den Dev-Proxy bzw. Same-Origin nutzt).

**Niemals** echte Secrets committen oder ins Frontend-Bundle bringen.

## Tests, Typecheck & Build

```bash
# Backend
cd backend
npx tsc --noEmit     # Typecheck
npm test             # 20 Unit-Tests (Decision-Engine, Maps-Parser, Manual-Paste)
npm run build        # Kompiliert nach backend/dist

# Frontend
cd frontend
npm run build        # tsc -b && vite build
```

## API-Überblick

- `GET/POST /api/restaurants`, `GET/PUT/DELETE /api/restaurants/:id`
- `POST /api/restaurants/:id/visit|favorite|blacklist`
- `POST /api/analyze/manual|osm|google-places|openai`
- `POST /api/parse/google-maps-link`
- `POST /api/decide`, `POST /api/decide/respond`
- `GET/PUT /api/config`, `GET/POST/DELETE /api/categories|tags`
- `GET/POST/PUT/DELETE /api/decision-profiles`
- `GET /api/export`, `POST /api/import`

## Deployment

- **Frontend** → Vercel/Netlify/Cloudflare Pages: `frontend/dist` deployen,
  `VITE_API_URL` auf die Backend-URL setzen.
- **Backend** → Render/Railway/Vercel Functions: Express-Server, Env-Variablen
  setzen, `npm run prisma:deploy` beim Release ausführen.
- **DB** → Neon PostgreSQL.

## Bekannte Einschränkungen

- `/api/analyze/website` (serverseitiger Website-Crawler) ist bewusst nicht
  implementiert — Manual-Paste ist der robuste, rechtssichere Ersatz. Details und
  Begründung in [`STEP.md`](./STEP.md).
- Der öffentliche Overpass-Mirror ist unter Last unzuverlässig; die
  Koordinaten-Suche ist robust, die reine Stadtsuche kann ins Timeout laufen
  (degradiert sauber mit Warnung).
- Google-Places- und OpenAI-Analyzer wurden ohne bezahlte Keys nur über den
  No-Key-Pfad und gegen Mock-Server verifiziert.
- Single-User ohne Authentifizierung (bewusst; Schema ist erweiterbar).
