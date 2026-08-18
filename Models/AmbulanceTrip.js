const mongoose = require("mongoose");

/**
 * Ek ambulance ride (logistics trip). Sample Job se alag — yahan tubes/consent nahi.
 */
const TRIP_STATUSES = [
  "Unassigned",
  "Assigned",
  "Accepted",
  "Rejected",
  "EnRoutePickup",
  "ArrivedPickup",
  "Onboard",
  "EnRouteDrop",
  "ArrivedDrop",
  "Completed",
  "Cancelled",
];

const ambulanceTripSchema = new mongoose.Schema(
  {
    tripId: { type: String, unique: true, sparse: true, index: true },
    patientName: { type: String, required: true, trim: true },
    mobileNumber: { type: String, trim: true, default: "" },
    pickupAddress: { type: String, required: true, trim: true },
    pickupLat: { type: Number, default: null },
    pickupLng: { type: Number, default: null },
    dropAddress: { type: String, required: true, trim: true },
    dropLat: { type: Number, default: null },
    dropLng: { type: Number, default: null },
    hospitalName: { type: String, trim: true, default: "" },
    city: { type: String, trim: true, default: "", index: true },
    pincode: { type: String, trim: true, default: "" },
    requestedType: {
      type: String,
      enum: ["BLS", "ALS", "ICU"],
      default: "BLS",
    },
    notes: { type: String, trim: true, default: "" },
    assignedDriver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AmbulanceDriver",
      default: null,
      index: true,
    },
    assignedDriverName: { type: String, default: "", trim: true },
    assignedAmbulance: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Ambulance",
      default: null,
    },
    vehicleNumber: { type: String, default: "", trim: true },
    assignedAt: { type: Date, default: null },
    assignedByName: { type: String, default: "", trim: true },
    tripStatus: {
      type: String,
      enum: TRIP_STATUSES,
      default: "Unassigned",
      index: true,
    },
    rejectedReason: { type: String, default: "", trim: true },
    cancelReason: { type: String, default: "", trim: true },
    cancelledAt: { type: Date, default: null },
    acceptedAt: { type: Date, default: null },
    enRoutePickupAt: { type: Date, default: null },
    arrivedPickupAt: { type: Date, default: null },
    onboardAt: { type: Date, default: null },
    enRouteDropAt: { type: Date, default: null },
    arrivedDropAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
    liveLat: { type: Number, default: null },
    liveLng: { type: Number, default: null },
    liveAt: { type: Date, default: null },
    path: [
      {
        lat: Number,
        lng: Number,
        at: Date,
      },
    ],
    gpsKm: { type: Number, default: 0 },
    startOdometerKm: { type: Number, default: null },
    startOdometerPhotoUrl: { type: String, default: "" },
    startVehiclePhotoUrl: { type: String, default: "" },
    startProofAt: { type: Date, default: null },
    startProofLat: { type: Number, default: null },
    startProofLng: { type: Number, default: null },
    endOdometerKm: { type: Number, default: null },
    endOdometerPhotoUrl: { type: String, default: "" },
    endVehiclePhotoUrl: { type: String, default: "" },
    endProofAt: { type: Date, default: null },
  },
  { timestamps: true }
);

ambulanceTripSchema.statics.TRIP_STATUSES = TRIP_STATUSES;

module.exports = mongoose.model("AmbulanceTrip", ambulanceTripSchema);
