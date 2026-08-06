"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { LodgingRateEditor } from "@/components/LodgingRateEditor";
import { SoftImage } from "@/components/SoftImage";
import type { LodgingProperty } from "@/lib/lodging";
import { enteredNightlyRange } from "@/lib/lodging/pricing";
import { placeStillUrl } from "@/lib/placeImages";
import { formatDateNumericUS, formatUsd } from "@/lib/units";

function provenanceLine(property: LodgingProperty): string | null {
  const pricing = property.pricing;
  if (pricing.kind !== "organizerEntered") return null;
  const d = new Date(pricing.enteredAt);
  const dateLabel = Number.isNaN(d.getTime()) ? "" : formatDateNumericUS(d);
  let line = `Rate entered by ${pricing.enteredByName}`;
  if (dateLabel) line += ` on ${dateLabel}`;
  if (pricing.datesChangedAt) {
    const changed = new Date(pricing.datesChangedAt);
    if (!Number.isNaN(changed.getTime())) {
      line += ` · dates changed ${formatDateNumericUS(changed).slice(0, 5)}`;
    }
  }
  return line;
}

function PublicLodgingCard({
  property,
  shareToken,
  optionId,
  householdCount,
  othersHint,
  anyPriced,
}: {
  property: LodgingProperty;
  shareToken: string;
  optionId: string;
  householdCount: number;
  othersHint: string | null;
  anyPriced: boolean;
}) {
  const router = useRouter();
  const pricing = property.pricing;
  const entered = pricing.kind === "organizerEntered" ? pricing : null;
  const [editing, setEditing] = useState(!entered);
  const nights = property.nights ?? 3;
  const provenance = provenanceLine(property);
  const listingUrl = (entered?.sourceUrl || property.websiteUrl) ?? undefined;

  return (
    <article className="place-lodging-card place-lodging-card--public">
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
            <h2 className="place-lodging-title">{property.name}</h2>
            <p className="place-lodging-meta">
              {[property.area, property.address, property.structuralFact]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
        </div>

        <div className="place-lodging-foot">
          {editing ? (
            <LodgingRateEditor
              shareToken={shareToken}
              optionId={optionId}
              propertyId={property.id}
              householdCount={householdCount}
              requireName
              initialNightly={entered?.nightlyUsd}
              initialFees={entered?.feesUsd}
              initialSourceUrl={entered?.sourceUrl ?? property.websiteUrl}
              onCancel={entered ? () => setEditing(false) : undefined}
              onSaved={() => {
                setEditing(false);
                router.refresh();
              }}
            />
          ) : entered ? (
            <div className="place-lodging-prices">
              <div>
                <strong className="place-lodging-price">
                  {formatUsd(entered.totalUsd)}
                </strong>
                <span className="place-lodging-price-note">
                  total, {nights} night{nights === 1 ? "" : "s"} ·{" "}
                  {formatUsd(entered.perHouseholdUsd)} / household
                </span>
              </div>
              {provenance ? (
                <p className="place-lodging-provenance">
                  {provenance}
                  {listingUrl ? (
                    <>
                      {" · "}
                      <a
                        href={listingUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Listing
                      </a>
                    </>
                  ) : null}
                  {" · "}
                  <button
                    type="button"
                    className="place-lodging-provenance-btn"
                    onClick={() => setEditing(true)}
                  >
                    Update
                  </button>
                </p>
              ) : null}
            </div>
          ) : (
            <div className="place-lodging-prices place-lodging-prices--unknown">
              <p className="place-lodging-unknown-copy">
                No public pricing for this rental.
              </p>
              {anyPriced && othersHint ? (
                <p className="place-lodging-others-hint">{othersHint}</p>
              ) : null}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setEditing(true)}
              >
                Add the nightly rate
              </button>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}

export function PublicLodgingPriceView({
  tripName,
  placeName,
  shareToken,
  optionId,
  householdCount,
  properties,
  weekendLabel,
  nightCount,
}: {
  tripName: string;
  placeName: string;
  shareToken: string;
  optionId: string;
  householdCount: number;
  properties: LodgingProperty[];
  weekendLabel: string | null;
  nightCount: number;
}) {
  const range = enteredNightlyRange(properties);
  const othersHint =
    range != null
      ? range.low === range.high
        ? `Others so far: ${formatUsd(range.low)} a night.`
        : `Others so far: ${formatUsd(range.low)}–${formatUsd(range.high)} a night.`
      : null;
  const pricedCount = properties.filter(
    (p) => p.pricing.kind === "organizerEntered",
  ).length;
  const unpriced = properties.filter((p) => p.pricing.kind === "unknown");

  return (
    <div className="shell page-narrow page-public place-price-help">
      <header className="place-price-help-header">
        <p className="pill">Help price lodging</p>
        <h1>{placeName}</h1>
        <p className="muted">
          For <strong>{tripName}</strong>
          {weekendLabel ? ` · ${weekendLabel}` : ""}
          {nightCount > 0 ? ` · ${nightCount} nights` : ""}. No account needed —
          paste a nightly rate and we&apos;ll split it{" "}
          {householdCount > 1 ? `${householdCount} ways` : "among the households"}
          .
        </p>
        <p className="place-lodging-count">
          {pricedCount} priced, {unpriced.length} rental
          {unpriced.length === 1 ? "" : "s"} waiting on a rate.
        </p>
      </header>

      <div className="place-lodging-list">
        {properties.map((p) => (
          <PublicLodgingCard
            key={p.id}
            property={p}
            shareToken={shareToken}
            optionId={optionId}
            householdCount={householdCount}
            othersHint={othersHint}
            anyPriced={pricedCount > 0}
          />
        ))}
      </div>
    </div>
  );
}
