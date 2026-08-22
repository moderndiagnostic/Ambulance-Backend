const express = require("express");
const router = express.Router();
const bcrypt = require("bcrypt");
const Ambulance = require("../Models/Ambulance");
const AmbulanceDriver = require("../Models/AmbulanceDriver");
const AmbulanceTrip = require("../Models/AmbulanceTrip");
const AmbulanceShift = require("../Models/AmbulanceShift");
const { verifyToken, requireRole } = require("./authMiddleware");
const { assertDriverIdentityFree } = require("../services/fieldIdentity");
const { generateAmbulanceTripId } = require("../services/ambulanceTripId");
const { sendPushToPhlebo } = require("../services/push");
const { ymd, dayRange, odoTripKm, kmMismatch } = require("../services/geo");

const adminOnly = [verifyToken, requireRole("admin", "ops", "manager")];

function cityFilter(user) {
  if (user.role === "admin" || user.role === "manager") {
    return user.city ? { city: user.city } : {};
  }
  return {};
}

function resolvedCity(user, city) {
  if (user.role === "admin" || user.role === "manager") return user.city || "";
  return city ? String(city).trim() : "";
}

const ACTIVE_TRIP_STATUSES = [
  "Assigned",
  "Accepted",
  "EnRoutePickup",
  "ArrivedPickup",
  "Onboard",
  "EnRouteDrop",
  "ArrivedDrop",
];

function createdAtFilter(query) {
  const from = String(query?.from || "").trim();
  const to = String(query?.to || "").trim();
  if (!from && !to) return null;
  const start = from ? dayRange(from).start : new Date(0);
  const end = to ? dayRange(to).end : new Date(Date.now() + 24 * 60 * 60 * 1000);
  return { start, end };
}

function chartWindow(query) {
  const range = createdAtFilter(query);
  if (range) return range;
  const toKey = ymd();
  const fromDate = new Date();
  fromDate.setDate(fromDate.getDate() - 13);
  return { start: dayRange(ymd(fromDate)).start, end: dayRange(toKey).end };
}

async function applyAssignment(user, trip, driverId, ambulanceId) {
  if (!driverId || !ambulanceId) {
    return { error: { status: 400, message: "driverId and ambulanceId required" } };
  }
  if (["Completed", "Cancelled"].includes(trip.tripStatus)) {
    return { error: { status: 400, message: "Cannot assign a closed trip" } };
  }

  const driver = await AmbulanceDriver.findOne({
    _id: driverId,
    ...cityFilter(user),
    status: "active",
  });
  if (!driver) return { error: { status: 404, message: "Driver not found" } };

  const busy = await AmbulanceTrip.findOne({
    assignedDriver: driver._id,
    tripStatus: { $in: ACTIVE_TRIP_STATUSES },
    _id: { $ne: trip._id },
  });
  if (busy) {
    return { error: { status: 400, message: "Driver already has an active trip" } };
  }

  const ambulance = await Ambulance.findOne({
    _id: ambulanceId,
    ...cityFilter(user),
    isActive: true,
  });
  if (!ambulance) return { error: { status: 404, message: "Ambulance not found" } };
  if (ambulance.status === "maintenance") {
    return { error: { status: 400, message: "Ambulance is in maintenance" } };
  }
  if (ambulance.status === "on_trip" && String(trip.assignedAmbulance) !== String(ambulance._id)) {
    return { error: { status: 400, message: "Ambulance already on another trip" } };
  }

  if (trip.assignedAmbulance && String(trip.assignedAmbulance) !== String(ambulance._id)) {
    await Ambulance.findByIdAndUpdate(trip.assignedAmbulance, { status: "available" });
  }

  trip.assignedDriver = driver._id;
  trip.assignedDriverName = driver.name;
  trip.assignedAmbulance = ambulance._id;
  trip.vehicleNumber = ambulance.vehicleNumber;
  trip.assignedAt = new Date();
  trip.assignedByName = user.name || user.email || "";
  trip.tripStatus = "Assigned";
  trip.rejectedReason = "";
  await trip.save();

  ambulance.status = "on_trip";
  await ambulance.save();

  sendPushToPhlebo(
    driver,
    "New ambulance trip",
    `${trip.patientName} — ${trip.pickupAddress}`,
    { tripId: String(trip._id) }
  ).catch(() => {});

  return { trip };
}

function formatAmbulance(a) {
  return {
    id: a._id,
    vehicleNumber: a.vehicleNumber,
    type: a.type,
    city: a.city,
    status: a.status,
    notes: a.notes,
    isActive: a.isActive,
    createdAt: a.createdAt,
  };
}

function formatDriver(d) {
  const obj = d.toObject ? d.toObject() : d;
  delete obj.passwordHash;
  obj.id = obj._id;
  return obj;
}

function photosMissing() {
  return [];
}

function formatTrip(t, { includePath = false } = {}) {
  const gpsKm = Math.round((Number(t.gpsKm) || 0) * 100) / 100;
  const odoKm = odoTripKm(t.startOdometerKm, t.endOdometerKm);
  const mismatch = kmMismatch(gpsKm, odoKm);
  const missing = photosMissing(t);
  const out = {
    id: t._id,
    tripId: t.tripId,
    patientName: t.patientName,
    mobileNumber: t.mobileNumber,
    pickupAddress: t.pickupAddress,
    pickupLat: t.pickupLat,
    pickupLng: t.pickupLng,
    dropAddress: t.dropAddress,
    dropLat: t.dropLat,
    dropLng: t.dropLng,
    hospitalName: t.hospitalName,
    city: t.city,
    pincode: t.pincode,
    requestedType: t.requestedType,
    notes: t.notes,
    assignedDriver: t.assignedDriver,
    assignedDriverName: t.assignedDriverName,
    assignedAmbulance: t.assignedAmbulance,
    vehicleNumber: t.vehicleNumber,
    assignedAt: t.assignedAt,
    assignedByName: t.assignedByName,
    tripStatus: t.tripStatus,
    rejectedReason: t.rejectedReason,
    rescheduleRequested: !!t.rescheduleRequested,
    rescheduleRequestedAt: t.rescheduleRequestedAt,
    rescheduleRequestNote: t.rescheduleRequestNote,
    cancelReason: t.cancelReason,
    liveLat: t.liveLat,
    liveLng: t.liveLng,
    liveAt: t.liveAt,
    createdAt: t.createdAt,
    completedAt: t.completedAt,
    acceptedAt: t.acceptedAt,
    enRoutePickupAt: t.enRoutePickupAt,
    arrivedPickupAt: t.arrivedPickupAt,
    onboardAt: t.onboardAt,
    enRouteDropAt: t.enRouteDropAt,
    arrivedDropAt: t.arrivedDropAt,
    startOdometerKm: t.startOdometerKm,
    startOdometerPhotoUrl: t.startOdometerPhotoUrl || "",
    startVehiclePhotoUrl: t.startVehiclePhotoUrl || "",
    startProofAt: t.startProofAt,
    startProofLat: t.startProofLat,
    startProofLng: t.startProofLng,
    endOdometerKm: t.endOdometerKm,
    endOdometerPhotoUrl: t.endOdometerPhotoUrl || "",
    endVehiclePhotoUrl: t.endVehiclePhotoUrl || "",
    endProofAt: t.endProofAt,
    gpsKm,
    odoKm,
    kmMismatch: mismatch.alert,
    kmMismatchPct: mismatch.pct,
    photosMissing: missing,
  };
  if (includePath) {
    out.path = Array.isArray(t.path) ? t.path : [];
  }
  return out;
}

// ── Vehicles ────────────────────────────────────────────────────────────────

router.get("/admin/ambulances", ...adminOnly, async (req, res) => {
  try {
    const rows = await Ambulance.find(cityFilter(req.user)).sort({ vehicleNumber: 1 });
    res.json({ success: true, ambulances: rows.map(formatAmbulance) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/admin/ambulances", ...adminOnly, async (req, res) => {
  try {
    const { vehicleNumber, type, notes } = req.body || {};
    if (!vehicleNumber) {
      return res.status(400).json({ success: false, message: "Vehicle number required" });
    }
    const ambulance = await Ambulance.create({
      vehicleNumber: String(vehicleNumber).trim().toUpperCase(),
      type: ["BLS", "ALS", "ICU"].includes(type) ? type : "BLS",
      city: resolvedCity(req.user, req.body.city),
      notes: notes ? String(notes).trim() : "",
    });
    res.status(201).json({ success: true, ambulance: formatAmbulance(ambulance) });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: "Vehicle number already exists" });
    }
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/admin/ambulances/:id", ...adminOnly, async (req, res) => {
  try {
    const ambulance = await Ambulance.findOne({ _id: req.params.id, ...cityFilter(req.user) });
    if (!ambulance) return res.status(404).json({ success: false, message: "Ambulance not found" });
    const { vehicleNumber, type, status, notes, isActive } = req.body || {};
    if (vehicleNumber) ambulance.vehicleNumber = String(vehicleNumber).trim().toUpperCase();
    if (["BLS", "ALS", "ICU"].includes(type)) ambulance.type = type;
    if (["available", "on_trip", "maintenance"].includes(status)) ambulance.status = status;
    if (notes !== undefined) ambulance.notes = String(notes).trim();
    if (typeof isActive === "boolean") ambulance.isActive = isActive;
    await ambulance.save();
    res.json({ success: true, ambulance: formatAmbulance(ambulance) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ── Drivers ─────────────────────────────────────────────────────────────────

router.get("/admin/ambulance-drivers", ...adminOnly, async (req, res) => {
  try {
    const rows = await AmbulanceDriver.find(cityFilter(req.user))
      .sort({ name: 1 })
      .select("-passwordHash");
    res.json({ success: true, drivers: rows.map(formatDriver) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/admin/ambulance-drivers", ...adminOnly, async (req, res) => {
  try {
    const { name, phone, employeeId, zone } = req.body || {};
    if (!name || !phone) {
      return res.status(400).json({ success: false, message: "Name and phone required" });
    }
    const mobile = String(phone).trim();
    if (!/^\d{10}$/.test(mobile)) {
      return res.status(400).json({ success: false, message: "Phone must be 10 digits" });
    }
    const city = resolvedCity(req.user, req.body.city);
    const empId = employeeId ? String(employeeId).trim() : `AMB-${Date.now().toString().slice(-6)}`;
    await assertDriverIdentityFree({ employeeId: empId, phone: mobile });
    const driver = await AmbulanceDriver.create({
      name: String(name).trim(),
      phone: mobile,
      employeeId: empId,
      city,
      zone: zone ? String(zone).trim() : "",
    });
    res.status(201).json({ success: true, driver: formatDriver(driver) });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
});

router.put("/admin/ambulance-drivers/:id", ...adminOnly, async (req, res) => {
  try {
    const driver = await AmbulanceDriver.findOne({ _id: req.params.id, ...cityFilter(req.user) });
    if (!driver) return res.status(404).json({ success: false, message: "Driver not found" });
    const { name, phone, employeeId, password, zone, status, assignedAmbulance } = req.body || {};
    const nextPhone = phone !== undefined ? String(phone).trim() : driver.phone;
    const nextEmp = employeeId !== undefined ? String(employeeId).trim() : driver.employeeId;
    await assertDriverIdentityFree({
      employeeId: nextEmp,
      phone: nextPhone,
      excludeDriverId: driver._id,
    });
    if (name) driver.name = String(name).trim();
    if (phone) driver.phone = nextPhone;
    if (employeeId) driver.employeeId = nextEmp;
    if (zone !== undefined) driver.zone = String(zone).trim();
    if (["active", "inactive", "suspended"].includes(status)) driver.status = status;
    if (assignedAmbulance !== undefined) {
      driver.assignedAmbulance = assignedAmbulance || null;
    }
    if (password) {
      if (String(password).length < 6) {
        return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
      }
      driver.passwordHash = await bcrypt.hash(String(password), 10);
    }
    await driver.save();
    res.json({ success: true, driver: formatDriver(driver) });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
});

// ── Trips ───────────────────────────────────────────────────────────────────

router.get("/admin/ambulance-trips", ...adminOnly, async (req, res) => {
  try {
    const filter = { ...cityFilter(req.user) };
    if (req.query.status) filter.tripStatus = String(req.query.status);
    const range = createdAtFilter(req.query);
    if (range) {
      filter.$or = [
        { createdAt: { $gte: range.start, $lt: range.end } },
        { assignedAt: { $gte: range.start, $lt: range.end } },
        { completedAt: { $gte: range.start, $lt: range.end } },
      ];
    }
    const trips = await AmbulanceTrip.find(filter).select("-path").sort({ createdAt: -1 }).limit(400);
    res.json({ success: true, trips: trips.map((t) => formatTrip(t)) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/admin/ambulance-trips/:id", ...adminOnly, async (req, res) => {
  try {
    const trip = await AmbulanceTrip.findOne({ _id: req.params.id, ...cityFilter(req.user) });
    if (!trip) return res.status(404).json({ success: false, message: "Trip not found" });
    res.json({ success: true, trip: formatTrip(trip, { includePath: true }) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put("/admin/ambulance-trips/:id", ...adminOnly, async (req, res) => {
  try {
    const trip = await AmbulanceTrip.findOne({ _id: req.params.id, ...cityFilter(req.user) });
    if (!trip) return res.status(404).json({ success: false, message: "Trip not found" });
    const b = req.body || {};
    if (b.patientName != null) trip.patientName = String(b.patientName).trim();
    if (b.mobileNumber != null) trip.mobileNumber = String(b.mobileNumber).trim();
    if (b.pickupAddress != null) trip.pickupAddress = String(b.pickupAddress).trim();
    if (b.dropAddress != null) trip.dropAddress = String(b.dropAddress).trim();
    if (b.hospitalName != null) trip.hospitalName = String(b.hospitalName).trim();
    if (b.pincode != null) trip.pincode = String(b.pincode).trim();
    if (b.notes != null) trip.notes = String(b.notes).trim();
    if (["BLS", "ALS", "ICU"].includes(b.requestedType)) trip.requestedType = b.requestedType;
    if (typeof b.pickupLat === "number") trip.pickupLat = b.pickupLat;
    if (typeof b.pickupLng === "number") trip.pickupLng = b.pickupLng;
    if (typeof b.dropLat === "number") trip.dropLat = b.dropLat;
    if (typeof b.dropLng === "number") trip.dropLng = b.dropLng;
    if (!trip.patientName || !trip.pickupAddress || !trip.dropAddress) {
      return res.status(400).json({
        success: false,
        message: "Patient name, pickup and drop address required",
      });
    }
    await trip.save();
    res.json({ success: true, trip: formatTrip(trip) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/admin/ambulance-trips", ...adminOnly, async (req, res) => {
  return res.status(403).json({
    success: false,
    message: "Drivers create trips from the app. Admin can only view.",
  });
});

router.put("/admin/ambulance-trips/:id/assign", ...adminOnly, async (_req, res) => {
  return res.status(403).json({
    success: false,
    message: "Drivers assign trips from the app. Admin can only view.",
  });
});

router.put("/admin/ambulance-trips/:id/cancel", ...adminOnly, async (req, res) => {
  try {
    const trip = await AmbulanceTrip.findOne({ _id: req.params.id, ...cityFilter(req.user) });
    if (!trip) return res.status(404).json({ success: false, message: "Trip not found" });
    if (["Completed", "Cancelled"].includes(trip.tripStatus)) {
      return res.status(400).json({ success: false, message: "Trip already closed" });
    }
    if (trip.assignedAmbulance) {
      await Ambulance.findByIdAndUpdate(trip.assignedAmbulance, { status: "available" });
    }
    trip.tripStatus = "Cancelled";
    trip.cancelReason = String(req.body.reason || "").trim();
    trip.cancelledAt = new Date();
    await trip.save();
    res.json({ success: true, trip: formatTrip(trip) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

function formatShiftAdmin(s) {
  return {
    id: s._id,
    driverName: s.driverName,
    driver: s.driver,
    vehicleNumber: s.vehicleNumber,
    city: s.city,
    dateKey: s.dateKey,
    checkInAt: s.checkInAt,
    checkOutAt: s.checkOutAt,
    odometerStart: s.odometerStart,
    odometerEnd: s.odometerEnd,
    checkInOdometerPhotoUrl: s.checkInOdometerPhotoUrl || "",
    checkInVehiclePhotoUrl: s.checkInVehiclePhotoUrl || (s.checkInVehiclePhotoUrls || [])[0] || "",
    checkInVehiclePhotoUrls: (s.checkInVehiclePhotoUrls || []).length
      ? s.checkInVehiclePhotoUrls
      : s.checkInVehiclePhotoUrl
        ? [s.checkInVehiclePhotoUrl]
        : [],
    checkOutOdometerPhotoUrl: s.checkOutOdometerPhotoUrl || "",
    checkOutVehiclePhotoUrl: s.checkOutVehiclePhotoUrl || (s.checkOutVehiclePhotoUrls || [])[0] || "",
    checkOutVehiclePhotoUrls: (s.checkOutVehiclePhotoUrls || []).length
      ? s.checkOutVehiclePhotoUrls
      : s.checkOutVehiclePhotoUrl
        ? [s.checkOutVehiclePhotoUrl]
        : [],
    gpsKm: s.gpsKm || 0,
    condition: s.condition || {},
    legs: s.legs || [],
  };
}

router.get("/admin/shifts", ...adminOnly, async (req, res) => {
  try {
    const filter = { ...cityFilter(req.user) };
    if (req.query.date) filter.dateKey = String(req.query.date);
    const shifts = await AmbulanceShift.find(filter).sort({ checkInAt: -1 }).limit(200);
    res.json({ success: true, shifts: shifts.map(formatShiftAdmin) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/admin/dashboard", ...adminOnly, async (req, res) => {
  try {
    const city = cityFilter(req.user);
    const todayKey = ymd();
    const { start: todayStart, end: todayEnd } = dayRange(todayKey);
    const range = createdAtFilter(req.query);
    const tripMatch = { ...city };
    if (range) tripMatch.createdAt = { $gte: range.start, $lt: range.end };
    const window = chartWindow(req.query);
    const chartMatch = {
      ...city,
      createdAt: { $gte: window.start, $lt: window.end },
    };

    const [
      totalTrips,
      todayTrips,
      unassigned,
      completed,
      cancelled,
      rejected,
      active,
      driversTotal,
      driversOnDuty,
      liveGps,
      fleetRows,
      todayShifts,
      statusRows,
      typeRows,
      dayRows,
      recent,
      auditTrips,
    ] = await Promise.all([
      AmbulanceTrip.countDocuments(tripMatch),
      AmbulanceTrip.countDocuments({ ...city, createdAt: { $gte: todayStart, $lt: todayEnd } }),
      AmbulanceTrip.countDocuments({ ...tripMatch, tripStatus: "Unassigned" }),
      AmbulanceTrip.countDocuments({ ...tripMatch, tripStatus: "Completed" }),
      AmbulanceTrip.countDocuments({ ...tripMatch, tripStatus: "Cancelled" }),
      AmbulanceTrip.countDocuments({ ...tripMatch, tripStatus: "Rejected" }),
      AmbulanceTrip.countDocuments({ ...city, tripStatus: { $in: ACTIVE_TRIP_STATUSES } }),
      AmbulanceDriver.countDocuments(city),
      AmbulanceDriver.countDocuments({ ...city, dutyStatus: "on_duty" }),
      AmbulanceDriver.countDocuments({
        ...city,
        dutyStatus: "on_duty",
        currentLat: { $type: "number" },
        currentLng: { $type: "number" },
      }),
      Ambulance.find(city).select("status isActive"),
      AmbulanceShift.find({ ...city, dateKey: todayKey }),
      AmbulanceTrip.aggregate([{ $match: tripMatch }, { $group: { _id: "$tripStatus", n: { $sum: 1 } } }]),
      AmbulanceTrip.aggregate([{ $match: tripMatch }, { $group: { _id: "$requestedType", n: { $sum: 1 } } }]),
      AmbulanceTrip.aggregate([
        { $match: chartMatch },
        {
          $group: {
            _id: {
              $dateToString: { format: "%Y-%m-%d", date: "$createdAt", timezone: "Asia/Kolkata" },
            },
            trips: { $sum: 1 },
            completed: {
              $sum: { $cond: [{ $eq: ["$tripStatus", "Completed"] }, 1, 0] },
            },
            cancelled: {
              $sum: {
                $cond: [{ $in: ["$tripStatus", ["Cancelled", "Rejected"]] }, 1, 0],
              },
            },
            gpsKm: { $sum: { $ifNull: ["$gpsKm", 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      AmbulanceTrip.find(tripMatch).select("-path").sort({ createdAt: -1 }).limit(8),
      AmbulanceTrip.find(tripMatch)
        .select(
          "tripStatus startOdometerKm endOdometerKm gpsKm startOdometerPhotoUrl startVehiclePhotoUrl endOdometerPhotoUrl startProofAt endProofAt"
        )
        .limit(800),
    ]);

    const fleetActive = fleetRows.filter((a) => a.isActive !== false);
    const byStatus = {};
    statusRows.forEach((r) => {
      byStatus[r._id || "Unknown"] = r.n;
    });
    const byType = {};
    typeRows.forEach((r) => {
      byType[r._id || "BLS"] = r.n;
    });

    const byDayMap = new Map(dayRows.map((r) => [r._id, r]));
    const byDay = [];
    const cursor = new Date(window.start);
    while (cursor < window.end) {
      const key = ymd(cursor);
      const row = byDayMap.get(key);
      byDay.push({
        date: key,
        trips: row?.trips || 0,
        completed: row?.completed || 0,
        cancelled: row?.cancelled || 0,
        gpsKm: Math.round((row?.gpsKm || 0) * 10) / 10,
      });
      cursor.setDate(cursor.getDate() + 1);
      if (byDay.length > 92) break;
    }

    let kmMismatchCount = 0;
    let photosMissingCount = 0;
    let gpsKmRange = 0;
    auditTrips.forEach((t) => {
      const formatted = formatTrip(t);
      if (formatted.kmMismatch) kmMismatchCount += 1;
      if (formatted.photosMissing.length) photosMissingCount += 1;
      gpsKmRange += Number(formatted.gpsKm) || 0;
    });

    const gpsKmToday = Math.round(todayShifts.reduce((s, sh) => s + (Number(sh.gpsKm) || 0), 0) * 10) / 10;
    const openCheckIns = todayShifts.filter((s) => !s.checkOutAt).length;
    const completionRate = totalTrips ? Math.round((completed / totalTrips) * 100) : 0;

    res.json({
      success: true,
      date: todayKey,
      from: req.query.from || "",
      to: req.query.to || "",
      totalTrips,
      todayTrips,
      unassigned,
      completed,
      cancelled,
      rejected,
      active,
      completionRate,
      kmMismatchCount,
      photosMissingCount,
      gpsKmToday,
      gpsKmRange: Math.round(gpsKmRange * 10) / 10,
      openCheckIns,
      drivers: { total: driversTotal, onDuty: driversOnDuty, liveGps },
      fleet: {
        total: fleetActive.length,
        available: fleetActive.filter((a) => a.status === "available").length,
        onTrip: fleetActive.filter((a) => a.status === "on_trip").length,
        maintenance: fleetActive.filter((a) => a.status === "maintenance").length,
      },
      byStatus,
      byType,
      byDay,
      recent: recent.map((t) => formatTrip(t)),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

function emptyDailyRow(driverId, driverName) {
  return {
    driverId: driverId || null,
    driverName: driverName || "Unassigned",
    vehicles: new Set(),
    tripCount: 0,
    completedCount: 0,
    cancelledCount: 0,
    unassignedCount: 0,
    gpsKm: 0,
    odoKm: 0,
    kmMismatchCount: 0,
    photosMissingCount: 0,
    trips: [],
    checkInAt: null,
    checkOutAt: null,
    odometerStart: null,
    odometerEnd: null,
    shiftGpsKm: 0,
    shiftOdoKm: null,
  };
}

function dutyHours(checkInAt, checkOutAt) {
  if (!checkInAt) return null;
  const start = new Date(checkInAt).getTime();
  if (!Number.isFinite(start)) return null;
  const end = checkOutAt ? new Date(checkOutAt).getTime() : Date.now();
  if (!Number.isFinite(end)) return null;
  return Math.max(0, Math.round(((end - start) / 3600000) * 10) / 10);
}

function shiftOdoOf(s) {
  if (s.odometerStart == null || s.odometerEnd == null) return null;
  const n = Number(s.odometerEnd) - Number(s.odometerStart);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.round(n * 10) / 10);
}

router.get("/admin/daily-sheet", ...adminOnly, async (req, res) => {
  try {
    const dateKey = String(req.query.date || ymd());
    const { start, end } = dayRange(dateKey);
    const city = cityFilter(req.user);
    const [trips, shifts] = await Promise.all([
      AmbulanceTrip.find({
        ...city,
        $or: [
          { createdAt: { $gte: start, $lt: end } },
          { assignedAt: { $gte: start, $lt: end } },
          { completedAt: { $gte: start, $lt: end } },
        ],
      })
        .select("-path")
        .sort({ assignedDriverName: 1, createdAt: 1 }),
      AmbulanceShift.find({ ...city, dateKey }).sort({ checkInAt: 1 }),
    ]);

    const byDriver = new Map();
    function rowFor(key, driverId, driverName) {
      if (!byDriver.has(key)) byDriver.set(key, emptyDailyRow(driverId, driverName));
      return byDriver.get(key);
    }

    for (const t of trips) {
      const formatted = formatTrip(t);
      const key = t.assignedDriver ? String(t.assignedDriver) : "unassigned";
      const row = rowFor(key, t.assignedDriver || null, t.assignedDriverName || "Unassigned");
      row.tripCount += 1;
      if (t.tripStatus === "Completed") row.completedCount += 1;
      if (t.tripStatus === "Cancelled" || t.tripStatus === "Rejected") row.cancelledCount += 1;
      if (t.tripStatus === "Unassigned") row.unassignedCount += 1;
      if (t.vehicleNumber) row.vehicles.add(t.vehicleNumber);
      row.gpsKm += formatted.gpsKm || 0;
      if (formatted.odoKm != null) row.odoKm += formatted.odoKm;
      if (formatted.kmMismatch) row.kmMismatchCount += 1;
      if (formatted.photosMissing.length) row.photosMissingCount += 1;
      row.trips.push({
        id: formatted.id,
        tripId: formatted.tripId,
        patientName: formatted.patientName,
        mobileNumber: formatted.mobileNumber,
        pickupAddress: formatted.pickupAddress,
        dropAddress: formatted.dropAddress,
        hospitalName: formatted.hospitalName,
        requestedType: formatted.requestedType,
        assignedDriverName: formatted.assignedDriverName,
        vehicleNumber: formatted.vehicleNumber,
        tripStatus: formatted.tripStatus,
        gpsKm: formatted.gpsKm,
        odoKm: formatted.odoKm,
        kmMismatch: formatted.kmMismatch,
        kmMismatchPct: formatted.kmMismatchPct,
        photosMissing: formatted.photosMissing,
        createdAt: formatted.createdAt,
        completedAt: formatted.completedAt,
      });
    }

    for (const s of shifts) {
      const key = s.driver ? String(s.driver) : `shift:${s._id}`;
      const row = rowFor(key, s.driver || null, s.driverName || "Driver");
      if (s.vehicleNumber) row.vehicles.add(s.vehicleNumber);
      if (s.checkInAt && (!row.checkInAt || s.checkInAt < row.checkInAt)) row.checkInAt = s.checkInAt;
      if (s.checkOutAt) {
        if (!row.checkOutAt || s.checkOutAt > row.checkOutAt) row.checkOutAt = s.checkOutAt;
      }
      if (s.odometerStart != null && (row.odometerStart == null || s.odometerStart < row.odometerStart)) {
        row.odometerStart = s.odometerStart;
      }
      if (s.odometerEnd != null && (row.odometerEnd == null || s.odometerEnd > row.odometerEnd)) {
        row.odometerEnd = s.odometerEnd;
      }
      row.shiftGpsKm += Number(s.gpsKm) || 0;
      const odo = shiftOdoOf(s);
      if (odo != null) row.shiftOdoKm = Math.round(((row.shiftOdoKm || 0) + odo) * 10) / 10;
    }

    // If any shift still open, check-out should stay empty even if an older shift closed
    for (const s of shifts) {
      if (!s.driver || s.checkOutAt) continue;
      const row = byDriver.get(String(s.driver));
      if (row) row.checkOutAt = null;
    }

    const rows = [...byDriver.values()]
      .map((r) => ({
        driverId: r.driverId,
        driverName: r.driverName,
        vehicles: [...r.vehicles],
        tripCount: r.tripCount,
        completedCount: r.completedCount,
        cancelledCount: r.cancelledCount,
        unassignedCount: r.unassignedCount,
        gpsKm: Math.round(r.gpsKm * 10) / 10,
        tripOdoKm: Math.round(r.odoKm * 10) / 10,
        odoKm: Math.round(r.odoKm * 10) / 10,
        shiftGpsKm: Math.round(r.shiftGpsKm * 10) / 10,
        shiftOdoKm: r.shiftOdoKm,
        odometerStart: r.odometerStart,
        odometerEnd: r.odometerEnd,
        checkInAt: r.checkInAt,
        checkOutAt: r.checkOutAt,
        dutyHours: dutyHours(r.checkInAt, r.checkOutAt),
        openCheckIn: !!(r.checkInAt && !r.checkOutAt),
        kmMismatchCount: r.kmMismatchCount,
        photosMissingCount: r.photosMissingCount,
        trips: r.trips,
      }))
      .sort((a, b) => {
        if (!a.driverId && b.driverId) return 1;
        if (a.driverId && !b.driverId) return -1;
        return String(a.driverName).localeCompare(String(b.driverName));
      });

    res.json({
      success: true,
      date: dateKey,
      totals: {
        drivers: rows.filter((r) => r.driverId).length,
        trips: trips.length,
        completed: rows.reduce((s, r) => s + r.completedCount, 0),
        cancelled: rows.reduce((s, r) => s + r.cancelledCount, 0),
        unassigned: rows.reduce((s, r) => s + r.unassignedCount, 0),
        gpsKm: Math.round(rows.reduce((s, r) => s + r.gpsKm, 0) * 10) / 10,
        tripOdoKm: Math.round(rows.reduce((s, r) => s + r.tripOdoKm, 0) * 10) / 10,
        shiftOdoKm: Math.round(rows.reduce((s, r) => s + (r.shiftOdoKm || 0), 0) * 10) / 10,
        photosMissing: rows.reduce((s, r) => s + r.photosMissingCount, 0),
        kmMismatch: rows.reduce((s, r) => s + r.kmMismatchCount, 0),
        openCheckIns: rows.filter((r) => r.openCheckIn).length,
      },
      rows,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/admin/kms", ...adminOnly, async (req, res) => {
  try {
    const filter = { ...cityFilter(req.user) };
    if (req.query.date) filter.dateKey = String(req.query.date);
    const shifts = await AmbulanceShift.find(filter).sort({ dateKey: -1, driverName: 1 }).limit(300);
    res.json({
      success: true,
      rows: shifts.map((s) => ({
        id: s._id,
        dateKey: s.dateKey,
        driverName: s.driverName,
        vehicleNumber: s.vehicleNumber,
        gpsKm: s.gpsKm || 0,
        odometerKm:
          s.odometerStart != null && s.odometerEnd != null
            ? Math.max(0, s.odometerEnd - s.odometerStart)
            : null,
        checkInAt: s.checkInAt,
        checkOutAt: s.checkOutAt,
      })),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/admin/maps-config", ...adminOnly, (_req, res) => {
  const key = String(process.env.GOOGLE_MAPS_API_KEY || "").trim();
  res.json({ success: true, googleMapsKey: key, enabled: Boolean(key) });
});

router.get("/admin/live-drivers", ...adminOnly, async (req, res) => {
  try {
    const filter = {
      ...cityFilter(req.user),
      dutyStatus: "on_duty",
      currentLat: { $type: "number" },
      currentLng: { $type: "number" },
    };
    const drivers = await AmbulanceDriver.find(filter)
      .select(
        "name phone zone city dutyStatus currentLat currentLng lastLocationAt todayDistanceKm vehicleNumber assignedAmbulance locationTrail"
      )
      .sort({ name: 1 });

    const openTripStatuses = [
      "Assigned",
      "Accepted",
      "EnRoutePickup",
      "ArrivedPickup",
      "Onboard",
      "EnRouteDrop",
      "ArrivedDrop",
    ];
    const trips = await AmbulanceTrip.find({
      assignedDriver: { $in: drivers.map((d) => d._id) },
      tripStatus: { $in: openTripStatuses },
    }).select(
      "assignedDriver tripStatus patientName pickupAddress dropAddress hospitalName pickupLat pickupLng dropLat dropLng liveLat liveLng"
    );
    const tripByDriver = {};
    trips.forEach((t) => {
      tripByDriver[String(t.assignedDriver)] = t;
    });

    res.json({
      success: true,
      drivers: drivers.map((d) => {
        const t = tripByDriver[String(d._id)];
        return {
          _id: d._id,
          name: d.name,
          phone: d.phone,
          zone: d.zone,
          city: d.city,
          dutyStatus: d.dutyStatus,
          currentLat: d.currentLat,
          currentLng: d.currentLng,
          lastLocationAt: d.lastLocationAt,
          todayDistanceKm: d.todayDistanceKm,
          vehicleNumber: d.vehicleNumber,
          locationTrail: d.locationTrail || [],
          activeTrip: t
            ? {
                tripStatus: t.tripStatus,
                patientName: t.patientName,
                pickupAddress: t.pickupAddress,
                dropAddress: t.dropAddress,
                hospitalName: t.hospitalName,
                pickupLat: t.pickupLat,
                pickupLng: t.pickupLng,
                dropLat: t.dropLat,
                dropLng: t.dropLng,
              }
            : null,
        };
      }),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
