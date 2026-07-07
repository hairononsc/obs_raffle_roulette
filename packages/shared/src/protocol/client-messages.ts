import { z } from 'zod';

import { PrizeInputSchema } from '../domain/prize.js';
import { SpinSettingsSchema } from '../domain/settings.js';
import { defineMessage } from './envelope.js';

/** Who is connecting. Determines which message types the server accepts. */
export const ClientRoleSchema = z.enum(['panel', 'widget']);

export type ClientRole = z.infer<typeof ClientRoleSchema>;

/**
 * First message on every connection. The server replies with `state.sync`
 * on success or `error` + close on failure.
 */
export const HelloMessageSchema = defineMessage(
  'hello',
  z.object({
    role: ClientRoleSchema,
    clientInfo: z.string().max(100).optional(),
  }),
);

/** Panel registers a purchase: a buyer and how many spins it grants. */
export const QueueAddMessageSchema = defineMessage(
  'queue.add',
  z.object({
    buyerName: z.string().min(1).max(50),
    spins: z.number().int().min(1).max(50),
    note: z.string().max(200).optional(),
  }),
);

/** Panel removes a queue entry (e.g. a cancelled purchase). */
export const QueueRemoveMessageSchema = defineMessage(
  'queue.remove',
  z.object({ entryId: z.string().min(1) }),
);

/**
 * Panel launches one spin for a queue entry. Rejected with
 * `SPIN_IN_PROGRESS` if another spin is active.
 */
export const SpinLaunchMessageSchema = defineMessage(
  'spin.launch',
  z.object({ entryId: z.string().min(1) }),
);

/** Widget confirms the wheel animation stopped on the target segment. */
export const SpinLandedMessageSchema = defineMessage(
  'wheel.spin.landed',
  z.object({ spinId: z.string().min(1) }),
);

export const PrizeCreateMessageSchema = defineMessage(
  'prize.create',
  z.object({ prize: PrizeInputSchema }),
);

export const PrizeUpdateMessageSchema = defineMessage(
  'prize.update',
  z.object({
    prizeId: z.string().min(1),
    patch: PrizeInputSchema.partial().refine((patch) => Object.keys(patch).length > 0, {
      message: 'patch must contain at least one field',
    }),
  }),
);

export const PrizeDeleteMessageSchema = defineMessage(
  'prize.delete',
  z.object({ prizeId: z.string().min(1) }),
);

/** Full replacement of spin settings; partial patches are not supported. */
export const SettingsUpdateMessageSchema = defineMessage(
  'settings.update',
  z.object({ settings: SpinSettingsSchema }),
);

export const ThemeSetMessageSchema = defineMessage(
  'theme.set',
  z.object({ themeId: z.string().min(1) }),
);

export const ClientMessageSchema = z.discriminatedUnion('type', [
  HelloMessageSchema,
  QueueAddMessageSchema,
  QueueRemoveMessageSchema,
  SpinLaunchMessageSchema,
  SpinLandedMessageSchema,
  PrizeCreateMessageSchema,
  PrizeUpdateMessageSchema,
  PrizeDeleteMessageSchema,
  SettingsUpdateMessageSchema,
  ThemeSetMessageSchema,
]);

export type HelloMessage = z.infer<typeof HelloMessageSchema>;
export type QueueAddMessage = z.infer<typeof QueueAddMessageSchema>;
export type QueueRemoveMessage = z.infer<typeof QueueRemoveMessageSchema>;
export type SpinLaunchMessage = z.infer<typeof SpinLaunchMessageSchema>;
export type SpinLandedMessage = z.infer<typeof SpinLandedMessageSchema>;
export type PrizeCreateMessage = z.infer<typeof PrizeCreateMessageSchema>;
export type PrizeUpdateMessage = z.infer<typeof PrizeUpdateMessageSchema>;
export type PrizeDeleteMessage = z.infer<typeof PrizeDeleteMessageSchema>;
export type SettingsUpdateMessage = z.infer<typeof SettingsUpdateMessageSchema>;
export type ThemeSetMessage = z.infer<typeof ThemeSetMessageSchema>;

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export type ClientMessageType = ClientMessage['type'];
