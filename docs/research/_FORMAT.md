# Research database format

Every lens folder (`science/`, `functional/`, `traditional/`, `data-sources/`, `apps/`) uses the same health-area file names, so the index can line them up side by side.

## Health areas (file slugs)

| Slug | Covers |
|---|---|
| `sleep` | sleep quality, insomnia, circadian rhythm, naps |
| `nutrition-digestion` | diet patterns, gut health, IBS, bloating, constipation, food intolerance, hydration |
| `respiratory-immune` | colds, cough, flu, sore throat, allergies, asthma, immunity |
| `cardio-metabolic` | blood pressure, cholesterol, blood sugar, weight, heart health |
| `mental-health-stress` | stress, anxiety, low mood, focus, burnout, mindfulness |
| `womens-health` | menstrual cycle, PMS, fertility, pregnancy, postpartum, menopause |
| `mens-health` | prostate, testosterone, sexual health, male-specific screening |
| `pain-musculoskeletal` | headache, migraine, back/joint pain, injuries, inflammation |
| `fitness-movement` | exercise, strength, mobility, recovery, steps, VO2max |
| `skin-hair-oral` | skin, eczema, acne, hair, teeth and gums |
| `children-family` | babies, kids, fever, household health, elderly care |
| `longevity-prevention` | screening, ageing, biomarkers, lab tests, preventive checks |
| `minor-ailments-first-aid` | burns, cuts, stings, nausea, hiccups, travel sickness, home first aid |
| `general` | anything cross-cutting that does not fit above |

A lens only creates files for areas where it found something.

## Entry template

```markdown
### <Name>
- **Use:** what it is for (symptom / goal)
- **What it is / how it's used:** 1-3 sentences, dose or method where relevant
- **Evidence:** Proven | Promising | Traditional / anecdotal | Disproven / likely harmful
- **Safety:** contraindications, interactions, who should avoid it (or "Low risk")
- **Sources:** [title](url), [title](url)
- **HealthHub fit:** which feature it could live in (tracker, journal prompt, routine, recipe, vitals, cycle, remedy library, household, lab results...) and a one-line idea
```

Evidence levels:
- **Proven**: supported by systematic reviews / meta-analyses or major clinical guidelines (NICE, WHO, Cochrane, national health authorities).
- **Promising**: some RCTs or consistent smaller studies, not yet conclusive.
- **Traditional / anecdotal**: long use or practitioner experience, little or no good trial data.
- **Disproven / likely harmful**: good evidence it does not work, or real risk. Keep these in so the app can warn about them.

For `data-sources/` and `apps/` the entry fields are adapted (licence, cost, API, what to borrow) but keep the same headings style.
