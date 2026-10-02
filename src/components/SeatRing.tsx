import { SOURCE_LABEL, type Source } from "../types.ts";

const SEATS: { id: Source; label: string }[] = [
  { id: "claude", label: "Claude" },
  { id: "codex", label: "Codex" },
  { id: "grok", label: "Grok" },
  { id: "workflow", label: "Flows" },
  { id: "memory", label: "Memory" },
];

type SeatRingProps = {
  active: Source[];
};

export function SeatRing({ active }: SeatRingProps) {
  const lit = new Set(active);
  const size = 240;
  const center = size / 2;
  const seatRadius = 72;
  const labelRadius = 104;

  return (
    <figure className="ring-wrap">
      <svg className="ring" viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle className="ring-track" cx={center} cy={center} r={seatRadius} />
        <circle className="ring-core" cx={center} cy={center} r="18" />
        {SEATS.map((seat, index) => {
          const angle = ((-90 + index * (360 / SEATS.length)) * Math.PI) / 180;
          const x = center + seatRadius * Math.cos(angle);
          const y = center + seatRadius * Math.sin(angle);
          const labelX = center + labelRadius * Math.cos(angle);
          const labelY = center + labelRadius * Math.sin(angle);
          const on = lit.has(seat.id);
          return (
            <g key={seat.id}>
              <circle className={on ? "seat on" : "seat"} cx={x} cy={y} r={on ? 7 : 4.5} />
              <text
                className={on ? "seat-label on" : "seat-label"}
                x={labelX}
                y={labelY}
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {seat.label}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="sr-only">
        Sources at the table:{" "}
        {SEATS.map((seat) => `${SOURCE_LABEL[seat.id]} ${lit.has(seat.id) ? "included" : "absent"}`).join(
          ", ",
        )}
        .
      </figcaption>
    </figure>
  );
}
