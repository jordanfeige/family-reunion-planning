import { customAlphabet } from "nanoid";

/** Short URL-safe slug for trip dashboard paths */
export const newTripSlug = customAlphabet(
  "abcdefghijklmnopqrstuvwxyz0123456789",
  12,
);

/** Longer unguessable tokens for surveys and share links */
export const newSecretToken = customAlphabet(
  "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789",
  28,
);
