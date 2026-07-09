import { z } from 'zod';

import { OfferTemplateInputSchema } from '../domain/offer-program.js';
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

/** Panel grants one key toward unlocking the chest. */
export const ChestKeyAddMessageSchema = defineMessage('chest.key.add', z.object({}));

/** Panel removes one key (e.g. a mistaken grant). */
export const ChestKeyRemoveMessageSchema = defineMessage('chest.key.remove', z.object({}));

/** Panel opens the chest manually, regardless of key count. */
export const ChestOpenMessageSchema = defineMessage('chest.open', z.object({}));

/** Panel closes an unlocked chest; keys are preserved. */
export const ChestCloseMessageSchema = defineMessage('chest.close', z.object({}));

/** Panel resets the chest: zero keys, locked. */
export const ChestResetMessageSchema = defineMessage('chest.reset', z.object({}));

/** Panel configures the chest prize and how many keys unlock it. */
export const ChestConfigureMessageSchema = defineMessage(
  'chest.configure',
  z.object({
    prize: z.string().min(1).max(100),
    keysTarget: z.number().int().min(1).max(50),
  }),
);

/** Panel starts a flash offer; rejected while another offer is active. */
export const OfferStartMessageSchema = defineMessage(
  'offer.start',
  z.object({
    title: z.string().min(1).max(60),
    description: z.string().max(160),
    durationMs: z.number().int().min(60_000).max(3_600_000),
  }),
);

/** Panel cancels the active flash offer before it expires. */
export const OfferCancelMessageSchema = defineMessage('offer.cancel', z.object({}));

/** Panel saves an offer template to the program pool. */
export const OfferPoolAddMessageSchema = defineMessage(
  'offer.pool.add',
  z.object({ template: OfferTemplateInputSchema }),
);

/** Panel removes a template from the pool (no-op if it does not exist). */
export const OfferPoolRemoveMessageSchema = defineMessage(
  'offer.pool.remove',
  z.object({ templateId: z.string().min(1) }),
);

/**
 * Panel starts an offer program: random pool offers fired at random times
 * within the live window. Rejected while a program is active or the pool
 * is empty.
 */
export const OfferProgramStartMessageSchema = defineMessage(
  'offer.program.start',
  z.object({
    liveDurationMs: z.number().int().min(1_800_000).max(21_600_000),
    offerCount: z.number().int().min(1).max(10),
  }),
);

/** Panel stops the active program (no-op if none). */
export const OfferProgramStopMessageSchema = defineMessage('offer.program.stop', z.object({}));

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
  ChestKeyAddMessageSchema,
  ChestKeyRemoveMessageSchema,
  ChestOpenMessageSchema,
  ChestCloseMessageSchema,
  ChestResetMessageSchema,
  ChestConfigureMessageSchema,
  OfferStartMessageSchema,
  OfferCancelMessageSchema,
  OfferPoolAddMessageSchema,
  OfferPoolRemoveMessageSchema,
  OfferProgramStartMessageSchema,
  OfferProgramStopMessageSchema,
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
export type ChestKeyAddMessage = z.infer<typeof ChestKeyAddMessageSchema>;
export type ChestKeyRemoveMessage = z.infer<typeof ChestKeyRemoveMessageSchema>;
export type ChestOpenMessage = z.infer<typeof ChestOpenMessageSchema>;
export type ChestCloseMessage = z.infer<typeof ChestCloseMessageSchema>;
export type ChestResetMessage = z.infer<typeof ChestResetMessageSchema>;
export type ChestConfigureMessage = z.infer<typeof ChestConfigureMessageSchema>;
export type OfferStartMessage = z.infer<typeof OfferStartMessageSchema>;
export type OfferCancelMessage = z.infer<typeof OfferCancelMessageSchema>;
export type OfferPoolAddMessage = z.infer<typeof OfferPoolAddMessageSchema>;
export type OfferPoolRemoveMessage = z.infer<typeof OfferPoolRemoveMessageSchema>;
export type OfferProgramStartMessage = z.infer<typeof OfferProgramStartMessageSchema>;
export type OfferProgramStopMessage = z.infer<typeof OfferProgramStopMessageSchema>;

export type ClientMessage = z.infer<typeof ClientMessageSchema>;

export type ClientMessageType = ClientMessage['type'];
