export function normalizeVoterEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function voterKeyFromSurveyResponse(responseId: string): string {
  return `response:${responseId}`;
}

export function voterKeyFromEmail(email: string): string {
  return `email:${normalizeVoterEmail(email)}`;
}

export function voterKeyFromGuest(guestId: string): string {
  return `guest:${guestId}`;
}

export function voterKeyFromUserId(userId: string): string {
  return `user:${userId}`;
}

export function resolveVoterKey(input: {
  userId?: string | null;
  surveyResponseId?: string | null;
  email?: string | null;
  guestId?: string | null;
}): { voterKey: string; surveyResponseId: string | null } {
  if (input.userId?.trim()) {
    return {
      voterKey: voterKeyFromUserId(input.userId.trim()),
      surveyResponseId: input.surveyResponseId ?? null,
    };
  }
  if (input.surveyResponseId) {
    return {
      voterKey: voterKeyFromSurveyResponse(input.surveyResponseId),
      surveyResponseId: input.surveyResponseId,
    };
  }
  const email = input.email?.trim();
  if (email) {
    return { voterKey: voterKeyFromEmail(email), surveyResponseId: null };
  }
  const guestId = input.guestId?.trim();
  if (guestId) {
    return { voterKey: voterKeyFromGuest(guestId), surveyResponseId: null };
  }
  throw new Error("Name is required to vote.");
}
