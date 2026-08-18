const express = require("express");
const router = express.Router();
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const AmbulanceDriver = require("../Models/AmbulanceDriver");
const {
  getJwtSecret,
  allowDemoOtp,
  DEMO_OTP,
  isDemoOtp,
} = require("../services/securityConfig");

function publicDriver(d) {
  return {
    id: d._id,
    role: "driver",
    name: d.name,
    phone: d.phone,
    employeeId: d.employeeId,
    dutyStatus: d.dutyStatus,
    city: d.city,
    zone: d.zone,
    assignedAmbulance: d.assignedAmbulance,
  };
}

function signDriver(driver) {
  return jwt.sign(
    { id: driver._id, role: "driver", phone: driver.phone },
    getJwtSecret(),
    { expiresIn: "30d" }
  );
}

/** Mobile OTP — same flow as phlebo app. Number must already be in Drivers. */
router.post("/ambulance/auth/otp/send", async (req, res) => {
  try {
    const phone = String(req.body.phone || "").trim();
    if (!/^\d{10}$/.test(phone)) {
      return res.status(400).json({ success: false, message: "Valid 10-digit phone required" });
    }

    const driver = await AmbulanceDriver.findOne({ phone });
    if (!driver) {
      return res.status(404).json({
        success: false,
        message: "This number is not registered. Contact your city admin to get added first.",
      });
    }
    if (driver.status !== "active") {
      return res.status(403).json({ success: false, message: "Account inactive — contact your admin" });
    }

    const otp = allowDemoOtp() ? DEMO_OTP : crypto.randomInt(100000, 999999).toString();
    driver.otp = otp;
    driver.otpExpires = new Date(Date.now() + 10 * 60 * 1000);
    await driver.save();

    console.log(`[Ambulance OTP] ${phone} => ${otp}`);

    res.json({
      success: true,
      message: "OTP sent",
      role: "driver",
      demoOtp: allowDemoOtp() ? otp : undefined,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/ambulance/auth/otp/verify", async (req, res) => {
  try {
    const phone = String(req.body.phone || "").trim();
    const otp = String(req.body.otp || "").trim();

    const driver = await AmbulanceDriver.findOne({ phone });
    if (!driver) {
      return res.status(404).json({ success: false, message: "Driver not found" });
    }

    const valid =
      (driver.otp && driver.otp === otp && driver.otpExpires && driver.otpExpires > new Date()) ||
      isDemoOtp(otp);

    if (!valid) {
      return res.status(400).json({ success: false, message: "Invalid or expired OTP" });
    }

    driver.otp = null;
    driver.otpExpires = null;
    await driver.save();

    res.json({
      success: true,
      token: signDriver(driver),
      role: "driver",
      user: publicDriver(driver),
      driver: publicDriver(driver),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
