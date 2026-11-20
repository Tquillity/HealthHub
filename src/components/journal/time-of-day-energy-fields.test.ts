import { describe, expect, it } from 'vitest';
import { changedTimeOfDayEnergy } from './time-of-day-energy-fields';

const blank = { energyMorning: '', energyAfternoon: '', energyEvening: '' };

describe('changedTimeOfDayEnergy', () => {
  it('sends nothing for slots left as they loaded', () => {
    // The afternoon was blank when the form loaded; a dashboard check-in saved 7 since.
    // Saving the untouched form must not send the afternoon at all (not even null).
    const payload = changedTimeOfDayEnergy(blank, blank);
    expect(payload).toEqual({});
    expect('energyAfternoon' in payload).toBe(false);

    const loaded = { energyMorning: '6', energyAfternoon: '', energyEvening: '4' };
    expect(changedTimeOfDayEnergy(loaded, { ...loaded })).toEqual({});
  });

  it('sends only the slots the user edited', () => {
    const loaded = { energyMorning: '6', energyAfternoon: '', energyEvening: '4' };
    expect(
      changedTimeOfDayEnergy(loaded, {
        energyMorning: '6',
        energyAfternoon: '8',
        energyEvening: '4',
      })
    ).toEqual({ energyAfternoon: 8 });
  });

  it('sends null for a slot the user cleared', () => {
    const loaded = { energyMorning: '6', energyAfternoon: '', energyEvening: '' };
    expect(changedTimeOfDayEnergy(loaded, blank)).toEqual({ energyMorning: null });
  });
});
