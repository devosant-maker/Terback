# Terback - Railway Safe Backend

Paket ini dibuat khusus untuk backend Railway.

## Struktur repo yang benar

Upload isi folder ini langsung ke root repository backend, sehingga GitHub terlihat seperti ini:

```txt
Terback/
├── package.json
├── server.js
├── Dockerfile
├── .env.example
└── README_RAILWAY_DEPLOY.md
```

Jangan upload seperti ini:

```txt
Terback/
└── backend/
    ├── package.json
    ├── server.js
    └── Dockerfile
```

Kalau tetap memakai folder `backend/`, maka Root Directory di Railway harus diset ke `/backend`.

## Railway Variables

Isi di Railway → Service → Variables:

```env
PORT=3000
TERMINAL_TOKEN=buat-token-rahasia-kamu
ALLOWED_ORIGIN=https://domain-vercel-kamu.vercel.app
MAX_SESSIONS=1
SESSION_TIMEOUT_MIN=30
TERMINAL_SHELL=/bin/bash
TERMINAL_CWD=/app
```

## WebSocket URL untuk frontend

Kalau domain Railway kamu:

```txt
https://nama-backend.up.railway.app
```

Maka isi WebSocket di frontend:

```txt
wss://nama-backend.up.railway.app/terminal
```

Jangan pakai `https://` di kolom WebSocket.
