import {
  DEFAULT_STORE_HOURS,
  getStoreStatus,
  pauseEndsAt,
  storeToday,
  type PauseDuration,
  type StoreHoursDTO,
  type StoreInfoDTO,
} from '@store/shared';
import { AppError } from '../../utils/AppError';
import { StoreSettingsModel, toStoreHoursDTO } from './store.model';
import type { UpdateHoursInput } from './store.schemas';

/** The saved settings, created from the defaults the first time. */
async function settings() {
  return StoreSettingsModel.findOneAndUpdate(
    { key: 'main' },
    { $setOnInsert: { key: 'main', ...DEFAULT_STORE_HOURS, pausedUntil: null } },
    { upsert: true, new: true },
  );
}

export async function getHours(): Promise<StoreHoursDTO> {
  return toStoreHoursDTO(await settings());
}

export function toInfo(hours: StoreHoursDTO, now = new Date()): StoreInfoDTO {
  const today = storeToday(hours, now);
  return {
    hours,
    status: getStoreStatus(hours, now),
    upcomingClosures: hours.closures.filter((c) => c.date >= today),
  };
}

export async function getInfo(): Promise<StoreInfoDTO> {
  return toInfo(await getHours());
}

export async function updateHours(input: UpdateHoursInput): Promise<StoreInfoDTO> {
  const doc = await settings();
  doc.set({ timezone: input.timezone, weekly: input.weekly, closures: input.closures });
  await doc.save();
  return toInfo(toStoreHoursDTO(doc));
}

export async function pause(duration: PauseDuration): Promise<StoreInfoDTO> {
  const doc = await settings();
  const until = pauseEndsAt(toStoreHoursDTO(doc), duration);
  doc.set({ paused: true, pausedUntil: until });
  await doc.save();
  return toInfo(toStoreHoursDTO(doc));
}

export async function resume(): Promise<StoreInfoDTO> {
  const doc = await settings();
  doc.set({ paused: false, pausedUntil: null });
  await doc.save();
  return toInfo(toStoreHoursDTO(doc));
}

/** Throws a 409 with a customer-facing message when orders can't be taken right now. */
export async function assertAcceptingOrders(): Promise<void> {
  const { status } = await getInfo();
  if (status.isOpen) return;
  const lead = status.reason === 'paused' ? 'Online ordering is paused right now.' : "Sorry, we're closed right now.";
  const next = status.opensAt ? `${status.detail}.` : 'Please check back soon.';
  throw new AppError(409, `${lead} ${next}`);
}
