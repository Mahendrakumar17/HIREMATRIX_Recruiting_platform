# HireMatrix

Full-stack hiring workspace: job posts, applications with resume uploads, screening, interviews, real-time notifications, and role-based dashboards.

## Stack

- **Frontend:** React (Vite), React Router, Axios, Socket.IO client, react-hot-toast  
- **Backend:** Node.js, Express, Mongoose (MongoDB), JWT, Multer uploads, Socket.IO, Nodemailer  

## Prerequisites

- [Node.js](https://nodejs.org/) (LTS recommended)  
- [MongoDB](https://www.mongodb.com/try/download/community) running locally (or update `MONGO_URI` for Atlas)  

## Project layout

```
Mahi_fullstack/
├── client/          # React app (port 5173 by default)
├── server/          # API + Socket.IO (port from PORT env, default see below)
└── docs/
    └── RBAC_ACCESS_CONTROL.md   # Roles and permissions matrix
```

## Quick start

### 1. Server

```bash
cd server
cp .env.example .env
# Edit .env: MONGO_URI, JWT_SECRET, CLIENT_URL(S), SMTP if you need mail
npm install
npm run dev
```

Default API URL: **`http://localhost:5001`** (set `PORT` in `.env`; `.env.example` uses `5001`).

Health check: `GET http://localhost:5001/api/health`

### 2. Client

```bash
cd client
npm install
npm run dev
```

Vite listens on **`http://localhost:5173`** by default (`0.0.0.0` bind — you can also open via `http://127.0.0.1:5173` or your LAN IP).

The client calls **`http://<same-host-as-browser>:5001/api`** (see `client/src/api.js`).

## Environment variables (`server/.env`)

| Variable | Purpose |
|----------|---------|
| `PORT` | API port |
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret for signing JWTs (use a long random value) |
| `CLIENT_URL` / `CLIENT_URLS` | Allowed browser origins for CORS (comma-separated for several URLs) |

Optional email (password reset flows / notifications as implemented): `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`. Ethereal/testing options are documented in the mailer when SMTP is omitted.

### CORS

Origins must **match exactly** what appears in the browser address bar (`http://localhost:5173` and `http://127.0.0.1:5173` are different). Prefer:

```env
CLIENT_URLS=http://localhost:5173,http://127.0.0.1:5173
```

If `CLIENT_URL` and `CLIENT_URLS` are **empty**, the server allows requests from any origin (useful for quick local tries; tighten for production).

## Roles

Self-service registration supports **Applicant**, **Recruiter**, **HR**, and **Hiring Manager**.

- **Applicant:** register with resume (required); apply to jobs and track status.  
- **Recruiter / HR / Hiring Manager:** company-related fields apply; recruiter/HR/HM accounts may sit in **pending admin approval** until an admin approves them.  

**Admin** is not created via public registration. On first startup, if **no** admin exists, the server can seed one — see **`server/src/utils/seedDefaultAdmin.js`**. Replace default credentials immediately in any shared or deployed environment.

More detail: **`docs/RBAC_ACCESS_CONTROL.md`**.

## npm scripts

| Location | Command | Description |
|----------|---------|-------------|
| `server/` | `npm run dev` | Kill port then nodemon (`PORT` from `.env`) |
| `server/` | `npm start` | `node index.js` |
| `server/` | `npm test` | Jest tests |
| `client/` | `npm run dev` | Vite dev server |
| `client/` | `npm run build` | Production build |
| `client/` | `npm run preview` | Preview production build |

## Troubleshooting

- **Login shows a generic error / CORS in server logs:** Fix `CLIENT_URLS` so it includes every origin you use (port + hostname), or leave client URL env vars empty only for strict local debugging. Restart the server after `.env` changes.  
- **Recruiter/HR/HM “pending approval”:** An admin must approve the account under **User Governance**.  
- **MongoDB errors:** Ensure `mongod` is running and `MONGO_URI` matches your database name and host.

## Security notes

- Do not commit real `.env` files or production secrets.  
- Use strong `JWT_SECRET` and rotated SMTP app passwords where applicable.

## License

See package metadata in `client/` and `server/` if a license field is specified.
