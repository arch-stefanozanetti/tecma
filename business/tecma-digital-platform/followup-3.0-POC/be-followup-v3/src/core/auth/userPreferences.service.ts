import type { Collection } from "mongodb";
import { getDb } from "../../config/db.js";

interface UserPreferencesDoc {
  _id?: string;
  email: string;
  workspaceId: string;
  selectedProjectIds: string[];
  updatedAt: Date;
}

const COLLECTION_NAME = "userPreferences";

const normalizeEmail = (email: string): string => email.trim().toLowerCase();

const getCollection = (): Collection<UserPreferencesDoc> => {
  return getDb().collection<UserPreferencesDoc>(COLLECTION_NAME);
};

export const getUserPreferences = async (email: string): Promise<UserPreferencesDoc | null> => {
  const col = getCollection();
  return col.findOne({ email: normalizeEmail(email) });
};

export const upsertUserPreferences = async (
  email: string,
  workspaceId: string,
  selectedProjectIds: string[]
): Promise<UserPreferencesDoc> => {
  const col = getCollection();
  const normalizedEmail = normalizeEmail(email);
  await col.updateOne(
    { email: normalizedEmail },
    {
      $set: {
        email: normalizedEmail,
        workspaceId,
        selectedProjectIds,
        updatedAt: new Date()
      }
    },
    { upsert: true }
  );
  const updated = await col.findOne({ email: normalizedEmail });
  if (!updated) {
    throw new Error("Unable to load user preferences after upsert");
  }
  return updated;
};

