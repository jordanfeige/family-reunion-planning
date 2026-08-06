"use client";

import Link from "next/link";

import { SoftImage } from "@/components/SoftImage";
import { placeStillUrl } from "@/lib/placeImages";
import type { LodgingBundle, LodgingProperty } from "@/lib/lodging";
import type { LocationOption } from "@/lib/locations";
import { formatDriveTime, formatFahrenheit, formatUsd } from "@/lib/units";
import { cityOnly } from "@/lib/driveTimes";

function placeName(title: string): string {
  const idx = title.indexOf(",");
  return (idx === -1 ? title : title.slice(0, idx)).trim();
}

function StatCell({
  label,
  value,
  qualifier,
  qualifierTone,
}: {
  label: string;
  value: string;
  qualifier?: string;
  qualifierTone?: "ok" | "warn" | "faint";
}) {
  return (
    <div className="place-detail-stat">
      <span className="place-detail-stat-label">{label}</span>
      <span className="place-detail-stat-value">{value}</span>
      {qualifier ? (
        <span
          className={`place-detail-stat-qual${
            qualifierTone === "ok"
              ? " is-ok"
              : qualifierTone === "warn"
                ? " is-warn"
                : ""
          }`}
        >
          {qualifier}
        </span>
      ) : (
        <span className="place-detail-stat-qual" aria-hidden>
          &nbsp;
        </span>
      )}
    </div>
  );
}

function LodgingCard({
  property,
  householdCount,
  recommended,
  onPick,
}: {
  property: LodgingProperty;
  householdCount: number;
  recommended: boolean;
  onPick?: () => void;
}) {
  const nights = property.nights ?? 3;
  const perHh =
    property.totalUsd != null && householdCount > 0
      ? Math.round(property.totalUsd / householdCount)
      : undefined;
  const atCeiling = (property.householdsAtCeiling ?? 0) > 0;

  return (
    <article className={`place-lodging-card${recommended ? " is-recommended" : ""}`}>
      <div className="place-lodging-media">
        <SoftImage
          src={property.imageUrl ?? placeStillUrl(property.name, property.area)}
          letter={property.name}
          width={220}
          height={180}
          className="place-lodging-img"
        />
      </div>
      <div className="place-lodging-body">
        <div className="place-lodging-top">
          <div>
            <h3 className="place-lodging-title">{property.name}</h3>
            <p className="place-lodging-meta">
              {[property.area, property.address, property.structuralFact]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          {property.badge || recommended ? (
            <span
              className={`place-lodging-badge${
                recommended || property.badge === "recommended" ? " is-accent" : ""
              }`}
            >
              {recommended || property.badge === "recommended"
                ? "Recommended"
                : property.badge === "logistics"
                  ? "Easiest logistics"
                  : property.badge}
            </span>
          ) : null}
        </div>

        <ul className="place-lodging-amenities">
          {property.amenities.map((a) => (
            <li
              key={`${a.kind}-${a.label}`}
              className={`place-lodging-amenity is-${a.kind}`}
            >
              <span aria-hidden>{a.kind === "pro" ? "✓" : "!"}</span>
              {a.label}
            </li>
          ))}
        </ul>

        <div className="place-lodging-foot">
          <div className="place-lodging-prices">
            <div>
              <strong className="place-lodging-price">
                {property.totalUsd != null
                  ? formatUsd(property.totalUsd)
                  : "checking…"}
              </strong>
              <span className="place-lodging-price-note">
                total, {nights} night{nights === 1 ? "" : "s"}
              </span>
            </div>
            <div>
              <strong className="place-lodging-price">
                {perHh != null ? formatUsd(perHh) : "checking…"}
              </strong>
              <span
                className={`place-lodging-price-note${atCeiling ? " is-warn" : ""}`}
              >
                {atCeiling
                  ? `at ${property.householdsAtCeiling} household${
                      property.householdsAtCeiling === 1 ? "" : "s"
                    }' ceiling`
                  : `per household, split ${householdCount || "…"} ways`}
              </span>
            </div>
          </div>
          <div className="place-lodging-actions">
            <span className="place-lodging-split-link">See the split</span>
            <button
              type="button"
              className={`btn ${recommended ? "btn-berry" : "btn-secondary"} btn-sm`}
              onClick={onPick}
            >
              Pick this
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

import { assertNoHouseholdCeilings } from "@/lib/privacyAssert";

export function DestinationDetailView({
  slug,
  option,
  optionIndex,
  optionCount,
  isLeading,
  headcount,
  householdCount,
  responsesReceived,
  responsesTotal,
  weekendLabel,
  nightCount,
  viewerDriveMinutes,
  farthestDriveLabel,
  nearby,
  fitLines,
  costLines,
  viewerHouseholdTotal,
  lodging,
}: {
  slug: string;
  option: LocationOption;
  optionIndex: number;
  optionCount: number;
  isLeading: boolean;
  headcount: number;
  householdCount: number;
  responsesReceived: number;
  responsesTotal: number;
  weekendLabel?: string | null;
  nightCount: number;
  viewerDriveMinutes?: number | null;
  farthestDriveLabel?: string | null;
  nearby: { name: string; driveMin?: number; why: string }[];
  fitLines: string[];
  costLines: { label: string; amount?: number }[];
  viewerHouseholdTotal?: number | null;
  lodging: LodgingBundle;
}) {
  assertNoHouseholdCeilings({ lodging, costLines, viewerHouseholdTotal });
  const name = placeName(option.title);
  const from = option.originMetro ? cityOnly(option.originMetro) : undefined;
  const driveValue =
    viewerDriveMinutes != null
      ? formatDriveTime(viewerDriveMinutes, from) || "checking…"
      : option.driveMinutesFromOrigin != null
        ? formatDriveTime(option.driveMinutesFromOrigin, from) || "checking…"
        : "checking…";
  const lodgingBand =
    option.typicalLodgingUsd != null
      ? formatUsd(option.typicalLodgingUsd)
      : "checking…";
  const weather =
    option.avgHighF != null ? formatFahrenheit(option.avgHighF) : "checking…";
  const crowd =
    option.crowdLevel === "busy"
      ? "busy season"
      : option.crowdLevel === "quiet"
        ? "quieter stretch"
        : option.crowdLevel === "moderate"
          ? "moderate crowds"
          : "checking…";
  const sleepsValue = lodging.properties[0]?.sleeps;
  const outstanding = Math.max(0, responsesTotal - responsesReceived);
  const votePct =
    responsesTotal > 0
      ? Math.round((responsesReceived / responsesTotal) * 100)
      : 0;

  return (
    <div className="place-detail">
      <div className="place-detail-strip">
        <Link href={`/t/${slug}?stop=decision`} className="place-detail-back">
          ← Back to the three options
        </Link>
        <span className="place-detail-step">Step 3 · Decision</span>
      </div>

      <section className="place-detail-hero">
        <SoftImage
          src={placeStillUrl(option.title, option.summary)}
          letter={name}
          width={400}
          height={224}
          className="place-detail-hero-img"
        />
        <div className="place-detail-hero-copy">
          <p className="place-detail-eyebrow">
            Option {optionIndex} of {optionCount}
            {isLeading ? " · leading" : ""}
          </p>
          <h1 className="place-detail-title">{name}</h1>
          <p className="place-detail-lead">
            {option.summary?.trim() ||
              "Shortlisted from your family’s drives, budget band, and survey votes."}
          </p>
          <div className="place-detail-stats" role="list">
            <StatCell
              label="Your drive"
              value={driveValue}
              qualifier={
                farthestDriveLabel
                  ? `farthest: ${farthestDriveLabel}`
                  : undefined
              }
            />
            <StatCell
              label="Per household"
              value={lodgingBand}
              qualifier={
                option.typicalLodgingUsd != null
                  ? `clears all ${householdCount || "…"}`
                  : undefined
              }
              qualifierTone={
                option.typicalLodgingUsd != null ? "ok" : "faint"
              }
            />
            <StatCell label="Season" value={weather} qualifier={crowd} />
            <StatCell
              label="Sleeps"
              value={
                sleepsValue != null
                  ? String(sleepsValue)
                  : headcount > 0
                    ? "checking…"
                    : "checking…"
              }
              qualifier={headcount > 0 ? `you need ${headcount}` : undefined}
            />
          </div>
        </div>
      </section>

      <div className="place-detail-body">
        <div className="place-detail-main">
          <header className="place-detail-section-head">
            <h2 className="place-detail-section-title">Where everyone sleeps</h2>
            {weekendLabel ? (
              <span className="place-detail-section-meta">
                {weekendLabel}
                {nightCount > 0 ? ` · ${nightCount} nights` : ""}
              </span>
            ) : null}
          </header>
          <p className="place-detail-section-lede">
            {lodging.status === "ready" && lodging.properties.length > 0
              ? `${lodging.properties.length} real way${
                  lodging.properties.length === 1 ? "" : "s"
                } to house this crew for the weekend.`
              : lodging.status === "empty"
                ? "Nothing that sleeps this group cleared retrieval for those dates."
                : "Properties are still being priced for this option."}
          </p>

          {lodging.status === "pending" ? (
            <p className="place-detail-lodging-pending">
              Pricing properties
              {weekendLabel ? ` for ${weekendLabel}` : ""}…
            </p>
          ) : null}

          {lodging.status === "empty" ? (
            <p className="place-detail-lodging-empty">
              Nothing sleeps {headcount || "the group"} in {name} that weekend.{" "}
              <Link href={`/t/${slug}?stop=decision`}>Try a different weekend</Link>
              {" · "}
              <span>Split across two properties</span>
            </p>
          ) : null}

          {lodging.status === "ready" && lodging.properties.length > 0 ? (
            <div className="place-lodging-list">
              {lodging.properties.map((p, i) => (
                <LodgingCard
                  key={p.id}
                  property={p}
                  householdCount={householdCount}
                  recommended={i === 0}
                />
              ))}
            </div>
          ) : null}

          {lodging.filteredCount && lodging.filteredCount > 0 ? (
            <p className="place-detail-filtered">
              {lodging.filteredReason ??
                `${lodging.filteredCount} more propert${
                  lodging.filteredCount === 1 ? "y" : "ies"
                } sleep ${headcount}+ but cost more than every household can cover.`}{" "}
              <button type="button" className="place-detail-filtered-show">
                Show them anyway
              </button>
            </p>
          ) : null}
        </div>

        <aside className="place-detail-sidebar">
          <section className="place-side-card place-side-card--fit">
            <p className="place-side-eyebrow">Fits your family</p>
            {fitLines.length > 0 ? (
              <ul className="place-side-fit-list">
                {fitLines.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="place-side-empty">
                Add survey homes and must-haves so this card can name real constraints.
              </p>
            )}
          </section>

          <section className="place-side-card place-side-card--cost">
            <h3 className="place-side-title">Cost, honestly</h3>
            <ul className="place-side-ledger">
              {costLines.map((row) => (
                <li key={row.label}>
                  <span>{row.label}</span>
                  <span>
                    {row.amount != null ? formatUsd(row.amount) : "checking…"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="place-side-total">
              {viewerHouseholdTotal != null
                ? formatUsd(viewerHouseholdTotal)
                : "checking…"}
            </p>
            <p className="place-side-footnote">
              Each household sees its own drive and gas. Nobody sees anyone else&apos;s
              ceiling.
            </p>
          </section>

          <section className="place-side-card">
            <h3 className="place-side-title">Family said</h3>
            {responsesReceived === 0 ? (
              <>
                <p className="place-side-empty">
                  Survey sent · no replies yet
                </p>
                <Link
                  href={`/t/${slug}?stop=survey`}
                  className="place-side-remind"
                >
                  Remind {responsesTotal || "all"} households
                </Link>
              </>
            ) : (
              <>
                <p className="place-side-vote-count">
                  {responsesReceived} of {responsesTotal}
                </p>
                <div className="place-side-progress" aria-hidden>
                  <span style={{ width: `${votePct}%` }} />
                </div>
                {outstanding > 0 ? (
                  <p className="place-side-outstanding">
                    {outstanding} still out ·{" "}
                    <Link href={`/t/${slug}?stop=survey`}>Remind them</Link>
                  </p>
                ) : (
                  <p className="place-side-outstanding">Everyone answered.</p>
                )}
              </>
            )}
          </section>

          <section className="place-side-card place-side-card--nearby">
            <h3 className="place-side-title">What&apos;s nearby</h3>
            {nearby.length === 0 ? (
              <p className="place-side-empty">checking…</p>
            ) : (
              <ul className="place-side-nearby">
                {nearby.map((n) => (
                  <li key={n.name}>
                    <strong>{n.name}</strong>
                    <span>
                      {n.driveMin != null
                        ? `${n.driveMin} min`
                        : "checking…"}{" "}
                      · {n.why}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
