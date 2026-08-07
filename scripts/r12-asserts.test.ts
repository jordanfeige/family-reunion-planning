/**
 * Runnable privacy + sourceId asserts for R12 §11 / §14a.
 * Uses Node's built-in test runner — no new deps.
 *
 *   node --import tsx --test scripts/r12-asserts.test.ts
 *   npx tsx --test scripts/r12-asserts.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { assertNoHouseholdCeilings } from "../src/lib/privacyAssert";
import {
  assertResolvedPlaces,
  formatMetaTriad,
  type ResolvedBrowseCard,
} from "../src/lib/browseResolve";

describe("§11 privacy — no household budget ceilings in client payloads", () => {
  it("passes clean aggregate payloads", () => {
    assert.doesNotThrow(() =>
      assertNoHouseholdCeilings({
        clearsAll: true,
        aboveCount: 2,
        label: "clears all 9 budgets",
      }),
    );
  });

  it("fails when budgetCeiling key is present", () => {
    assert.throws(
      () =>
        assertNoHouseholdCeilings({
          households: [{ name: "A", budgetCeiling: 400 }],
        }),
      /Privacy violation/,
    );
  });

  it("fails when ceilingUsd key is present", () => {
    assert.throws(
      () => assertNoHouseholdCeilings({ ceilingUsd: 250 }),
      /Privacy violation/,
    );
  });

  it("fails when a string embeds a ceiling field name", () => {
    assert.throws(
      () =>
        assertNoHouseholdCeilings(
          JSON.stringify({ note: "see budgetCeiling for household" }),
        ),
      /Privacy violation/,
    );
  });

  it("fails on privateCeiling / householdCeiling", () => {
    assert.throws(
      () => assertNoHouseholdCeilings({ privateCeiling: 100 }),
      /Privacy violation/,
    );
    assert.throws(
      () => assertNoHouseholdCeilings({ householdCeiling: 100 }),
      /Privacy violation/,
    );
  });
});

describe("§14a sourceId assert — every rendered place", () => {
  function card(
    overrides: Partial<ResolvedBrowseCard> &
      Pick<ResolvedBrowseCard, "title" | "category" | "sourceId">,
  ): ResolvedBrowseCard {
    return {
      id: overrides.sourceId ?? "x",
      placeName: null,
      place: null,
      driveMinutes: null,
      scaleFact: null,
      durationHours: 2,
      durationMins: 120,
      estCostUsd: 0,
      costNote: "free",
      description: "x".repeat(80),
      pluses: ["a"],
      cautions: ["b"],
      imageQuery: "park",
      imageUrl: null,
      image: {
        url: null,
        source: "none",
        artist: null,
        license: null,
        attributionUrl: null,
        photographer: null,
        profileUrl: null,
      },
      metaLine: "free",
      ...overrides,
    };
  }

  it("allows stay-home without sourceId", () => {
    assert.doesNotThrow(() =>
      assertResolvedPlaces([
        card({
          title: "Jaipur and Patchwork",
          category: "stay-home",
          sourceId: null,
        }),
      ]),
    );
  });

  it("fails when a named place lacks sourceId", () => {
    assert.throws(
      () =>
        assertResolvedPlaces([
          card({
            title: "Palisades State Park",
            category: "day-trip",
            sourceId: null,
          }),
        ]),
      /missing sourceId/,
    );
  });

  it("passes when sourceId is present from overpass|mapbox", () => {
    assert.doesNotThrow(() =>
      assertResolvedPlaces([
        card({
          title: "Palisades State Park",
          category: "day-trip",
          sourceId: "way/12345",
        }),
      ]),
    );
  });
});

describe("§13b meta triad", () => {
  it("omits unresolved drive and scale", () => {
    assert.equal(
      formatMetaTriad({
        driveMinutes: null,
        scaleFact: null,
        costNote: "free, no permit",
        estCostUsd: 0,
      }),
      "free, no permit",
    );
  });

  it("orders drive · scale · cost", () => {
    assert.equal(
      formatMetaTriad({
        driveMinutes: 28,
        scaleFact: "2.4 mi of trail",
        costNote: "free, no permit",
        estCostUsd: 0,
      }),
      "28 min · 2.4 mi of trail · free, no permit",
    );
  });
});
