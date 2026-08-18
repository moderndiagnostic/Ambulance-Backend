const Counter = require("../Models/Counter");

function dayKeyOf(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

/** Human trip id — AMB-20260817-0001 */
async function generateAmbulanceTripId(date = new Date()) {
  const dayKey = dayKeyOf(date);
  const counter = await Counter.findOneAndUpdate(
    { _id: `ambulance_trip_${dayKey}` },
    { $inc: { seq: 1 } },
    { upsert: true, new: true }
  );
  const seq = String(counter.seq).padStart(4, "0");
  return `AMB-${dayKey}-${seq}`;
}

module.exports = { generateAmbulanceTripId };
