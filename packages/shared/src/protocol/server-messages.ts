import { z } from 'zod';

import { PrizeSchema } from '../domain/prize.js';
import { QueueEntrySchema } from '../domain/queue.js';
import { SpinSettingsSchema } from '../domain/settings.js';
import { ActiveSpinSchema } from '../domain/spin.js';
import { WheelSegmentSchema } from '../domain/wheel.js';
import { defineMessage } from './envelope.js';
import { ErrorCodeSchema } from './errors.js';

/**
 * Complete snapshot of everything a client needs to render or operate.
 * Sent as the reply to a successful `hello`. Any client must be able to
 * rebuild its entire UI from this single message — that is what makes a
 * mid-spin OBS widget reload recoverable.
 */
export const StateSyncMessageSchema = defineMessage(
  'state.sync',
  z.object({
    settings: SpinSettingsSchema,
    themeId: z.string().min(1),
    prizes: z.array(PrizeSchema),
    segments: z.array(WheelSegmentSchema),
    queue: z.array(QueueEntrySchema),
    activeSpin: ActiveSpinSchema.nullable(),
  }),
);

/** Positive reply to a command; carries the originating `requestId`. */
export const AckMessageSchema = defineMessage('ack', z.object({}));

/**
 * Negative reply to a command (carries its `requestId`) or a connection
 *-level failure such as a malformed frame (no `requestId` available).
 */
export const ErrorMessageSchema = defineMessage(
  'error',
  z.object({
    code: ErrorCodeSchema,
    message: z.string().min(1),
  }),
);

/** Broadcast whenever the queue content changes, with the full new queue. */
export const QueueChangedMessageSchema = defineMessage(
  'queue.changed',
  z.object({ queue: z.array(QueueEntrySchema) }),
);

/**
 * Broadcast when a spin starts. The outcome is already decided and stock
 * already reserved; the widget's only job is to animate the wheel until it
 * stops on `spin.targetSegmentIndex`.
 */
export const SpinStartMessageSchema = defineMessage(
  'wheel.spin.start',
  z.object({ spin: ActiveSpinSchema }),
);

/**
 * Broadcast when a spin reaches its terminal state — either the widget
 * confirmed the landing or the server's safety timeout fired.
 */
export const SpinCompletedMessageSchema = defineMessage(
  'spin.completed',
  z.object({
    spinId: z.string().min(1),
    buyerName: z.string().min(1).max(50),
    prizeId: z.string().min(1),
    prizeName: z.string().min(1).max(60),
    completedAt: z.number().int().nonnegative(),
  }),
);

/**
 * Broadcast whenever the prize list or its derived wheel layout changes
 * (edits from the panel, or stock depletion after a spin).
 */
export const PrizesChangedMessageSchema = defineMessage(
  'prizes.changed',
  z.object({
    prizes: z.array(PrizeSchema),
    segments: z.array(WheelSegmentSchema),
  }),
);

export const SettingsChangedMessageSchema = defineMessage(
  'settings.changed',
  z.object({ settings: SpinSettingsSchema }),
);

export const ThemeChangedMessageSchema = defineMessage(
  'theme.changed',
  z.object({ themeId: z.string().min(1) }),
);

export const ServerMessageSchema = z.discriminatedUnion('type', [
  StateSyncMessageSchema,
  AckMessageSchema,
  ErrorMessageSchema,
  QueueChangedMessageSchema,
  SpinStartMessageSchema,
  SpinCompletedMessageSchema,
  PrizesChangedMessageSchema,
  SettingsChangedMessageSchema,
  ThemeChangedMessageSchema,
]);

export type StateSyncMessage = z.infer<typeof StateSyncMessageSchema>;
export type AckMessage = z.infer<typeof AckMessageSchema>;
export type ErrorMessage = z.infer<typeof ErrorMessageSchema>;
export type QueueChangedMessage = z.infer<typeof QueueChangedMessageSchema>;
export type SpinStartMessage = z.infer<typeof SpinStartMessageSchema>;
export type SpinCompletedMessage = z.infer<typeof SpinCompletedMessageSchema>;
export type PrizesChangedMessage = z.infer<typeof PrizesChangedMessageSchema>;
export type SettingsChangedMessage = z.infer<typeof SettingsChangedMessageSchema>;
export type ThemeChangedMessage = z.infer<typeof ThemeChangedMessageSchema>;

export type ServerMessage = z.infer<typeof ServerMessageSchema>;

export type ServerMessageType = ServerMessage['type'];
