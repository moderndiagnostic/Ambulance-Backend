const mongoose = require("mongoose");

/**
 * Ambulance fleet vehicle — alag collection, Job/phlebo se mix nahi.
 * Driver trip isi vehicle ko assign karta hai.
 */
const ambulanceSchema = new mongoose.Schema(
  {
    vehicleNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    type: {
      type: String,
      enum: ["BLS", "ALS", "ICU"],
      default: "BLS",
    },
    city: { type: String, trim: true, default: "", index: true },
    status: {
      type: String,
      enum: ["available", "on_trip", "maintenance"],
      default: "available",
      index: true,
    },
    notes: { type: String, trim: true, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Ambulance", ambulanceSchema);
