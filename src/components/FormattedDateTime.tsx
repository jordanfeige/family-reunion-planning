"use client";

import { useEffect, useState } from "react";

import { formatDateLocal, formatDateTimeLocal } from "@/lib/datetime";

export function FormattedDateTime({
  value,
  dateOnly = false,
  className,
  style,
}: {
  value: Date | string | null | undefined;
  dateOnly?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!value) {
      setLabel(null);
      return;
    }
    const d = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(d.getTime())) {
      setLabel(null);
      return;
    }
    setLabel(dateOnly ? formatDateLocal(d) : formatDateTimeLocal(d));
  }, [value, dateOnly]);

  if (!label) return null;

  const iso =
    typeof value === "string"
      ? value
      : value instanceof Date
        ? value.toISOString()
        : undefined;

  return (
    <time dateTime={iso} className={className} style={style} suppressHydrationWarning>
      {label}
    </time>
  );
}
