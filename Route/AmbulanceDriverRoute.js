const express = require("express");
const router = express.Router();
const Ambulance = require("../Models/Ambulance");
const AmbulanceTrip = require("../Models/AmbulanceTrip");
const AmbulanceShift = require("../Models/AmbulanceShift");
const { verifyAmbulanceDriver } = require("./ambulanceAuthMiddleware");
const { haversineKm, ymd, appendTripPath, odoTripKm } = require("../services/geo");
const { generateAmbulanceTripId } = require("../services/ambulanceTripId");
const { saveDataUrlImage } = require("../services/media");

const MAX_VEHICLE_PHOTOS = 8;

function saveVehiclePhotoList(body, folder) {
  const raw = [];
  if (Array.isArray(body?.vehiclePhotos) && body.vehiclePhotos.length) {
    raw.push(...body.vehiclePhotos);
  } else if (body?.vehiclePhoto) {
    raw.push(body.vehiclePhoto);
  }
  const out = [];
  for (const item of raw.slice(0, MAX_VEHICLE_PHOTOS)) {
    const p = saveDataUrlImage(item, folder);
    if (p) out.push(p);
  }
  return out;
}

const MAX_REALISTIC_PING_KM = 3;

const NEXT_STATUS = {
  Assigned: ["Accepted", "Rejected"],
  Accepted: ["EnRoutePickup"],
  EnRoutePickup: ["ArrivedPickup"],
  ArrivedPickup: ["Onboard"],
  Onboard: ["EnRouteDrop"],
  EnRouteDrop: ["ArrivedDrop"],
  ArrivedDrop: ["Completed"],
};

const OPEN_STATUSES = [
  "Assigned",
  "Accepted",
  "EnRoutePickup",
  "ArrivedPickup",
  "Onboard",
  "EnRouteDrop",
  "ArrivedDrop",
];

function formatDriver(d) {
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
    currentLat: d.currentLat,
    currentLng: d.currentLng,
    lastLocationAt: d.lastLocationAt,
    todayDistanceKm: d.todayDistanceKm || 0,
    photoUrl: d.photoUrl || "",
  };
}

function formatTrip(t) {
  const gpsKm = Math.round((Number(t.gpsKm) || 0) * 10) / 10;
  const odoKm = odoTripKm(t.startOdometerKm, t.endOdometerKm);
  const tripKm = odoKm != null && odoKm > 0 ? odoKm : gpsKm;
  return {
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
    requestedType: t.requestedType,
    notes: t.notes,
    assignedDriverName: t.assignedDriverName,
    vehicleNumber: t.vehicleNumber,
    tripStatus: t.tripStatus,
    rejectedReason: t.rejectedReason,
    rescheduleRequested: !!t.rescheduleRequested,
    rescheduleRequestedAt: t.rescheduleRequestedAt,
    rescheduleRequestNote: t.rescheduleRequestNote,
    assignedAt: t.assignedAt,
    acceptedAt: t.acceptedAt,
    enRoutePickupAt: t.enRoutePickupAt,
    arrivedPickupAt: t.arrivedPickupAt,
    onboardAt: t.onboardAt,
    enRouteDropAt: t.enRouteDropAt,
    arrivedDropAt: t.arrivedDropAt,
    completedAt: t.completedAt,
    cancelledAt: t.cancelledAt,
    liveLat: t.liveLat,
    liveLng: t.liveLng,
    startOdometerKm: t.startOdometerKm,
    startOdometerPhotoUrl: t.startOdometerPhotoUrl || "",
    startVehiclePhotoUrl: t.startVehiclePhotoUrl || "",
    startProofAt: t.startProofAt,
    endOdometerKm: t.endOdometerKm,
    endOdometerPhotoUrl: t.endOdometerPhotoUrl || "",
    endVehiclePhotoUrl: t.endVehiclePhotoUrl || "",
    endProofAt: t.endProofAt,
    createdAt: t.createdAt,
    gpsKm,
    odoKm,
    tripKm,
  };
}

async function requireReadyShift(req, res) {
  if (req.driver.dutyStatus !== "on_duty") {
    res.status(400).json({
      success: false,
      message: "Go on duty (start-of-day check-in) before taking a trip",
      needCheckIn: true,
    });
    return null;
  }
  const shift = await AmbulanceShift.findOne({
    driver: req.driver._id,
    dateKey: ymd(),
    checkOutAt: null,
  });
  if (!shift || !shift.ambulance) {
    res.status(400).json({
      success: false,
      message: "Start-of-day vehicle check-in required",
      needCheckIn: true,
    });
    return null;
  }
  const busy = await AmbulanceTrip.findOne({
    assignedDriver: req.driver._id,
    tripStatus: { $in: OPEN_STATUSES },
  });
  if (busy) {
    res.status(400).json({
      success: false,
      message: "Finish your current trip first",
      activeTripId: busy._id,
    });
    return null;
  }
  return shift;
}

function cityPoolFilter(driver) {
  if (!driver.city) return {};
  return { $or: [{ city: driver.city }, { city: "" }, { city: { $exists: false } }] };
}

async function assignTripToDriver(trip, driver, shift, ambulanceOverride) {
  const ambulance = ambulanceOverride || (await Ambulance.findById(shift.ambulance));
  if (!ambulance) {
    const err = new Error("Vehicle not found");
    err.status = 400;
    throw err;
  }
  if (ambulance.status === "maintenance") {
    const err = new Error("Vehicle is in maintenance");
    err.status = 400;
    throw err;
  }
  if (ambulance.status === "on_trip") {
    const isShiftVehicle = String(ambulance._id) === String(shift.ambulance);
    if (!isShiftVehicle) {
      const err = new Error("This vehicle is already on a trip");
      err.status = 400;
      throw err;
    }
  }
  trip.assignedDriver = driver._id;
  trip.assignedDriverName = driver.name;
  trip.assignedAmbulance = ambulance._id;
  trip.vehicleNumber = ambulance.vehicleNumber || shift.vehicleNumber;
  trip.assignedAt = new Date();
  trip.assignedByName = `${driver.name} (driver)`;
  ambulance.status = "on_trip";
  await ambulance.save();
  return trip;
}

async function loadOwnTrip(req, res) {
  const trip = await AmbulanceTrip.findOne({
    _id: req.params.id,
    assignedDriver: req.driver._id,
  });
  if (!trip) {
    res.status(404).json({ success: false, message: "Trip not found" });
    return null;
  }
  return trip;
}

async function releaseVehicle(trip) {
  if (!trip.assignedAmbulance) return;
  await Ambulance.findByIdAndUpdate(trip.assignedAmbulance, { status: "available" });
}

router.get("/ambulance/me", verifyAmbulanceDriver, async (req, res) => {
  res.json({ success: true, driver: formatDriver(req.driver) });
});

router.put("/ambulance/duty-status", verifyAmbulanceDriver, async (req, res) => {
  try {
    const { dutyStatus } = req.body;
    if (!["on_duty", "off_duty"].includes(dutyStatus)) {
      return res.status(400).json({ success: false, message: "Invalid duty status" });
    }
    if (dutyStatus === "on_duty") {
      const open = await AmbulanceShift.findOne({
        driver: req.driver._id,
        dateKey: ymd(),
        checkOutAt: null,
      });
      if (!open) {
        return res.status(400).json({
          success: false,
          message: "Start-of-day vehicle check-in required before going on duty",
          needCheckIn: true,
        });
      }
    }
    req.driver.dutyStatus = dutyStatus;
    await req.driver.save();
    res.json({ success: true, dutyStatus: req.driver.dutyStatus, driver: formatDriver(req.driver) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/ambulance/location", verifyAmbulanceDriver, async (req, res) => {
  try {
    const { lat, lng } = req.body;
    if (typeof lat !== "number" || typeof lng !== "number") {
      return res.status(400).json({ success: false, message: "lat/lng required" });
    }
    const todayKey = ymd();
    const sameDay = req.driver.todayDistanceDateKey === todayKey;
    if (
      sameDay &&
      typeof req.driver.currentLat === "number" &&
      typeof req.driver.currentLng === "number"
    ) {
      const deltaKm = haversineKm(req.driver.currentLat, req.driver.currentLng, lat, lng);
      if (deltaKm <= MAX_REALISTIC_PING_KM) {
        req.driver.todayDistanceKm =
          Math.round(((req.driver.todayDistanceKm || 0) + deltaKm) * 100) / 100;
        const shift = await AmbulanceShift.findOne({
          driver: req.driver._id,
          dateKey: todayKey,
          checkOutAt: null,
        });
        if (shift) {
          shift.gpsKm = Math.round(((shift.gpsKm || 0) + deltaKm) * 100) / 100;
          await shift.save();
        }
      }
    } else if (!sameDay) {
      req.driver.todayDistanceKm = 0;
    }
    req.driver.todayDistanceDateKey = todayKey;

    req.driver.currentLat = lat;
    req.driver.currentLng = lng;
    req.driver.lastLocationAt = new Date();
    const trail = Array.isArray(req.driver.locationTrail) ? req.driver.locationTrail : [];
    trail.push({ lat, lng, at: req.driver.lastLocationAt });
    req.driver.locationTrail = trail.slice(-80);
    await req.driver.save();

    const active = await AmbulanceTrip.findOne({
      assignedDriver: req.driver._id,
      tripStatus: { $in: OPEN_STATUSES },
    }).sort({ updatedAt: -1 });
    if (active) {
      const at = new Date();
      active.liveLat = lat;
      active.liveLng = lng;
      active.liveAt = at;
      appendTripPath(active, lat, lng, at);
      await active.save();
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/ambulance/push-token", verifyAmbulanceDriver, async (req, res) => {
  try {
    req.driver.pushToken = String(req.body?.token || "").trim();
    await req.driver.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/ambulance/trips", verifyAmbulanceDriver, async (req, res) => {
  try {
    const trips = await AmbulanceTrip.find({
      assignedDriver: req.driver._id,
    }).sort({ createdAt: -1 }).limit(300);
    res.json({ success: true, trips: trips.map(formatTrip) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/ambulance/trips/open", verifyAmbulanceDriver, async (req, res) => {
  try {
    const trips = await AmbulanceTrip.find({
      tripStatus: "Unassigned",
      ...cityPoolFilter(req.driver),
    }).sort({ createdAt: -1 }).limit(50);
    res.json({ success: true, trips: trips.map(formatTrip) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/ambulance/trips/create", verifyAmbulanceDriver, async (req, res) => {
  try {
    const shift = await requireReadyShift(req, res);
    if (!shift) return;
    const {
      patientName,
      mobileNumber,
      pickupAddress,
      dropAddress,
      hospitalName,
      requestedType,
      notes,
      pickupLat,
      pickupLng,
      dropLat,
      dropLng,
    } = req.body || {};
    if (!patientName || !pickupAddress || !dropAddress) {
      return res.status(400).json({
        success: false,
        message: "Patient name, pickup and hospital/drop address required",
      });
    }
    const ambulance = await Ambulance.findById(shift.ambulance);
    if (!ambulance) {
      return res.status(400).json({ success: false, message: "Checked-in vehicle not found" });
    }
    if (ambulance.status === "maintenance") {
      return res.status(400).json({ success: false, message: "Vehicle is in maintenance" });
    }
    const trip = new AmbulanceTrip({
      tripId: await generateAmbulanceTripId(),
      patientName: String(patientName).trim(),
      mobileNumber: mobileNumber ? String(mobileNumber).trim() : "",
      pickupAddress: String(pickupAddress).trim(),
      dropAddress: String(dropAddress).trim(),
      hospitalName: hospitalName ? String(hospitalName).trim() : "",
      city: req.driver.city || "",
      requestedType: ["BLS", "ALS", "ICU"].includes(requestedType) ? requestedType : "BLS",
      notes: notes ? String(notes).trim() : "",
      pickupLat: typeof pickupLat === "number" ? pickupLat : null,
      pickupLng: typeof pickupLng === "number" ? pickupLng : null,
      dropLat: typeof dropLat === "number" ? dropLat : null,
      dropLng: typeof dropLng === "number" ? dropLng : null,
      tripStatus: "Accepted",
      acceptedAt: new Date(),
    });
    await assignTripToDriver(trip, req.driver, shift, ambulance);
    await trip.save();
    res.status(201).json({ success: true, trip: formatTrip(trip) });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
});

router.post("/ambulance/trips/:id/claim", verifyAmbulanceDriver, async (req, res) => {
  try {
    const shift = await requireReadyShift(req, res);
    if (!shift) return;
    const ambulance = await Ambulance.findById(shift.ambulance);
    if (!ambulance) {
      return res.status(400).json({ success: false, message: "Checked-in vehicle not found" });
    }
    if (ambulance.status === "maintenance") {
      return res.status(400).json({ success: false, message: "Vehicle is in maintenance" });
    }
    const trip = await AmbulanceTrip.findOneAndUpdate(
      {
        _id: req.params.id,
        tripStatus: "Unassigned",
        ...cityPoolFilter(req.driver),
      },
      {
        $set: {
          tripStatus: "Assigned",
          assignedDriver: req.driver._id,
          assignedDriverName: req.driver.name,
          assignedAmbulance: ambulance._id,
          vehicleNumber: ambulance.vehicleNumber || shift.vehicleNumber,
          assignedAt: new Date(),
          assignedByName: `${req.driver.name} (driver)`,
        },
      },
      { new: true }
    );
    if (!trip) {
      return res.status(404).json({
        success: false,
        message: "Trip not available — already taken or not in your city",
      });
    }
    if (ambulance.status !== "on_trip") {
      ambulance.status = "on_trip";
      await ambulance.save();
    }
    res.json({ success: true, trip: formatTrip(trip) });
  } catch (error) {
    res.status(error.status || 500).json({ success: false, message: error.message });
  }
});

router.get("/ambulance/trips/:id", verifyAmbulanceDriver, async (req, res) => {
  try {
    const trip = await loadOwnTrip(req, res);
    if (!trip) return;
    res.json({ success: true, trip: formatTrip(trip) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/ambulance/trips/:id/accept", verifyAmbulanceDriver, async (req, res) => {
  try {
    const trip = await loadOwnTrip(req, res);
    if (!trip) return;
    if (trip.tripStatus !== "Assigned") {
      return res.status(400).json({ success: false, message: "Trip cannot be accepted in this status" });
    }
    const busy = await AmbulanceTrip.findOne({
      assignedDriver: req.driver._id,
      _id: { $ne: trip._id },
      tripStatus: { $in: OPEN_STATUSES.filter((s) => s !== "Assigned") },
    });
    if (busy) {
      return res.status(400).json({
        success: false,
        message: "Complete your current trip before accepting another",
      });
    }
    trip.tripStatus = "Accepted";
    trip.acceptedAt = new Date();
    await trip.save();
    res.json({ success: true, trip: formatTrip(trip) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/ambulance/trips/:id/start-proof", verifyAmbulanceDriver, async (req, res) => {
  try {
    const trip = await loadOwnTrip(req, res);
    if (!trip) return;
    if (!["Assigned", "Accepted"].includes(trip.tripStatus)) {
      return res.status(400).json({ success: false, message: "Start photos only before leaving for pickup" });
    }
    const { odometerKm, odometerPhoto, vehiclePhoto, vehicleNumber, lat, lng } = req.body || {};
    const odoPath = saveDataUrlImage(odometerPhoto, "trips");
    const vehPath = saveDataUrlImage(vehiclePhoto, "trips");
    if (!odoPath || !vehPath) {
      return res.status(400).json({
        success: false,
        message: "Odometer photo and vehicle photo both required",
      });
    }
    const startKm = odometerKm != null && odometerKm !== "" ? Number(odometerKm) : NaN;
    if (!Number.isFinite(startKm) || startKm < 0) {
      return res.status(400).json({ success: false, message: "Start odometer km required" });
    }
    trip.startOdometerKm = startKm;
    trip.startOdometerPhotoUrl = odoPath;
    trip.startVehiclePhotoUrl = vehPath;
    if (vehicleNumber) trip.vehicleNumber = String(vehicleNumber).trim().toUpperCase();
    trip.startProofAt = new Date();
    trip.startProofLat = typeof lat === "number" ? lat : null;
    trip.startProofLng = typeof lng === "number" ? lng : null;
    if (typeof lat === "number" && typeof lng === "number") {
      appendTripPath(trip, lat, lng, trip.startProofAt);
    }
    if (trip.tripStatus === "Assigned") {
      trip.tripStatus = "Accepted";
      trip.acceptedAt = trip.acceptedAt || new Date();
    }
    await trip.save();
    res.json({ success: true, trip: formatTrip(trip) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/ambulance/trips/:id/end-proof", verifyAmbulanceDriver, async (req, res) => {
  try {
    const trip = await loadOwnTrip(req, res);
    if (!trip) return;
    if (trip.tripStatus !== "ArrivedDrop") {
      return res.status(400).json({
        success: false,
        message: "End photos after reaching hospital, before complete",
      });
    }
    const { odometerKm, odometerPhoto, vehiclePhoto } = req.body || {};
    const odoPath = saveDataUrlImage(odometerPhoto, "trips");
    if (!odoPath) {
      return res.status(400).json({ success: false, message: "End odometer photo required" });
    }
    const endKm = odometerKm != null && odometerKm !== "" ? Number(odometerKm) : NaN;
    if (!Number.isFinite(endKm) || endKm < 0) {
      return res.status(400).json({ success: false, message: "End odometer km required" });
    }
    if (trip.startOdometerKm != null && endKm < Number(trip.startOdometerKm)) {
      return res.status(400).json({ success: false, message: "End odometer cannot be less than start" });
    }
    trip.endOdometerKm = endKm;
    trip.endOdometerPhotoUrl = odoPath;
    if (vehiclePhoto) trip.endVehiclePhotoUrl = saveDataUrlImage(vehiclePhoto, "trips") || "";
    trip.endProofAt = new Date();
    await trip.save();
    res.json({ success: true, trip: formatTrip(trip) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/ambulance/trips/:id/reschedule", verifyAmbulanceDriver, async (req, res) => {
  try {
    const trip = await loadOwnTrip(req, res);
    if (!trip) return;
    const allowed = ["Assigned", "Accepted", "EnRoutePickup", "ArrivedPickup"];
    if (!allowed.includes(trip.tripStatus)) {
      return res.status(400).json({
        success: false,
        message: "This trip cannot be rescheduled now",
      });
    }
    trip.rescheduleRequested = true;
    trip.rescheduleRequestedAt = new Date();
    trip.rescheduleRequestNote = String(req.body.reason || "Patient requested later").trim();
    trip.tripStatus = "Unassigned";
    trip.assignedDriver = null;
    trip.assignedDriverName = "";
    trip.assignedAt = null;
    await trip.save();
    await releaseVehicle(trip);
    trip.assignedAmbulance = null;
    trip.vehicleNumber = "";
    await trip.save();
    res.json({ success: true, trip: formatTrip(trip) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/ambulance/trips/:id/reject", verifyAmbulanceDriver, async (req, res) => {
  try {
    const trip = await loadOwnTrip(req, res);
    if (!trip) return;
    if (!["Assigned", "Accepted"].includes(trip.tripStatus)) {
      return res.status(400).json({ success: false, message: "Trip cannot be rejected now" });
    }
    trip.tripStatus = "Rejected";
    trip.rejectedReason = String(req.body.reason || "").trim();
    trip.cancelledAt = new Date();
    await trip.save();
    await releaseVehicle(trip);
    trip.assignedAmbulance = null;
    await trip.save();
    res.json({ success: true, trip: formatTrip(trip) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

async function advance(req, res, expectedFrom, nextStatus, timeField) {
  try {
    const trip = await loadOwnTrip(req, res);
    if (!trip) return;
    const allowed = NEXT_STATUS[trip.tripStatus] || [];
    if (trip.tripStatus !== expectedFrom || !allowed.includes(nextStatus)) {
      return res.status(400).json({
        success: false,
        message: `Cannot move from ${trip.tripStatus} to ${nextStatus}`,
      });
    }
    const { lat, lng } = req.body || {};
    trip.tripStatus = nextStatus;
    if (timeField) trip[timeField] = new Date();
    if (typeof lat === "number" && typeof lng === "number") {
      trip.liveLat = lat;
      trip.liveLng = lng;
      trip.liveAt = new Date();
    }
    const LEG_LABEL = {
      EnRoutePickup: "En route to patient",
      ArrivedPickup: "Arrived at pickup",
      Onboard: "Patient onboard",
      EnRouteDrop: "En route to hospital",
      ArrivedDrop: "Arrived at hospital",
      Completed: "Trip completed",
    };
    if (LEG_LABEL[nextStatus]) {
      const shift = await AmbulanceShift.findOne({
        driver: req.driver._id,
        dateKey: ymd(),
        checkOutAt: null,
      });
      if (shift) {
        shift.legs.push({
          type: nextStatus,
          label: `${trip.tripId || "Trip"} · ${LEG_LABEL[nextStatus]}`,
          at: new Date(),
          lat: typeof lat === "number" ? lat : null,
          lng: typeof lng === "number" ? lng : null,
        });
        await shift.save();
      }
    }
    if (nextStatus === "Completed") {
      trip.completedAt = new Date();
      await releaseVehicle(trip);
    }
    await trip.save();
    res.json({ success: true, trip: formatTrip(trip) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
}

router.post("/ambulance/trips/:id/en-route-pickup", verifyAmbulanceDriver, (req, res) =>
  advance(req, res, "Accepted", "EnRoutePickup", "enRoutePickupAt")
);
router.post("/ambulance/trips/:id/arrived-pickup", verifyAmbulanceDriver, (req, res) =>
  advance(req, res, "EnRoutePickup", "ArrivedPickup", "arrivedPickupAt")
);
router.post("/ambulance/trips/:id/onboard", verifyAmbulanceDriver, (req, res) =>
  advance(req, res, "ArrivedPickup", "Onboard", "onboardAt")
);
router.post("/ambulance/trips/:id/en-route-drop", verifyAmbulanceDriver, (req, res) =>
  advance(req, res, "Onboard", "EnRouteDrop", "enRouteDropAt")
);
router.post("/ambulance/trips/:id/arrived-drop", verifyAmbulanceDriver, (req, res) =>
  advance(req, res, "EnRouteDrop", "ArrivedDrop", "arrivedDropAt")
);
router.post("/ambulance/trips/:id/complete", verifyAmbulanceDriver, async (req, res) => {
  try {
    const trip = await loadOwnTrip(req, res);
    if (!trip) return;
    const fromStarted = [
      "EnRoutePickup",
      "ArrivedPickup",
      "Onboard",
      "EnRouteDrop",
      "ArrivedDrop",
    ];
    if (!fromStarted.includes(trip.tripStatus)) {
      return res.status(400).json({
        success: false,
        message: "Start the trip before completing",
      });
    }
    const { lat, lng } = req.body || {};
    trip.tripStatus = "Completed";
    trip.completedAt = new Date();
    if (typeof lat === "number" && typeof lng === "number") {
      trip.liveLat = lat;
      trip.liveLng = lng;
      trip.liveAt = new Date();
    }
    const shift = await AmbulanceShift.findOne({
      driver: req.driver._id,
      dateKey: ymd(),
      checkOutAt: null,
    });
    if (shift) {
      shift.legs.push({
        type: "Completed",
        label: `${trip.tripId || "Trip"} · Trip completed`,
        at: new Date(),
        lat: typeof lat === "number" ? lat : null,
        lng: typeof lng === "number" ? lng : null,
      });
      await shift.save();
    }
    await releaseVehicle(trip);
    await trip.save();
    res.json({ success: true, trip: formatTrip(trip) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

function formatShift(s) {
  return {
    id: s._id,
    ambulanceId: s.ambulance,
    dateKey: s.dateKey,
    vehicleNumber: s.vehicleNumber,
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

router.get("/ambulance/fleet", verifyAmbulanceDriver, async (req, res) => {
  try {
    const filter = { isActive: { $ne: false } };
    if (req.driver.city) filter.city = req.driver.city;
    const ambulances = await Ambulance.find(filter).sort({ vehicleNumber: 1 });
    const openShifts = await AmbulanceShift.find({ checkOutAt: null }).select("ambulance driver");
    const occupiedBy = new Map(openShifts.map((s) => [String(s.ambulance), String(s.driver)]));
    const mapped = ambulances.map((a) => {
      const holder = occupiedBy.get(String(a._id));
      const mine = holder && holder === String(req.driver._id);
      const others = holder && !mine;
      const free = a.status === "available" && !others;
      return {
        id: a._id,
        vehicleNumber: a.vehicleNumber,
        type: a.type,
        status: a.status,
        free,
      };
    });
    const onlyAvailable = String(req.query.available || "") === "1";
    res.json({
      success: true,
      ambulances: onlyAvailable ? mapped.filter((a) => a.free) : mapped,
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/ambulance/shift/today", verifyAmbulanceDriver, async (req, res) => {
  try {
    const shift = await AmbulanceShift.findOne({
      driver: req.driver._id,
      dateKey: ymd(),
    }).sort({ checkInAt: -1 });
    res.json({ success: true, shift: shift ? formatShift(shift) : null });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/ambulance/shift/check-in", verifyAmbulanceDriver, async (req, res) => {
  try {
    const dateKey = ymd();
    const open = await AmbulanceShift.findOne({
      driver: req.driver._id,
      dateKey,
      checkOutAt: null,
    });
    if (open) {
      return res.status(400).json({ success: false, message: "Already checked in today" });
    }
    const { ambulanceId, odometerStart, odometerPhoto, lat, lng, condition } = req.body || {};
    if (!ambulanceId) {
      return res.status(400).json({ success: false, message: "Select a vehicle" });
    }
    const startKm = odometerStart != null && odometerStart !== "" ? Number(odometerStart) : NaN;
    if (!Number.isFinite(startKm) || startKm <= 0) {
      return res.status(400).json({ success: false, message: "Start odometer km required" });
    }
    const odoPath = saveDataUrlImage(odometerPhoto, "shifts");
    const vehPaths = saveVehiclePhotoList(req.body, "shifts");
    if (!odoPath || !vehPaths.length) {
      return res.status(400).json({
        success: false,
        message: "Odometer photo and vehicle photo required at check-in",
      });
    }
    const ambulance = await Ambulance.findById(ambulanceId);
    if (!ambulance) return res.status(404).json({ success: false, message: "Ambulance not found" });
    if (ambulance.status === "maintenance") {
      return res.status(400).json({ success: false, message: "Vehicle is in maintenance" });
    }
    if (ambulance.status === "on_trip") {
      return res.status(400).json({ success: false, message: "Vehicle is already on a trip" });
    }
    const otherShift = await AmbulanceShift.findOne({
      ambulance: ambulance._id,
      checkOutAt: null,
    });
    if (otherShift) {
      return res.status(400).json({ success: false, message: "This vehicle is already checked in by another driver" });
    }

    const cond = condition || {};
    const shift = await AmbulanceShift.create({
      driver: req.driver._id,
      driverName: req.driver.name,
      ambulance: ambulance._id,
      vehicleNumber: ambulance.vehicleNumber,
      city: req.driver.city || ambulance.city || "",
      dateKey,
      checkInAt: new Date(),
      checkInLat: typeof lat === "number" ? lat : null,
      checkInLng: typeof lng === "number" ? lng : null,
      odometerStart: startKm,
      checkInOdometerPhotoUrl: odoPath,
      checkInVehiclePhotoUrl: vehPaths[0],
      checkInVehiclePhotoUrls: vehPaths,
      condition: {
        fuelLevel: ["full", "half", "low"].includes(cond.fuelLevel) ? cond.fuelLevel : "",
        tiresOk: cond.tiresOk !== false,
        lightsOk: cond.lightsOk !== false,
        sirenOk: cond.sirenOk !== false,
        acOk: cond.acOk !== false,
        stretcherOk: cond.stretcherOk !== false,
        oxygenOk: cond.oxygenOk !== false,
        notes: cond.notes ? String(cond.notes).trim() : "",
      },
      gpsKm: 0,
      legs: [
        {
          type: "check_in",
          label: `Day start · ${ambulance.vehicleNumber}`,
          at: new Date(),
          lat: typeof lat === "number" ? lat : null,
          lng: typeof lng === "number" ? lng : null,
        },
      ],
    });

    req.driver.dutyStatus = "on_duty";
    req.driver.assignedAmbulance = ambulance._id;
    if (req.driver.todayDistanceDateKey !== dateKey) {
      req.driver.todayDistanceKm = 0;
      req.driver.todayDistanceDateKey = dateKey;
    }
    await req.driver.save();

    res.status(201).json({
      success: true,
      shift: formatShift(shift),
      driver: formatDriver(req.driver),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/ambulance/shift/check-out", verifyAmbulanceDriver, async (req, res) => {
  try {
    const shift = await AmbulanceShift.findOne({
      driver: req.driver._id,
      dateKey: ymd(),
      checkOutAt: null,
    });
    if (!shift) {
      return res.status(400).json({ success: false, message: "No open check-in today" });
    }
    const { lat, lng, odometerEnd, odometerPhoto } = req.body || {};
    const endKm = odometerEnd != null && odometerEnd !== "" ? Number(odometerEnd) : NaN;
    if (!Number.isFinite(endKm) || endKm <= 0) {
      return res.status(400).json({ success: false, message: "End odometer km required" });
    }
    if (shift.odometerStart != null && endKm < Number(shift.odometerStart)) {
      return res.status(400).json({ success: false, message: "End odometer cannot be less than start" });
    }
    const odoPath = saveDataUrlImage(odometerPhoto, "shifts");
    const vehPaths = saveVehiclePhotoList(req.body, "shifts");
    if (!odoPath || !vehPaths.length) {
      return res.status(400).json({
        success: false,
        message: "Odometer photo and vehicle photo required at check-out",
      });
    }
    shift.checkOutAt = new Date();
    shift.checkOutLat = typeof lat === "number" ? lat : null;
    shift.checkOutLng = typeof lng === "number" ? lng : null;
    shift.odometerEnd = endKm;
    shift.checkOutOdometerPhotoUrl = odoPath;
    shift.checkOutVehiclePhotoUrl = vehPaths[0];
    shift.checkOutVehiclePhotoUrls = vehPaths;
    shift.legs.push({
      type: "check_out",
      label: "Day end",
      at: new Date(),
      lat: shift.checkOutLat,
      lng: shift.checkOutLng,
    });
    await shift.save();

    req.driver.dutyStatus = "off_duty";
    await req.driver.save();

    res.json({ success: true, shift: formatShift(shift), driver: formatDriver(req.driver) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/ambulance/me/photo", verifyAmbulanceDriver, async (req, res) => {
  try {
    const path = saveDataUrlImage(req.body?.photo, "drivers");
    if (!path) {
      return res.status(400).json({ success: false, message: "Photo required" });
    }
    req.driver.photoUrl = path;
    await req.driver.save();
    res.json({ success: true, driver: formatDriver(req.driver) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/ambulance/logout", verifyAmbulanceDriver, async (req, res) => {
  try {
    const open = await AmbulanceShift.findOne({
      driver: req.driver._id,
      checkOutAt: null,
    }).sort({ checkInAt: -1 });
    if (open) {
      open.checkOutAt = new Date();
      open.legs.push({
        type: "check_out",
        label: "Logged out",
        at: new Date(),
      });
      await open.save();
    }
    req.driver.dutyStatus = "off_duty";
    await req.driver.save();
    res.json({ success: true, driver: formatDriver(req.driver) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get("/ambulance/km-history", verifyAmbulanceDriver, async (req, res) => {
  try {
    const filter = { driver: req.driver._id };
    const days = Number(req.query.days);
    if (Number.isFinite(days) && days > 0) {
      const since = new Date();
      since.setDate(since.getDate() - Math.min(3650, days));
      filter.dateKey = { $gte: ymd(since) };
    }
    const shifts = await AmbulanceShift.find(filter).sort({ dateKey: -1, checkInAt: -1 });
    res.json({
      success: true,
      rows: shifts.map((s) => ({
        dateKey: s.dateKey,
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

module.exports = router;
