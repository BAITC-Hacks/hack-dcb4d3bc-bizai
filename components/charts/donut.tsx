"use client";

import { useId } from "react";

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export function Donut({
  slices,
  size = 180,
  thickness = 22,
  centerLabel,
  centerValue
}: {
  slices: DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const id = useId();
  const total = slices.reduce((s, c) => s + c.value, 0) || 1;
  const radius = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  let cursor = 0;

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} className="overflow-visible" role="img" aria-label={`${centerLabel}: ${centerValue}. ${slices.map(slice => `${slice.label}: ${slice.value}`).join("; ")}`}>
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          fill="none"
          stroke="#E6ECF4"
          strokeWidth={thickness}
        />
        {slices.map((slice, idx) => {
          const fraction = slice.value / total;
          const length = Math.PI * 2 * radius;
          const dash = fraction * length;
          const offset = -cursor * length;
          cursor += fraction;
          return (
            <circle
              key={`${id}-${idx}`}
              cx={cx}
              cy={cy}
              r={radius}
              fill="none"
              stroke={slice.color}
              strokeWidth={thickness}
              strokeDasharray={`${dash} ${length}`}
              strokeDashoffset={offset}
              transform={`rotate(-90 ${cx} ${cy})`}
              strokeLinecap="butt"
            />
          );
        })}
        <text
          x={cx}
          y={cy - 4}
          textAnchor="middle"
          className="fill-brand-ink text-xl font-semibold"
        >
          {centerValue}
        </text>
        <text
          x={cx}
          y={cy + 16}
          textAnchor="middle"
          className="fill-muted-foreground text-[10px] uppercase tracking-widest"
        >
          {centerLabel}
        </text>
      </svg>
      <div className="grid w-full gap-1 text-xs">
        {slices.map((slice) => (
          <div key={slice.label} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: slice.color }}
              />
              <span className="text-brand-ink">{slice.label}</span>
            </div>
            <span className="font-semibold text-brand-ink">{slice.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
