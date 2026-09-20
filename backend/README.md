# VELNOX Backend v2

Express + SQL.js backend for VELNOX Web Labs.

## Start

```powershell
cd backend
npm install
npm start
```

API health: `http://localhost:3000/api/health`
Admin: `http://localhost:3000/admin/`

Default local login:
- Username: `admin`
- Password: `velnox123`

Change the values in `backend/.env` before production.

## API

Public:
- `GET /api/health`
- `GET /api/projects`
- `GET /api/testimonials`
- `POST /api/enquiries`
- `POST /api/auth/login`

Protected admin routes use `Authorization: Bearer <token>`.

## Database

The database is stored at `backend/data/velnox.db`. SQL.js is used so no native SQLite compiler is required.

For production on a platform with ephemeral storage, move the database to managed PostgreSQL or another persistent database.
