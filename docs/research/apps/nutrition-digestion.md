# Nutrition and digestion: apps and tools

Food logging, meal planning, recipe managers and gut-health apps that overlap with HealthHub's recipes, meal planner and groceries features.

## Calorie and nutrient tracking

### MyFitnessPal
- **Use:** Calorie and macro logging.
- **What it is:** Largest consumer food logger (iOS/Android/web), freemium with Premium.
- **Standout features:** Huge crowd-sourced food database, barcode scanning, many device integrations.
- **Evidence / credibility:** Wellness app; crowd-sourced entries vary in accuracy.
- **Privacy notes:** 2018 breach exposed about 150 million accounts (usernames, emails, hashed passwords); Have I Been Pwned lists 143.6 million and notes the data was sold on the dark web in 2019.
- **Sources:** [Engadget on breach](https://www.engadget.com/2018/03/29/under-armour-data-breach-affects-150-million-myfitnesspal-users/), [Have I Been Pwned](https://haveibeenpwned.com/breach/MyFitnessPal), [Infosecurity Magazine](https://www.infosecurity-magazine.com/news/underarmours-myfitnesspal-150m/)
- **What HealthHub could borrow:** Barcode scan for groceries/pantry items; also a reminder that a big centralised account database is a target, so keep password hashing and breach response in place.

### Cronometer
- **Use:** Detailed micronutrient tracking.
- **What it is:** Canadian app (iOS/Android/web), free with Gold subscription; Cronometer Pro for dietitians.
- **Standout features:** Tracks up to 84 nutrients (vitamins, minerals, amino acids, fatty acids); verified (not crowd-sourced) database of 1.1M+ foods; custom recipes.
- **Evidence / credibility:** Uses curated lab databases; used professionally by dietitians.
- **Privacy notes:** No major incidents found.
- **Sources:** [Cronometer features](https://cronometer.com/features), [Cronometer Gold](https://cronometer.com/gold), [calorie-trackers.com review](https://www.calorie-trackers.com/reviews/cronometer/)
- **What HealthHub could borrow:** Compute micronutrient totals for HealthHub recipes and meal plans (iron, B12, vitamin D, fibre) and show "gaps this week" on the dashboard.

### Lifesum (Swedish)
- **Use:** Diet tracking with food quality scoring.
- **What it is:** Stockholm-founded app (Lifesum AB), freemium.
- **Standout features:** Life Score: weekly 0-150 score from 16 nutrition and exercise metrics, updated each Monday. Food ratings per 100 kcal based on macros, sugar, fibre, sodium and calorie density. Diet programs including Scandinavian and Mediterranean.
- **Evidence / credibility:** Defaults follow WHO recommendations with inspiration from the NRF9.3 nutrient-density index.
- **Privacy notes:** EU company under GDPR.
- **Sources:** [Lifesum help: Life Score and meal ratings](https://help.lifesum.com/en/article/food-rating-1afp5ga/), [App Store listing](https://apps.apple.com/us/app/-/id286906691)
- **What HealthHub could borrow:** A simple weekly "food quality" score for planned meals and a Nordic/Mediterranean pattern filter in recipes. Note Lifesum users cannot turn food ratings off; HealthHub should make scores optional (eating-disorder sensitivity).

### Yazio
- **Use:** Calorie counting and intermittent fasting.
- **What it is:** German app, freemium with Pro.
- **Standout features:** Optional fasting timer (16:8, 5:2 and more) linked to calorie plans; meal-timing reminders; fasting "stage" explanations.
- **Evidence / credibility:** Wellness app.
- **Privacy notes:** No major incidents found.
- **Sources:** [App Store listing](https://apps.apple.com/app/id946099227)
- **What HealthHub could borrow:** A fasting/eating-window timer could reuse HealthHub's existing PomoZen timer infrastructure.

### Lose It!
- **Use:** Weight-loss calorie tracking.
- **What it is:** US app, freemium with Premium.
- **Standout features:** Snap It photo logging (launched 2016 as a neural-network beta, now premium), AI voice logging, barcode scanner.
- **Evidence / credibility:** Wellness app; Snap It accuracy figures were on a benchmark dataset, not real meals.
- **Privacy notes:** No major incidents found.
- **Sources:** [TechCrunch: Snap It launch](https://techcrunch.com/2016/09/29/lose-it-launches-snap-it-to-let-users-count-calories-in-food-photos/?ncid=rss), [MobiHealthNews](https://www.mobihealthnews.com/news/lose-it-now-lets-users-log-foods-their-phones-camera-and-machine-learning-algorithm), [App Store listing](https://apps.apple.com/app/id297368629)
- **What HealthHub could borrow:** Photo journal for meals (photo first, details optional) linked to the journal and meal planner.

### MacroFactor
- **Use:** Nutrition coaching with adaptive energy targets.
- **What it is:** Subscription app (iOS/Android).
- **Standout features:** Adaptive TDEE: starts from an equation, then solves "calories in minus change in stored energy = calories out" from logged food and weight trends; V3 algorithm is robust to missing days; optional step-informed updates.
- **Evidence / credibility:** Company publishes its methodology and accuracy write-ups.
- **Privacy notes:** No major incidents found.
- **Sources:** [MacroFactor: expenditure V3](https://macrofactor.com/expenditure-v3/), [MacroFactor: algorithm accuracy](https://macrofactor.com/algorithm-accuracy/)
- **What HealthHub could borrow:** Trend-smoothed weight (moving average) in vitals instead of noisy daily values, and "missing days are OK" tolerant logging.

## Meal planning and recipes

### Mealime
- **Use:** Quick weekly meal plans with auto grocery list.
- **What it is:** App (iOS/Android), free with Pro ($2.99/month).
- **Standout features:** Building a meal plan auto-creates the week's grocery list; check off items you already have; send list to grocery delivery partners.
- **Evidence / credibility:** N/A (consumer tool).
- **Privacy notes:** No incidents found. Users complain they cannot export/print lists or see past plans.
- **Sources:** [App Store listing](https://apps.apple.com/app/id1079999103), [Plan to Eat's Mealime review](https://plantoeat.com/?p=37293)
- **What HealthHub could borrow:** "I already have this" check-off when a meal plan becomes a grocery list, plus keeping history of past plans and printable lists (gaps Mealime users notice).

### Plan to Eat
- **Use:** Recipe collection plus meal planning.
- **What it is:** Web/iOS/Android subscription ($5.95/month or $49/year, 14-day trial).
- **Standout features:** Recipe Clipper for websites, social media and cookbooks; drag-and-drop planner; reusable saved plans; aisle-sorted shopping list; one account for the whole family; freezer meal tracking; nutrition totals in the planner.
- **Evidence / credibility:** N/A.
- **Privacy notes:** No incidents found.
- **Sources:** [Plan to Eat website](https://www.plantoeat.com/), [Plan to Eat's Mealime comparison](https://plantoeat.com/?p=37293)
- **What HealthHub could borrow:** Saved/reusable meal-plan templates, a freezer inventory, and nutrition totals per planned day.

### Paprika Recipe Manager
- **Use:** Personal recipe library.
- **What it is:** One-time purchase per platform (iOS about $4.99; also macOS, Windows, Android).
- **Standout features:** Built-in browser and bookmarklet that clip recipes from websites while keeping the source URL; grocery lists that combine ingredients and sort by aisle; pantry with purchase and expiry dates, items move between pantry and grocery list.
- **Evidence / credibility:** N/A.
- **Privacy notes:** Local-first app with optional cloud sync.
- **Sources:** [Paprika iOS help](https://paprikaapp.com/help/ios), [App Store listing](https://apps.apple.com/app/id1303222868)
- **What HealthHub could borrow:** URL recipe import (schema.org Recipe parsing) and a pantry with expiry dates feeding the grocery list.

## Gut health and IBS

### Cara Care (IBS)
- **Use:** IBS self-management with diet, gut-directed psychology and education.
- **What it is:** Berlin-based app; in Germany a prescribable DiGA ("app on prescription") fully covered by public insurance, 12-week program, German-only therapy content.
- **Standout features:** Food and symptom diary, structured IBS program combining nutrition (e.g. low-FODMAP guidance), psychology and medical education.
- **Evidence / credibility:** Listed in the German BfArM DiGA directory (provisionally from 2022, permanent reimbursement later confirmed), which requires evidence of benefit. Ownership reports conflict (Bayer vs Mahana Therapeutics).
- **Privacy notes:** DiGAs must meet German data-protection and security requirements.
- **Sources:** [MobiHealthNews: DiGA approval](https://www.mobihealthnews.com/news/emea/berlin-based-cara-care-app-approved-german-diga), [Pharmaphorum: permanent reimbursement](https://pharmaphorum.com/news/mahanas-dtx-ibs-gets-permanent-reimbursement-germany), [Cara Care](https://cara.care/en)
- **What HealthHub could borrow:** A food-and-symptom diary that links recipes/meals eaten to bloating or bowel symptoms, with an optional guided low-FODMAP elimination-and-reintroduction routine.
