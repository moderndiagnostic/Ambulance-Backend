require("dotenv").config();
const path = require("path");
const fs = require("fs");
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const {
  assertSecurityConfig,
  getCorsOriginOption,
  isProduction,
} = require("./services/securityConfig");
const { seedPlatform } = require("./services/seed");
const { authLimiter, otpSendLimiter } = require("./middleware/rateLimit");

/**
 * AmbulanceBackend — standalone (same folder layout as PhleboBackend).
 * Admin SPA at /admin. Field driver APIs at /v1/api/ambulance/*.
 */
const PORT = process.env.PORT || 3011;
const MONGO_URI = process.env.MONGO_URI || "mongodb://localhost:27017/ambulance_local";

try {
  assertSecurityConfig();
} catch (err) {
  console.error(err.message);
  process.exit(1);
}

process.on("uncaughtException", (err) => {
  console.error("[uncaughtException] server survived:", err);
});
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection] server survived:", reason);
});

const app = express();
app.use(morgan("dev"));
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  })
);
app.use(
  cors({
    origin: getCorsOriginOption(),
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key", "x-seed-key"],
  })
);
app.use(express.json({ limit: "4mb" }));
app.use(express.urlencoded({ extended: true, limit: "4mb" }));

app.use("/v1/api/login", authLimiter);
app.use("/v1/api/ambulance/auth/otp/send", otpSendLimiter);
app.use("/v1/api/ambulance/auth/otp/verify", authLimiter);

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "ambulance-platform",
    mode: "standalone",
    message: "Ambulance APIs + admin — separate from PhleboBackend",
    db: mongoose.connection.name || null,
  });
});

app.get("/health", (_req, res) => {
  const state = mongoose.connection.readyState;
  res.status(state === 1 ? 200 : 503).json({
    ok: state === 1,
    ambulancePort: PORT,
    mongo: state === 1 ? "connected" : "disconnected",
    db: mongoose.connection.name || null,
  });
});

app.use("/v1/api", require("./Route/AuthRoute"));
app.use("/v1/api", require("./Route/FieldAuthRoute"));
app.use("/v1/api", require("./Route/AmbulanceDriverRoute"));
app.use("/v1/api", require("./Route/AmbulanceAdminRoute"));

const UPLOADS_DIST = path.join(__dirname, "uploads");
app.use("/uploads", express.static(UPLOADS_DIST));

const ADMIN_DIST = path.join(__dirname, "admin-web", "dist");
if (fs.existsSync(ADMIN_DIST)) {
  app.use("/admin", express.static(ADMIN_DIST));
  app.get("/admin/*", (_req, res) => {
    res.sendFile(path.join(ADMIN_DIST, "index.html"));
  });
} else {
  app.get("/admin", (_req, res) => {
    res.status(503).send(
      "Ambulance admin not built yet. Run: cd admin-web && npm install && npm run build"
    );
  });
}

app.use("/v1/api", (_req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error("[unhandled route error]", err);
  if (res.headersSent) return;
  res.status(500).json({ success: false, message: "Something went wrong" });
});

mongoose.connection.on("error", (err) => {
  console.error("[mongo] connection error:", err.message);
});
mongoose.connection.on("disconnected", () => {
  console.warn("[mongo] disconnected — mongoose will retry automatically");
});

async function start() {
  await mongoose.connect(MONGO_URI);
  console.log("Connected DB:", mongoose.connection.name);
  await seedPlatform();
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AmbulanceBackend :${PORT} (standalone, DB=${mongoose.connection.name})`);
    console.log("Admin → http://localhost:" + PORT + "/admin");
    console.log("Field app → http://localhost:" + PORT + "/v1/api");
    console.log(
      `Security: NODE_ENV=${process.env.NODE_ENV || "development"} CORS=${isProduction() ? "restricted" : "dev-open"}`
    );
  });
}

start().catch((err) => {
  console.error("Failed to start AmbulanceBackend:", err);
  process.exit(1);
});
