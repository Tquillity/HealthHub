# Recovery Score

A daily 0-100 wellness indicator that combines heart rate variability (HRV), resting
heart rate (RHR) and sleep, compared with your own usual values for the same cycle
phase. Code: `src/lib/recovery.ts` (pure functions) and `src/lib/cycle-insights.ts`
(phases and chart data). Tests: `src/lib/recovery.test.ts`.

It is not a medical measure. It does not diagnose illness, overtraining or hormonal
problems. It only says how today compares with your own recent pattern, so the copy in
the app stays non-medical ("take it steady", "consider an easier day").

## Inputs

One reading per day, logged on the dashboard Vitals card (manual entry; designed so a
wearable import can write the same journal fields later):

| Field | Unit | Accepted range | Stored on |
|-------|------|----------------|-----------|
| Resting heart rate | bpm | 25-150 | `JournalEntry.restingHeartRate` |
| HRV (RMSSD) | ms | 5-300 | `JournalEntry.heartRateVariability` |
| Sleep quality | 1-10 | 1-10 | `JournalEntry.sleepQuality` |
| Sleep hours | hours | journal form | `JournalEntry.sleepHours` (existing) |

Take RHR and HRV right after waking, before getting up, at about the same time each day.
Morning readings are the standard for day-to-day comparison (Plews et al. 2013), and one
consistent time of day is the simplest time-of-day normalisation.

Vitals are opt-in (`User.trackVitals`, profile page). Without it, no vitals are saved
and no recovery data is computed or sent to the browser.

## Phase of each day

Each day gets its cycle phase from the logged period starts (`src/lib/cycle-history.ts`):
completed cycles use their real length, the current cycle uses the user's typical length,
and the phase boundaries are the app's shared wellness model
(`getPhaseForDay` in `src/lib/cycle-calculator.ts`). Without cycle tracking every day has
no phase and only the overall baseline is used.

## Baselines

For every day, the baseline is built from the **previous 90 days** (the day itself is
never part of its own baseline):

1. readings from the **same phase**, if there are at least 3;
2. otherwise **all readings** in those 90 days, if there are at least 3;
3. otherwise that component is unavailable for the day.

Why phase-specific: vagally mediated HRV is typically lower and RHR a few bpm higher in
the luteal phase than in the follicular phase (Schmalenberger et al. 2019; Goodale et al.
2019). Comparing a luteal day with an all-cycle average would mark a normal luteal day as
poor recovery.

## Component scores

Each component is turned into a z-score against its baseline, then mapped linearly:

```
score = clamp(75 + 25 · z, 0, 100)
```

A day at your usual level scores 75 (green). One SD worse gives 50 (yellow); about
1.6 SD worse reaches red.

| Component | z | SD floor |
|-----------|---|----------|
| HRV | `(ln(HRV) − mean ln HRV) / SD` (higher is better) | 0.10 ln units (≈10%) |
| RHR | `(mean RHR − RHR) / SD` (lower is better) | 2 bpm |
| Sleep | not baseline-relative, see below | – |

HRV is compared on the log scale, the usual practice for RMSSD (Plews et al. 2013). The
SD floors stop a short or very steady history from turning tiny changes into huge
z-scores; they sit at the low end of typical day-to-day variation (Plews et al. 2013;
Buchheit 2014).

**Sleep** uses absolute scales: quality 1-10 maps to 0-100 (`(q − 1) / 9 · 100`), and
sleep hours map from 0 points at 4 h to full points at 7 h or more, the adult
recommendation (Watson et al. 2015). When both are known, the sleep score is their
average.

## Combining

| Component | Weight |
|-----------|--------|
| HRV | 0.4 |
| RHR | 0.3 |
| Sleep | 0.3 |

Missing components are left out and the remaining weights are re-normalised, so a day
with only sleep data still gets a (sleep-based) score. The UI lists which components
were used. With no usable component the score is `null` and nothing is shown.

HRV carries the most weight because it is the most responsive of the three to recovery
and strain (Plews et al. 2013; Buchheit 2014). Self-reported measures respond to strain
at least as well as objective ones (Saw et al. 2016), so sleep gets a real weight too.

## Zones

| Zone | Score |
|------|-------|
| Green | 67-100 |
| Yellow | 34-66 |
| Red | 0-33 |

Equal thirds of the scale (`RECOVERY_ZONE_THRESHOLDS`).

## Alerts

Each day's score is compared with your **usual score for that phase**: the mean of your
recovery scores in the same phase over the previous 90 days (at least 3 scores; else all
phases, at least 3; else no comparison and no alert).

An alert is raised when the score is **at least 15 points below** that usual score **and
more than one standard deviation below** it. Requiring both keeps alerts meaningful:
for someone whose scores swing a lot, a 15-point dip can be an ordinary day; for someone
very steady, a dip just over 1 SD can be only a few points. The dashboard shows the alert
with gentle, non-medical advice; the cycle chart marks those days.

## Chart (cycle page, Clinical mode)

- Recovery line on its own 0-100 axis, with each day's dot coloured by zone.
- Dotted lines at 34 and 67 mark the zone boundaries.
- For each phase, a dashed line in the phase colour shows your usual recovery score in
  that phase over the last 90 days (needs 3 scores in that phase).
- Days with an alert get a red triangle marker; the tooltip shows RHR, HRV, sleep, the
  score and how far below usual it is. A text summary below the chart lists the dips for
  screen readers.

## Privacy

- Vitals are plain numbers (like mood and energy), never shared with household members,
  included in "Download my data", and removed with the account.
- Profile → "Vitals and temperature": turn tracking off (hides everything, keeps data)
  or "Delete all vitals data" (clears RHR, HRV and sleep quality on every journal day).

## Constants

All in `src/lib/recovery.ts`: `RECOVERY_BASELINE_WINDOW_DAYS` (90),
`MIN_BASELINE_READINGS` (3), `RECOVERY_WEIGHTS`, `SCORE_AT_BASELINE` (75),
`POINTS_PER_SD` (25), `HRV_LN_SD_FLOOR` (0.10), `RHR_SD_FLOOR_BPM` (2),
`SLEEP_HOURS_FOR_ZERO` (4), `SLEEP_HOURS_FOR_FULL` (7), `RECOVERY_ZONE_THRESHOLDS`
(67 / 34), `ALERT_MIN_DROP_POINTS` (15).

## References

- Plews DJ, Laursen PB, Stanley J, Kilding AE, Buchheit M. Training adaptation and heart
  rate variability in elite endurance athletes: opening the door to effective
  monitoring. Sports Med. 2013;43(9):773-781.
- Buchheit M. Monitoring training status with HR measures: do all roads lead to Rome?
  Front Physiol. 2014;5:73.
- Saw AE, Main LC, Gastin PB. Monitoring the athlete training response: subjective
  self-reported measures trump commonly used objective measures: a systematic review.
  Br J Sports Med. 2016;50(5):281-291.
- Schmalenberger KM, Eisenlohr-Moul TA, Würth L, et al. A systematic review and
  meta-analysis of within-person changes in cardiac vagal activity across the menstrual
  cycle. J Clin Med. 2019;8(11):1946.
- Goodale BM, Shilaih M, Falco L, et al. Wearable sensors reveal menses-driven changes
  in physiology and enable prediction of the fertile window: observational study.
  J Med Internet Res. 2019;21(4):e13404.
- Watson NF, Badr MS, Belenky G, et al. Recommended amount of sleep for a healthy adult:
  a joint consensus statement of the American Academy of Sleep Medicine and Sleep
  Research Society. Sleep. 2015;38(6):843-844.
- Nunan D, Sandercock GR, Brodie DA. A quantitative systematic review of normal values
  for short-term heart rate variability in healthy adults. Pacing Clin Electrophysiol.
  2010;33(11):1407-1417 (RMSSD range used for input validation).
