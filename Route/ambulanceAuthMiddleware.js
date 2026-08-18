const jwt = require("jsonwebtoken");
const AmbulanceDriver = require("../Models/AmbulanceDriver");
const { getJwtSecret } = require("../services/securityConfig");

const getBearerToken = (req) => {
  const authHeader = req.headers.authorization || "";
  if (authHeader.startsWith("Bearer ")) return authHeader.slice(7).trim();
  return "";
};

const verifyAmbulanceDriver = async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ success: false, message: "Login required" });
    }
    const decoded = jwt.verify(token, getJwtSecret());
    if (decoded.role !== "driver") {
      return res.status(403).json({ success: false, message: "Driver access only" });
    }
    const driver = await AmbulanceDriver.findById(decoded.id);
    if (!driver || driver.status !== "active") {
      return res.status(401).json({ success: false, message: "Account inactive" });
    }
    req.driver = driver;
    next();
  } catch {
    return res.status(401).json({ success: false, message: "Invalid or expired token" });
  }
};

module.exports = { verifyAmbulanceDriver };
