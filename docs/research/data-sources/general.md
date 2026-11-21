# General: open data sources (cross-cutting)

Medicines, supplements, herbs, medical terminology, symptom triage, health guidance content, wearables/FHIR and research search APIs. Area-specific sources are in [nutrition-digestion.md](nutrition-digestion.md), [respiratory-immune.md](respiratory-immune.md) and [fitness-movement.md](fitness-movement.md). Checked November 2026; facts marked "unverified" could not be confirmed from an official page this session.

## Medicines (Sweden first)

### FASS API (Läkemedelsindustriföreningen, LIF)
- **Use:** Swedish medicine information: package leaflets (bipacksedlar), SmPC, Fass texts, DHPC safety letters, interchangeable products.
- **What it is:** REST API behind fass.se, covering about 20,000 pharmaceuticals and 4,500 substances; basic product information updated every 30 minutes (via LiiV from E-hälsomyndigheten).
- **Access:** REST; access by agreement. Contact fass@lif.se for demo and terms. No public key signup found.
- **Cost & licence:** Not published; assume a commercial agreement is needed. Needs owner permission before pursuing.
- **Data quality / trust:** Very high; the authoritative Swedish source texts come from the pharmaceutical companies and build on approved product information.
- **Privacy notes:** Lookups by product only.
- **Sources:** [Fass API (LIF, PDF, 2024)](https://lif.se/globalassets/pdf/fass/fass-api-202406-eng.pdf), [Fass API (LIF, older PDF)](https://www.lif.se/contentassets/d3405d38497d45a5bce0c1f71bf842ad/fass-api-eng.pdf)
- **HealthHub fit:** Medicine cabinet / household meds list with a "read the leaflet on fass.se" deep link (free, no API needed). Ask LIF only if in-app leaflet text is wanted.

### RxNorm / RxNav APIs (US National Library of Medicine)
- **Use:** Normalised drug names, ingredients and classes (RxClass), mapping brand names to active ingredients.
- **What it is:** NLM's free drug terminology APIs (RxNorm, RxTerms, Prescribable RxNorm, RxClass).
- **Access:** REST (JSON/XML), no key. Older terms cap usage at 20 requests/second per IP. Full monthly RxNorm downloads need a free UMLS licence.
- **Cost & licence:** Free; no licence needed for the APIs except `getProprietaryInformation` (UMLS licence). May not use the NLM name/logo; RxNorm terms ask for an NLM attribution statement.
- **Data quality / trust:** High, but US-market products; ingredient-level data works internationally.
- **Privacy notes:** Drug names sent to NLM; no account needed.
- **Important:** NLM's drug-drug interaction API and RxNav Interactions tab were **discontinued on 2 January 2024**. Underlying sources: ONC high-priority DDI list, CredibleMeds QT list, DrugBank (licensed).
- **Sources:** [RxNorm API](https://lhncbc.nlm.nih.gov/RxNav/APIs/RxNormAPIs.html), [RxNav Terms of Service](https://lhncbc.nlm.nih.gov/RxNav/TermsofService.html), [RxNorm Terms of Service](https://www.nlm.nih.gov/research/umls/rxnorm/docs/termsofservice.html), [RxNav FAQ (interaction API discontinued)](https://lhncbc.nlm.nih.gov/RxNav/information/FAQs.html), [API update notice](https://www.lhncbc.nlm.nih.gov/RxNav/news/APIUpdate.html)
- **HealthHub fit:** Map a household med to its active ingredient so the app can warn about duplicate ingredients (e.g. two paracetamol products). Do not build an interaction checker on it.

### DailyMed web services (NLM)
- **Use:** Full US drug labels (SPL) incl. boxed warnings, dosage, interactions sections.
- **Access:** REST v2 (`/dailymed/services/v2/spls.json`), GET only, XML/JSON; no account or key. Full SPL bulk downloads (largest about 16 GB).
- **Cost & licence:** Free (US government label data).
- **Data quality / trust:** High, US-labelled products; Swedish brands differ.
- **Privacy notes:** No account; queries only.
- **Sources:** [DailyMed web services](https://dailymed.nlm.nih.gov/dailymed/app-support-web-services.cfm), [SPLs API (v2)](https://dailymed.nlm.nih.gov/dailymed/webservices-help/v2/spls_api.cfm)
- **HealthHub fit:** Low; FASS is the right Swedish source. Useful only for reference text on ingredients not in Swedish sources.

### openFDA
- **Use:** US drug labels, adverse event reports (FAERS), recalls; also food and device data.
- **Access:** REST/JSON (Elasticsearch-style queries). Without key: 240 requests/min and 1,000/day per IP; with free key: 240/min and 120,000/day.
- **Cost & licence:** Free; key use subject to openFDA terms (data licence not confirmed this session; US government data is generally public domain).
- **Data quality / trust:** FAERS reports are unverified spontaneous reports, cannot show causation; label data is official.
- **Privacy notes:** Queries only.
- **Sources:** [openFDA authentication and limits](https://open.fda.gov/apis/authentication/), [Drug adverse event API](https://open.fda.gov/apis/drug/event/)
- **HealthHub fit:** Low; possibly a "common reported side effects" hint. Not a priority for Sweden.

## Supplements and herbs

### NIH ODS Dietary Supplement Label Database (DSLD)
- **Use:** Ingredients and amounts on supplement labels; label images.
- **Access:** Free REST API (no auth according to third-party tooling; current version 9.x), Swagger docs; whole dataset available on request/download guide.
- **Cost & licence:** Free (US government). ODS does not verify label accuracy; inclusion is not endorsement.
- **Data quality / trust:** Medium; manufacturer label claims, US market.
- **Privacy notes:** Queries only.
- **Sources:** [DSLD (ODS)](https://ods.od.nih.gov/Research/Dietary_Supplement_Label_Database/), [DSLD Label API](https://dsldapi.od.nih.gov/)
- **HealthHub fit:** Supplement tracker: look up typical ingredient amounts when a user logs a supplement (e.g. vitamin D 25 µg) to sum daily intake against upper limits.

### NIH ODS fact sheets and NCCIH "Herbs at a Glance"
- **Use:** Plain-language, evidence-graded summaries of vitamins, minerals and about 50 herbs: what the science says, side effects, cautions.
- **Access:** Web pages and PDF/eBook; no API.
- **Cost & licence:** Free to read. Reuse terms not found this session; US federal text is generally public domain but some images are third-party (e.g. photographer credits). Link rather than copy, or verify before copying.
- **Data quality / trust:** High; written by NIH from current research.
- **Privacy notes:** n/a.
- **Sources:** [NCCIH Herbs at a Glance](https://www.nccih.nih.gov/health/herbsataglance), [ODS botanical fact sheets list](https://ods.od.nih.gov/factsheets/list-Botanicals)
- **HealthHub fit:** Remedy library: each herb card links to its NCCIH/ODS sheet as the "what the evidence says" source.

### EMA EU herbal monographs (HMPC)
- **Use:** The EU's scientific opinion on each herbal substance: well-established vs traditional use, posology, contraindications, interactions.
- **Access:** Web pages per substance with PDF monographs and assessment reports; no API.
- **Cost & licence:** Free. EMA content is generally reusable with acknowledgement (check EMA legal notice).
- **Data quality / trust:** High; regulatory review. Matches what Swedish "traditionella växtbaserade läkemedel" registrations rely on.
- **Privacy notes:** n/a.
- **Sources:** [EU monographs and list entries](https://www.ema.europa.eu/de/human-regulatory-overview/herbal-medicinal-products/european-union-monographs-list-entries)
- **HealthHub fit:** Remedy library safety block (who should avoid, max duration) per herb, citing the monograph. Very good European counterpart to NCCIH.

### Dr. Duke's Phytochemical and Ethnobotanical Databases (USDA ARS)
- **Use:** Plants, their chemical constituents, and traditional/ethnobotanical uses.
- **Access:** Web search at phytochem.nal.usda.gov; full raw database tables as a ZIP plus data dictionary (figshare via data.gov / Ag Data Commons).
- **Cost & licence:** Free, CC0 1.0 (public domain). USDA states it is not for self-diagnosis or self-medication.
- **Data quality / trust:** Low-medium for health claims: largely literature-compiled traditional uses, not efficacy evidence.
- **Privacy notes:** Static download.
- **Sources:** [data.gov record (CC0, downloads)](https://catalog.data.gov/dataset/dr-dukes-phytochemical-and-ethnobotanical-databases), [DOI 10.15482/USDA.ADC/1239279](https://dx.doi.org/10.15482/USDA.ADC/1239279), [Wikipedia overview](https://en.wikipedia.org/wiki/Dr._Duke%27s_Phytochemical_and_Ethnobotanical_Databases)
- **HealthHub fit:** "Traditional use" tags in the remedy library, always shown with an evidence level of "Traditional / anecdotal".

## Medical terminology

### SNOMED CT (Swedish national release)
- **Use:** Coded clinical concepts (diagnoses, symptoms, findings) with Swedish terms.
- **Access:** RF2 release files after licence; Socialstyrelsen browser usable after accepting browser terms.
- **Cost & licence:** Free in Sweden (member since 2007; Socialstyrelsen is the National Release Center). Requires a licence application (covers international + Swedish release); reporting duty if used in systems outside Sweden. Not open licence; cannot be redistributed freely.
- **Data quality / trust:** Very high; national standard used in Swedish healthcare.
- **Privacy notes:** Local files.
- **Sources:** [Licence application form (PDF)](https://www.socialstyrelsen.se/globalassets/sharepoint-dokument/dokument-webb/blankett/blankett-ansokan-om-snomed-ct-licens.pdf), [Swedish national release affiliate licence (PDF)](https://www.socialstyrelsen.se/globalassets/sharepoint-dokument/dokument-webb/ovrigt/snomed-ct-swedish-national-release-affiliate-licence.pdf), [Browser manual (PDF)](https://www.socialstyrelsen.se/globalassets/sharepoint-dokument/dokument-webb/klassifikationer-och-koder/manual-snomed-ct-browser.pdf), [Region Skåne guidance (licence free)](https://vardgivare.skane.se/siteassets/3.-kompetens-och-utveckling/sakkunniggrupper/fackspraksrad/gemensam-terminologi-och-informationsstruktur-fackspraksrad.pdf)
- **HealthHub fit:** Later: tag symptoms/conditions with SNOMED codes so records could be exported to 1177/journal systems. Needs a (free) licence application, so ask the owner first.

### WHO ICD-11 API
- **Use:** Diagnosis classification, multilingual, with search/autocomplete.
- **Access:** REST API with free registration (client credentials); WHO also documents a locally hosted API container (not verified this session).
- **Cost & licence:** Free; CC BY-ND 3.0 IGO (no modifying or translating content); mappings to other classifications need a separate WHO agreement; cite WHO.
- **Data quality / trust:** High; global standard. Note Sweden still uses ICD-10-SE clinically.
- **Privacy notes:** Self-host the container to avoid sending search terms to WHO.
- **Sources:** [ICD-API](https://icd.who.int/icdapi), [ICD-11 licence](https://icd.who.int/docs/icd-api/license), [ICD-11 licence agreement (PDF)](https://icd.Who.Int/en/docs/ICD11-license.pdf), [ICD-11 fact sheet 2026](https://icd.who.int/en/docs/ICD11_Fact_Sheet_2026.pdf)
- **HealthHub fit:** Condition picker in profile with consistent names; low priority.

### LOINC
- **Use:** Standard codes for lab tests and vital signs (e.g. HbA1c, blood pressure).
- **Access:** Free download after account; FHIR terminology API from Regenstrief.
- **Cost & licence:** Free worldwide, commercial use allowed; must include the LOINC copyright notice and not alter content or build a competing standard.
- **Data quality / trust:** Very high; universal standard (Apple Health records and FHIR use it).
- **Privacy notes:** Local files.
- **Sources:** [HL7 Terminology: LOINC](https://terminology.hl7.org/LOINC.html), [Getting LOINC](https://loinc.org/?p=7451)
- **HealthHub fit:** Lab results feature: store each result with a LOINC code so imports (FHIR, Apple Health clinical records) line up and trends work across labs. Top pick for longevity-prevention.

### MeSH and Swedish MeSH
- **Use:** Controlled vocabulary for searching PubMed; Swedish MeSH translates Swedish health terms to English search terms.
- **Access:** NLM MeSH downloads free; Swedish MeSH is a web tool from Karolinska Institutet University Library (also in UMLS as MSHSWE). No public API or bulk download found for Swedish MeSH.
- **Cost & licence:** NLM MeSH free; Swedish MeSH free to use online, reuse terms unclear (described as licensed translation in UMLS).
- **Data quality / trust:** High.
- **Privacy notes:** n/a.
- **Sources:** [Swedish MeSH (KIB)](https://kib.ki.se/en/node/1292), [MSHSWE source in UMLS](https://nlm.nih.gov/research/umls/sourcereleasedocs/current/MSHSWE), [Swedish MeSH tool (Örebro University)](https://www.oru.se/university-library/search-tools/databases/swedish-mesh-tree-tool)
- **HealthHub fit:** Translate a Swedish symptom word into a MeSH term before querying PubMed/Europe PMC for "what research says" links.

## Symptom checkers and triage

### 1177 content API (Inera)
- **Use:** Swedish, quality-assured health articles ("when to seek care") from 1177.se.
- **Access:** REST (`https://www.1177.se/api/` with key). **Currently only offered to regions.**
- **Cost & licence:** Not available to private developers; no reuse licence published.
- **Data quality / trust:** Very high; the national reference for Swedish patients.
- **Privacy notes:** n/a.
- **Sources:** [Intresseanmälan för en API-nyckel](https://www.1177.se/om-1177/1177.se/intresseanmalan-for-en-api-nyckel/)
- **HealthHub fit:** Deep-link to the relevant 1177 page and to phone 1177 for triage instead of building triage. Free and safest.

### Infermedica API
- **Use:** AI symptom assessment and triage.
- **Access:** REST; trial account up to 2,000 calls on request.
- **Cost & licence:** Paid, quote-based. Consumer product Symptomate is free for individuals but not for integration.
- **Data quality / trust:** Medical-device-grade product (vendor claims); commercial.
- **Privacy notes:** Sends symptoms (health data, GDPR special category) to a third party; would need a DPA.
- **Sources:** [Infermedica developer FAQ](https://developer.infermedica.com/docs/faq)
- **HealthHub fit:** Skip (paid, sensitive data leaves the household). Link to Symptomate or 1177 instead.

### ApiMedic (priaid) Symptom Checker
- **Use:** Symptom-to-diagnosis API.
- **Access:** REST with API key; rate-limited free tier per directories (quota unverified).
- **Cost & licence:** Free tier plus paid plans; licence agreement linked from their GitHub repo (not read).
- **Data quality / trust:** Unclear; little independent validation found.
- **Privacy notes:** Sends symptoms to a third party.
- **Sources:** [priaid symptomchecker (GitHub)](https://www.github.com/priaid-eHealth/symptomchecker), [ApiMedic directory listing](https://public-api.org/api/1177/apimedic)
- **HealthHub fit:** Skip.

## Health guidance content

### MedlinePlus Connect (NLM)
- **Use:** Returns patient-friendly health topic, lab test and drug info for a given code (ICD-10-CM, SNOMED, LOINC, RxCUI, NDC).
- **Access:** REST (JSON/XML), no registration or licence.
- **Cost & licence:** Free; credit MedlinePlus.gov; do not use the logo or imply endorsement. Drug monographs are ASHP-licensed content. Intended for US coding systems; English and Spanish only. (Separate MedlinePlus search web service: max 85 requests/min per IP.)
- **Data quality / trust:** High.
- **Privacy notes:** Send codes only, never personal data.
- **Sources:** [MedlinePlus Connect](https://medlineplus.gov/medlineplus-connect/), [Technical information](https://medlineplus.gov/medlineplus-connect/technical-information), [FAQ](https://medlineplus.gov/medlineplus-connect/faqs), [MedlinePlus web services](https://www.medlineplus.gov/about/developers/webservices)
- **HealthHub fit:** "Learn more" links on lab results by LOINC code (English). Good free add-on.

### NHS Website Content API (v2)
- **Use:** NHS.uk conditions, medicines, live-well articles as structured content.
- **Access:** Register on NHS developer portal, agree to syndication terms; v1 retired, v2 current.
- **Cost & licence:** Free syndication programme; content under Open Government Licence plus syndication terms; some content not licensed for reuse. Whether non-UK use is allowed was not confirmed (NICE, a different body, charges for international use).
- **Data quality / trust:** Very high.
- **Privacy notes:** n/a.
- **Sources:** [NHS syndicated content APIs (api.gov.uk)](https://api.gov.uk/nd/nhs-syndicated-content-rest-apis/), [Content not licensed for re-use](https://www.nhs.uk/our-policies/terms-and-conditions/content-not-licensed-for-re-use/), [Making nhs.uk available everywhere](https://healthtech.blog.gov.uk/2019/07/15/making-nhs-uk-available-everywhere/)
- **HealthHub fit:** English-language article source for the learn section, if terms allow use from Sweden; confirm before use.

### WHO Global Health Observatory
- **Use:** Population health statistics (life expectancy, obesity, etc.) by country.
- **Access:** GHO OData API (WHO said it would be deprecated near end-2025; check data.who.int for the current API). Legacy Athena API retired.
- **Cost & licence:** Free; dataset terms at data.who.int (not read in full); WHO publications are CC BY-NC-SA 3.0 IGO.
- **Data quality / trust:** High, population-level only.
- **Privacy notes:** n/a.
- **Sources:** [GHO OData API](https://who.int/data/gho/info/gho-odata-api), [Legacy API retired notice](https://www.who.int/data/gho/legacy), [Terms for WHO datasets](https://data.who.int/redirect-pages/footer/learn-more/terms-and-conditions)
- **HealthHub fit:** Low; maybe context like "Swedish average" on dashboard.

## Wearables and devices

### Apple Health (HealthKit) export
- **Use:** Steps, heart rate, sleep, workouts, cycle data from iPhone/Apple Watch.
- **Access:** No web or server API; HealthKit is native iOS only. Users can export a ZIP containing `export.xml` from the Health app and upload it; parse in the browser or server.
- **Cost & licence:** Free. A native companion app would need an Apple Developer account (paid, needs permission).
- **Data quality / trust:** High (device data).
- **Privacy notes:** Very sensitive; parse client-side or store only selected aggregates; data stays on the user's device until uploaded.
- **Sources:** [Open Wearables: integrating Apple Health](https://openwearables.io/blog/how-to-integrate-apple-health-data-into-your-app), [Browser-only export converter (iphone-ticker.de)](https://www.iphone-ticker.de/apple-health-webseite-konvertiert-xml-daten-ins-csv-format-89349/), [Apple Developer Forums thread](https://developer.apple.com/forums/thread/668521)
- **HealthHub fit:** "Import Apple Health export" in profile/vitals: pull weight, resting HR, sleep and menstrual flow into existing trackers. Top pick (free, private).

### Google Health Connect and Google Health API (replaces Fitbit Web API)
- **Use:** Android health data hub; cloud Google Health API for Fitbit/Pixel data.
- **Access:** Health Connect is an on-device Android API (needs a native app). Legacy Fitbit Web API support ends 30 September 2026 (shutdown dates reported between Sep and Nov 2026); migrate to Google Health API with Google OAuth.
- **Cost & licence:** Free developer access (Google API terms).
- **Data quality / trust:** High.
- **Privacy notes:** OAuth scopes per data type; Google review for sensitive scopes.
- **Sources:** [About the Google Health API](https://developers.google.com/health/about), [Fitbit: legacy Web API support ends](https://dev.fitbit.com/build/), [Health & Fitness developer newsletter](https://developers.google.com/health/newsletters)
- **HealthHub fit:** Medium-term option for Fitbit/Pixel Watch users; do not build on the legacy Fitbit Web API.

### Garmin Connect Developer Program (Health API)
- **Access/cost:** Free for approved **business** developers only; some metrics may need licence fees. New applications reportedly paused since spring 2026.
- **Privacy notes:** Push-based webhooks to your server.
- **Sources:** [Garmin Health API](https://developer.garmin.com/gc-developer-program/health-api), [Program FAQ](https://developer.garmin.com/gc-developer-program/program-faq), [Report: access paused](https://the5krunner.com/2026/09/14/garmin-developer-api-access-paused/)
- **HealthHub fit:** Not available to a private household app now. Workaround: user exports FIT/CSV files.

### Oura API v2
- **Access/cost:** Free for developers; OAuth2 only (personal access tokens deprecated Dec 2025); apps limited to 10 users before Oura approval; Gen3/Ring 4 users need an active Oura Membership for API access.
- **Sources:** [The Oura API (support)](https://support.ouraring.com/hc/en-us/articles/4415266939155-The-Oura-API), [Oura OpenAPI spec](https://cloud.ouraring.com/v2/static/json/openapi-1.35.json)
- **HealthHub fit:** Good for a household (well under 10 users): sleep score, readiness, temperature trend for cycle tracking.

### Withings Public API
- **Access/cost:** Free, OAuth2, no contract required for the Public API (SDK/OnSite need contracts). Scopes: user.info, user.metrics, user.activity, user.sleepevents.
- **Sources:** [Withings API reference](https://developer.withings.com/llms.md), [OAuth web flow](https://developer.withings.com/developer-guide/v3/integration-guide/advanced-research-api/get-access/oauth-web-flow/)
- **HealthHub fit:** Auto-import weight, body composition and blood pressure into vitals. Strong fit.

### Polar AccessLink API v3
- **Access/cost:** Free; any Polar Flow account can register an API client; OAuth2, read-only, user consent.
- **Sources:** [Polar AccessLink API v3](https://www.polar.com/accesslink-api/), [Polar example (GitHub)](https://github.com/polarofficial/accesslink-example-python)
- **HealthHub fit:** Workouts, sleep, nightly recharge into routines/sleep. Polar is popular in the Nordics.

### Terra API (aggregator)
- **Access/cost:** Paid; usage-based, from about $399-499/month; add-ons extra.
- **Sources:** [Terra pricing docs](https://docs.tryterra.co/unified-api/pricing), [Terra pricing](https://tryterra.co/pricing)
- **HealthHub fit:** Skip (cost).

### Open Wearables (self-hosted aggregator)
- **Use:** One API over Apple Health, Health Connect, Samsung, Oura, Garmin, Polar, Suunto, Whoop, Strava.
- **Access/cost:** Free, MIT licence, self-hosted (Docker, Postgres, REST/OpenAPI). Still depends on each vendor's API access.
- **Sources:** [Open Wearables on SourceForge](https://sourceforge.net/projects/open-wearables), [Open Wearables 0.3 (Health Connect, Samsung)](https://medium.com/@themomentum_ai/open-wearables-0-3-android-support-google-health-connect-samsung-health-9de844e9608c), [OpenAlternative listing](https://openalternative.co/open-wearables)
- **HealthHub fit:** Free alternative to Terra; good reference for data models even if not deployed.

### Open mHealth / IEEE 1752.1 schemas
- **Use:** Standard JSON Schemas for step count, heart rate, sleep, blood pressure etc.
- **Access/cost:** Free on GitHub; sleep/physical activity schemas superseded by IEEE 1752.1 (opensource.ieee.org). Licence of core repo not confirmed (related repos Apache 2.0 / MIT).
- **Sources:** [openmhealth/schemas (GitHub)](https://www.github.com/openmhealth/schemas), [Schema design principles](https://www.openmhealth.org/documentation/schema-docs/schema-design-principles/)
- **HealthHub fit:** Use as the shape for vitals/sleep tables so wearable imports normalise cleanly.

### HL7 FHIR, SMART on FHIR, HAPI FHIR
- **Use:** Standard for health records exchange; SMART on FHIR is the OAuth app-launch layer.
- **Access/cost:** FHIR specification CC0 (public domain). HAPI FHIR (Java server/client) Apache 2.0. SMART licence not checked.
- **Sources:** [FHIR licence](https://hl7.org/fhir/license.html), [HAPI FHIR (GitHub mirror)](https://github.com/CMSgov/hapi-fhir)
- **HealthHub fit:** Use FHIR resource shapes (Observation, MedicationStatement) for export/import; no need to run a FHIR server.

## Research search APIs

Note: the session's web-search budget ran out before these could be fully verified; official pages were fetched where possible, the rest is flagged.

### PubMed E-utilities (NCBI)
- **Use:** Search biomedical citations and abstracts (MEDLINE/PubMed).
- **Access:** REST (XML/JSON). Commonly 3 requests/sec without key, 10/sec with free key (unverified this session; page blocked by captcha).
- **Cost & licence:** Free; abstracts may be publisher-copyrighted, so show and link rather than republish.
- **Sources:** [E-utilities documentation](https://www.ncbi.nlm.nih.gov/books/NBK25497/)
- **HealthHub fit:** "Latest research" links on remedy library entries.

### Europe PMC REST API
- **Use:** PubMed plus European content, preprints and open-access full text.
- **Access:** REST (JSON/XML), no key (unverified this session; page returned 403/503 to fetcher).
- **Cost & licence:** Free; full text reuse depends on each article's licence (open-access subset is mostly CC licences).
- **Sources:** [Europe PMC RESTful web service](https://europepmc.org/RestfulWebService)
- **HealthHub fit:** Alternative to PubMed with better OA full-text links.

### ClinicalTrials.gov API v2
- **Use:** Find recruiting trials (incl. Sweden) by condition.
- **Access:** REST v2 (JSON), no key (unverified this session).
- **Cost & licence:** Free (US government).
- **Sources:** [ClinicalTrials.gov data API](https://clinicaltrials.gov/data-api/api)
- **HealthHub fit:** Low; niche.

### Semantic Scholar API
- **Use:** Paper search, citations, TLDR summaries.
- **Access:** REST; unauthenticated requests share a common pool and may be throttled; free keys start at 1 request/sec.
- **Cost & licence:** Free; API licence agreement governs use (not read).
- **Sources:** [Semantic Scholar API](https://www.semanticscholar.org/product/api)
- **HealthHub fit:** Optional TLDRs on research links.

### Cochrane Library
- **Use:** Systematic reviews, the gold standard for "Proven" evidence levels.
- **Access:** Web; abstracts and plain-language summaries free to read; no public API found. Access page blocked our fetcher.
- **Cost & licence:** Full reviews often paywalled; reuse requires permission.
- **Sources:** [Cochrane Library access help](https://www.cochranelibrary.com/help/access)
- **HealthHub fit:** Link from remedy library evidence levels; do not copy text.

## Not covered in this pass

The search budget ran out before these could be researched: lab-test reference-range datasets (NHANES, CALIPER, Swedish lab handbooks), cycle/fertility and sleep research datasets, HerbMed and Natural Medicines (both believed to be subscription), and Swedish open health statistics (Socialstyrelsen, Folkhälsomyndigheten). Worth a follow-up.

## Top picks for HealthHub

| Source | Why | Cost |
|---|---|---|
| Livsmedelsverket Livsmedelsdatabasen | Official Swedish nutrient data for recipes and meal planner, JSON API | Free, CC BY 4.0 (credit Livsmedelsverket) |
| Open Food Facts | Barcode scanning for groceries, allergens, Nutri-Score, strong Swedish coverage | Free, ODbL (attribution + share-alike) |
| USDA FoodData Central | Deep micronutrient data to fill gaps | Free, CC0 |
| Pollenrapporten API (NRM) | Swedish pollen forecasts for allergy household members | Free, CC BY-SA / CC BY-ND, commercial OK |
| Apple Health export.xml import | Private, no-API way to bring in steps, sleep, weight, cycle data | Free |
| Withings / Polar / Oura APIs | Direct device imports for vitals, workouts, sleep | Free developer access (Oura needs member ring users) |
| Compendium of Physical Activities | MET values for activity calories | Free incl. commercial, cite |
| free-exercise-db | 800+ exercises with images for routines | Free, Unlicense |
| LOINC | Codes for lab results and vitals so trends line up | Free, keep copyright notice |
| EMA herbal monographs + NCCIH/ODS fact sheets | Trusted safety and evidence text for the remedy library | Free to read; link and cite |
| RxNorm API | Map medicines to active ingredients (duplicate-ingredient warnings) | Free, no key |
| SMHI open data / Open-Meteo | Weather, air quality, UV context | SMHI free CC BY 4.0; Open-Meteo free non-commercial |
