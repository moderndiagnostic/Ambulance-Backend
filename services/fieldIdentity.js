const AmbulanceDriver = require("../Models/AmbulanceDriver");

async function assertDriverIdentityFree({ employeeId, phone, excludeDriverId }) {
  const id = employeeId ? String(employeeId).trim() : "";
  const mobile = phone ? String(phone).trim() : "";

  if (id) {
    const existing = await AmbulanceDriver.findOne({ employeeId: id }).select("_id");
    if (existing && String(existing._id) !== String(excludeDriverId || "")) {
      const err = new Error("Employee ID already used by a driver");
      err.status = 400;
      throw err;
    }
  }

  if (mobile) {
    const existing = await AmbulanceDriver.findOne({ phone: mobile }).select("_id");
    if (existing && String(existing._id) !== String(excludeDriverId || "")) {
      const err = new Error("Phone already registered as a driver");
      err.status = 400;
      throw err;
    }
  }
}

module.exports = { assertDriverIdentityFree };
