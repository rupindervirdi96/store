import { Schema, model } from 'mongoose';
import { WEEKDAYS, type DayHours, type StoreHoursDTO, type Weekday } from '@store/shared';

const DayHoursSchema = new Schema<DayHours>(
  {
    closed: { type: Boolean, default: false },
    open: { type: String, required: true },
    close: { type: String, required: true },
  },
  { _id: false },
);

/** Store-wide settings: a single document with key "main". */
const StoreSettingsSchema = new Schema(
  {
    key: { type: String, required: true, unique: true, default: 'main' },
    timezone: { type: String, required: true },
    weekly: new Schema(
      Object.fromEntries(WEEKDAYS.map((d) => [d, { type: DayHoursSchema, required: true }])) as Record<
        Weekday,
        { type: typeof DayHoursSchema; required: true }
      >,
      { _id: false },
    ),
    closures: {
      type: [new Schema({ date: { type: String, required: true }, note: { type: String, trim: true } }, { _id: false })],
      default: [],
    },
    paused: { type: Boolean, default: false },
    pausedUntil: { type: Date, default: null },
  },
  { timestamps: true },
);

export const StoreSettingsModel = model('StoreSettings', StoreSettingsSchema);

type StoreSettingsDoc = InstanceType<typeof StoreSettingsModel>;

export function toStoreHoursDTO(s: StoreSettingsDoc): StoreHoursDTO {
  const weekly = Object.fromEntries(
    WEEKDAYS.map((d) => {
      const day = s.weekly![d] as DayHours;
      return [d, { closed: Boolean(day.closed), open: day.open, close: day.close }];
    }),
  ) as Record<Weekday, DayHours>;
  return {
    timezone: s.timezone,
    weekly,
    closures: s.closures.map((c) => ({ date: c.date, ...(c.note && { note: c.note }) })),
    paused: s.paused,
    pausedUntil: s.pausedUntil?.toISOString() ?? null,
  };
}
