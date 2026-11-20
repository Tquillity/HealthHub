import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  class ClinicalReportUnavailableError extends Error {}
  return {
    requireSessionUserId: vi.fn(),
    loadClinicalReport: vi.fn(),
    ClinicalReportUnavailableError,
  };
});
vi.mock('@/lib/session', () => ({
  requireSessionUserId: mocks.requireSessionUserId,
}));
vi.mock('@/lib/clinical-report-data', () => ({
  loadClinicalReport: mocks.loadClinicalReport,
  ClinicalReportUnavailableError: mocks.ClinicalReportUnavailableError,
}));
import { generateClinicalReport } from './clinical-report-actions';

const options = {
  months: 6 as const,
  includeName: false,
  includeNotes: false,
  includeBbt: true,
  includeSymptoms: true,
  includeVitals: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireSessionUserId.mockResolvedValue({ ok: true, userId: 'me' });
  mocks.loadClinicalReport.mockResolvedValue({ meta: {}, cycles: {}, phases: {} });
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe('generateClinicalReport', () => {
  it('builds the report for the signed-in user with the validated options', async () => {
    const result = await generateClinicalReport({ ...options, today: '2026-11-20' });
    expect(result.success).toBe(true);
    expect(mocks.loadClinicalReport).toHaveBeenCalledWith('me', {
      ...options,
      today: '2026-11-20',
    });
  });

  it('rejects guests before loading anything', async () => {
    mocks.requireSessionUserId.mockResolvedValue({
      ok: false,
      error: 'Unauthorized',
    });
    expect(await generateClinicalReport(options)).toEqual({
      success: false,
      error: 'Unauthorized',
    });
    expect(mocks.loadClinicalReport).not.toHaveBeenCalled();
  });

  it('never accepts a user id or unknown options from the client', async () => {
    const withUserId = { ...options, userId: 'someone-else' };
    const result = await generateClinicalReport(
      withUserId as unknown as Parameters<typeof generateClinicalReport>[0]
    );
    expect(result.success).toBe(false);
    expect(mocks.loadClinicalReport).not.toHaveBeenCalled();
  });

  it('accepts only 3, 6 or 12 months and boolean toggles', async () => {
    for (const bad of [
      { ...options, months: 5 },
      { ...options, months: '6' },
      { ...options, includeNotes: 'yes' },
      { ...options, today: '2026-02-30' },
      { months: 3 },
    ]) {
      const result = await generateClinicalReport(
        bad as unknown as Parameters<typeof generateClinicalReport>[0]
      );
      expect(result.success).toBe(false);
    }
    expect(mocks.loadClinicalReport).not.toHaveBeenCalled();
  });

  it('shows why a report is unavailable', async () => {
    mocks.loadClinicalReport.mockRejectedValue(
      new mocks.ClinicalReportUnavailableError('Turn on cycle tracking first.')
    );
    expect(await generateClinicalReport(options)).toEqual({
      success: false,
      error: 'Turn on cycle tracking first.',
    });
  });

  it('logs failures without their message (it may contain health data)', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mocks.loadClinicalReport.mockRejectedValue(
      new Error('query failed for temperature 36.6 and note "private"')
    );
    const result = await generateClinicalReport(options);
    expect(result.success).toBe(false);
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/36\.6|private/);
  });
});
