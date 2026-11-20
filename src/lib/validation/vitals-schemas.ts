import { z } from 'zod';
import {
  BBT_RANGE,
  CERVICAL_MUCUS_TYPES,
  isBbtInRange,
  TEMPERATURE_UNITS,
} from '@/lib/bbt';
import { DateOnlyStringSchema } from '@/lib/date-only';
import { PastDateOnlyStringSchema } from '@/lib/validation/profile-schemas';

/**
 * Resting heart rate (bpm). Well-trained endurance athletes can rest in the 30s or
 * lower; above 100 at rest is already unusual. 25-150 accepts every real morning value
 * (including an unwell day) and rejects typos.
 */
export const RESTING_HEART_RATE_RANGE = { min: 25, max: 150 } as const;

/**
 * HRV as RMSSD (ms). Healthy adults average about 42 ± 15 ms (Nunan D et al., Pacing
 * Clin Electrophysiol 2010;33:1407-1417) and wearables report roughly 10-200 ms.
 * 5-300 covers real extremes and rejects unit mix-ups such as seconds.
 */
export const HEART_RATE_VARIABILITY_RANGE = { min: 5, max: 300 } as const;

/** Same 1-10 scale as mood and energy in the journal. */
export const SLEEP_QUALITY_RANGE = { min: 1, max: 10 } as const;

export const TemperatureUnitSchema = z.enum(TEMPERATURE_UNITS);
export const CervicalMucusSchema = z.enum(CERVICAL_MUCUS_TYPES);

/**
 * One day's BBT and/or cervical mucus.
 * `undefined` leaves the stored value unchanged, `null` clears it.
 */
export const BbtReadingInputSchema = z
  .object({
    date: PastDateOnlyStringSchema,
    temperature: z.number().nullable().optional(),
    unit: TemperatureUnitSchema,
    cervicalMucus: CervicalMucusSchema.nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (
      value.temperature !== null &&
      value.temperature !== undefined &&
      !isBbtInRange(value.temperature, value.unit)
    ) {
      const range = BBT_RANGE[value.unit];
      ctx.addIssue({
        code: 'custom',
        path: ['temperature'],
        message: `Temperature must be between ${range.min} and ${range.max} °${value.unit}`,
      });
    }
    if (value.temperature === undefined && value.cervicalMucus === undefined) {
      ctx.addIssue({ code: 'custom', message: 'Nothing to save' });
    }
  });
export type BbtReadingInput = z.infer<typeof BbtReadingInputSchema>;

/**
 * One day's vitals. `undefined` leaves the stored value unchanged, `null` clears it.
 */
export const VitalsInputSchema = z
  .object({
    date: PastDateOnlyStringSchema,
    restingHeartRate: z
      .number()
      .int('Resting heart rate must be a whole number')
      .min(
        RESTING_HEART_RATE_RANGE.min,
        `Resting heart rate must be at least ${RESTING_HEART_RATE_RANGE.min} bpm`
      )
      .max(
        RESTING_HEART_RATE_RANGE.max,
        `Resting heart rate must be at most ${RESTING_HEART_RATE_RANGE.max} bpm`
      )
      .nullable()
      .optional(),
    heartRateVariability: z
      .number()
      .min(
        HEART_RATE_VARIABILITY_RANGE.min,
        `HRV must be at least ${HEART_RATE_VARIABILITY_RANGE.min} ms`
      )
      .max(
        HEART_RATE_VARIABILITY_RANGE.max,
        `HRV must be at most ${HEART_RATE_VARIABILITY_RANGE.max} ms`
      )
      .nullable()
      .optional(),
    sleepQuality: z
      .number()
      .int('Sleep quality must be a whole number')
      .min(SLEEP_QUALITY_RANGE.min, 'Sleep quality must be 1-10')
      .max(SLEEP_QUALITY_RANGE.max, 'Sleep quality must be 1-10')
      .nullable()
      .optional(),
  })
  .refine(
    (value) =>
      value.restingHeartRate !== undefined ||
      value.heartRateVariability !== undefined ||
      value.sleepQuality !== undefined,
    { message: 'Nothing to save' }
  );
export type VitalsInput = z.infer<typeof VitalsInputSchema>;

export const PeriodStartInputSchema = z.object({
  date: PastDateOnlyStringSchema,
});

export const DayInputSchema = z.object({ date: DateOnlyStringSchema });

export const VitalsPreferencesSchema = z
  .object({
    trackVitals: z.boolean().optional(),
    temperatureUnit: TemperatureUnitSchema.optional(),
  })
  .refine(
    (value) =>
      value.trackVitals !== undefined || value.temperatureUnit !== undefined,
    { message: 'Nothing to save' }
  );
export type VitalsPreferencesInput = z.infer<typeof VitalsPreferencesSchema>;
