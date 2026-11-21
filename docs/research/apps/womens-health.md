# Women's health: apps and tools

Cycle, fertility and menopause apps, with special attention to privacy, which is the biggest trust issue in this category.

## Contraception and fertility (regulated)

### Natural Cycles
- **Use:** Hormone-free contraception and conception planning from basal body temperature.
- **What it is:** Swedish-founded app (iOS/Android), paid subscription; reads temperature from a thermometer, Oura ring or Apple Watch and marks "green" (not fertile) and "red" days.
- **Standout features:** Daily fertility status; wearable temperature import; modes for preventing pregnancy, planning, and pregnancy follow-up.
- **Evidence / credibility:** First app cleared by the US FDA as birth control (De Novo, 2018), based on clinical data from 15,570 women. Later 510(k) clearances for Oura (2021) and Apple Watch temperature data (2023). Company quotes 93% effectiveness with typical use, 98% with perfect use. Not for people for whom pregnancy would be high-risk, and gives no STI protection.
- **Privacy notes:** Holds very sensitive reproductive data in the cloud; regulated as a medical device, so held to stricter quality rules than a wellness app.
- **Sources:** [FDA press announcement](https://www.fda.gov/NewsEvents/Newsroom/PressAnnouncements/ucm616511.htm), [STAT: FDA clears Natural Cycles](https://www.statnews.com/2018/08/10/fda-clears-natural-cycles-app/), [Tech.eu: Apple Watch clearance](https://tech.eu/2023/09/20/natural-cycles-fda-clearance-to-use-apple-watch-data/), [Engadget: wearables clearance](https://www.engadget.com/natural-cycles-fda-wearable-clearance-232422042.html)
- **What HealthHub could borrow:** Let the cycle tracker log basal temperature (manual or imported from wearables) and show a temperature chart with the post-ovulation shift. Label it clearly as "information, not contraception": HealthHub is not a cleared device.

## Period and cycle trackers

### Clue
- **Use:** Period, symptom and cycle tracking; modes for trying to conceive, pregnancy and perimenopause.
- **What it is:** Berlin-based app (iOS/Android), free core with a yearly subscription (about $40/year per Mozilla, 2022).
- **Standout features:** Cycle analysis and history, birth-control logging, reminders, home-screen widget, Apple Health sync, wearable connection, a dedicated perimenopause mode.
- **Evidence / credibility:** Wellness app, not a contraceptive device. Known for science-led educational content.
- **Privacy notes:** Under EU GDPR; says health data is never sold. Mozilla praised that it stores profile data separately from cycle data and lets consent be revisited per data use, but still rated it "somewhat creepy" in 2022. A 2022 Motherboard investigation found a data broker selling datasets identifying devices with Clue installed.
- **Sources:** [Mozilla Privacy Not Included: Clue](https://www.mozillafoundation.org/en/privacynotincluded/clue-period-cycle-tracker/), [Mozilla privacy review: Clue](https://www.mozillafoundation.org/en/nothing-personal/clue-period-tracker-app-privacy-review/), [App Store listing](https://apps.apple.com/app/clue/id657189652)
- **What HealthHub could borrow:** Separate consent toggles per data use (e.g. "share cycle with partner", "include in household dashboard", "include in doctor export"), and a perimenopause mode in the cycle tracker.

### Flo
- **Use:** Period, ovulation and pregnancy tracking.
- **What it is:** Very large consumer app (100M+ users reported), freemium.
- **Standout features:** Predictions, symptom logging, pregnancy mode, health content.
- **Evidence / credibility:** Wellness app, not regulated as contraception.
- **Privacy notes:** The cautionary tale of the category. The US FTC found Flo shared sensitive data, including pregnancy status sent as "app events", with Facebook and Google analytics despite privacy promises. The 2021 settlement required user notification, an independent privacy review and consent before sharing.
- **Sources:** [FTC press release](https://www.ftc.gov/news-events/news/press-releases/2021/01/developer-popular-womens-fertility-tracking-app-settles-ftc-allegations-it-misled-consumers-about), [TechCrunch](https://techcrunch.com/2021/01/13/flo-gets-ftc-slap-for-sharing-user-data-when-it-promised-privacy/), [MobiHealthNews](https://www.mobihealthnews.com/news/fertility-app-flo-health-settles-ftc-over-sensitive-data-sharing-complaint)
- **What HealthHub could borrow:** The lesson, not the features: no third-party analytics SDKs on health pages, and a plain-language "who sees this data" page.

### Stardust
- **Use:** Period tracking with social/astrology framing and friend sharing.
- **What it is:** US app, freemium.
- **Standout features:** Sharing cycle info with friends; moon-phase themed UI.
- **Evidence / credibility:** Wellness app.
- **Privacy notes:** Marketed "end-to-end encryption" after the Roe v. Wade reversal in 2022, but the founder told TechCrunch it used standard SSL plus AWS server-side encryption; the claim was removed. Mozilla's later review scored it lowest of six trackers (2/10) for third-party sharing.
- **Sources:** [TechCrunch](https://techcrunch.com/2022/06/27/stardust-period-tracker-phone-number), [Mozilla privacy review: Stardust](https://www.mozillafoundation.org/en/nothing-personal/stardust-privacy-review/), [All About Cookies report](https://allaboutcookies.org/stardust-shared-users-health-data)
- **What HealthHub could borrow:** Only make encryption claims that are literally true; if household sharing of cycle data is added, make it opt-in per person and per field.

### Euki
- **Use:** Private period and sexual/reproductive health tracking plus information.
- **What it is:** Open-source nonprofit app (spun off from Women Help Women in 2024), free.
- **Standout features:** No account required; health data stored only on the device.
- **Evidence / credibility:** Information app; not a medical device.
- **Privacy notes:** The only perfect score in Mozilla's test of six period trackers: core features sent no health data off the device.
- **Sources:** [Mozilla privacy review: Euki](https://www.mozillafoundation.org/en/nothing-personal/euki-privacy-review/), [CyberInsider summary](https://cyberinsider.com/mozilla-study-ranks-euki-as-the-most-private-period-tracker/)
- **What HealthHub could borrow:** An "on this device only" option for the most sensitive logs (cycle, sexual health), kept out of server sync and household views.

### drip.
- **Use:** Period tracking or full symptothermal fertility awareness.
- **What it is:** Open-source (GPL-3.0) app by the Bloody Health collective; free on iOS, Google Play and F-Droid.
- **Standout features:** Transparent calculations you can follow yourself; gender-inclusive design; password protection; import/export; cycle and period-length graphs.
- **Evidence / credibility:** Not a regulated device; symptothermal rules are shown openly rather than as a black box.
- **Privacy notes:** "Everything you enter stays on your device"; App Store label shows no data collected; no ads.
- **Sources:** [drip website](https://dripapp.org/), [F-Droid listing](https://f-droid.org/ru/packages/com.drip/index.html), [App Store listing](https://apps.apple.com/app/id1584564949), [Tuta roundup of private period apps](https://tuta.com/blog/best-period-apps)
- **What HealthHub could borrow:** Show "why we predicted this" next to every cycle prediction (which cycles and rules were used), and use gender-neutral wording in the cycle feature.

### Glow
- **Use:** Fertility, period and pregnancy tracking with partner sharing.
- **What it is:** US app family (Glow, Eve, Nurture, Baby), freemium.
- **Standout features:** "Partner Connect" linking two accounts to share data.
- **Evidence / credibility:** Wellness app.
- **Privacy notes:** California Attorney General settlement in 2020 ($250,000) over security flaws in Partner Connect that let others access data and change passwords without consent; required privacy-by-design. No known breach.
- **Sources:** [WilmerHale summary](https://www.wilmerhale.com/en/insights/blogs/wilmerhale-privacy-and-cybersecurity-law/20200929-california-settles-with-glow-app-over-alleged-privacy-and-security-violations), [Consumer Reports statement](https://advocacy.consumerreports.org/press_release/consumer-reports-applauds-californias-settlement-against-glow-for-privacy-violations-that-risked-exposing-womens-sensitive-health-data), [IAPP](https://iapp.org/news/a/calif-attorney-general-reaches-250k-settlement-with-fertility-tracking-app/)
- **What HealthHub could borrow:** Directly relevant to household "spaces": partner/family sharing must require confirmation from the data owner, be revocable, and never let a linked account change the owner's credentials.

## Menopause

### Balance (Dr Louise Newson)
- **Use:** Perimenopause and menopause symptom tracking and education.
- **What it is:** UK app (iOS/Android), free with optional Balance+ subscription (live Q&As, expert content).
- **Standout features:** Nightly symptom-tracker reminder; pattern spotting; downloadable health report to bring to appointments; community feed.
- **Evidence / credibility:** ORCHA-reviewed; Apple Editors' Choice. Content is evidence-based per the developer; not a medical device.
- **Privacy notes:** App Store label lists usage and diagnostics data not linked to identity.
- **Sources:** [App Store listing](https://apps.apple.com/app/id1503345959), [Marie Claire feature](https://marieclaire.co.uk/life/health-fitness/this-womens-health-app-is-democratising-access-to-menopause-specialists-771354), [Prolific North on launch](https://www.prolificnorth.co.uk/news/magneticnorth-creates-menopause-app/)
- **What HealthHub could borrow:** A menopause symptom checklist (hot flushes, sleep, mood, joint pain) inside the cycle tracker with a one-tap "appointment report" PDF.
