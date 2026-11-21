# General: all-in-one, family, chronic illness, medication and habit apps

Cross-cutting health apps and the UX patterns they share, ending with a ranked list of feature ideas for HealthHub.

## Health data platforms

### Apple Health
- **Use:** Central health data store on iPhone/Apple Watch.
- **What it is:** Built into iOS, free.
- **Standout features:** Health Sharing with up to 5 people (choose categories, stop anytime); Health Records downloaded from participating providers (allergies, meds, immunisations), with per-category consent for third-party apps; Medical ID readable from the lock screen by first responders.
- **Evidence / credibility:** Platform, not a medical device (some Watch features are cleared separately).
- **Privacy notes:** Health data encrypted on device; apps get access per data type.
- **Sources:** [Apple: share and view health data](https://support.apple.com/HT212629), [Apple: Health app and privacy](https://apple.com/legal/privacy/data/en/health-app)
- **What HealthHub could borrow:** Per-category sharing inside household spaces (share "steps and sleep" but not "cycle"), and an emergency card per family member (allergies, meds, conditions, contacts) printable or shown on a lock-screen-style page.

### Google Health Connect (and Google Fit)
- **Use:** Android's on-device health data hub (successor for app-to-app sharing).
- **What it is:** Part of Android 14+, app on older Android; free.
- **Standout features:** Per-data-type read/write permissions; separate permissions for background and historical reads; users can set which source wins when apps overlap; delete data.
- **Evidence / credibility:** Platform.
- **Privacy notes:** Data stored on-device and encrypted; device-centric, not account-centric.
- **Sources:** [Health Connect data types](https://developer.android.com/health-and-fitness/health-connect/data-types), [Get started with Health Connect](https://developer.android.com/guide/health-and-fitness/health-connect/get-started)
- **What HealthHub could borrow:** As a web/PWA app HealthHub cannot read these directly; a lightweight path is importing Apple Health XML export / Health Connect CSV exports, or a small companion app later. Copy the "source priority" setting for overlapping data.

### Samsung Health
- **Use:** Galaxy phone/watch health app.
- **What it is:** Free.
- **Standout features:** Family sharing ("Connected Care") of selected metrics after account linking and consent; preview what will be shared; guardians consent for children; shared data removed after long inactivity (reported 90 days); AI meal scanning (US beta).
- **Evidence / credibility:** Some watch features (ECG, irregular rhythm) are regulated separately.
- **Privacy notes:** Granular consent, revocable at any time.
- **Sources:** [Android Authority APK teardown](https://androidauthority.com/samsung-galaxy-watch-family-health-tracking-apk-teardown-3455990), [Samsung newsroom](https://news.samsung.com/global/samsung-introduces-next-gen-galaxy-watch-features-for-ai-powered-everyday-health-companion)
- **What HealthHub could borrow:** "Preview what they'll see" before sharing with a household member, and auto-expiry of shares.

## Personal analytics and correlation apps

### Bearable
- **Use:** Symptom, mood and habit tracking for chronic illness and mental health.
- **What it is:** iOS/Android, free with optional paid features.
- **Standout features:** Track anything (symptoms, meds, habits, food, weather); automatic correlations between symptoms and sleep, food, stress, meds; suggests what to log next; Apple Health sync; export.
- **Evidence / credibility:** Says insights are not medical advice; correlation, not causation.
- **Privacy notes:** Encrypted storage claimed; check policy.
- **Sources:** [App Store listing](https://apps.apple.com/app/bearable/id1482581097), [Google Play listing](https://play.google.com/store/apps/details?id=com.bearable), [AlternativeTo](https://alternativeto.net/software/bearable/about)
- **What HealthHub could borrow:** The flagship idea: correlation insights across HealthHub's existing data ("on days you slept <6 h your mood averaged 2.1 vs 3.4", "headaches 3x more common in luteal phase").

### Exist.io
- **Use:** Personal analytics across connected services.
- **What it is:** Web + iOS/Android subscription (historically about $6.99/month).
- **Standout features:** Nightly 1-5 day rating by notification or email reply; custom tags (coffee, meds); correlation and "what affects your mood most" pages.
- **Evidence / credibility:** Statistical correlations only.
- **Privacy notes:** Small independent company.
- **Sources:** [Exist: mood tracking](https://exist.io/about/mood/), [Exist: custom tags](https://exist.io/about/custom-tags/), [Brett Terpstra on custom tracking](https://brettterpstra.com/2017/08/02/quantify-everything-with-exist-dot-io-custom-tracking/)
- **What HealthHub could borrow:** End-of-day "rate your day" prompt with tags, and a plain-language insights page ranked by effect size.

### Gyroscope
- **Use:** "Health OS" dashboard combining many data sources.
- **What it is:** iOS subscription.
- **Standout features:** Health Camera (meal photo to macros), Health Score, optional human or AI coach, Labs for habit experiments, polished visualisations.
- **Evidence / credibility:** None claimed; reviews mention bugs and cost.
- **Privacy notes:** Aggregates many sources in the cloud.
- **Sources:** [App Store listing](https://apps.apple.com/us/app/gyroscope/id1104085053), [AppAdvice](https://appadvice.com/post/gyroscope-health-will-revamp-your-lifes-operating-system/1104085053/1982115323)
- **What HealthHub could borrow:** "Experiments": pick a habit change for 2 weeks (no caffeine after noon) and compare before/after on sleep and mood.

### Welltory
- **Use:** HRV-based stress and energy measurement.
- **What it is:** iOS/Android, free with Premium.
- **Standout features:** HRV from phone camera or wearables; stress/energy scores; trigger analysis; symptom and migraine journaling.
- **Evidence / credibility:** HRV is a real physiological signal; camera HRV accuracy and the scores are not clinically validated.
- **Privacy notes:** Cloud account.
- **Sources:** [Welltory help: app overview](https://help.welltory.com/en/articles/3352351-overview-of-the-welltory-app), [TechCrunch](https://techcrunch.com/?p=1524928)
- **What HealthHub could borrow:** Morning check-in that can include an optional resting heart rate / HRV value from a wearable.

## Records, chronic illness and caregiving

### Guava
- **Use:** Medical records plus symptom tracking for the whole family.
- **What it is:** iOS/Android/web, free tier with paid plan.
- **Standout features:** Connects to US patient portals; upload documents and AI extracts data; body heat map for symptoms (location, severity, time); family profiles and invites to manage kids' and parents' health.
- **Evidence / credibility:** Organisation tool, not a device.
- **Privacy notes:** Holds full medical records; review policy.
- **Sources:** [Guava Health](https://guavahealth.com/), [Guava: tracking and visualizing symptoms](https://guavahealth.com/article/tracking-and-visualizing-symptoms-in-guava), [Guava plans](https://guavahealth.com/plans)
- **What HealthHub could borrow:** Body-map symptom logging (tap where it hurts) and a document vault per family member (vaccination cards, lab PDFs, discharge notes).

### CareClinic
- **Use:** Medication, symptom and vitals tracking with caregiver features.
- **What it is:** iOS/Android/web, free core with paid tier.
- **Standout features:** Separate profiles for parents, children and spouse, each with own med schedule and logs; share records with siblings and carers; PDF reports with medication history, symptom trends and vital charts.
- **Evidence / credibility:** Consumer tool.
- **Privacy notes:** Cloud sharing; check policy.
- **Sources:** [CareClinic caregiver app](https://careclinic.io/caregiver-app), [CareClinic features](https://careclinic.io/features)
- **What HealthHub could borrow:** Caregiver role in household spaces (can log for, but not necessarily see everything of, another member).

### Visible
- **Use:** Energy pacing for Long Covid, ME/CFS and POTS.
- **What it is:** Free app with daily morning HR/HRV check-in via phone camera; paid tier adds a Polar armband for real-time pacing alerts.
- **Standout features:** Morning check-in plus symptom ratings produce a 1-5 "stability score"; alerts when heart rate suggests overexertion.
- **Evidence / credibility:** One 2025 self-report survey (Frontiers in Digital Health) with no comparison group; no trials.
- **Privacy notes:** Cloud account.
- **Sources:** [App Store listing](https://apps.apple.com/app/id1624474919), [Health Rising review](https://www.healthrising.org/blog/2022/11/19/visible-app-long-covid-chronic-fatigue-syndrome/), [Frontiers survey (PDF)](https://www.frontiersin.org/journals/digital-health/articles/10.3389/fdgth.2025.1662255/pdf)
- **What HealthHub could borrow:** A daily "energy budget" check-in for anyone recovering from illness, feeding suggested routine intensity.

### Mymee
- **Use:** Trigger finding for autoimmune conditions and Long Covid.
- **What it is:** Free app plus paid human health coaching program.
- **Standout features:** Personalised symptom and trigger tracking, data visualisation, weekly coaching; works alongside the user's doctors.
- **Evidence / credibility:** Retrospective study in RMD Open reported quality-of-life gains; weaker than an RCT.
- **Privacy notes:** Coach sees your data.
- **Sources:** [App Store listing](https://apps.apple.com/us/app/mymee-inc/id1261068992), [Autoimmune Institute article](https://www.autoimmuneinstitute.org/covid_timeline/caring-for-autoimmunity-long-covid-with-a-personalized-approach/)
- **What HealthHub could borrow:** "Share a read-only view with my coach/dietitian" link with expiry.

## Medication

### Medisafe
- **Use:** Medication reminders and adherence.
- **What it is:** iOS/Android, freemium; now also a pharma engagement platform.
- **Standout features:** Reliable dose reminders; drug-drug interaction warnings (US); Medfriend: a family member is notified if you miss a dose.
- **Evidence / credibility:** Company reports adherence gains (e.g. 17% increase) from its programmes.
- **Privacy notes:** Business model involves pharma partners; review data sharing.
- **Sources:** [App Store listing](https://apps.apple.com/app/id573916946), [GoodRx review of reminder apps](https://www.goodrx.com/healthcare-access/digital-health/medication-reminder-apps), [Medisafe](https://www.medisafe.com/)
- **What HealthHub could borrow:** Medfriend-style escalation in household spaces: if Grandma's 08:00 dose is not ticked by 09:00, notify a chosen family member.

### MyTherapy
- **Use:** Medication, supplement and measurement reminders.
- **What it is:** Free app by smartpatient GmbH, Munich; optional ad-free/Plus purchase.
- **Standout features:** Pill and supplement reminders; refill and new-prescription reminders; measurements and symptoms in a patient diary; monthly overview for doctor visits.
- **Evidence / credibility:** ISO 13485 and ISO 27001 certifications claimed.
- **Privacy notes:** EU/GDPR company.
- **Sources:** [App Store listing (DE)](https://apps.apple.com/de/app/mytherapy-medication-reminder/id662170995?l=en-GB)
- **What HealthHub could borrow:** Refill countdown (pills left) and a monthly one-page summary.

## Habits and routines

### Streaks
- **Use:** Habit tracking on Apple devices.
- **What it is:** One-time purchase, no subscription or ads; iPhone, iPad, Watch, Mac.
- **Standout features:** Up to 24 tasks; tasks auto-complete from Apple Health data (steps, water, daylight, mindful minutes); "negative" habits to break.
- **Evidence / credibility:** Consumer tool.
- **Privacy notes:** iCloud sync.
- **Sources:** [Streaks](https://streaks.app/)
- **What HealthHub could borrow:** Routines that auto-tick from data HealthHub already has (e.g. "log water" ticks when 2 L is logged) and "avoid" habits.

### Habitica
- **Use:** Gamified habit tracking.
- **What it is:** Open-source web/mobile app, free with optional subscription.
- **Standout features:** RPG mechanics; habits, dailies and to-dos; parties that hold each other accountable.
- **Evidence / credibility:** Consumer tool.
- **Privacy notes:** Open source.
- **Sources:** [Habitica features](https://habitica.com/static/features)
- **What HealthHub could borrow:** Household "party" challenges (family step goal, veggie week) with shared progress.

### Fabulous
- **Use:** Morning/afternoon/evening routine building.
- **What it is:** Subscription app; began in Duke University's behavioural economics lab (Dan Ariely).
- **Standout features:** Guided routines; personalised path from onboarding; short coaching sessions; live coaching.
- **Evidence / credibility:** Behavioural-science design; no trial data captured.
- **Privacy notes:** Account-based.
- **Sources:** [Fabulous](https://www.thefabulous.co/)
- **What HealthHub could borrow:** Starter routine templates (morning, wind-down) that unlock gradually, one habit at a time.

## Remedies and herbs

### HerbList (NIH NCCIH)
- **Use:** Evidence summaries for herbs and supplements.
- **What it is:** Free app from the US National Center for Complementary and Integrative Health.
- **Standout features:** 50+ popular herbs (chamomile, ginger, turmeric...); what research says on effectiveness; safety, side effects and herb-drug interactions; favourites to discuss with a doctor; works offline.
- **Evidence / credibility:** Government, evidence-graded content.
- **Privacy notes:** No account.
- **Sources:** [NCCIH: HerbList app](https://www.nccih.nih.gov/health/herblist-app)
- **What HealthHub could borrow:** A remedy library where each home remedy shows an evidence level and interaction warnings, cross-checked against the member's medication list. Research gap: Ayurveda/TCM and home-remedy apps could not be sourced before the search budget ran out.

## Common UX patterns seen across apps

- **Correlation insights:** Bearable, Exist, Daylio, WHOOP Journal. Automatic "X goes with Y" findings from everyday logs.
- **Two-tap logging:** Daylio icons, How We Feel grid, Exist email reply. Low effort keeps people logging.
- **Gentle streaks:** Finch and Streaks reward consistency without shaming missed days; MacroFactor tolerates missing data.
- **Timed nudges:** Rise habit timing, Balance nightly reminder, MyTherapy refills.
- **Body map / heatmaps:** Guava body heat map, Migraine Buddy pain location, calendar heatmaps of symptoms.
- **Doctor-visit reports:** Balance, Migraine Buddy, CareClinic, MyTherapy. A PDF summary is a top-valued feature.
- **Privacy-first local storage:** drip, Euki, openScale, Daylio keep data on device; Flo, Glow and Stardust show the cost of getting it wrong.
- **Household sharing with consent:** Apple Health sharing, Samsung Connected Care, Medisafe Medfriend, Nightscout followers, baby trackers' shared logs, 1177's under-13 parent access.
- **Transparent predictions:** drip shows its rules; Huckleberry explains wake windows.

## Top 15 feature ideas for HealthHub

1. **Correlation insights** across journal, sleep, cycle, meals and routines ("you report headaches 3x more in the days before your period"). Inspired by Bearable, Exist.
2. **Doctor-visit report**: one-click PDF per member with symptoms, meds, vitals trends and cycle summary for a chosen period. Balance, Migraine Buddy, CareClinic.
3. **Per-category consent for household sharing** with a "preview what they'll see" step and revocable/expiring shares. Apple Health, Samsung, Clue, lessons from Glow.
4. **Medication tracker with family escalation**: reminders, refill countdown, and notify a chosen household member on missed doses. Medisafe, MyTherapy.
5. **Two-tap mood + activity journal entry** using an energy x pleasantness mood grid and activity icons. Daylio, How We Feel.
6. **Lab results tracker**: manual entry or PDF upload of Werlabs/1177 results, trend per marker with reference range, grouped by body system. Werlabs, Function, Superpower.
7. **Body-map symptom logging** with a calendar heatmap. Guava, Migraine Buddy.
8. **Emergency card per member** (allergies, meds, conditions, contacts, blood type) printable and viewable offline. Apple Medical ID.
9. **Sensitive-data "device only" mode** for cycle/sexual-health logs and a plain "who sees this" privacy page; no third-party analytics on health pages. Euki, drip, Flo lesson.
10. **Food-symptom diary linked to recipes and meal plans**, with an optional guided elimination/reintroduction routine. Cara Care, Bearable.
11. **Remedy library with evidence levels and interaction checks** against each member's medications. HerbList.
12. **Habit experiments**: 2-week before/after test of one change on sleep or mood. Gyroscope Labs, Exist.
13. **Routines that auto-complete from logged data** plus gentle, non-shaming streaks and household challenges. Streaks, Finch, Habitica.
14. **Child profiles and caregiver handover view** (nap/feed/fever logs, "since you last looked"), with parent control until a set age. Huckleberry, Pebbi, 1177.
15. **Health data import** (Apple Health export, Health Connect, CSV) for sleep, steps, weight and temperature, plus micronutrient totals for meal plans. Health Connect, openScale, Cronometer.
