function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function donutRing(cx, cy, rOuter, rInner) {
  return [
    `M ${cx} ${cy - rOuter}`,
    `A ${rOuter} ${rOuter} 0 1 1 ${cx} ${cy + rOuter}`,
    `A ${rOuter} ${rOuter} 0 1 1 ${cx} ${cy - rOuter}`,
    `M ${cx} ${cy - rInner}`,
    `A ${rInner} ${rInner} 0 1 0 ${cx} ${cy + rInner}`,
    `A ${rInner} ${rInner} 0 1 0 ${cx} ${cy - rInner}`,
    "Z",
  ].join(" ");
}
function donutSlice(cx, cy, rOuter, rInner, startAngle, endAngle) {
  const large = endAngle - startAngle > 180 ? 1 : 0;
  const p1 = polarToCartesian(cx, cy, rOuter, startAngle);
  const p2 = polarToCartesian(cx, cy, rOuter, endAngle);
  const p3 = polarToCartesian(cx, cy, rInner, endAngle);
  const p4 = polarToCartesian(cx, cy, rInner, startAngle);
  return [
    `M ${p1.x} ${p1.y}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${p4.x} ${p4.y}`,
    "Z",
  ].join(" ");
}

export default function DonutChart({
  title,
  subtitle,
  segments,
  centerValue,
  centerLabel,
  onSegmentClick,
  emptyText = "No data",
}) {
  const items = (segments || []).filter((s) => Number(s.value) > 0);
  const total = items.reduce((s, i) => s + Number(i.value || 0), 0);
  const size = 220;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 92;
  const rInner = 58;
  const gap = total > 0 && items.length > 1 ? 2.2 : 0;

  let angle = 0;
  const slices = items.map((item) => {
    const sweep = (Number(item.value) / total) * 360;
    const start = angle + gap / 2;
    const end = angle + sweep - gap / 2;
    angle += sweep;
    return { ...item, start, end: Math.max(end, start + 0.4), pct: Math.round((item.value / total) * 1000) / 10 };
  });

  return (
    <div className="card p-5 h-full">
      <div className="mb-1">
        <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
        {subtitle ? <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p> : null}
      </div>
      {total === 0 ? (
        <p className="text-sm text-slate-400 py-16 text-center">{emptyText}</p>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-6 mt-3">
          <div className="relative shrink-0">
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-sm">
              <circle cx={cx} cy={cy} r={rOuter} fill="#f8fafc" />
              <circle cx={cx} cy={cy} r={rInner - 6} fill="#ffffff" />
              {slices.map((s) => (
                <path
                  key={s.label}
                  d={
                    s.end - s.start >= 359
                      ? donutRing(cx, cy, rOuter, rInner)
                      : donutSlice(cx, cy, rOuter, rInner, s.start, s.end)
                  }
                  fill={s.color}
                  fillRule="evenodd"
                  className={onSegmentClick ? "cursor-pointer hover:opacity-90 transition-opacity" : ""}
                  onClick={() => onSegmentClick?.(s)}
                >
                  <title>{`${s.label}: ${s.value} (${s.pct}%)`}</title>
                </path>
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div className="text-2xl font-semibold tracking-tight text-slate-900">
                {centerValue != null ? centerValue : total}
              </div>
              <div className="text-[11px] uppercase tracking-wider text-slate-400 font-medium">
                {centerLabel || "Total"}
              </div>
            </div>
          </div>
          <div className="flex-1 w-full space-y-2.5 min-w-0">
            {slices.map((s) => (
              <button
                key={s.label}
                type="button"
                disabled={!onSegmentClick}
                onClick={() => onSegmentClick?.(s)}
                className={`w-full flex items-center gap-3 text-left ${
                  onSegmentClick ? "hover:bg-slate-50 rounded-lg px-1 py-0.5 -mx-1" : ""
                }`}
              >
                <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: s.color }} />
                <span className="flex-1 text-sm text-slate-600 truncate">{s.label}</span>
                <span className="text-sm font-semibold text-slate-800 tabular-nums">{s.value}</span>
                <span className="text-xs text-slate-400 w-10 text-right tabular-nums">{s.pct}%</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function RadialGauge({ title, subtitle, value, max = 100, color = "#0f766e", caption }) {
  const pct = max ? Math.min(100, Math.max(0, (Number(value) / max) * 100)) : 0;
  const size = 200;
  const cx = 100;
  const cy = 108;
  const r = 72;
  const C = 2 * Math.PI * r * 0.75;
  const offset = C * (1 - pct / 100);

  return (
    <div className="card p-5 h-full">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      {subtitle ? <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p> : null}
      <div className="relative mx-auto w-[200px] h-[150px] mt-2">
        <svg width={size} height={150} viewBox="0 0 200 150">
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy}`}
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="16"
            strokeLinecap="round"
          />
          <path
            d={`M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy}`}
            fill="none"
            stroke={color}
            strokeWidth="16"
            strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={offset}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-end pb-2">
          <div className="text-3xl font-semibold text-slate-900 tabular-nums">{Math.round(pct)}%</div>
          {caption ? <div className="text-[11px] text-slate-400">{caption}</div> : null}
        </div>
      </div>
    </div>
  );
}
