# Field Shift — Malatya crop rotation lab

An educational decision-support prototype for [Field Shift: Adapting Farms with NASA Data](https://www.spaceappschallenge.org/2026/challenges/field-shift-adapting-farms-with-nasa-data/).

**Intended first users:** agricultural vocational students in Malatya, using the prototype in a short, instructor-led session. Learning impact has yet to be evaluated.

Open **Field-Shift.html** in a browser and select **English**. Two historical NASA POWER scenarios are included and work offline. The single-farm and shared-water modes let learners simulate crop rotations, replay them under identical weather, and compare trade-offs across three seasons.

## What drives decisions

NASA POWER daily precipitation replenishes modeled soil storage. Mean, minimum and maximum air temperature drive Hargreaves reference evapotranspiration. Crop stage coefficients scale reference demand and the daily maximum is checked against a sensitive-stage heat threshold. Farm-specific minimum cereal and, where applicable, legume plot-seasons filter recommendations. The decision report shows unmet water demand, heat exposure, crop-family repetition and days without crop cover.

Model inputs for field soils, planting dates, crop coefficients, stage timing and water quotas are illustrative and await local validation. Crop cover and family repetition are rotation indicators. They do not quantify soil health, yield, income or actual water savings.

## Submission files

- **Judging-Demo.pdf** and **Judging-Demo.html** contain the same seven English judging slides.
- **DEMO.md** holds the local presentation script and disclosure draft.
- **NASA-DATA.md**, **MODEL.md**, **ASSUMPTIONS.md** and **TESTING.md** document provenance, method, assumptions and verification.
- **LICENSE** applies to original project code. NASA POWER data and the linked references retain their respective source terms.

Source code uses browser and Node.js standard APIs. Run tests with `node --test model.test.mjs flow.test.mjs`. Run the Edge integration test with `node browser.test.mjs --file`. Rebuild the standalone edition with `node build.mjs`.

## Learning and decisions

Planting opens immediately. The optional reflection opens after play. Session JSON includes the reflection answers and correct count. Choose early, standard or late sowing in the active plot panel. Early and late shift the full crop calendar by 15 days, a teaching simplification. Relative yield and three mission stars appear in the report.
