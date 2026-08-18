const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const OpsUser = require("../Models/OpsUser");
const { getJwtSecret, isProduction } = require("../services/securityConfig");

/** City admin / ops login — same OpsUser collection as Phlebo if same MONGO_URI */
router.post("/login", async (req, res) => {
  try {
    const { email, password, keepLoggedIn } = req.body;
    if (!email || !password) {
      return res.status(400).json({ msg: "Email and password are required" });
    }

    const userdata = await OpsUser.findOne({ email: String(email).toLowerCase().trim() });
    if (!userdata) {
      return res.status(404).json({ msg: "User not found" });
    }

    const isMatch = await bcrypt.compare(password, userdata.password);
    if (!isMatch) {
      return res.status(401).json({ msg: "Invalid password" });
    }

    if (userdata.isActive === false) {
      return res.status(403).json({ msg: "Account disabled — contact your admin" });
    }

    const expiresIn = keepLoggedIn ? "7d" : "24h";
    const token = jwt.sign(
      {
        email: userdata.email,
        id: userdata._id,
        role: userdata.role || "ops",
        city: userdata.city || "",
      },
      getJwtSecret(),
      { expiresIn }
    );

    const userResponse = userdata.toObject();
    delete userResponse.password;

    res.status(200).json({
      msg: "Login successful",
      userdata: userResponse,
      token,
      expiresIn,
      note: isProduction() ? undefined : "Ambulance Ops",
    });
  } catch (error) {
    res.status(500).json({ msg: "Server error", error: error.message });
  }
});

const { verifyToken, requireRole } = require("./authMiddleware");

/** City admin creates a logistics-style ambulance manager for their city. */
router.post("/managers", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const { email, password, name } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ success: false, message: "email and password required" });
    }
    if (String(password).length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }
    const cleanEmail = String(email).toLowerCase().trim();
    const taken = await OpsUser.findOne({ email: cleanEmail });
    if (taken) {
      return res.status(400).json({ success: false, message: "Email already registered" });
    }
    const manager = await OpsUser.create({
      email: cleanEmail,
      password: await bcrypt.hash(String(password), 10),
      name: name ? String(name).trim() : "Ambulance Manager",
      role: "manager",
      city: req.user.city || "",
      createdBy: req.user._id,
      isActive: true,
    });
    const obj = manager.toObject();
    delete obj.password;
    res.status(201).json({ success: true, manager: obj });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/managers", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const filter = { role: "manager" };
    if (req.user.city) filter.city = req.user.city;
    const managers = await OpsUser.find(filter).select("-password").sort({ name: 1 });
    res.json({ success: true, managers });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/managers/:id/status", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const manager = await OpsUser.findOne({
      _id: req.params.id,
      role: "manager",
      ...(req.user.city ? { city: req.user.city } : {}),
    });
    if (!manager) return res.status(404).json({ success: false, message: "Manager not found" });
    manager.isActive = !!req.body.isActive;
    await manager.save();
    const obj = manager.toObject();
    delete obj.password;
    res.json({ success: true, manager: obj });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/managers/:id/reset-password", verifyToken, requireRole("admin"), async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password || String(password).length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
    }
    const manager = await OpsUser.findOne({
      _id: req.params.id,
      role: "manager",
      ...(req.user.city ? { city: req.user.city } : {}),
    });
    if (!manager) return res.status(404).json({ success: false, message: "Manager not found" });
    manager.password = await bcrypt.hash(String(password), 10);
    await manager.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
