"use client";

import Link from "next/link";
import { useEffect, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

import {
  askFamilyToPriceLodgingAction,
  refreshPlaceLodgingAction,
} from "@/app/actions/lodging";
import { LodgingRateEditor } from "@/components/LodgingRateEditor";
import { SoftImage } from "@/components/SoftImage";
import type { DriveLeg } from "@/lib/drive";
import { formatDriveMinutes } from "@/lib/drive";
import type { LodgingBundle, LodgingProperty } from "@/lib/lodging";
import { enteredNightlyRange } from "@/lib/lodging/pricing";
import type { LocationOption } from "@/lib/locations";
import type { NearbyPlace } from "@/lib/nearby";
import { listLocalFacts, type PersonFact } from "@/lib/peopleGraph";
import { placeStillUrl } from "@/lib/placeImages";
import type { PlanCapabilities } from "@/lib/planMode";
import { assertNoHouseholdCeilings } from "@/lib/privacyAssert";
import { formatDateNumericUS, formatUsd } from "@/lib/units";

function placeName(title: string): string {
  const idx = title.indexOf(",");
  return (idx === -1 ? title : title.slice(0, idx)).trim();
}

const TAG_LABEL: Record<string, string> = {
  quiet: "prefers quieter places",
  lively: "likes lively spots",
  outdoors: "wants outdoors time",
  "hands-on": "likes hands-on plans",
  "food-forward": "cares about food",
  alcohol: "ok with alcohol venues",
  spectator: "likes spectator events",
  physical: "wants physical activities",
  "kids-friendly": "needs kids-friendly options",
  "at-home": "leans stay-home",
  "long-drive": "open to longer drives",
  budget: "watching the budget",
  splurge: "open to a splurge",
};

function factLine(fact: PersonFact): string {
  const label = TAG_LABEL[fact.value] ?? fact.value.replace(/-/g, " ");
  if (fact.kind === "dislike") {
    return `Avoid ${fact.value.replace(/-/g, " ")}.`;
  }
  return label.charAt(0).toUpperCase() + label.slice(1) + ".";
}

function StatCell({
  label,
  value,
  valueNode,
  qualifier,
  qualifierTone,
}: {
  label: string;
  value: string | null;
  valueNode?: ReactNode;
  qualifier?: string | null;
  qualifierTone?: "ok" | "warn" | "faint";
}) {
  if (value == null && !valueNode && (qualifier == null || qualifier === "")) {
    return null;
  }
  if (value == null && !valueNode) return null;

  return (
    <div className="place-detail-stat">
      <span className="place-detail-stat-label">{label}</span>
      {valueNode ? (
        <span className="place-detail-stat-value">{valueNode}</span>
      ) : (
        <span className="place-detail-stat-value">{value}</span>
      )}
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

function provenanceLine(property: LodgingProperty): string | null {
  const pricing = property.pricing;
  if (pricing.kind !== "organizerEntered") return null;
  const d = new Date(pricing.enteredAt);
  const dateLabel = Number.isNaN(d.getTime())
    ? ""
    : formatDateNumericUS(d);
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

function LodgingCard({
  property,
  householdCount,
  showSplit,
  recommended,
  slug,
  optionId,
  othersHint,
  anyPriced,
}: {
  property: LodgingProperty;
  householdCount: number;
  showSplit: boolean;
  recommended: boolean;
  slug: string;
  optionId: string;
  othersHint: string | null;
  anyPriced: boolean;
}) {
  const router = useRouter();
  const nights = property.nights ?? 3;
  const pricing = property.pricing;
  const entered = pricing.kind === "organizerEntered" ? pricing : null;
  const [editing, setEditing] = useState(false);
  const perHh = entered?.perHouseholdUsd;
  const atCeiling =
    entered != null && showSplit && (property.householdsAtCeiling ?? 0) > 0;
  const showBadge = entered != null && (property.badge || recommended);
  const provenance = provenanceLine(property);
  const listingUrl = (entered?.sourceUrl || property.websiteUrl) ?? undefined;
  const phone = property.phone;

  return (
    <article
      className={`place-lodging-card${recommended && entered ? " is-recommended" : ""}`}
      id={`lodging-${property.id}`}
    >
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
          {showBadge ? (
            <span
              className={`place-lodging-badge${
                recommended || property.badge === "recommended"
                  ? " is-accent"
                  : ""
              }`}
            >
              {recommended || property.badge === "recommended"
                ? "Recommended"
                : property.badge === "logistics"
                  ? "Easiest logistics"
                  : property.badge}
            </span>
          ) : !entered ? (
            <span className="place-lodging-badge is-unknown">
              Price unknown — can&apos;t check against budgets
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
          {editing ? (
            <LodgingRateEditor
              slug={slug}
              optionId={optionId}
              propertyId={property.id}
              householdCount={householdCount}
              initialNightly={entered?.nightlyUsd}
              initialFees={entered?.feesUsd}
              initialSourceUrl={
                entered?.sourceUrl ?? property.websiteUrl
              }
              onCancel={() => setEditing(false)}
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
                  total, {nights} night{nights === 1 ? "" : "s"}
                </span>
              </div>
              {showSplit && perHh != null ? (
                <div>
                  <strong className="place-lodging-price">
                    {formatUsd(perHh)}
                  </strong>
                  <span
                    className={`place-lodging-price-note${
                      atCeiling ? " is-warn" : ""
                    }`}
                  >
                    {atCeiling
                      ? `at ${property.householdsAtCeiling} household${
                          property.householdsAtCeiling === 1 ? "" : "s"
                        }' ceiling`
                      : `per household, split ${householdCount} ways`}
                  </span>
                </div>
              ) : null}
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
              <div className="place-lodging-unknown-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => setEditing(true)}
                >
                  Add the nightly rate
                </button>
                {listingUrl ? (
                  <a
                    className="place-lodging-website"
                    href={listingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Check their site
                  </a>
                ) : null}
                {phone ? (
                  <a className="place-lodging-website" href={`tel:${phone}`}>
                    {phone}
                  </a>
                ) : null}
              </div>
            </div>
          )}
          {!editing ? (
            <div className="place-lodging-actions">
              {showSplit && entered ? (
                <span className="place-lodging-split-link">See the split</span>
              ) : null}
              <button
                type="button"
                className={`btn ${recommended && entered ? "btn-berry" : "btn-secondary"} btn-sm`}
              >
                Pick this
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function FitsYourFamily() {
  const [lines, setLines] = useState<string[] | null>(null);

  useEffect(() => {
    const facts = listLocalFacts().slice(0, 4);
    setLines(facts.map(factLine));
  }, []);

  if (lines === null) {
    return (
      <section className="place-side-card place-side-card--fit">
        <p className="place-side-eyebrow">Fits your family</p>
        <p className="place-side-empty">&nbsp;</p>
      </section>
    );
  }

  return (
    <section className="place-side-card place-side-card--fit">
      <p className="place-side-eyebrow">Fits your family</p>
      {lines.length > 0 ? (
        <ul className="place-side-fit-list">
          {lines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      ) : (
        <p className="place-side-empty">
          <Link href="/people">Add people</Link> so this card can name real
          constraints.
        </p>
      )}
    </section>
  );
}

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
  driveStat,
  farthestDriveLabel,
  perHouseholdLodgingUsd,
  seasonStat,
  sleepsValue,
  gettingThere,
  nearby,
  costLines,
  costReady,
  viewerHouseholdTotal,
  lodging,
  capabilities,
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
  driveStat: { value: string | null; qualifier: string | null };
  farthestDriveLabel?: string | null;
  perHouseholdLodgingUsd: number | null;
  seasonStat: { value: string; qualifier: string } | null;
  sleepsValue: number | null;
  gettingThere: DriveLeg[];
  nearby: NearbyPlace[];
  costLines: { label: string; amount: number | null }[];
  /** When false, show all cost amounts as pending together — never mix. */
  costReady: boolean;
  viewerHouseholdTotal?: number | null;
  lodging: LodgingBundle;
  capabilities: PlanCapabilities;
}) {
  assertNoHouseholdCeilings({ lodging, costLines, viewerHouseholdTotal });
  const router = useRouter();
  const [refreshing, startRefresh] = useTransition();
  const [asking, startAsk] = useTransition();
  const [askNote, setAskNote] = useState<string | null>(null);
  const name = placeName(option.title);
  const eyebrowCount = Math.min(3, Math.max(optionCount, 1));
  const eyebrowIndex = Math.min(optionIndex, eyebrowCount);
  const outstanding = Math.max(0, responsesTotal - responsesReceived);
  const votePct =
    responsesTotal > 0
      ? Math.round((responsesReceived / responsesTotal) * 100)
      : 0;

  const lodgingPending = lodging.status === "pending";

  const showProperties =
    (lodging.status === "ready" || lodging.status === "partial") &&
    lodging.properties.length > 0;

  const capacityKnown = showProperties
    ? lodging.properties.filter((p) => p.sleeps != null)
    : [];
  const capacityUnknown = showProperties
    ? lodging.properties.filter((p) => p.sleeps == null)
    : [];
  const pricedCount =
    lodging.pricedCount ??
    lodging.properties.filter((p) => p.pricing.kind === "organizerEntered")
      .length;
  const unpricedRentalCount =
    lodging.unpricedRentalCount ??
    lodging.properties.filter((p) => p.pricing.kind === "unknown").length;

  const range = enteredNightlyRange(lodging.properties);
  const othersHint =
    range != null
      ? range.low === range.high
        ? `Others so far: ${formatUsd(range.low)} a night.`
        : `Others so far: ${formatUsd(range.low)}–${formatUsd(range.high)} a night.`
      : null;

  function onRefresh() {
    startRefresh(async () => {
      await refreshPlaceLodgingAction(slug, option.id);
      router.refresh();
    });
  }

  function onAskFamily() {
    startAsk(async () => {
      setAskNote(null);
      const result = await askFamilyToPriceLodgingAction(slug, option.id);
      if (!result.ok) {
        setAskNote(result.error);
        return;
      }
      if (result.sent === 0) {
        setAskNote(
          `No household emails on file yet — share this link: ${result.priceUrl}`,
        );
      } else {
        setAskNote(
          `Emailed ${result.sent} household${result.sent === 1 ? "" : "s"}.`,
        );
      }
      router.refresh();
    });
  }

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
            Option {eyebrowIndex} of {eyebrowCount}
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
              value={driveStat.value}
              qualifier={
                capabilities.farthestHousehold && farthestDriveLabel
                  ? `farthest: ${farthestDriveLabel}`
                  : driveStat.qualifier
              }
            />
            <StatCell
              label={capabilities.splitLabels ? "Per household" : "Stay"}
              value={
                perHouseholdLodgingUsd != null
                  ? formatUsd(perHouseholdLodgingUsd)
                  : null
              }
              valueNode={
                perHouseholdLodgingUsd == null ? (
                  <a className="place-detail-stat-link" href="#where-everyone-sleeps">
                    Add a rate to see this
                  </a>
                ) : undefined
              }
              qualifier={
                perHouseholdLodgingUsd != null &&
                capabilities.budgetFloors &&
                householdCount > 1
                  ? `clears all ${householdCount}`
                  : perHouseholdLodgingUsd != null
                    ? "from entered rates"
                    : null
              }
              qualifierTone={
                perHouseholdLodgingUsd != null ? "ok" : "faint"
              }
            />
            <StatCell
              label="Season"
              value={seasonStat?.value ?? null}
              qualifier={seasonStat?.qualifier ?? null}
            />
            <StatCell
              label="Sleeps"
              value={sleepsValue != null ? String(sleepsValue) : null}
              qualifier={
                sleepsValue != null && headcount > 0
                  ? `you need ${headcount}`
                  : null
              }
            />
          </div>
        </div>
      </section>

      <div className="place-detail-body">
        <div className="place-detail-main">
          <header className="place-detail-section-head" id="where-everyone-sleeps">
            <h2 className="place-detail-section-title">Where everyone sleeps</h2>
            {weekendLabel ? (
              <span className="place-detail-section-meta">
                {weekendLabel}
                {nightCount > 0 ? ` · ${nightCount} nights` : ""}
              </span>
            ) : null}
          </header>
          <p className="place-detail-section-lede">
            {showProperties
              ? pricedCount === 0
                ? `Paste a rate and I'll split it ${householdCount > 1 ? `${householdCount} ways` : "among the households"}.`
                : `${lodging.properties.length} real way${
                    lodging.properties.length === 1 ? "" : "s"
                  } to house this crew for the weekend.`
              : lodging.status === "empty"
                ? "Nothing that sleeps this group cleared retrieval for those dates."
                : lodging.status === "failed"
                  ? lodging.partialNote ??
                    "Could not load rentals for this area."
                  : "Gathering rentals for this option."}
          </p>

          {lodgingPending ? (
            <p className="place-detail-lodging-pending">
              Looking up rentals
              {weekendLabel ? ` for ${weekendLabel}` : ""}…
            </p>
          ) : null}

          {lodging.status === "failed" && !showProperties ? (
            <p className="place-detail-lodging-empty">
              {lodging.partialNote ?? "Could not load lodging."}{" "}
              <button
                type="button"
                className="place-detail-filtered-show"
                disabled={refreshing}
                onClick={onRefresh}
              >
                {refreshing ? "Refreshing…" : "Refresh listings"}
              </button>
            </p>
          ) : null}

          {lodging.status === "empty" ? (
            <p className="place-detail-lodging-empty">
              Nothing sleeps {headcount || "the group"} in {name} that weekend.{" "}
              <Link href={`/t/${slug}?stop=decision`}>Try a different weekend</Link>
            </p>
          ) : null}

          {lodging.status === "partial" && lodging.partialNote ? (
            <p className="place-detail-filtered">{lodging.partialNote}</p>
          ) : null}

          {showProperties ? (
            <>
              {capacityKnown.length > 0 ? (
                <div className="place-lodging-list">
                  {capacityKnown.map((p) => (
                    <LodgingCard
                      key={p.id}
                      property={p}
                      householdCount={householdCount}
                      showSplit={capabilities.splitLabels}
                      recommended={p.badge === "recommended"}
                      slug={slug}
                      optionId={option.id}
                      othersHint={othersHint}
                      anyPriced={pricedCount > 0}
                    />
                  ))}
                </div>
              ) : null}

              {capacityUnknown.length > 0 ? (
                <div className="place-lodging-capacity-group">
                  <h3 className="place-lodging-capacity-heading">
                    Capacity unknown
                  </h3>
                  <div className="place-lodging-list">
                    {capacityUnknown.map((p) => (
                      <LodgingCard
                        key={p.id}
                        property={p}
                        householdCount={householdCount}
                        showSplit={capabilities.splitLabels}
                        recommended={p.badge === "recommended"}
                        slug={slug}
                        optionId={option.id}
                        othersHint={othersHint}
                        anyPriced={pricedCount > 0}
                      />
                    ))}
                  </div>
                </div>
              ) : null}

              {(pricedCount > 0 || unpricedRentalCount > 0) && (
                <p className="place-lodging-count">
                  {pricedCount} priced, {unpricedRentalCount} rental
                  {unpricedRentalCount === 1 ? "" : "s"} waiting on a rate.
                </p>
              )}

              {unpricedRentalCount > 0 ? (
                <p className="place-lodging-ask">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={asking}
                    onClick={onAskFamily}
                  >
                    {asking
                      ? "Sending…"
                      : "Ask the family to help price these"}
                  </button>
                  {askNote ? (
                    <span className="place-lodging-ask-note">{askNote}</span>
                  ) : null}
                </p>
              ) : null}
            </>
          ) : null}

          {showProperties ? (
            <p className="place-detail-filtered">
              <button
                type="button"
                className="place-detail-filtered-show"
                disabled={refreshing}
                onClick={onRefresh}
              >
                {refreshing ? "Refreshing…" : "Refresh listings"}
              </button>
            </p>
          ) : null}

          {lodging.filteredCount && lodging.filteredCount > 0 ? (
            <p className="place-detail-filtered">
              {lodging.filteredReason ??
                `${lodging.filteredCount} more propert${
                  lodging.filteredCount === 1 ? "y" : "ies"
                } filtered for capacity.`}
            </p>
          ) : null}

          <section className="place-getting-there">
            <h2 className="place-detail-section-title">Getting there</h2>
            {gettingThere.length === 0 ? (
              <p className="place-side-empty">
                Add home cities on the survey to see drive times and gas.
              </p>
            ) : gettingThere.every((l) => l.minutes == null) ? (
              <p className="place-side-empty">
                Drive times need Mapbox — add MAPBOX_TOKEN to enable them.
              </p>
            ) : (
              <ul className="place-getting-list">
                {gettingThere.map((leg) => (
                  <li key={leg.fromLabel}>
                    <strong>{leg.fromLabel}</strong>
                    <span>
                      {leg.minutes != null
                        ? formatDriveMinutes(leg.minutes)
                        : "—"}
                      {leg.gasUsd != null
                        ? ` · ~${formatUsd(leg.gasUsd)} gas`
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="place-getting-there place-nearby-inline">
            <h2 className="place-detail-section-title">What&apos;s nearby</h2>
            {nearby.length === 0 ? (
              <p className="place-side-empty">
                Nearby places will show when map search is available for this
                area.
              </p>
            ) : (
              <ul className="place-side-nearby">
                {nearby.map((n) => (
                  <li key={`${n.name}-${n.category}`}>
                    <strong>{n.name}</strong>
                    <span>
                      {n.distanceLabel ? `${n.distanceLabel} · ` : ""}
                      {n.category}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="place-detail-sidebar">
          <FitsYourFamily />

          <section className="place-side-card place-side-card--cost">
            <h3 className="place-side-title">
              {capabilities.splitLabels ? "Cost, honestly" : "Cost"}
            </h3>
            <ul className="place-side-ledger">
              {costLines.map((row) => (
                <li key={row.label}>
                  <span>{row.label}</span>
                  <span>
                    {costReady && row.amount != null
                      ? formatUsd(row.amount)
                      : "—"}
                  </span>
                </li>
              ))}
            </ul>
            <p className="place-side-total">
              {costReady && viewerHouseholdTotal != null
                ? formatUsd(viewerHouseholdTotal)
                : "—"}
            </p>
            <p className="place-side-footnote">
              Groceries estimated at $28 per person for the weekend.
            </p>
            {capabilities.splitLabels && householdCount > 1 ? (
              <p className="place-side-footnote">
                Each household sees its own drive and gas. Nobody sees anyone
                else&apos;s ceiling.
              </p>
            ) : null}
          </section>

          {capabilities.voting ? (
            <section className="place-side-card">
              <h3 className="place-side-title">Family said</h3>
              {responsesReceived === 0 ? (
                <>
                  <p className="place-side-empty">Survey sent · no replies yet</p>
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
          ) : null}
        </aside>
      </div>
    </div>
  );
}
