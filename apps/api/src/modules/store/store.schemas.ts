import {
  DATE_PATTERN,
  PAUSE_DURATIONS,
  TIME_PATTERN,
  WEEKDAYS,
  isValidTimezone,
} from '@store/shared';
import { z } from 'zod';

const DayHoursInput = z
  .object({
    closed: z.boolean(),
    open: z.string().regex(TIME_PATTERN, 'Use HH:mm, e.g. 11:00'),
    close: z.string().regex(TIME_PATTERN, 'Use HH:mm, e.g. 22:00'),
  })
  .refine((d) => d.closed || d.open !== d.close, { message: 'Opening and closing times must differ', path: ['close'] });

export const UpdateHoursSchema = z.object({
  timezone: z.string().refine(isValidTimezone, 'Unknown time zone'),
  weekly: z.object(Object.fromEntries(WEEKDAYS.map((d) => [d, DayHoursInput])) as Record<(typeof WEEKDAYS)[number], typeof DayHoursInput>),
  closures: z
    .array(
      z.object({
        date: z.string().regex(DATE_PATTERN, 'Use YYYY-MM-DD'),
        note: z.string().trim().max(80).optional(),
      }),
    )
    .max(100)
    .refine((list) => new Set(list.map((c) => c.date)).size === list.length, 'Each date can only be closed once')
    .transform((list) => [...list].sort((a, b) => a.date.localeCompare(b.date))),
});

export const PauseSchema = z.object({ duration: z.enum(PAUSE_DURATIONS) });

export type UpdateHoursInput = z.infer<typeof UpdateHoursSchema>;
