import {
  cancelTripInviteAction,
  inviteTripCollaboratorAction,
  removeTripMemberAction,
} from "@/app/actions/trips";
import type { TripInviteItem, TripMemberWithUser } from "@/lib/supabase/collaborators";
import type { TripOrganizerRole } from "@/lib/tripAccess";
import { canManageCollaborators, canRemoveMembers } from "@/lib/tripAccess";

export function TripCollaborators({
  slug,
  role,
  ownerLabel,
  members,
  pendingInvites,
}: {
  slug: string;
  role: TripOrganizerRole;
  ownerLabel: string;
  members: TripMemberWithUser[];
  pendingInvites: TripInviteItem[];
}) {
  const canInvite = canManageCollaborators(role);
  const canRemove = canRemoveMembers(role);

  return (
    <div className="card" style={{ marginBottom: "1.25rem" }}>
      <h2 style={{ marginTop: 0, color: "var(--color-fjord)", fontSize: "1.1rem" }}>
        Planning team
      </h2>
      <p className="muted" style={{ margin: "0 0 1rem", fontSize: "0.9rem" }}>
        Invite co-planners who can edit this trip hub. Family RSVPs still use the public
        survey link—no account needed for them.
      </p>

      <ul className="stack" style={{ listStyle: "none", padding: 0, margin: "0 0 1rem" }}>
        <li
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "0.65rem 0.85rem",
            border: "1px solid rgba(28,61,90,0.1)",
            borderRadius: "var(--radius-md)",
          }}
        >
          <span>
            <strong>{ownerLabel}</strong>
            <span className="muted" style={{ display: "block", fontSize: "0.85rem" }}>
              Owner
            </span>
          </span>
        </li>
        {members.map((m) => (
          <li
            key={m.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.65rem 0.85rem",
              border: "1px solid rgba(28,61,90,0.1)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <span>
              <strong>{m.name || m.email || "Collaborator"}</strong>
              {m.name && m.email ? (
                <span className="muted" style={{ display: "block", fontSize: "0.85rem" }}>
                  {m.email}
                </span>
              ) : null}
              <span className="pill" style={{ marginTop: "0.35rem", fontSize: "0.75rem" }}>
                Co-planner
              </span>
            </span>
            {canRemove ? (
              <form action={removeTripMemberAction}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="member_id" value={m.id} />
                <button type="submit" className="btn btn-secondary" style={{ fontSize: "0.8rem" }}>
                  Remove
                </button>
              </form>
            ) : null}
          </li>
        ))}
        {pendingInvites.map((inv) => (
          <li
            key={inv.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "0.75rem",
              padding: "0.65rem 0.85rem",
              border: "1px dashed rgba(28,61,90,0.2)",
              borderRadius: "var(--radius-md)",
            }}
          >
            <span>
              <strong>{inv.email}</strong>
              <span className="muted" style={{ display: "block", fontSize: "0.85rem" }}>
                Invited — waiting for sign-in
              </span>
            </span>
            {canInvite ? (
              <form action={cancelTripInviteAction}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="invite_id" value={inv.id} />
                <button type="submit" className="btn btn-secondary" style={{ fontSize: "0.8rem" }}>
                  Cancel
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>

      {canInvite ? (
        <form action={inviteTripCollaboratorAction} className="stack" style={{ marginTop: "0.5rem" }}>
          <input type="hidden" name="slug" value={slug} />
          <div className="field" style={{ marginBottom: 0 }}>
            <label htmlFor="collaborator_email">Invite by email</label>
            <div className="row" style={{ gap: "0.5rem", flexWrap: "wrap" }}>
              <input
                id="collaborator_email"
                name="email"
                type="email"
                required
                placeholder="cousin@example.com"
                autoComplete="email"
                style={{ flex: "1 1 12rem", minWidth: 0 }}
              />
              <button type="submit" className="btn btn-primary">
                Send invite
              </button>
            </div>
            <small className="muted">
              They sign up with the same email, then this trip appears on their dashboard.
            </small>
          </div>
        </form>
      ) : (
        <p className="muted" style={{ margin: 0, fontSize: "0.88rem" }}>
          You can view this trip as a co-planner. Ask the owner if you need to invite others.
        </p>
      )}
    </div>
  );
}
