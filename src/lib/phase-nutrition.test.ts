import { describe, expect, it } from 'vitest';
import { getDietaryRecommendations } from './dietary-recommendations';
import {
  CYCLE_PHASES,
  derivePhaseTags,
  describeBiologicalMatch,
  formatList,
  getBiologicalMatch,
  inferIngredientNutrients,
  inferNutrientHighlights,
  NUTRIENT_HIGHLIGHTS,
  nutrientHighlightsSchema,
  PHASE_NUTRITION,
  phaseTagsSchema,
  resolveRecipeBioProfile,
  sanitizeNutrientHighlights,
  sanitizePhaseTags,
} from './phase-nutrition';

const nutrientsOf = (name: string, unit?: string) =>
  inferIngredientNutrients({ name, unit });

describe('PHASE_NUTRITION', () => {
  it('covers every phase with focus nutrients from the vocabulary', () => {
    for (const phase of CYCLE_PHASES) {
      const entry = PHASE_NUTRITION[phase];
      expect(entry.focus.length, phase).toBeGreaterThan(0);
      for (const nutrient of [...entry.focus, ...entry.supporting]) {
        expect(NUTRIENT_HIGHLIGHTS).toContain(nutrient);
      }
      expect(entry.focus.some((n) => entry.supporting.includes(n)), phase).toBe(false);
    }
  });

  it('follows the existing guidance and the issue', () => {
    expect(PHASE_NUTRITION.menstrual.focus).toContain('iron');
    expect(PHASE_NUTRITION.follicular.focus).toEqual(['protein', 'complex-carbs']);
    expect(PHASE_NUTRITION.luteal.focus).toEqual(['magnesium', 'complex-carbs']);
    // dietary-recommendations.ts lists the same themes on the cycle page
    expect(getDietaryRecommendations('menstrual')?.focus).toContain('iron-rich foods');
    expect(getDietaryRecommendations('luteal')?.focus).toEqual(
      expect.arrayContaining(['complex carbs', 'magnesium-rich foods'])
    );
    expect(getDietaryRecommendations('ovulation')?.focus).toContain('seeds');
  });

  it('keeps copy friendly and non-medical', () => {
    for (const phase of CYCLE_PHASES) {
      const { headline, benefit } = PHASE_NUTRITION[phase];
      expect(`${headline} ${benefit}`).not.toMatch(/\b(cure|treat|diagnos|prevent|deficien)/i);
    }
    expect(PHASE_NUTRITION.luteal.headline).toBe(
      'Luteal days favor magnesium-rich meals and complex carbs.'
    );
  });
});

describe('inferIngredientNutrients', () => {
  it('recognises Swedish ingredient names, including compounds', () => {
    expect(nutrientsOf('Babyspenat')).toEqual(['iron', 'magnesium']);
    expect(nutrientsOf('Röda linser')).toEqual(
      expect.arrayContaining(['iron', 'protein', 'fiber', 'complex-carbs'])
    );
    expect(nutrientsOf('Kikärtor, kokta')).toContain('protein');
    expect(nutrientsOf('Pumpafrön')).toEqual(
      expect.arrayContaining(['iron', 'magnesium', 'zinc'])
    );
    expect(nutrientsOf('Laxfilé (färsk)')).toEqual(
      expect.arrayContaining(['omega-3', 'protein'])
    );
    expect(nutrientsOf('Nötfärs')).toEqual(expect.arrayContaining(['iron', 'zinc', 'protein']));
    expect(nutrientsOf('Havregryn')).toEqual(
      expect.arrayContaining(['complex-carbs', 'fiber'])
    );
    expect(nutrientsOf('Vit quinoa')).toEqual(
      expect.arrayContaining(['complex-carbs', 'protein', 'iron'])
    );
    expect(nutrientsOf('Svarta bönor')).toEqual(
      expect.arrayContaining(['iron', 'magnesium', 'fiber'])
    );
    expect(nutrientsOf('Hasselnötter')).toContain('magnesium');
    expect(nutrientsOf('Mörk choklad 70%')).toEqual(
      expect.arrayContaining(['magnesium', 'iron', 'antioxidants'])
    );
    expect(nutrientsOf('Ägg')).toEqual(['protein']);
    expect(nutrientsOf('Äggulor')).toEqual(['protein']);
    expect(nutrientsOf('Fetaost')).toEqual(['calcium']);
  });

  it('recognises English ingredient names', () => {
    expect(nutrientsOf('Fresh spinach')).toEqual(['iron', 'magnesium']);
    expect(nutrientsOf('Red lentils')).toContain('iron');
    expect(nutrientsOf('Chickpeas')).toContain('protein');
    expect(nutrientsOf('Salmon fillet')).toContain('omega-3');
    expect(nutrientsOf('Ground beef')).toContain('iron');
    expect(nutrientsOf('Rolled oats')).toContain('complex-carbs');
    expect(nutrientsOf('Black beans')).toContain('magnesium');
    expect(nutrientsOf('Mixed nuts')).toContain('magnesium');
    expect(nutrientsOf('Dark chocolate')).toContain('antioxidants');
    expect(nutrientsOf('Eggs')).toEqual(['protein']);
    expect(nutrientsOf('Pumpkin seeds')).toContain('zinc');
    expect(nutrientsOf('Flaxseed')).toContain('omega-3');
  });

  it('does not confuse look-alike words', () => {
    // Beef vs nuts vs nutmeg
    expect(nutrientsOf('Muskotnöt')).toEqual([]);
    expect(nutrientsOf('Nutmeg')).toEqual([]);
    expect(nutrientsOf('Coconut milk')).toEqual([]);
    expect(nutrientsOf('Kokosmjölk')).toEqual([]);
    // "färsk" is not "färs", "flax" is not "lax", "ärtskott" is not "ärtor"
    expect(nutrientsOf('Fänkål färsk')).toEqual([]);
    expect(nutrientsOf('Krossade linfrön')).not.toContain('protein');
    expect(nutrientsOf('Ärtskott')).toEqual([]);
    expect(nutrientsOf('Eggplant')).toEqual([]);
    expect(nutrientsOf('Lammsallad')).toEqual([]);
    expect(nutrientsOf('Linsbiffar')).not.toContain('zinc');
    expect(nutrientsOf('Körsbärstomater')).toEqual([]);
  });

  it('does not count spices, vegetables and sprouts as berries, eggs or legumes', () => {
    // Linseed is flax, not lentils ("lins")
    expect(nutrientsOf('Linseed', 'g')).toEqual(['magnesium', 'omega-3', 'fiber']);
    expect(nutrientsOf('Krossade linfrön', 'g')).toEqual(['magnesium', 'omega-3', 'fiber']);
    // Juniper berries are a whole spice
    expect(nutrientsOf('Enbär', 'st')).toEqual([]);
    expect(nutrientsOf('Krossade enbär', 'st')).toEqual([]);
    expect(nutrientsOf('Juniper berries', 'st')).toEqual([]);
    // Eggplant
    expect(nutrientsOf('Äggplanta', 'st')).toEqual([]);
    expect(nutrientsOf('Egg plant', 'st')).toEqual([]);
    // Bean sprouts are a vegetable
    expect(nutrientsOf('Mungbönsgroddar', 'g')).toEqual([]);
    expect(nutrientsOf('Mungbönsskott', 'g')).toEqual([]);
    expect(nutrientsOf('Bean sprouts', 'g')).toEqual([]);
    expect(nutrientsOf('Bean sprout', 'g')).toEqual([]);
    expect(nutrientsOf('Beansprouts', 'g')).toEqual([]);
    expect(nutrientsOf('Böngroddar', 'g')).toEqual([]);
    // The real things still count
    expect(nutrientsOf('Linser', 'dl')).toContain('iron');
    expect(nutrientsOf('Mungbönor', 'dl')).toContain('iron');
    expect(nutrientsOf('Blåbär', 'dl')).toContain('antioxidants');
    expect(nutrientsOf('Ägg', 'st')).toEqual(['protein']);
    expect(nutrientsOf('Äggula', 'st')).toEqual(['protein']);
  });

  it('ignores stock, sauces, oils, plant drinks and seasoning-sized amounts', () => {
    expect(nutrientsOf('Fiskfond')).toEqual([]);
    expect(nutrientsOf('Fisksås')).toEqual([]);
    expect(nutrientsOf('Viltfond')).toEqual([]);
    expect(nutrientsOf('Kycklingbuljong')).toEqual([]);
    expect(nutrientsOf('Sesamolja')).toEqual([]);
    expect(nutrientsOf('Mandeldryck')).toEqual([]);
    expect(nutrientsOf('Havredryck')).toEqual([]);
    expect(nutrientsOf('Kakaosmör')).toEqual([]);
    expect(nutrientsOf('Potatismjöl')).toEqual([]);
    expect(nutrientsOf('Paprikapulver')).toEqual([]);
    expect(nutrientsOf('Apelsinzest')).toEqual([]);
    expect(nutrientsOf('Kakao', 'tsk')).toEqual([]);
    expect(nutrientsOf('Chiafrön', 'krm')).toEqual([]);
    expect(nutrientsOf('Chiafrön', 'msk')).toContain('omega-3');
  });

  it('returns nothing for unknown or empty names', () => {
    expect(nutrientsOf('Salt')).toEqual([]);
    expect(nutrientsOf('')).toEqual([]);
    expect(nutrientsOf('  (valfritt)  ')).toEqual([]);
  });
});

describe('inferNutrientHighlights / derivePhaseTags', () => {
  it('merges ingredients into vocabulary order', () => {
    expect(
      inferNutrientHighlights([
        { name: 'Pumpafrön' },
        { name: 'Linfrön' },
        { name: 'Salt', unit: 'tsk' },
      ])
    ).toEqual(['iron', 'magnesium', 'protein', 'omega-3', 'fiber', 'zinc']);
  });

  it('tags a phase when the recipe provides one of its focus nutrients', () => {
    expect(derivePhaseTags(['iron'])).toEqual(['menstrual']);
    expect(derivePhaseTags(['magnesium'])).toEqual(['luteal']);
    expect(derivePhaseTags(['complex-carbs'])).toEqual(['follicular', 'luteal']);
    expect(derivePhaseTags(['antioxidants'])).toEqual(['ovulation']);
    // Supporting nutrients alone are not enough
    expect(derivePhaseTags(['vitamin-b6', 'calcium'])).toEqual([]);
    expect(derivePhaseTags([])).toEqual([]);
  });
});

describe('resolveRecipeBioProfile', () => {
  const lentilSoup = {
    ingredients: [{ name: 'Röda linser' }, { name: 'Spenat' }],
  };

  it('infers nutrients and phases when nothing is tagged', () => {
    expect(resolveRecipeBioProfile(lentilSoup)).toEqual({
      phases: ['menstrual', 'follicular', 'luteal'],
      nutrients: ['iron', 'magnesium', 'protein', 'complex-carbs', 'fiber'],
    });
  });

  it('lets explicit tags win over inference', () => {
    expect(
      resolveRecipeBioProfile({ ...lentilSoup, phaseTags: ['menstrual'] })
    ).toMatchObject({ phases: ['menstrual'] });
    expect(
      resolveRecipeBioProfile({ ...lentilSoup, nutrientHighlights: ['magnesium'] })
    ).toEqual({ phases: ['luteal'], nutrients: ['magnesium'] });
  });

  it('ignores stored values outside the vocabulary', () => {
    expect(
      resolveRecipeBioProfile({ ...lentilSoup, phaseTags: ['winter'], nutrientHighlights: ['kale'] })
    ).toEqual(resolveRecipeBioProfile(lentilSoup));
  });

  it('only tags treats and building blocks explicitly', () => {
    const pie = { ingredients: [{ name: 'Ägg' }], leanRole: 'Treat' };
    expect(resolveRecipeBioProfile(pie)).toEqual({ phases: [], nutrients: ['protein'] });
    expect(
      resolveRecipeBioProfile({ ingredients: [{ name: 'Jordnötssmör' }], leanRole: 'process' })
        .phases
    ).toEqual([]);
    expect(resolveRecipeBioProfile({ ...pie, phaseTags: ['luteal'] }).phases).toEqual([
      'luteal',
    ]);
    expect(resolveRecipeBioProfile({ ...pie, leanRole: 'Daily' }).phases).toEqual([
      'follicular',
    ]);
  });

  it('never derives phases for treats and building blocks from nutrients, even saved ones', () => {
    // "Use suggestions" in the recipe form (or an older seed) saves the inferred nutrients
    const savedPie = { ingredients: [{ name: 'Ägg' }], leanRole: 'Treat', nutrientHighlights: ['protein'] };
    expect(resolveRecipeBioProfile(savedPie)).toEqual({ phases: [], nutrients: ['protein'] });
    expect(
      resolveRecipeBioProfile({
        ingredients: [{ name: 'Jordnötssmör' }],
        leanRole: 'Process',
        nutrientHighlights: ['protein', 'magnesium'],
      }).phases
    ).toEqual([]);
    // An explicit phase still counts
    expect(resolveRecipeBioProfile({ ...savedPie, phaseTags: ['follicular'] }).phases).toEqual([
      'follicular',
    ]);
  });
});

describe('getBiologicalMatch', () => {
  const profile = { phases: ['luteal' as const], nutrients: ['magnesium' as const, 'calcium' as const] };

  it('matches only the tagged phase', () => {
    expect(getBiologicalMatch(profile, 'luteal')).toEqual({
      phase: 'luteal',
      nutrients: ['magnesium', 'calcium'],
      strength: 1,
    });
    expect(getBiologicalMatch(profile, 'menstrual')).toBeNull();
    expect(getBiologicalMatch(profile, null)).toBeNull();
    expect(getBiologicalMatch(undefined, 'luteal')).toBeNull();
  });

  it('counts focus nutrients and keeps a floor of 1 for explicit phase tags', () => {
    expect(
      getBiologicalMatch(
        { phases: ['luteal'], nutrients: ['magnesium', 'complex-carbs'] },
        'luteal'
      )?.strength
    ).toBe(2);
    expect(getBiologicalMatch({ phases: ['luteal'], nutrients: [] }, 'luteal')).toEqual({
      phase: 'luteal',
      nutrients: [],
      strength: 1,
    });
  });

  it('describes the benefit in plain words', () => {
    const match = getBiologicalMatch(profile, 'luteal');
    expect(match && describeBiologicalMatch(match)).toBe(
      `Suits your luteal phase. It brings magnesium and calcium. ${PHASE_NUTRITION.luteal.benefit}`
    );
  });
});

describe('tag schemas', () => {
  it('normalise case, drop duplicates and store vocabulary order', () => {
    expect(phaseTagsSchema.parse([' Luteal', 'menstrual', 'LUTEAL'])).toEqual([
      'menstrual',
      'luteal',
    ]);
    expect(nutrientHighlightsSchema.parse(['Zinc', 'iron', 'iron'])).toEqual(['iron', 'zinc']);
    expect(phaseTagsSchema.parse([])).toEqual([]);
  });

  it('reject values outside the vocabulary', () => {
    expect(phaseTagsSchema.safeParse(['spring']).success).toBe(false);
    expect(nutrientHighlightsSchema.safeParse(['vitamin-d']).success).toBe(false);
    expect(nutrientHighlightsSchema.safeParse([42]).success).toBe(false);
  });

  it('sanitize helpers keep only known values', () => {
    expect(sanitizePhaseTags(['Luteal ', 'x', 'menstrual'])).toEqual(['menstrual', 'luteal']);
    expect(sanitizeNutrientHighlights(undefined)).toEqual([]);
  });
});

describe('formatList', () => {
  it('joins with commas and "and"', () => {
    expect(formatList([])).toBe('');
    expect(formatList(['a'])).toBe('a');
    expect(formatList(['a', 'b'])).toBe('a and b');
    expect(formatList(['a', 'b', 'c'])).toBe('a, b and c');
  });
});
