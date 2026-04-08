/**
 * Dominio calendario attività (parità enum con legacy CRM).
 * `source` (FOLLOWUP_*) resta per canale business/report; `activityType` descrive il tipo operativo (chiamata, sopralluogo, …).
 */
import { z } from "zod";

export const CALENDAR_SOURCES = ["FOLLOWUP_SELL", "FOLLOWUP_RENT", "CUSTOM_SERVICE"] as const;

/** Tipi di attività (legacy: activityType). */
export const CALENDAR_ACTIVITY_TYPES = [
  "call",
  "videoCall",
  "meeting",
  "onsiteInspection",
  "proposal",
  "customActivity",
  "busy",
  "outOfOffice",
] as const;
export type CalendarActivityType = (typeof CALENDAR_ACTIVITY_TYPES)[number];

/** Stati con resa colore in griglia (legacy status). */
export const CALENDAR_ACTIVITY_STATUSES = ["none", "confirmed", "pending", "lowReliability", "canceled"] as const;
export type CalendarActivityStatus = (typeof CALENDAR_ACTIVITY_STATUSES)[number];

/** Esito attività (legacy outcome). */
export const CALENDAR_OUTCOMES = [
  "CONTINUE_WITH_PROPOSAL",
  "CONTINUE_WITH_QUOTE",
  "ADDITIONAL_APPOINTMENT_SET",
  "FOLLOW_UP_SET",
  "AWAITING_CLIENT_FEEDBACK",
  "NOT_INTERESTED_FEATURES",
  "NOT_INTERESTED_PRICE",
  "OTHER",
] as const;
export type CalendarOutcome = (typeof CALENDAR_OUTCOMES)[number];

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, "Colore deve essere esadecimale #RRGGBB")
  .optional();

export const CalendarEventFieldsSchema = z.object({
  activityType: z.enum(CALENDAR_ACTIVITY_TYPES).default("meeting"),
  activityStatus: z.enum(CALENDAR_ACTIVITY_STATUSES).default("none"),
  outcome: z.enum(CALENDAR_OUTCOMES).optional().nullable(),
  /** Email utente workspace (tz_user_workspaces.userId) */
  assignedUserId: z.string().min(1).optional(),
  apartmentIds: z.array(z.string().min(1)).max(50).optional(),
  allDay: z.boolean().optional(),
  notesInternal: z.string().max(2000).optional(),
  notesClientVisible: z.string().max(2000).optional(),
  additionalInfo: z.string().max(4000).optional(),
  notifyClientOnActivityUpdate: z.boolean().optional(),
});

export const CalendarEventCreateExtendedSchema = z
  .object({
    workspaceId: z.string().min(1),
    projectId: z.string().min(1),
    title: z.string().min(1, "Titolo obbligatorio"),
    startsAt: z.string().min(1, "Data inizio obbligatoria"),
    endsAt: z.string().min(1, "Data fine obbligatoria"),
    source: z.enum(CALENDAR_SOURCES).default("CUSTOM_SERVICE"),
    clientId: z.string().optional(),
    /** @deprecated prefer apartmentIds */
    apartmentId: z.string().optional(),
  })
  .merge(CalendarEventFieldsSchema);

export const CalendarEventUpdateExtendedSchema = z
  .object({
    title: z.string().min(1).optional(),
    startsAt: z.string().min(1).optional(),
    endsAt: z.string().min(1).optional(),
    projectId: z.string().min(1).optional(),
    source: z.enum(CALENDAR_SOURCES).optional(),
    clientId: z.string().nullable().optional(),
    apartmentId: z.string().nullable().optional(),
  })
  .merge(
    z.object({
      activityType: z.enum(CALENDAR_ACTIVITY_TYPES).optional(),
      activityStatus: z.enum(CALENDAR_ACTIVITY_STATUSES).optional(),
      outcome: z.enum(CALENDAR_OUTCOMES).nullable().optional(),
      assignedUserId: z.string().nullable().optional(),
      apartmentIds: z.array(z.string().min(1)).max(50).nullable().optional(),
      allDay: z.boolean().optional(),
      notesInternal: z.string().max(2000).nullable().optional(),
      notesClientVisible: z.string().max(2000).nullable().optional(),
      additionalInfo: z.string().max(4000).nullable().optional(),
      notifyClientOnActivityUpdate: z.boolean().optional(),
    })
  );

export type CalendarEventRecord = {
  _id: unknown;
  workspaceId?: unknown;
  projectId?: unknown;
  title?: unknown;
  startsAt?: unknown;
  endsAt?: unknown;
  source?: unknown;
  clientId?: unknown;
  apartmentId?: unknown;
  activityType?: unknown;
  activityStatus?: unknown;
  outcome?: unknown;
  assignedUserId?: unknown;
  apartmentIds?: unknown;
  allDay?: unknown;
  notesInternal?: unknown;
  notesClientVisible?: unknown;
  additionalInfo?: unknown;
  notifyClientOnActivityUpdate?: unknown;
  createdByUserId?: unknown;
  updatedAt?: unknown;
};
