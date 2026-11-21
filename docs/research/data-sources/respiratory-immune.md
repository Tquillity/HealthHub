# Respiratory and immune: open data sources

Pollen, air quality and weather feeds that could warn allergic or asthmatic household members. Checked November 2026.

## Pollen

### Pollenrapporten API (Naturhistoriska riksmuseet, Palynologiska laboratoriet)
- **Use:** Swedish pollen forecasts and measured pollen levels by city and pollen type (birch, grass, mugwort, etc.).
- **What it is:** The Swedish Museum of Natural History's national pollen monitoring service, the source behind pollenrapporten.se.
- **Access:** Open REST API (FastAPI, JSON). Docs at `https://api.pollenrapporten.se/docs`; test endpoint `https://api.pollenrapporten.se/v1/pollen-types`. Terms: use only documented endpoints, no bulk downloads for many locations, do not re-fetch the same data repeatedly; misuse can lead to IP blocking.
- **Cost & licence:** Free; commercial use allowed. Open data under CC BY-SA 4.0; forecasts (text and values) under CC BY-ND 4.0 (do not alter the forecast text). Attribution: "Palynologiska laboratoriet, Naturhistoriska riksmuseet". Note the terms page labels the forecast licence inconsistently; treat forecasts as no-derivatives to be safe.
- **Data quality / trust:** High; official Swedish monitoring by trained palynologists, regional stations.
- **Privacy notes:** Only a region/city is sent. Fetch once a day server-side and cache; no personal data.
- **Sources:** [Använda våra öppna data (terms and API)](https://www.nrm.se/natur--och-miljoovervakning/pollenovervakning/pollenrapporten/anvanda-vara-oppna-data), [Pollenrapporten](https://www.nrm.se/natur--och-miljoovervakning/pollenovervakning/pollenrapporten), [API docs](https://api.pollenrapporten.se/docs)
- **HealthHub fit:** Dashboard "pollen today" card for household members who flag allergies in their profile; correlate pollen level with symptom entries in the journal. Top pick.

### Open-Meteo Air Quality API (incl. pollen)
- **Use:** Hourly air quality (PM2.5, PM10, NO2, O3, European AQI, UV index) and modelled pollen for any coordinate.
- **What it is:** Open-source weather API; air quality and pollen come from the Copernicus CAMS European forecast. Pollen is Europe-only (alder, birch, grass, mugwort, olive, ragweed).
- **Access:** REST/JSON, no key for the free tier. Free limits: 600 calls/min, 5,000/hour, 10,000/day (300,000/month).
- **Cost & licence:** Free API is **non-commercial only** (private, non-profit apps without ads or subscriptions are explicitly non-commercial; a private household app qualifies). Data CC BY 4.0 (credit Open-Meteo and CAMS). Server software AGPLv3 and can be self-hosted. Paid commercial licence exists.
- **Data quality / trust:** Medium-high; model forecasts, not station measurements.
- **Privacy notes:** Sends coordinates; round to city level to avoid sharing the home address.
- **Sources:** [Air Quality API docs](https://open-meteo.com/en/docs/air-quality-api), [Terms & Privacy](https://open-meteo.com/en/terms), [Pricing](https://open-meteo.com/en/pricing), [Open-Meteo source (GitHub)](https://github.com/open-meteo/open-meteo/blob/main/README.md)
- **HealthHub fit:** Air quality plus UV card on the dashboard; good backup when Pollenrapporten has no nearby station. Re-check licence if HealthHub is ever commercialised.

## Weather and air quality (Swedish authorities)

### SMHI open data
- **Use:** Swedish weather forecasts and observations, solar radiation, and air quality (SMHI is national data host for air quality via "Luftmiljödata").
- **What it is:** The Swedish Meteorological and Hydrological Institute's open data programme.
- **Access:** Open REST APIs via SMHI's open data explorer (specific endpoints not catalogued this session).
- **Cost & licence:** Free. Creative Commons Erkännande 4.0 SE (CC BY 4.0), commercial use allowed; name SMHI as source and state any changes. Weather warnings have separate terms (may be used freely but must not be altered).
- **Data quality / trust:** High; official national agency.
- **Privacy notes:** Location only; cache server-side.
- **Sources:** [SMHI öppna data](https://www.smhi.se/data/oppna-data), [Om SMHIs data](https://www.smhi.se/data/om-smhis-data), [Villkor för användning](https://www.smhi.se/data/om-smhis-data/villkor-for-anvandning)
- **HealthHub fit:** Temperature/heat-wave context for routines and children-family (e.g. hydration reminders on hot days); an alternative to Open-Meteo with a licence that allows commercial use.
