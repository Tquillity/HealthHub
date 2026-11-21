# Sleep: apps and tools

Phone-based sleep trackers, coaching apps and wearables, and what HealthHub could take from them without needing hardware.

## Phone-based trackers

### Sleep Cycle (Swedish)
- **Use:** Sleep tracking and gentle waking.
- **What it is:** App by Sleep Cycle AB, Stockholm (iOS/Android), freemium with Premium.
- **Standout features:** Smart alarm that wakes you in a light-sleep phase; uses sound analysis or accelerometer, no wearable; detects snoring, coughing and sleep talking (Premium); sleep sounds; AI sleep coach.
- **Evidence / credibility:** Wellness app; reviewers report it can pick up a partner's cough.
- **Privacy notes:** Records audio in the bedroom; check settings.
- **Sources:** [App Store listing](https://apps.apple.com/app/id320606217)
- **What HealthHub could borrow:** A "wake window" alarm idea is out of scope for a web app, but a simple bedtime routine plus morning "how did you sleep" check-in with snoring/cough tags is easy.

### SleepScore
- **Use:** Contactless sleep tracking.
- **What it is:** Free app from a ResMed joint venture; uses the phone speaker as sonar.
- **Standout features:** 0-100 nightly SleepScore (average 78), goal setting, personalised tips.
- **Evidence / credibility:** Algorithms developed by ResMed and validated against polysomnography per the company.
- **Privacy notes:** Uses microphone and speaker continuously overnight.
- **Sources:** [MobiHealthNews](https://www.mobihealthnews.com/news/sleepscores-new-app-monitors-sleep-quality-using-soundwaves), [Sleep Review](https://sleepreviewmag.com/sleep-diagnostics/consumer-sleep-tracking/contactless-sleep-trackers/resmed-joint-venture-launches-smartphone-app-uses-sonar-track-users-sleep-2/), [App Store listing](https://apps.apple.com/us/app/sleepscore/id1364781299?uo=4)
- **What HealthHub could borrow:** A single 0-100 nightly score shown next to population average, built from imported sleep duration plus self-rating.

## Coaching

### Rise
- **Use:** Energy and sleep-debt management.
- **What it is:** Subscription app (iOS/Android), roughly $36-70/year depending on region.
- **Standout features:** Sleep debt estimate; daily energy schedule with predicted peaks and dips based on circadian rhythm; 16 timed habit nudges (caffeine cut-off, light exposure, wind-down).
- **Evidence / credibility:** Built on two well-established concepts (sleep debt, circadian rhythm); the app's personalisation is not independently validated and some users find schedules inaccurate.
- **Privacy notes:** No incidents found.
- **Sources:** [App Store listing](https://apps.apple.com/app/id1453884781), [Rise Science](https://www.risescience.com/fb)
- **What HealthHub could borrow:** Running "sleep debt" over the last 14 nights and timed reminders in routines (e.g. "last coffee by 14:00", "screens off at 22:00").

## Wearables

### Oura Ring
- **Use:** Sleep, readiness and temperature tracking from a ring.
- **What it is:** Finnish smart ring, hardware purchase plus monthly membership.
- **Standout features:** Sleep stages, readiness score, temperature trends (used by Natural Cycles).
- **Evidence / credibility:** A 2024 Brigham and Women's study (Oura-funded, independently run) found Oura had the best four-stage agreement with polysomnography among Oura, Fitbit and Apple Watch; an adolescent study found staging needed improvement. The readiness score itself is not validated.
- **Privacy notes:** Cloud-based; very sensitive biometric data.
- **Sources:** [Oura blog on 2024 Sensors study](https://ouraring.com/blog/sv/2024-sensors-oura-ring-validation-study/), [Adolescent PSG validation (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC7894804), [ClinicalTrials.gov validation trial](https://clinicaltrials.gov/study/NCT07908199)
- **What HealthHub could borrow:** Import sleep and temperature through Apple Health / Health Connect rather than building device integrations; treat composite "readiness" scores as soft guidance.

### WHOOP
- **Use:** Recovery, strain and sleep coaching.
- **What it is:** Screenless strap sold by subscription.
- **Standout features:** Daily Recovery and Strain scores; Journal that lets users tag behaviours (alcohol, late meals) and see their effect on recovery.
- **Evidence / credibility:** Received an FDA warning letter (July 2025) because its Blood Pressure Insights feature was marketed without clearance; FDA said BP estimation is not low-risk and falls outside the general-wellness policy. A follow-up FDA letter is dated June 2026.
- **Privacy notes:** Cloud-based.
- **Sources:** [FDA warning letter](https://www.fda.gov/inspections-compliance-enforcement-and-criminal-investigations/warning-letters/whoop-inc-709755-07142025), [MobiHealthNews](https://www.mobihealthnews.com/news/whoop-receives-warning-letter-fda-blood-pressure-insights), [Arnold & Porter analysis](https://www.arnoldporter.com/en/perspectives/advisories/2025/09/fda-warning-letter-to-fitness-wearable-sponsor)
- **What HealthHub could borrow:** The behaviour-tag Journal pattern (yes/no tags each evening, effect on next-day sleep/mood). Also a regulatory boundary: never estimate or diagnose vitals like blood pressure; only display user-entered or device-measured values.
