export type TripOrganizerRole = "owner" | "editor";

export function canManageCollaborators(role: TripOrganizerRole): boolean {
  return role === "owner" || role === "editor";
}

export function canRemoveMembers(role: TripOrganizerRole): boolean {
  return role === "owner";
}
