# VELNOX deployment

## 1. Backend → Render

Create a Render Web Service from this repository.

- Root Directory: `backend`
- Runtime: Node
- Build Command: `npm install`
- Start Command: `npm start`
- Plan: Free (if available on your Render account)

Environment variables:

```text
ADMIN_USERNAME=admin
ADMIN_PASSWORD=choose-a-strong-password
JWT_SECRET=use-a-long-random-secret
CORS_ORIGINS=https://velnox-weblabs.web.app,https://velnox-labs.web.app,http://localhost:5500
DB_FILE=./data/velnox.db
```

After deploy, check:
`https://YOUR-BACKEND.onrender.com/api/health`

## 2. Connect Firebase frontend

Open `js/config.js` and replace the empty value with the backend URL:

```js
window.VELNOX_API = 'https://YOUR-BACKEND.onrender.com';
```

Then deploy Firebase Hosting:

```powershell
firebase use velnox-labs
firebase deploy --only hosting
```

## 3. Admin

Open:
`https://YOUR-BACKEND.onrender.com/admin/`

Use the `ADMIN_USERNAME` and `ADMIN_PASSWORD` configured in Render.

## Important database note

The included SQL.js database is excellent for local development and demos. Render's free filesystem is ephemeral, so database changes can be lost after a redeploy/restart. For permanent production data, use a managed PostgreSQL database and change the data layer to PostgreSQL.
