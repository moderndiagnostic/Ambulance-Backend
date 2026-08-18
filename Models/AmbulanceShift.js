const mongoose = require("mongoose");

/**
 * Start-of-day check-in: vehicle condition + GPS.
 * Point-to-point legs (base → pickup → hospital → checkout) isi document pe.
 */
const ambulanceShiftSchema = new mongoose.Schema(
  {
    driver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AmbulanceDriver",
      required: true,
      index: true,
    },
    driverName: { type: String, default: "", trim: true },
    ambulance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ambulance",
      default: null,
    },
    vehicleNumber: { type: String, default: "", trim: true },
    city: { type: String, default: "", trim: true, index: true },
    dateKey: { type: String, required: true, index: true },
    checkInAt: { type: Date, default: null },
    checkInLat: { type: Number, default: null },
    checkInLng: { type: Number, default: null },
    odometerStart: { type: Number, default: null },
    condition: {
      fuelLevel: { type: String, enum: ["full", "half", "low", ""], default: "" },
      tiresOk: { type: Boolean, default: true },
      lightsOk: { type: Boolean, default: true },
      sirenOk: { type: Boolean, default: true },
      acOk: { type: Boolean, default: true },
      stretcherOk: { type: Boolean, default: true },
      oxygenOk: { type: Boolean, default: true },
      notes: { type: String, default: "", trim: true },
    },
    checkOutAt: { type: Date, default: null },
    checkOutLat: { type: Number, default: null },
    checkOutLng: { type: Number, default: null },
    odometerEnd: { type: Number, default: null },
    gpsKm: { type: Number, default: 0 },
    legs: [
      {
        type: { type: String, trim: true, default: "" },
        label: { type: String, trim: true, default: "" },
        at: { type: Date, default: Date.now },
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
      },
    ],
  },
  { timestamps: true }
);

ambulanceShiftSchema.index({ driver: 1, dateKey: 1 });

module.exports = mongoose.model("AmbulanceShift", ambulanceShiftSchema);
