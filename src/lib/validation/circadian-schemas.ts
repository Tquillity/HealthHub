import { z } from 'zod';

/** Energy check-in on the journal's 1-10 scale (like `energy`). */
export const EnergyRatingSchema = z
  .number()
  .int('Energy must be a whole number from 1 to 10')
  .min(1, 'Energy must be from 1 to 10')
  .max(10, 'Energy must be from 1 to 10');

/** "How is your energy right now?": the server picks the time-of-day slot. */
export const LogEnergyNowSchema = z.object({ energy: EnergyRatingSchema });
export type LogEnergyNowInput = z.infer<typeof LogEnergyNowSchema>;

/**
 * Energy by time of day on one journal day (journal form).
 * `undefined` leaves the stored value unchanged, `null` clears it.
 */
export const TimeOfDayEnergyFieldsSchema = z.object({
  energyMorning: EnergyRatingSchema.nullable().optional(),
  energyAfternoon: EnergyRatingSchema.nullable().optional(),
  energyEvening: EnergyRatingSchema.nullable().optional(),
});
export type TimeOfDayEnergyFields = z.infer<typeof TimeOfDayEnergyFieldsSchema>;

export const CircadianPreferencesSchema = z.object({
  enabled: z.boolean(),
  /** The browser's zone, saved on opt-in while the profile still has the default. */
  deviceTimeZone: z.string().trim().max(100).optional(),
});
export type CircadianPreferencesInput = z.infer<
  typeof CircadianPreferencesSchema
>;
