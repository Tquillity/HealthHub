# Fitness and movement: open data sources

Exercise libraries and energy-cost tables for routines and activity logging. Wearable integrations are in [general.md](general.md). Checked November 2026.

## Exercise libraries

### free-exercise-db (yuhonas)
- **Use:** Ready-made exercise library with instructions, muscles, equipment and images.
- **What it is:** Open public-domain dataset of 800+ exercises as JSON, with a browsable frontend.
- **Access:** Download `dist/exercises.json` from GitHub; images in the repo (relative paths). Makefile can build NDJSON for PostgreSQL import.
- **Cost & licence:** Free. Unlicense (public domain): commercial use, no attribution required.
- **Data quality / trust:** Medium; community-curated, English only, no evidence ratings.
- **Privacy notes:** Static data, bundle locally; no runtime calls.
- **Sources:** [free-exercise-db (GitHub)](https://github.com/yuhonas/free-exercise-db), [README](https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/README.md)
- **HealthHub fit:** Routines: seed an `Exercise` table so users can build strength/mobility routines with pictures. Top pick (simplest licence).

### wger
- **Use:** Exercise and ingredient database plus a full open-source workout/nutrition tracker.
- **What it is:** FLOSS Django app (wger.de) with a public REST API; exercises are multilingual (community translations).
- **Access:** REST API (JSON) on wger.de or self-hosted via Docker. The wger.de site sits behind bot protection, so prefer a one-off import.
- **Cost & licence:** Free. Code AGPL-3.0-or-later (matters only if you copy code). Exercise and ingredient data under Creative Commons licences set per entry (older docs say CC BY-SA 3.0); check each entry's licence and credit authors. Docs CC BY-SA 4.0.
- **Data quality / trust:** Medium; community entries with images/videos, some in Swedish.
- **Privacy notes:** Import data once; do not send user workouts to wger.de.
- **Sources:** [wger README](https://raw.githubusercontent.com/wger-project/wger/master/README.md), [wger on PyPI](https://pypi.org/project/wger/)
- **HealthHub fit:** Source of Swedish exercise names/translations to enrich free-exercise-db; keep per-exercise licence and author fields so attribution can be shown.

### ExerciseDB
- **Use:** 1,300+ exercises with animated GIFs.
- **What it is:** Commercial exercise API (V1 and V2 datasets).
- **Access:** V2 via RapidAPI subscription plans; V1 single-payment / self-hosted via the ExerciseDB shop. Community MIT-licensed V1 forks exist, but the licence of the underlying media is unclear.
- **Cost & licence:** Paid (prices on RapidAPI/shop, not captured). Media licence unclear; do not use forks without checking rights.
- **Data quality / trust:** Good visuals; commercial.
- **Privacy notes:** n/a.
- **Sources:** [ExerciseDB API v2 docs](https://exercisedb.notion.site/Table-of-Contents-1a6983b728ca80b69e85c5c74133220e), [Community V1 fork (MIT), ecosyste.ms listing](https://awesome.ecosyste.ms/projects/github.com%2Fcyberboyanmol%2Fexercisedb-api)
- **HealthHub fit:** Skip unless GIFs become essential; the free sources above suffice.

## Energy expenditure

### Compendium of Physical Activities (2024 Adult, Older Adult, Wheelchair)
- **Use:** MET values to estimate calories burned for any activity.
- **What it is:** Research-standard table: the 2024 Adult Compendium lists 1,114 activities (912 measured, 202 estimated) across 22 headings for ages 19-59; separate Older Adult (60+) and Wheelchair compendia.
- **Access:** Website listings and PDF/spreadsheet downloads at pacompendium.com; open-access papers in Journal of Sport and Health Science.
- **Cost & licence:** Free, including commercial use. Conditions: keep MET values unchanged, do not merge activities with different METs, cite the website or papers.
- **Data quality / trust:** High; peer-reviewed, measured values where available.
- **Privacy notes:** Static table, compute locally.
- **Sources:** [pacompendium.com](https://pacompendium.com/), [2024 Adult Compendium paper (PubMed)](https://pubmed.ncbi.nlm.nih.gov/38242596/), [Full text (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC10818145/), [Adult Compendium PDF](https://pacompendium.com/wp-content/uploads/2024/01/2024-adult-compendium_1_2024.pdf)
- **HealthHub fit:** Routines/activity log: kcal = MET x weight (kg) x hours using the vitals weight; switch to the Older Adult table for household members 60+. Top pick.
