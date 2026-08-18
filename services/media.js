const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const UPLOADS_ROOT = path.join(__dirname, "..", "uploads");

function saveDataUrlImage(input, folder = "trips") {
  const raw = String(input || "").trim();
  if (!raw) return "";
  if (raw.startsWith("http://") || raw.startsWith("https://") || raw.startsWith("/uploads/")) {
    return raw;
  }
  const match = raw.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) return "";
  const mime = match[1].toLowerCase();
  const ext = mime.includes("png") ? "png" : mime.includes("webp") ? "webp" : "jpg";
  const dir = path.join(UPLOADS_ROOT, folder);
  fs.mkdirSync(dir, { recursive: true });
  const name = `${Date.now()}_${crypto.randomBytes(4).toString("hex")}.${ext}`;
  fs.writeFileSync(path.join(dir, name), Buffer.from(match[2], "base64"));
  return `/uploads/${folder}/${name}`;
}

module.exports = { saveDataUrlImage, UPLOADS_ROOT };
