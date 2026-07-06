# Deployment – Option A (Backend → Render, Frontend → Vercel)

Schritt-für-Schritt-Anleitung zum Hosten von Food Selector.
Architektur: statisches Frontend auf Vercel, Express-Backend auf Render,
Datenbank auf Neon (bereits vorhanden).

---

## Voraussetzungen

- Das Projekt liegt in einem GitHub-Repository (siehe Teil 1).
- Neon-Datenbank ist eingerichtet (ist sie – `DATABASE_URL` existiert).
- Konten bei [render.com](https://render.com) und [vercel.com](https://vercel.com).
- **Wichtig:** Echte Secrets niemals committen. `.env` ist bereits in
  `.gitignore`. Alle Keys werden nur in den Dashboards von Render/Vercel gesetzt.

---

## Teil 1 – Code zu GitHub pushen

> Falls das Repo noch nicht auf GitHub liegt.

```bash
# im Projekt-Root
git add .
git commit -m "Food Selector app"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

Prüfen, dass `backend/.env` **nicht** mit hochgeladen wurde
(`git status` darf `backend/.env` nicht zeigen).

---

## Teil 2 – Backend auf Render

1. Render-Dashboard → **New** → **Web Service** → GitHub-Repo auswählen.
2. Einstellungen:
   - **Name:** z. B. `foodselector-api`
   - **Root Directory:** `backend`
   - **Runtime:** Node
   - **Region:** **Frankfurt (EU Central)** – gleiche Region wie die Neon-DB
     (`eu-central-1`) → niedrige Datenbank-Latenz.
   - **Build Command:**
     ```
     npm install && npx prisma generate && npm run build
     ```
   - **Start Command:**
     ```
     npm run start
     ```
3. **Environment Variables** (unter „Environment"):
   | Key                     | Wert                                            |
   |-------------------------|-------------------------------------------------|
   | `DATABASE_URL`          | Neon-Connection-String (`sslmode=require`)      |
   | `APP_ENV`               | `production`                                    |
   | `OVERPASS_API_URL`      | `https://overpass-api.de/api/interpreter`       |
   | `OPENAI_API_KEY`        | (optional) dein OpenAI-Key                      |
   | `GOOGLE_PLACES_API_KEY` | (optional) dein Google-Places-Key               |
   | `SMTP_URL`              | (optional) SMTP-Server für Einladungs-E-Mails, z. B. `smtps://user:pass@smtp.example.com:465` |
   | `EMAIL_FROM`            | (optional) Absenderadresse der Einladungs-E-Mails |
   | `APP_BASE_URL`          | (optional) öffentliche Frontend-URL für Einladungslinks |
   | `CORS_ORIGIN`           | **vorerst leer lassen** – wird in Teil 4 gesetzt|

   > Ohne `SMTP_URL` + `EMAIL_FROM` werden keine Einladungs-E-Mails versendet;
   > Einladungen funktionieren dann über kopierbare Einladungslinks.

   > `PORT` nicht setzen – Render gibt den Port automatisch vor, und der Server
   > liest ihn aus `process.env.PORT` (`backend/src/index.ts`).

4. **Create Web Service** → erster Deploy startet.
5. **Migration einspielen** (einmalig pro Schema-Änderung). Zwei Wege:
   - **Variante a (empfohlen):** Render → Service → **Settings** → **Pre-Deploy
     Command**:
     ```
     npx prisma migrate deploy
     ```
   - **Variante b (manuell):** Render → Service → **Shell** öffnen und dort
     `npx prisma migrate deploy` ausführen.
6. Nach dem Deploy die Backend-URL notieren, z. B.
   `https://foodselector-api.onrender.com`.
7. **Test:** `https://foodselector-api.onrender.com/health` muss
   `{"status":"ok"}` liefern.

> Hinweis: Renders kostenloser Web-Service „schläft" nach Inaktivität ein; die
> erste Anfrage danach dauert ein paar Sekunden (Cold Start).

---

## Teil 3 – Frontend auf Vercel

1. Vercel-Dashboard → **Add New** → **Project** → GitHub-Repo importieren.
2. Einstellungen:
   - **Root Directory:** `frontend`
   - **Framework Preset:** **Vite** (erkennt Vercel meist automatisch)
   - **Build Command:** `npm run build` (Default)
   - **Output Directory:** `dist` (Default)
3. **Environment Variable:**
   | Key            | Wert                                                  |
   |----------------|-------------------------------------------------------|
   | `VITE_API_URL` | `https://foodselector-api.onrender.com/api`           |

   > Das `/api` am Ende ist wichtig – der API-Client hängt die Pfade direkt an
   > (`frontend/src/lib/api.ts`).
4. **Deploy** → nach dem Build die Vercel-URL notieren, z. B.
   `https://foodselector.vercel.app`.

---

## Teil 4 – Frontend und Backend verbinden

1. **CORS freischalten:** Zurück zu Render → Backend → Environment →
   `CORS_ORIGIN` auf die **exakte** Vercel-URL setzen (ohne abschließenden
   Schrägstrich, ohne Pfad):
   ```
   CORS_ORIGIN=https://foodselector.vercel.app
   ```
   Speichern → Render deployt automatisch neu.

2. **SPA-Routing absichern (empfohlen):** Damit ein direkter Aufruf/Reload von
   Deep-Links wie `/restaurants` nicht in einem 404 endet, eine Datei
   `frontend/vercel.json` anlegen:
   ```json
   {
     "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
   }
   ```
   Committen und pushen → Vercel deployt neu.

---

## Teil 5 – Verifizieren

1. Vercel-URL im Browser öffnen → Dashboard lädt.
2. **Restaurants** öffnen → die Liste lädt echte Daten (kein CORS-Fehler in der
   Browser-Konsole).
3. Ein Restaurant anlegen/bearbeiten → Speichern landet in der Neon-DB.
4. **Entscheiden** → Vorschlag wird generiert.

Bei einem CORS-Fehler: `CORS_ORIGIN` (Render) und die tatsächliche Vercel-Domain
exakt abgleichen. Bei „Network Error": prüfen, ob `VITE_API_URL` korrekt auf das
Render-Backend inkl. `/api` zeigt.

---

## Spätere Updates

- **Code-Änderung:** `git push` auf `main` → Render **und** Vercel deployen
  automatisch neu.
- **Neue DB-Migration:** lokal `npx prisma migrate dev` ausführen, committen,
  pushen; Render spielt sie über das Pre-Deploy-Command (`prisma migrate
  deploy`) ein.

---

## CI/CD – automatischer Deploy (GitHub Actions)

Die Pipeline liegt in [.github/workflows/ci.yml](.github/workflows/ci.yml).

**Ablauf bei jedem Push/PR auf `main`:**
1. `build-and-test` (Quality-Gate): `npm ci` → Prisma-Client generieren →
   Backend typecheck/build → Backend-Tests → Frontend typecheck/build.
2. `deploy` (nur bei Push auf `main`, nur wenn Schritt 1 grün ist): triggert
   Render- und Vercel-Deploy über Deploy-Hooks.

**Vorteil gegenüber dem nativen Auto-Deploy von Render/Vercel:** Es wird nur
deployt, wenn Tests/Builds erfolgreich sind.

### Einzurichtende GitHub-Secrets
(Repo → Settings → Secrets and variables → Actions → New repository secret)

| Secret                    | Woher                                                         |
|---------------------------|--------------------------------------------------------------|
| `RENDER_DEPLOY_HOOK_URL`  | Render → Service → Settings → **Deploy Hook** (URL kopieren) |
| `VERCEL_DEPLOY_HOOK_URL`  | Vercel → Project → Settings → Git → **Deploy Hooks** (Hook für `main` erstellen) |

Solange ein Secret fehlt, überspringt der jeweilige Deploy-Schritt sauber
(kein Fehler) – die Pipeline kann also schon vor dem Einrichten gemerged werden.

### Wichtig: natives Auto-Deploy abschalten
Damit nicht doppelt deployt wird, das automatische Git-Deploy bei den Hostern
deaktivieren, sobald die Pipeline aktiv ist:
- **Render:** Service → Settings → Build & Deploy → **Auto-Deploy = No**.
- **Vercel:** Project → Settings → Git → **Ignored Build Step** bzw. Auto-Deploy
  für `main` deaktivieren (oder Production-Deploys nur über den Hook zulassen).

Migrationen laufen weiterhin über Renders Pre-Deploy-Command
(`npx prisma migrate deploy`, siehe Teil 2) – die CI selbst braucht **keinen**
DB-Zugriff.

## Troubleshooting

### CORS-Fehler: „ACAO-Header '…vercel.app/' not equal to supplied origin"
Der `CORS_ORIGIN`-Wert auf Render hatte einen abschließenden Schrägstrich, der
Browser-Origin nie. Das Backend normalisiert seit dem Hardening den Slash
automatisch (`backend/src/app.ts`) und akzeptiert auch eine **kommagetrennte
Liste** mehrerer Origins. Trotzdem den Wert idealerweise sauber halten:
```
CORS_ORIGIN=https://foodselector.vercel.app
```
Nach Änderung muss Render **neu deployen** (passiert beim Speichern automatisch).

### Anfragen gehen an `…/restaurants` statt `…/api/restaurants`
`VITE_API_URL` wurde ohne `/api` gesetzt. Der API-Client normalisiert das seit dem
Hardening (`frontend/src/lib/api.ts`) und hängt `/api` bei Bedarf an – aber:
`VITE_API_URL` wird **beim Build eingebacken**. Nach jeder Änderung der Variable
**das Frontend in Vercel neu deployen** (Deployments → Redeploy oder Commit
pushen), sonst greift der alte Wert weiter.

### Allgemein
- Nach Env-Änderung am **Backend** → Render redeployt automatisch.
- Nach Env-Änderung am **Frontend** → Vercel **manuell** redeployen (Build-Zeit-Var).

## Sicherheitshinweis

Die OpenAI-, Google-Places- und Neon-Keys wurden im Klartext geteilt. Vor dem
Live-Gang **rotieren** (in den jeweiligen Dashboards neu erzeugen) und nur in den
Environment-Variablen von Render/Vercel hinterlegen – nie im Repo.
