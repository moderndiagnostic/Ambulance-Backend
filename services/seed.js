const bcrypt = require("bcrypt");
const OpsUser = require("../Models/OpsUser");

/**
 * Ambulance DB is a different Atlas database — Phlebo opsusers yahan copy nahi hote.
 * Pehla city admin boot pe (idempotent) jab SEED_OPS_USER=true.
 */
async function seedPlatform() {
  const seedOps = String(process.env.SEED_OPS_USER || "false").toLowerCase() === "true";
  if (!seedOps) return;

  const email = (process.env.OPS_EMAIL || "ops@ambulance.local").toLowerCase().trim();
  const password = process.env.OPS_PASSWORD || "ops123456";
  const city = String(process.env.OPS_CITY || "").trim();
  const name = process.env.OPS_NAME || "Ambulance City Admin";

  let ops = await OpsUser.findOne({ email });
  if (!ops) {
    ops = await OpsUser.create({
      email,
      password: await bcrypt.hash(password, 10),
      name,
      role: "admin",
      city,
      isActive: true,
    });
    console.log(`[seed] City admin: ${email} · city=${city || "(set OPS_CITY in .env)"}`);
    return;
  }

  // Env change (e.g. Jaipur example hataana) existing seed user pe apply ho.
  let dirty = false;
  if (ops.city !== city) {
    ops.city = city;
    dirty = true;
  }
  if (name && ops.name !== name) {
    ops.name = name;
    dirty = true;
  }
  if (dirty) {
    await ops.save();
    console.log(`[seed] City admin updated: ${email} · city=${city || "(blank)"}`);
  }
}

module.exports = { seedPlatform };
