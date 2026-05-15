"use client";

import { formatTimeOfDay } from "@/lib/datetime";

export function FormattedTimeOfDay({
  value,
  className,
  style,
}: {
  value: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const label = formatTimeOfDay(value);
  if (!label) return null;
  return (
    <span className={className} style={style}>
      {label}
    </span>
  );
}
