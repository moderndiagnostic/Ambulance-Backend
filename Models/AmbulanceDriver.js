const mongoose = require("mongoose");

/**
 * Ambulance driver — field login is mobile OTP (same as phlebo app).
 */
const ambulanceDriverSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      validate: {
        validator: (v) => /^\d{10}$/.test(v),
        message: "Phone must be 10 digits",
      },
    },
    employeeId: { type: String, required: true, unique: true, trim: true },
    passwordHash: { type: String, default: "" },
    otp: { type: String, default: null },
    otpExpires: { type: Date, default: null },
    city: { type: String, trim: true, default: "", index: true },
    zone: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: ["active", "inactive", "suspended"],
      default: "active",
    },
    dutyStatus: {
      type: String,
      enum: ["on_duty", "off_duty"],
      default: "off_duty",
    },
    assignedAmbulance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ambulance",
      default: null,
    },
    currentLat: { type: Number, default: null },
    currentLng: { type: Number, default: null },
    lastLocationAt: { type: Date, default: null },
    locationTrail: [
      {
        lat: { type: Number },
        lng: { type: Number },
        at: { type: Date, default: Date.now },
        _id: false,
      },
    ],
    todayDistanceKm: { type: Number, default: 0 },
    todayDistanceDateKey: { type: String, default: "" },
    pushToken: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AmbulanceDriver", ambulanceDriverSchema);
