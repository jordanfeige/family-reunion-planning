"use client";

import { useMemo, useState } from "react";

import { SurveyNextSteps } from "@/components/SurveyNextSteps";
import { SurveyReviewCard } from "@/components/SurveyReviewCard";
import { WizardFooter, WizardFooterSentinel } from "@/components/WizardFooter";
import { WizardStepper } from "@/components/WizardStepper";
import { useWizardFooterReveal } from "@/components/useWizardFooterReveal";
import type { WizardIconName } from "@/components/wizard-icons";
import { formatLocationLabel, type LocationOption } from "@/lib/locations";
import type { GuestSession } from "@/lib/guestSession";
import type { SurveyNextStep } from "@/lib/surveyNextSteps";
import { US_STATE_ABBR } from "@/lib/units";
import { formatWeekendLabel } from "@/lib/weekends";

type SurveyInitial = {
  respondentName: string;
  respondentEmail: string | null;
  adultCount: number;
  kidCount: number;
  notes: string | null;
  selectedLocations: string[];
  selectedSlots: string[];
  homeCity?: string;
  homeState?: string;
};

type SurveyStep = "party" | "locations" | "weekends" | "notes";

export function PublicSurveyForm({
  action,
  token,
  tripName,
  slots,
  locations,
  nextSteps,
  planUrl,
  showPlanLink = false,
  guestSession = null,
  initialResponse = null,
}: {
  action: (formData: FormData) => Promise<void>;
  token: string;
  tripName: string;
  slots: string[];
  locations: LocationOption[];
  nextSteps: SurveyNextStep[];
  planUrl?: string;
  showPlanLink?: boolean;
  guestSession?: GuestSession | null;
  initialResponse?: SurveyInitial | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<SurveyStep>("party");
  const { sentinelRef, revealed } = useWizardFooterReveal(step);
  const emailLocked = Boolean(guestSession);

  const [name, setName] = useState(
    initialResponse?.respondentName ?? guestSession?.name ?? "",
  );
  const [email, setEmail] = useState(
    guestSession?.email ?? initialResponse?.respondentEmail ?? "",
  );
  const [adultCount, setAdultCount] = useState(initialResponse?.adultCount ?? 1);
  const [kidCount, setKidCount] = useState(initialResponse?.kidCount ?? 0);
  const [notes, setNotes] = useState(initialResponse?.notes ?? "");
  const [selectedLocations, setSelectedLocations] = useState<Set<string>>(
    () => new Set(initialResponse?.selectedLocations ?? []),
  );
  const [selectedSlots, setSelectedSlots] = useState<Set<string>>(
    () => new Set(initialResponse?.selectedSlots ?? []),
  );
  const [homeCity, setHomeCity] = useState(initialResponse?.homeCity ?? "");
  const [homeState, setHomeState] = useState(initialResponse?.homeState ?? "");
  const [sendEmailCopy, setSendEmailCopy] = useState(false);

  const steps = useMemo(() => {
    const list: SurveyStep[] = ["party"];
    if (locations.length > 0) list.push("locations");
    if (slots.length > 0) list.push("weekends");
    list.push("notes");
    return list;
  }, [locations.length, slots.length]);

  const stepIndex = steps.indexOf(step);
  const isFirst = stepIndex <= 0;
  const isLast = stepIndex >= steps.length - 1;

  function toggleInSet(
    set: React.Dispatch<React.SetStateAction<Set<string>>>,
    value: string,
    checked: boolean,
  ) {
    set((prev) => {
      const next = new Set(prev);
      if (checked) next.add(value);
      else next.delete(value);
      return next;
    });
    setError(null);
  }

  function validateParty() {
    if (!name.trim()) {
      setError("Please enter your name.");
      return false;
    }
    if (adultCount + kidCount < 1) {
      setError("Please enter at least one adult or kid in your party.");
      return false;
    }
    if (!homeCity.trim()) {
      setError("Enter your home city so we can show drive times.");
      return false;
    }
    if (!homeState.trim()) {
      setError("Enter your home state so we can show drive times.");
      return false;
    }
    return true;
  }

  function validateLocations() {
    if (locations.length > 0 && selectedLocations.size === 0) {
      setError("Please select at least one location you are interested in.");
      return false;
    }
    return true;
  }

  function validateWeekends() {
    if (slots.length > 0 && selectedSlots.size === 0) {
      setError("Please select at least one weekend that works for you.");
      return false;
    }
    return true;
  }

  function goNext() {
    if (step === "party" && !validateParty()) return;
    if (step === "locations" && !validateLocations()) return;
    if (step === "weekends" && !validateWeekends()) return;
    setError(null);
    if (!isLast) setStep(steps[stepIndex + 1]);
  }

  function goBack() {
    setError(null);
    if (!isFirst) setStep(steps[stepIndex - 1]);
  }

  function validateEmailCopy() {
    if (sendEmailCopy && !email.trim()) {
      setError("Enter an email address to receive your copy, or uncheck the box.");
      return false;
    }
    return true;
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    if (!isLast) {
      e.preventDefault();
      goNext();
      return;
    }
    if (
      !validateParty() ||
      !validateLocations() ||
      !validateWeekends() ||
      !validateEmailCopy()
    ) {
      e.preventDefault();
      if (!name.trim() || adultCount + kidCount < 1) setStep("party");
      else if (locations.length > 0 && selectedLocations.size === 0) {
        setStep("locations");
      } else if (slots.length > 0 && selectedSlots.size === 0) {
        setStep("weekends");
      }
    }
  }

  const stepMeta: Record<
    SurveyStep,
    { label: string; shortLabel: string; icon: WizardIconName }
  > = {
    party: { label: "Your party", shortLabel: "Party", icon: "party" },
    locations: { label: "Locations", shortLabel: "Places", icon: "locations" },
    weekends: { label: "Weekends", shortLabel: "Dates", icon: "weekends" },
    notes: { label: "Final details", shortLabel: "Notes", icon: "notes" },
  };

  const stepperSteps = steps.map((id, idx) => ({
    id,
    label: stepMeta[id].label,
    shortLabel: stepMeta[id].shortLabel,
    icon: stepMeta[id].icon,
    complete: idx < stepIndex,
  }));

  return (
    <form
      action={action}
      className="stack survey-wizard"
      style={{ marginTop: "1.25rem" }}
      onSubmit={handleSubmit}
    >
      <input type="hidden" name="token" value={token} />
      <input type="hidden" name="name" value={name} />
      <input type="hidden" name="email" value={email} />
      <input type="hidden" name="adult_count" value={adultCount} />
      <input type="hidden" name="kid_count" value={kidCount} />
      <input type="hidden" name="notes" value={notes} />
      <input type="hidden" name="home_city" value={homeCity} />
      <input type="hidden" name="home_state" value={homeState} />
      {Array.from(selectedLocations).map((id) => (
        <input key={`loc-${id}`} type="hidden" name="location" value={id} />
      ))}
      {Array.from(selectedSlots).map((slot) => (
        <input key={`slot-${slot}`} type="hidden" name="slot" value={slot} />
      ))}

      <div className="wizard-rail wizard-rail--compact survey-wizard-rail">
        <p className="wizard-progress-label survey-wizard-progress">
          {stepIndex > 0
            ? `${stepIndex} of ${steps.length - 1} steps done`
            : "Quick taps — about a minute"}
        </p>
        <WizardStepper
          steps={stepperSteps}
          activeId={step}
          onSelect={(id) => {
            setError(null);
            setStep(id as SurveyStep);
          }}
          canSelect={(_s, idx) => idx <= stepIndex}
        />
      </div>

      <div key={step} className="survey-step-body wizard-panel-enter">
        {step === "party" ? (
          <div className="stack">
            <p className="muted" style={{ margin: 0 }}>
              Who is coming? This helps the organizers count heads.
            </p>
            <div className="field">
              <label htmlFor="name">Your name *</label>
              <input
                id="name"
                required
                placeholder="Your name"
                autoComplete="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
              />
            </div>
            <div className="field">
              <label htmlFor="email">
                Email {emailLocked ? "" : "(optional)"}
              </label>
              <input
                id="email"
                type="email"
                placeholder={emailLocked ? undefined : "for reminders only"}
                autoComplete="email"
                value={email}
                readOnly={emailLocked}
                required={emailLocked}
                onChange={(e) => {
                  if (emailLocked) return;
                  setEmail(e.target.value);
                  setError(null);
                }}
              />
              {emailLocked ? (
                <p className="muted" style={{ margin: "0.35rem 0 0", fontSize: "0.82rem" }}>
                  Locked to your signed-in account.
                </p>
              ) : null}
            </div>
            <div className="grid-2">
              <div className="field">
                <label htmlFor="adult_count">Adults (18+)</label>
                <input
                  id="adult_count"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={adultCount}
                  onChange={(e) => {
                    setAdultCount(Number.parseInt(e.target.value, 10) || 0);
                    setError(null);
                  }}
                />
              </div>
              <div className="field">
                <label htmlFor="kid_count">Kids (under 18)</label>
                <input
                  id="kid_count"
                  type="number"
                  min={0}
                  inputMode="numeric"
                  value={kidCount}
                  onChange={(e) => {
                    setKidCount(Number.parseInt(e.target.value, 10) || 0);
                    setError(null);
                  }}
                />
              </div>
            </div>
            <fieldset className="field" style={{ border: "none", padding: 0, margin: 0 }}>
              <legend className="survey-segment-legend" style={{ marginBottom: "0.35rem" }}>
                Where you&apos;re coming from
              </legend>
              <p className="survey-home-helper">
                So we can show everyone their own drive time.
              </p>
              <div className="grid-2">
                <div className="field">
                  <label htmlFor="home_city">City *</label>
                  <input
                    id="home_city"
                    required
                    placeholder="Portland"
                    autoComplete="address-level2"
                    value={homeCity}
                    onChange={(e) => {
                      setHomeCity(e.target.value);
                      setError(null);
                    }}
                  />
                </div>
                <div className="field">
                  <label htmlFor="home_state">State *</label>
                  <input
                    id="home_state"
                    list="us-states"
                    required
                    placeholder="OR"
                    maxLength={2}
                    autoComplete="address-level1"
                    value={homeState}
                    onChange={(e) => {
                      setHomeState(e.target.value.toUpperCase().slice(0, 2));
                      setError(null);
                    }}
                  />
                  <datalist id="us-states">
                    {Object.values(US_STATE_ABBR).map((abbr) => (
                      <option key={abbr} value={abbr} />
                    ))}
                  </datalist>
                </div>
              </div>
            </fieldset>
          </div>
        ) : null}

        {step === "locations" && locations.length > 0 ? (
          <fieldset className="field" style={{ border: "none", padding: 0, margin: 0 }}>
            <legend className="sr-only">Location preferences</legend>
            <p className="muted" style={{ margin: "0 0 0.5rem" }}>
              Tap every location your crew would consider (select all that apply).
            </p>
            <ul className="choice-list">
              {locations.map((loc) => (
                <li key={loc.id}>
                  <label className="choice-card">
                    <input
                      type="checkbox"
                      checked={selectedLocations.has(loc.id)}
                      onChange={(e) =>
                        toggleInSet(setSelectedLocations, loc.id, e.target.checked)
                      }
                    />
                    <span className="choice-card-body">
                      <span className="choice-check" aria-hidden />
                      <span>{formatLocationLabel(loc)}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        ) : null}

        {step === "weekends" && slots.length > 0 ? (
          <fieldset className="field" style={{ border: "none", padding: 0, margin: 0 }}>
            <legend className="sr-only">Weekend availability</legend>
            <p className="muted" style={{ margin: "0 0 0.5rem" }}>
              Tap every Fri–Sun weekend that works for your family.
            </p>
            <ul className="choice-list">
              {slots.map((slot) => (
                <li key={slot}>
                  <label className="choice-card">
                    <input
                      type="checkbox"
                      checked={selectedSlots.has(slot)}
                      onChange={(e) =>
                        toggleInSet(setSelectedSlots, slot, e.target.checked)
                      }
                    />
                    <span className="choice-card-body">
                      <span className="choice-check" aria-hidden />
                      <span>{formatWeekendLabel(slot)}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
        ) : null}

        {step === "notes" ? (
          <div className="stack">
            <SurveyReviewCard
              tripName={tripName}
              name={name}
              adultCount={adultCount}
              kidCount={kidCount}
              selectedSlots={selectedSlots}
              selectedLocations={selectedLocations}
              locations={locations}
              notes={notes}
              email={email}
              onEmailChange={(v) => {
                setEmail(v);
                setError(null);
              }}
              sendEmailCopy={sendEmailCopy}
              onSendEmailCopyChange={setSendEmailCopy}
            />
            <div className="field">
              <label htmlFor="notes">Anything else? (optional)</label>
              <textarea
                id="notes"
                placeholder="We can only join Saturday daytime, but flexible on lodging."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>
            <SurveyNextSteps
              steps={nextSteps}
              planUrl={planUrl}
              showPlanLink={showPlanLink}
            />
          </div>
        ) : null}

        <WizardFooterSentinel sentinelRef={sentinelRef} />
      </div>

      {error ? <p className="error-banner" style={{ margin: 0 }}>{error}</p> : null}

      <WizardFooter
        revealed={revealed}
        isFirst={isFirst}
        isLast={isLast}
        onBack={goBack}
        onContinue={goNext}
        lastStepLabel="Send RSVP"
        lastStepType="submit"
        lastStepClassName="btn btn-berry"
        phaseLabel={`Step ${stepIndex + 1} of ${steps.length}`}
      />
    </form>
  );
}
