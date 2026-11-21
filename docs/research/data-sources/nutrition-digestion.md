# Nutrition and digestion: open data sources

Food composition databases, product barcode data and paid nutrition APIs that could feed the meal planner, recipes, groceries and journal. Checked November 2026.

## National food composition tables (best fit for a Swedish household)

### Livsmedelsverket: Livsmedelsdatabasen (Swedish Food Composition Database)
- **Use:** Nutrient values for generic Swedish foods and dishes (recipes, meal planner, daily intake).
- **What it is:** The Swedish Food Agency's national reference table: about 2,500 foods with values for over 50 nutrients each, including classifications, raw commodities and ingredients.
- **Access:** Free REST API returning JSON (`/api/v1/livsmedel` with sub-routes for nutrient values, classification, ingredients). Swagger docs at dataportal.livsmedelsverket.se. No key mentioned.
- **Cost & licence:** Free. CC BY 4.0: reuse, redistribution and derived versions allowed, commercial use allowed. Attribution required: "The Swedish Food Agency must be stated as the source."
- **Data quality / trust:** High. Official government reference data, analysed or calculated values, Swedish food names. Generic foods only, not branded products.
- **Privacy notes:** Lookups contain only food names/IDs; no personal data leaves HealthHub. Data can also be mirrored locally into Postgres so no runtime calls are needed.
- **Sources:** [Food composition data (open data page)](https://www.livsmedelsverket.se/en/about-us/open-data/food-composition-data/), [API Swagger](https://dataportal.livsmedelsverket.se/livsmedel/swagger/index.html), [The food database](https://dev.livsmedelsverket.se/en/food-and-content/naringsamnen/livsmedelsdatabasen)
- **HealthHub fit:** Recipes and meal planner: the primary nutrient source. Seed a local `Food` table from the API, link recipe ingredients to it, show per-serving nutrition in Swedish. Top pick.

### Fineli (Finnish Food Composition Database, THL)
- **Use:** Second Nordic nutrient table, good overlap with Swedish foods; includes glycaemic index values.
- **What it is:** THL's national database with over 5,000 foods and 55 nutritional factors.
- **Access:** Listed as an open data topic on THL's open data portal; downloadable packages. Fineli's own open data page returned 403 to our fetcher, so formats were not confirmed. A community project (fineli-sql) converts the download into SQL.
- **Cost & licence:** Free. The exact licence could not be confirmed this session (THL open data is generally CC BY 4.0 but verify on fineli.fi). THL owns the data and the Fineli name is a registered trademark; services must not imply THL endorsement.
- **Data quality / trust:** High; official national data.
- **Privacy notes:** Static download, no runtime calls needed.
- **Sources:** [Suomi.fi service description](https://www.suomi.fi/services/finnish-food-composition-database-fineli-the-national-institute-for-health-and-welfare-thl/cbc1b926-a496-42b9-8a66-5e3e9ef638e4), [THL Open Data on avoindata.fi](https://avoindata.fi/data/en/dataset/thl-n-avoin-data), [fineli-sql (GitHub)](https://github.com/mafredri/fineli-sql), [GI values in Fineli (paper)](https://ouci.dntb.gov.ua/works/4VzOBvy4)
- **HealthHub fit:** Fallback for foods missing from Livsmedelsdatabasen; GI values for a blood-sugar-friendly recipe tag. Verify licence before importing.

### ANSES-CIQUAL (French food composition table)
- **Use:** Large European generic food table (fallback / cross-check).
- **What it is:** French agency ANSES's table; the 2020 release has 3,185 foods and 67 components.
- **Access:** Full download (Excel/XML/CSV) from ciqual.anses.fr; the dataset has moved to recherche.data.gouv.fr; the 2020 edition is also archived on Zenodo.
- **Cost & licence:** Free. ANSES states reuse is authorised under the French "Licence Ouverte / Open Licence" (attribution-style, commercial use allowed).
- **Data quality / trust:** High; official. French food names (English names included).
- **Privacy notes:** Static download.
- **Sources:** [ANSES-CIQUAL table](https://www.anses.fr/en/content/anses-ciqual-food-composition-table), [Major update of CIQUAL](https://www.anses.fr/en/node/125190), [data.gouv.fr dataset (moved notice)](https://www.data.gouv.fr/datasets/table-de-composition-nutritionnelle-des-aliments-ciqual-2020/discussions), [Ciqual 2020 on Zenodo](https://zenodo.org/records/4770202)
- **HealthHub fit:** Optional extra source for exotic ingredients; low priority given Swedish/Finnish tables.

### USDA FoodData Central
- **Use:** The largest free nutrient database (generic foods plus US branded products), very detailed micronutrients.
- **What it is:** USDA's integrated database: Foundation Foods, SR Legacy, Survey Foods (FNDDS), Experimental Foods and Branded Foods.
- **Access:** REST API (JSON) with a free data.gov API key; full CSV/JSON downloads. Default limit 1,000 requests/hour per IP; DEMO_KEY is 30/hour and 50/day.
- **Cost & licence:** Free. CC0 1.0 (public domain); USDA asks that FoodData Central is credited as the source. Commercial use fine.
- **Data quality / trust:** High for Foundation/SR Legacy (lab analysed); Branded data is manufacturer-supplied and US-market only.
- **Privacy notes:** Keep the API key server-side (USDA says the key holder must keep it private). Queries contain only food terms.
- **Sources:** [FoodData Central API Guide](https://fdc.nal.usda.gov/api-guide), [API key signup](https://fdc.nal.usda.gov/api-key-signup)
- **HealthHub fit:** Secondary source for micronutrients (e.g. vitamin K, choline) missing from the Swedish table; can bulk-import SR Legacy once into Postgres.

### EuroFIR FoodEXplorer
- **Use:** One search interface across many European national food tables.
- **What it is:** EuroFIR AISBL's aggregator of national composition databases.
- **Access:** Web tool; downloads limited for pay-per-view users, full downloads for members.
- **Cost & licence:** Not free: pay-per-view 20 EUR/week, 35 EUR/2 weeks; 2023 membership fees 1,000-3,000 EUR/year (proposed +10% from 2024).
- **Data quality / trust:** High (compiled national data), but redistribution terms are restrictive.
- **Privacy notes:** n/a.
- **Sources:** [Access to FoodEXplorer (pay-per-view)](https://www.eurofir.org/why-join-eurofir-aisbl/pay-per-view), [Membership fees 2023 (PDF)](https://www.eurofir.org/wp-admin/wp-content/uploads/2023/03/Membership-Package_EuroFIR_2023_Proposed-new-fees-Lecture-seule.pdf)
- **HealthHub fit:** Skip. Paid, and the free national tables above cover the need.

## Branded products and barcodes

### Open Food Facts
- **Use:** Barcode lookup of packaged groceries: ingredients, allergens, nutrition, Nutri-Score, NOVA processing level, additives.
- **What it is:** A crowd-sourced, non-profit global database of food products with good Swedish coverage (se.openfoodfacts.org).
- **Access:** Free REST API (JSON), no key for reads; full database dumps (CSV, JSONL, MongoDB). Asks for a custom User-Agent and to avoid heavy scraping (use dumps instead).
- **Cost & licence:** Free. Database under ODbL (share-alike + attribution), individual contents under the Database Contents License, images CC BY-SA. Commercial use allowed, but any database you combine it with must also be released openly; credit "(c) Open Food Facts contributors".
- **Data quality / trust:** Medium. Volunteer-entered, varies per product; good for ingredients/allergens, verify nutrition values on the package.
- **Privacy notes:** A barcode lookup reveals what you buy to OFF servers (no account needed). Caching looked-up products locally keeps calls minimal.
- **Sources:** [License: be on the legal side](https://openfoodfacts.github.io/documentation/docs/Product-Opener/api/tutorials/license-be-on-the-legal-side/), [ODbL licence (wiki)](https://wiki.openfoodfacts.org/ODBL_License), [Are there conditions to use the API?](https://support.openfoodfacts.org/help/en-gb/12-api-data-reuse/94-are-there-conditions-to-use-the-api), [Reusing Open Food Facts data](https://wiki.openfoodfacts.org/Reusing_Open_Food_Facts_Data), [Swedish data page](https://se.openfoodfacts.org/data)
- **HealthHub fit:** Groceries: scan a barcode to add an item and flag allergens/additives for household members; keep OFF data in a separate table so the share-alike obligation does not reach HealthHub's private data. Top pick.

## Commercial nutrition APIs (paid, for comparison)

### Edamam (Nutrition Analysis, Food Database, Recipe, Meal Planner APIs)
- **Use:** Natural-language ingredient parsing ("2 dl milk") into nutrition; recipe search.
- **What it is:** Commercial nutrition/recipe API.
- **Access:** REST with app ID/key.
- **Cost & licence:** Free "Developer" tier for Nutrition Analysis; Enterprise Core $69/month; Enterprise Unlimited custom (official page, verify current). Requires the Edamam attribution badge and link; only end-user-driven requests; caching only on some paid plans. Several older Edamam APIs are retired.
- **Data quality / trust:** Good, but US-centred; Swedish units/language support is limited.
- **Privacy notes:** Free text ingredients are sent to a US company.
- **Sources:** [Nutrition Analysis API](https://developer.edamam.com/edamam-nutrition-api), [Food and Grocery Database API](https://developer.edamam.com/food-database-api), [Meal Planner API](https://developer.edamam.com/meal-planner-api)
- **HealthHub fit:** Only if ingredient-text parsing becomes a must; otherwise build parsing locally against Livsmedelsdatabasen. Caching restrictions clash with a local-first app.

### Nutritionix
- **Use:** Natural-language food logging, US restaurant/branded data.
- **What it is:** Commercial nutrition API.
- **Access:** REST with free account key.
- **Cost & licence:** A limited free developer ("Hacker") plan exists per third-party sites; paid tiers for production. Official price list not found this session; one competitor blog quotes $449/month (unverified).
- **Data quality / trust:** Good for US; little Swedish relevance.
- **Privacy notes:** Queries go to a US company.
- **Sources:** [Nutritionix on apis.io](https://apis.io/providers/nutritionix/), [Nutritionix free use discussion](https://ntro.it.com/is-nutritionix-free-to-use-for-calorie-tracking), [Comparison blog (competitor)](https://dev.to/raviteja_nekkalapu_/most-nutrition-apis-hide-80-of-the-data-behind-paywalls-mine-doesnt-49pl)
- **HealthHub fit:** Skip; US-centred and paid.

### FatSecret Platform API
- **Use:** Global food and branded database API.
- **What it is:** Commercial API sold in several editions.
- **Access:** REST/OAuth.
- **Cost & licence:** Edition prices and attribution terms are on the official editions page; not reviewed in detail this session.
- **Data quality / trust:** Broad coverage, mixed quality.
- **Privacy notes:** Queries go to a third party.
- **Sources:** [fatsecret Platform Editions](https://platform.fatsecret.com/api-editions)
- **HealthHub fit:** Low; Open Food Facts covers barcodes for free.
