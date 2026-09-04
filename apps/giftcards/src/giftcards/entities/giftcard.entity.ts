// Re-export types from schema for backward compatibility
export type { Giftcard, InsertGiftcard } from "./giftcard.schema";

export const getIsExpired = (giftcard: { expiresAt: string | null }) => {
  return giftcard.expiresAt ? new Date() > new Date(giftcard.expiresAt) : false;
};
