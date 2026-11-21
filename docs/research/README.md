# HealthHub health research database

A pick-list of health practices, remedies, data sources and app ideas, gathered on 2026-11-21 by five parallel research passes. Nothing here is built into the app yet. The point is for the owner to decide what goes into HealthHub next.

HealthHub's goal: *give you and your household one private place to track, understand and improve your everyday health.* Every entry ends with a **HealthHub fit** line suggesting where it could live.

## How it is organised

- **By lens (folder):** where the idea comes from.
  - [`science/`](science/) evidence-based medicine and clinical guidelines (Cochrane, NICE, WHO, NIH, 1177, Livsmedelsverket). Every file ends with red-flag "see a doctor" signs.
  - [`functional/`](functional/) funktionsmedicin, integrative and alternative approaches, with what proponents claim and what the evidence shows.
  - [`traditional/`](traditional/) grandmother remedies and folk medicine (huskurer) from the Nordics and the rest of the world.
  - [`data-sources/`](data-sources/) open databases and APIs HealthHub could plug into, with cost and licence.
  - [`apps/`](apps/) health apps, trackers and devices to borrow features from, with privacy notes.
- **By health area (file name):** the same file names are used in every folder, so `science/sleep.md`, `functional/sleep.md` and `traditional/sleep.md` cover the same topic from different angles.
- **By use (H2 headings inside each file):** for example "Cough" or "Sore throat" inside `respiratory-immune.md`.

Entry format and evidence definitions: [_FORMAT.md](_FORMAT.md).

## Evidence labels

| Label | Meaning |
|---|---|
| **Proven** | Systematic reviews, meta-analyses or major guidelines support it |
| **Promising** | Some trials or consistent smaller studies, not conclusive |
| **Traditional / anecdotal** | Long use or practitioner experience, little or no good trial data |
| **Disproven / likely harmful** | Good evidence it does not work, or real risk. Kept so the app can warn about it |

## Area × lens matrix (entry counts, click to open)

| Area | Science | Functional / integrative | Traditional / folk | Data sources | Apps & tools |
|---|---|---|---|---|---|
| Sleep | [17](science/sleep.md) | [12](functional/sleep.md) | [5](traditional/sleep.md) | · | [5](apps/sleep.md) |
| Nutrition & digestion | [18](science/nutrition-digestion.md) | [8](functional/nutrition-digestion.md) | [9](traditional/nutrition-digestion.md) | [9](data-sources/nutrition-digestion.md) | [10](apps/nutrition-digestion.md) |
| Respiratory & immune | [15](science/respiratory-immune.md) | [6](functional/respiratory-immune.md) | [20](traditional/respiratory-immune.md) | [3](data-sources/respiratory-immune.md) | · |
| Cardio-metabolic | [18](science/cardio-metabolic.md) | [10](functional/cardio-metabolic.md) | [5](traditional/cardio-metabolic.md) | · | [2](apps/cardio-metabolic.md) |
| Mental health & stress | [13](science/mental-health-stress.md) | [9](functional/mental-health-stress.md) | [4](traditional/mental-health-stress.md) | · | [7](apps/mental-health-stress.md) |
| Women's health | [17](science/womens-health.md) | [15](functional/womens-health.md) | [12](traditional/womens-health.md) | · | [8](apps/womens-health.md) |
| Men's health | [10](science/mens-health.md) | [1](functional/mens-health.md) | · | · | · |
| Pain & musculoskeletal | [16](science/pain-musculoskeletal.md) | [14](functional/pain-musculoskeletal.md) | [5](traditional/pain-musculoskeletal.md) | · | [1](apps/pain-musculoskeletal.md) |
| Fitness & movement | [12](science/fitness-movement.md) | · | · | [4](data-sources/fitness-movement.md) | · |
| Skin, hair & oral | [15](science/skin-hair-oral.md) | [3](functional/skin-hair-oral.md) | [6](traditional/skin-hair-oral.md) | · | · |
| Children & family | [18](science/children-family.md) | [8](functional/children-family.md) | [14](traditional/children-family.md) | · | [5](apps/children-family.md) |
| Longevity & prevention | [15](science/longevity-prevention.md) | [7](functional/longevity-prevention.md) | · | · | [4](apps/longevity-prevention.md) |
| Minor ailments & first aid | [18](science/minor-ailments-first-aid.md) | · | [10](traditional/minor-ailments-first-aid.md) | · | · |
| General / cross-cutting | [10](science/general.md) | [12](functional/general.md) | [3](traditional/general.md) | [33](data-sources/general.md) | [17](apps/general.md) |
| **Total** | **212** | **105** | **93** | **49** | **59** |

## Best ideas across all five lenses

These came up repeatedly or look like the strongest fit for HealthHub. Details and sources are in the linked files.

**Safety layer (build first, protects everything else)**
1. **Red-flag rules engine:** one set of "see a doctor now" rules every tracker passes through (3-week cough, FAST stroke signs, BP ≥180/120, child fever by age, non-blanching rash, suicidal thoughts), with Swedish numbers (1177 / 112). See every `science/*.md` red-flag section.
2. **Age-aware household warnings:** no honey under 1 year, no camphor rubs under 2, no amber necklaces, no star anise tea for babies. Uses each household member's age. See [traditional/children-family.md](traditional/children-family.md), [functional/children-family.md](functional/children-family.md).
3. **Supplement and remedy cabinet with interaction and liver flags:** St John's wort vs the contraceptive pill, turmeric vs warfarin, liquorice vs blood pressure, liver-injury list (turmeric, ashwagandha, green tea extract, black cohosh, kava). Note: no free drug-interaction API exists since NLM closed theirs in 2024, so this would be a curated list. See [functional/general.md](functional/general.md), [data-sources/general.md](data-sources/general.md).
4. **"Myth or medicine?" cards:** honest labels on popular remedies (onion by the bed: harmless but unproven; honey for cough: proven; butter on burns: harmful).

**Tracking and insight**
5. **Correlation insights** across journal, sleep, cycle, meals and routines (Bearable / Exist style). See [apps/general.md](apps/general.md).
6. **n-of-1 self-experiments:** a 4–12 week before/after template so you can test "works for me but unproven" practices honestly (magnesium and sleep, cold showers and mood, vitex and PMS).
7. **Doctor-visit PDF per family member:** symptoms, medications, vitals trends, cycle.
8. **Lab results tracker** with LOINC codes and reference ranges (Werlabs / 1177 results).
9. **Guided 7-day home blood pressure check** (AHA / NICE / ESH protocol).
10. **Headache diary** with medication-overuse warning and cycle overlay.

**Programmes and routines**
11. **CBT-I 6-week sleep course** with sleep-efficiency diary (first-line for insomnia).
12. **Low-FODMAP eliminate-and-reintroduce plan** inside the meal planner, plus a food–symptom diary.
13. **Diabetes-prevention style programme** (7% weight loss + 150 min/week activity).
14. **Breathing pacer** (~6 breaths/min) in the timer, tai chi / yoga routines for older members, water-gargling (ugai) habit.
15. **Offline first-aid cards with timers:** 20-minute burn cooling, nosebleed pressure, choking, anaphylaxis, tick-bite watch.

**Free data to plug in**
- Livsmedelsverket food database (CC BY 4.0), Open Food Facts barcodes (ODbL, keep in its own table), Pollenrapporten pollen API, Apple Health `export.xml` import, Withings / Polar / Oura APIs, free-exercise-db (public domain), MET compendium, LOINC, EU herbal monographs and NIH fact sheets (link, don't copy).

## Known gaps and caveats

- **Shared search limit:** all five passes shared a 200-search budget, which ran out partway. The science pass wrote the later areas (from cardio-metabolic on) from guideline knowledge and verified every URL exists, but did not re-read each page. Some dose figures there deserve a second check.
- **Not covered yet:** functional: zinc and vitamin D for colds, nasal rinsing, Buteyko, sauna, saffron, Silexan lavender, men's health beyond saw palmetto. Traditional: Russian banya, mustard foot baths, black radish syrup, ajwain/hing, coin rubbing, lead-containing remedies (azarcon, kohl), pine tar and birch. Data: lab reference-range datasets, cycle/sleep datasets, HerbMed. Apps: Ayurveda/TCM/home-remedy apps, MindDoc.
- **Unsourced statements to verify** before showing in the app: Swedish melatonin and DHEA status, the Danish ashwagandha restriction, estimated SEK cost of a glucose sensor, a few herb safety details in `traditional/`.
- **Licences:** 1177 content is not open to private apps (link instead), FASS needs an agreement, SNOMED CT needs a free application to Socialstyrelsen, Open-Meteo free tier is non-commercial only.
- **Not medical advice.** This is a research pick-list; anything shown to users should keep the evidence label and safety note.
