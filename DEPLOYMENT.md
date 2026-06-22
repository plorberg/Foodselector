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
   | `CORS_ORIGIN`           | **vorerst leer lassen** – wird in Teil 4 gesetzt|

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
