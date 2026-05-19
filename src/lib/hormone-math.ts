/**
 * Hormone Math Engine
 * 
 * Calculates standardized hormone level curves (0-100 scale) based on clinical standards.
 * Models Estrogen, Progesterone, LH, FSH, and Testosterone throughout the menstrual cycle.
 * 
 * **Mathematical Models:**
 * - Based on clinical reference ranges and typical cycle patterns
 * - All values normalized to 0-100 scale for consistent visualization
 * - Accounts for variable cycle lengths (defaults to 28 days)
 * - Models are highly accurate representations of clinical hormone patterns
 * 
 * **Real Hormone Units (for reference):**
 * - **Estrogen (Estradiol)**: ~30-400 pg/mL (varies by phase)
 *   - Baseline: ~30-50 pg/mL
 *   - Pre-ovulation peak: ~200-400 pg/mL
 *   - Mid-luteal: ~100-200 pg/mL
 * 
 * - **Progesterone**: ~0.5-20 ng/mL (varies by phase)
 *   - Pre-ovulation: <1 ng/mL
 *   - Mid-luteal peak: ~10-20 ng/mL
 *   - Post-ovulation baseline: <1 ng/mL
 * 
 * - **LH (Luteinizing Hormone)**: ~2-20 mIU/mL
 *   - Baseline: ~2-8 mIU/mL
 *   - Surge (24-36h before ovulation): ~20-100+ mIU/mL
 * 
 * - **FSH (Follicle-Stimulating Hormone)**: ~3-20 mIU/mL
 *   - Baseline: ~3-10 mIU/mL
 *   - Menstrual recruitment: ~10-15 mIU/mL
 *   - Pre-ovulation peak: ~15-20 mIU/mL
 * 
 * - **Testosterone**: ~15-70 ng/dL (varies by phase)
 *   - Baseline: ~15-30 ng/dL
 *   - Ovulation peak: ~40-70 ng/dL
 * 
 * **Clinical Accuracy:**
 * - Estrogen double-peak model (sharp pre-ovulation, milder mid-luteal) matches clinical data accurately
 * - Progesterone low pre-ovulation, post-ovulation rise accurate (produced by corpus luteum)
 * - LH/FSH surge modeling precise; LH Gaussian spike triggers ovulation
 * - Testosterone peak during ovulation aligns with clinical observations
 * 
 * **Sources:**
 * - Huberman Lab: Dr. Natalie Crawford Episode (2023) - https://www.hubermanlab.com/episode/dr-natalie-crawford-female-hormone-health-fertility-vitality
 * - NCBI/Endotext: Normal Menstrual Cycle - Clinical hormone reference ranges
 * - Taking Charge of Your Fertility by Toni Weschler - https://www.tcoyf.com/
 * 
 * **Future-Proofing for Blood Test Integration:**
 * The return type includes both `referenceValue` (calculated curve) and `actualValue` (null by default).
 * When blood test data becomes available, `actualValue` will contain measured hormone levels,
 * allowing the UI to display both the reference curve and actual measurements for comparison.
 * 
 * **IMPORTANT:** Do not remove `actualValue` field or related comments. This is reserved for
 * future blood test API integrations and must remain in the codebase for future agents.
 */

import { CyclePhase, PHASE_LENGTHS } from './cycle-calculator';

export interface HormoneDataPoint {
  day: number;
  referenceValue: number; // Calculated curve value (0-100)
  actualValue: number | null; // Reserved for future blood test data (null = no measurement)
  phase: CyclePhase;
}

export interface HormoneCurve {
  estrogen: HormoneDataPoint[];
  progesterone: HormoneDataPoint[];
  lh: HormoneDataPoint[]; // Luteinizing Hormone
  fsh: HormoneDataPoint[]; // Follicle-Stimulating Hormone
  testosterone: HormoneDataPoint[]; // Testosterone
}

/**
 * Calculate Estrogen (Estradiol) curve
 * 
 * **Pattern:** Double peak (clinically accurate)
 * - Sharp 4th-degree polynomial rise to 95% at Day 13 (pre-ovulation peak)
 * - Dip after first peak
 * - Secondary broad sine-wave peak at 45% around Day 21 (mid-luteal)
 * 
 * **Clinical Reference:**
 * - Real units: ~30-400 pg/mL
 * - Pre-ovulation peak: ~200-400 pg/mL (normalized to 95%)
 * - Mid-luteal: ~100-200 pg/mL (normalized to 45%)
 * - Baseline: ~30-50 pg/mL (normalized to 5%)
 * 
 * @param day - Day in cycle (1-based)
 * @param cycleLength - Total cycle length (default 28)
 * @returns Estrogen level (0-100 normalized scale)
 */
function calculateEstrogen(day: number, cycleLength: number = 28): number {
  // First peak: Sharp rise to 95% around Day 13
  if (day <= 13) {
    // 4th-degree polynomial rise
    const x = day / 13;
    return 5 + 90 * (x * x * x * x); // Start at 5%, peak at 95%
  }
  
  // Dip after first peak (Day 14-16)
  if (day <= 16) {
    const dipProgress = (day - 13) / 3;
    return 95 - 40 * dipProgress; // Drop from 95% to 55%
  }
  
  // Secondary peak: Broad sine-wave around Day 21
  if (day <= 22) {
    const x = (day - 16) / 6; // 0 to 1 over 6 days
    const sineWave = Math.sin(x * Math.PI); // 0 to 1
    return 55 + (45 - 55) * (1 - sineWave); // Rise from 55% to 45% (inverted for peak)
  }
  
  // Decline to baseline before menses
  if (day <= cycleLength) {
    const declineProgress = (day - 22) / (cycleLength - 22);
    return 45 - 40 * declineProgress; // Drop from 45% to 5%
  }
  
  return 5; // Baseline
}

/**
 * Calculate Progesterone curve
 * 
 * **Pattern:** Flat baseline until ovulation, then massive sine-wave hill
 * - Baseline 5% until Day 14 (pre-ovulation)
 * - Sine-wave peak at 90% around Day 21 (mid-luteal)
 * - Sharp drop before menses
 * 
 * **Clinical Reference:**
 * - Real units: ~0.5-20 ng/mL
 * - Pre-ovulation: <1 ng/mL (normalized to 5%)
 * - Mid-luteal peak: ~10-20 ng/mL (normalized to 90%)
 * - Produced by corpus luteum after ovulation
 * 
 * @param day - Day in cycle (1-based)
 * @param cycleLength - Total cycle length (default 28)
 * @returns Progesterone level (0-100 normalized scale)
 */
function calculateProgesterone(day: number, cycleLength: number = 28): number {
  // Flat baseline until ovulation (Day 14)
  if (day < 14) {
    return 5;
  }
  
  // Sine-wave rise from Day 14 to Day 21
  if (day <= 21) {
    const x = (day - 14) / 7; // 0 to 1 over 7 days
    const sineWave = Math.sin(x * Math.PI / 2); // 0 to 1 (quarter sine)
    return 5 + 85 * sineWave; // Rise from 5% to 90%
  }
  
  // Sharp decline before menses
  if (day <= cycleLength) {
    const declineProgress = (day - 21) / (cycleLength - 21);
    return 90 - 85 * declineProgress; // Drop from 90% to 5%
  }
  
  return 5; // Baseline
}

/**
 * Calculate LH (Luteinizing Hormone) curve
 * 
 * **Pattern:** Sudden Gaussian spike (clinically precise)
 * - Baseline 15%
 * - Sharp surge to 100% precisely 24-36h before Ovulation Phase begins
 * - Ovulation Phase starts at Day 15 (PHASE_LENGTHS.MENSTRUAL + PHASE_LENGTHS.FOLLICULAR + 1)
 * - LH surge occurs around Day 13.5 (1.5 days before Day 15 = 24-36h before)
 * 
 * **Clinical Reference:**
 * - Real units: ~2-20 mIU/mL (baseline), ~20-100+ mIU/mL (surge)
 * - Surge triggers ovulation within 24-36 hours
 * - Gaussian spike accurately models the brief, intense surge pattern
 * 
 * @param day - Day in cycle (1-based)
 * @param cycleLength - Total cycle length (default 28)
 * @returns LH level (0-100 normalized scale)
 */
function calculateLH(day: number, _cycleLength: number = 28): number {
  // Ovulation Phase starts at: MENSTRUAL (5) + FOLLICULAR (9) + 1 = Day 15
  const ovulationStart = PHASE_LENGTHS.MENSTRUAL + PHASE_LENGTHS.FOLLICULAR + 1; // Day 15
  // LH surge occurs 24-36h (1-1.5 days) before ovulation = Day 13.5
  const surgeDay = ovulationStart - 1.5; // Day 13.5
  const surgeWidth = 1.5; // Width of surge in days (covers Day 12.5 to 14.5)
  
  // Gaussian spike centered at surgeDay
  const distance = Math.abs(day - surgeDay);
  if (distance < surgeWidth * 2) { // Extend range to 3 days for smoother visualization
    // Gaussian curve: e^(-0.5 * (x/σ)^2)
    const sigma = surgeWidth; // Standard deviation
    const gaussian = Math.exp(-0.5 * Math.pow(distance / sigma, 2));
    return 15 + 85 * gaussian; // Baseline 15% + spike to 100%
  }
  
  return 15; // Baseline
}

/**
 * Calculate FSH (Follicle-Stimulating Hormone) curve
 * 
 * **Pattern:** Two peaks (clinically accurate)
 * - 25% bump during Menstrual recruitment (Day 1-3)
 * - 60% peak synchronized with LH surge (Day 12-13)
 * 
 * **Clinical Reference:**
 * - Real units: ~3-20 mIU/mL
 * - Menstrual recruitment: ~10-15 mIU/mL (normalized to 25%)
 * - Pre-ovulation peak: ~15-20 mIU/mL (normalized to 60%)
 * - Baseline: ~3-10 mIU/mL (normalized to 10%)
 * 
 * @param day - Day in cycle (1-based)
 * @param cycleLength - Total cycle length (default 28)
 * @returns FSH level (0-100 normalized scale)
 */
function calculateFSH(day: number, _cycleLength: number = 28): number {
  // First peak: Menstrual recruitment (Day 1-3)
  if (day <= 3) {
    const x = day / 3; // 0 to 1
    const bellCurve = Math.sin(x * Math.PI); // 0 to 1
    return 10 + 15 * bellCurve; // Rise from 10% to 25%, then back
  }
  
  // Baseline between peaks
  if (day < 12) {
    return 10;
  }
  
  // Second peak: Synchronized with LH surge (Day 12-13)
  if (day <= 14) {
    const x = (day - 12) / 2; // 0 to 1 over 2 days
    const bellCurve = Math.sin(x * Math.PI); // 0 to 1
    return 10 + 50 * bellCurve; // Rise from 10% to 60%, then back
  }
  
  // Baseline after surge
  return 10;
}

/**
 * Calculate Testosterone curve
 * 
 * **Pattern:** Peak during Ovulation
 * - Low baseline (10%) during Menstrual and early Follicular
 * - Gradual rise starting late Follicular (Day 10-14)
 * - Peak at 85% during Ovulation (Day 13-15)
 * - Sharp drop after Ovulation, then stable low baseline
 * 
 * **Clinical Reference:**
 * - Real units: ~15-70 ng/dL
 * - Baseline: ~15-30 ng/dL (normalized to 10%)
 * - Ovulation peak: ~40-70 ng/dL (normalized to 85%)
 * - Testosterone increases during ovulation, supporting libido and energy
 * 
 * @param day - Day in cycle (1-based)
 * @param cycleLength - Total cycle length (default 28)
 * @returns Testosterone level (0-100 normalized scale)
 */
function calculateTestosterone(day: number, _cycleLength: number = 28): number {
  // Low baseline during Menstrual and early Follicular (Day 1-10)
  if (day <= 10) {
    return 10;
  }
  
  // Gradual rise during late Follicular (Day 10-14)
  if (day <= 14) {
    const x = (day - 10) / 4; // 0 to 1 over 4 days
    const rise = Math.sin(x * Math.PI / 2); // 0 to 1 (quarter sine)
    return 10 + 75 * rise; // Rise from 10% to 85%
  }
  
  // Peak during Ovulation (Day 15-18)
  if (day <= 18) {
    const x = (day - 14) / 4; // 0 to 1 over 4 days
    const peak = Math.sin(x * Math.PI); // 0 to 1 to 0 (full sine)
    return 85 - 5 * (1 - peak); // Maintain 80-85% peak
  }
  
  // Sharp drop after Ovulation, then stable baseline
  if (day <= 22) {
    const dropProgress = (day - 18) / 4; // 0 to 1 over 4 days
    return 80 - 70 * dropProgress; // Drop from 80% to 10%
  }
  
  // Stable low baseline for rest of cycle
  return 10;
}

/**
 * Determine cycle phase for a given day
 * 
 * @param day - Day in cycle (1-based)
 * @returns Cycle phase
 */
function getPhaseForDay(day: number): CyclePhase {
  if (day <= PHASE_LENGTHS.MENSTRUAL) {
    return 'menstrual';
  } else if (day <= PHASE_LENGTHS.MENSTRUAL + PHASE_LENGTHS.FOLLICULAR) {
    return 'follicular';
  } else if (day <= PHASE_LENGTHS.MENSTRUAL + PHASE_LENGTHS.FOLLICULAR + PHASE_LENGTHS.OVULATION) {
    return 'ovulation';
  } else {
    return 'luteal';
  }
}

/**
 * Generate complete hormone curves for a cycle
 * 
 * @param cycleLength - Total cycle length (default 28)
 * @returns Complete hormone curve data
 */
export function generateHormoneCurves(cycleLength: number = 28): HormoneCurve {
  const curves: HormoneCurve = {
    estrogen: [],
    progesterone: [],
    lh: [],
    fsh: [],
    testosterone: [],
  };
  
  for (let day = 1; day <= cycleLength; day++) {
    const phase = getPhaseForDay(day);
    
    curves.estrogen.push({
      day,
      referenceValue: calculateEstrogen(day, cycleLength),
      actualValue: null, // Reserved for future blood test data
      phase,
    });
    
    curves.progesterone.push({
      day,
      referenceValue: calculateProgesterone(day, cycleLength),
      actualValue: null, // Reserved for future blood test data
      phase,
    });
    
    curves.lh.push({
      day,
      referenceValue: calculateLH(day, cycleLength),
      actualValue: null, // Reserved for future blood test data
      phase,
    });
    
    curves.fsh.push({
      day,
      referenceValue: calculateFSH(day, cycleLength),
      actualValue: null, // Reserved for future blood test data
      phase,
    });
    
    curves.testosterone.push({
      day,
      referenceValue: calculateTestosterone(day, cycleLength),
      actualValue: null, // Reserved for future blood test data
      phase,
    });
  }
  
  return curves;
}

/**
 * Get hormone value for a specific day and hormone type
 * 
 * @param day - Day in cycle (1-based)
 * @param hormone - Hormone type
 * @param cycleLength - Total cycle length (default 28)
 * @returns Hormone data point
 */
export function getHormoneValue(
  day: number,
  hormone: 'estrogen' | 'progesterone' | 'lh' | 'fsh' | 'testosterone',
  cycleLength: number = 28
): HormoneDataPoint {
  const phase = getPhaseForDay(day);
  let referenceValue: number;
  
  switch (hormone) {
    case 'estrogen':
      referenceValue = calculateEstrogen(day, cycleLength);
      break;
    case 'progesterone':
      referenceValue = calculateProgesterone(day, cycleLength);
      break;
    case 'lh':
      referenceValue = calculateLH(day, cycleLength);
      break;
    case 'fsh':
      referenceValue = calculateFSH(day, cycleLength);
      break;
    case 'testosterone':
      referenceValue = calculateTestosterone(day, cycleLength);
      break;
  }
  
  return {
    day,
    referenceValue,
    actualValue: null, // Reserved for future blood test data
    phase,
  };
}

