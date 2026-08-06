"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import {
  listLocalFacts,
  retireLocalFact,
  type PersonFact,
} from "@/lib/peopleGraph";

export default function PeoplePage() {
  const [facts, setFacts] = useState<PersonFact[]>([]);

  useEffect(() => {
    setFacts(listLocalFacts());
  }, []);

  return (
    <div className="shell content-page">
      <header className="content-page-head">
        <p className="browse-eyebrow">People</p>
        <h1 className="content-page-title">What I&apos;ve learned</h1>
        <p className="content-page-lede">
          Inferred from Browse swipes. Confirm what&apos;s right, retire what isn&apos;t.
        </p>
      </header>

      {facts.length === 0 ? (
        <p className="muted">
          No inferred facts yet.{" "}
          <Link href="/browse">Browse a stack</Link> — three matching swipes on the
          same tag create one.
        </p>
      ) : (
        <ul className="people-fact-list">
          {facts.map((f) => (
            <li key={f.id} className="people-fact-row">
              <div>
                <strong>
                  {f.kind === "preference" ? "Likes" : "Dislikes"} {f.value}
                </strong>
                <p className="muted">
                  From “{f.sourceQuote}” · {f.confidence}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  retireLocalFact(f.id);
                  setFacts(listLocalFacts());
                }}
              >
                {f.confidence === "inferred" ? "Right? Retire" : "Retire"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
