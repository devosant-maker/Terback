const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const { spawn } = require("child_process");
const express = require("express");
const WebSocket = require("ws");

const PORT = Number(process.env.PORT || 3000);
const TOKEN = process.env.TERMINAL_TOKEN || "ganti-token-ini";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "";
const MAX_SESSIONS = Number(process.env.MAX_SESSIONS || 1);
const SESSION_TIMEOUT_MIN = Number(process.env.SESSION_TIMEOUT_MIN || 30);
const TERMINAL_SHELL = process.env.TERMINAL_SHELL || "/bin/bash";
const TERMINAL_CWD = process.env.TERMINAL_CWD || process.env.HOME || process.cwd();
const TERMINAL_USE_SCRIPT = String(process.env.TERMINAL_USE_SCRIPT || "true").toLowerCase() !== "false";

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ noServer: true });
const sessions = new Set();

function allowedOrigin(origin) {
  if (!ALLOWED_ORIGIN) return true;

  const list = ALLOWED_ORIGIN
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (list.includes("*")) return true;
  if (!origin) return false;

  return list.includes(origin);
}

function safeTokenCompare(received, expected) {
  if (!received || !expected) return false;

  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);

  if (receivedBuffer.length !== expectedBuffer.length) return false;

  return crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

function rejectSocket(socket, code, message) {
  socket.write([
    `HTTP/1.1 ${code} ${message}`,
    "Connection: close",
    "",
    ""
  ].join("\r\n"));
  socket.destroy();
}

function commandExists(commandPath) {
  try {
    fs.accessSync(commandPath, fs.constants.X_OK);
    return true;
  } catch (_error) {
    return false;
  }
}

function createShellProcess() {
  const env = {
    ...process.env,
    TERM: "xterm-256color",
    COLORTERM: "truecolor",
    FORCE_COLOR: "1"
  };

  const commonOptions = {
    cwd: TERMINAL_CWD,
    env,
    stdio: ["pipe", "pipe", "pipe"]
  };

  const scriptPath = "/usr/bin/script";

  if (TERMINAL_USE_SCRIPT && commandExists(scriptPath)) {
    return {
      process: spawn(scriptPath, ["-qfec", `${TERMINAL_SHELL} -i`, "/dev/null"], commonOptions),
      mode: "pseudo-tty via script"
    };
  }

  return {
    process: spawn(TERMINAL_SHELL, ["-i"], commonOptions),
    mode: "interactive shell"
  };
}

app.get("/", (_req, res) => {
  res.json({
    name: "iPad Online Terminal Backend",
    status: "ok",
    terminal: "/terminal",
    note: "Connect using WebSocket with a valid token."
  });
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    activeSessions: sessions.size,
    maxSessions: MAX_SESSIONS
  });
});

server.on("upgrade", (req, socket, head) => {
  try {
    const origin = req.headers.origin;
    const host = req.headers.host || "localhost";
    const url = new URL(req.url, `http://${host}`);

    if (url.pathname !== "/terminal") {
      return rejectSocket(socket, 404, "Not Found");
    }

    if (!allowedOrigin(origin)) {
      return rejectSocket(socket, 403, "Forbidden");
    }

    const token = url.searchParams.get("token");

    if (!safeTokenCompare(token, TOKEN)) {
      return rejectSocket(socket, 401, "Unauthorized");
    }

    if (sessions.size >= MAX_SESSIONS) {
      return rejectSocket(socket, 429, "Too Many Sessions");
    }

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit("connection", ws, req);
    });
  } catch (_error) {
    return rejectSocket(socket, 400, "Bad Request");
  }
});

wss.on("connection", (ws, req) => {
  sessions.add(ws);

  const { process: shell, mode } = createShellProcess();
  let cleaned = false;
  const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";

  ws.send("\r\n\x1b[32mConnected to iPad Online Terminal.\x1b[0m\r\n");
  ws.send(`\x1b[90mClient: ${clientIp}\x1b[0m\r\n`);
  ws.send(`\x1b[90mShell: ${TERMINAL_SHELL}\x1b[0m\r\n`);
  ws.send(`\x1b[90mMode: ${mode}\x1b[0m\r\n\r\n`);

  shell.stdout.on("data", (data) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(data.toString("utf8"));
  });

  shell.stderr.on("data", (data) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(data.toString("utf8"));
  });

  shell.on("error", (error) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(`\r\n\x1b[31mShell error: ${error.message}\x1b[0m\r\n`);
      ws.close();
    }
  });

  shell.on("exit", (code) => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(`\r\n\x1b[33mShell exited with code ${code ?? "unknown"}.\x1b[0m\r\n`);
      ws.close();
    }
  });

  ws.on("message", (message) => {
    try {
      const parsed = JSON.parse(message.toString());

      if (parsed.type === "input" && typeof parsed.data === "string" && shell.stdin.writable) {
        shell.stdin.write(parsed.data);
      }

      if (parsed.type === "resize") {
        // Resize is accepted for frontend compatibility. This no-native backend ignores it safely.
      }
    } catch (_error) {
      if (shell.stdin.writable) shell.stdin.write(message.toString());
    }
  });

  const timeout = setTimeout(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send("\r\n\x1b[33mSession timeout. Connection closed.\x1b[0m\r\n");
      ws.close();
    }
  }, SESSION_TIMEOUT_MIN * 60 * 1000);

  function cleanup() {
    if (cleaned) return;
    cleaned = true;
    clearTimeout(timeout);
    sessions.delete(ws);
    try { shell.kill("SIGTERM"); } catch (_error) {}
  }

  ws.on("close", cleanup);
  ws.on("error", cleanup);
});

server.listen(PORT, () => {
  console.log(`Backend running on port ${PORT}`);
});
