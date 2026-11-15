# Model method

Version 1.2.0. Soil water and crop family carry forward between years. Irrigation budgets reset each season. Daily reference evapotranspiration is estimated with FAO-56 equation 52, using mean temperature, temperature range, and astronomical radiation (equations 21, 23–25). Radiation is converted from MJ/m²/day to mm/day with 0.408. Daily crop demand is stage Kc × ET0. Crop-specific stage shares approximate timing across the planting-to-harvest period.

Effective precipitation is added to soil storage. Overflow beyond capacity is recorded. Soil supplies crop demand first. Remaining demand is allocated from the irrigation budget in proportion to daily demand in shared mode. Unmet demand is the volume left after both sources. A thermal exposure is counted when daily maximum temperature exceeds the crop threshold during its sensitive phase.

Hillside requires at least 6 cereal plot-seasons, Lowland requires 5, and Creekside requires at least 5 cereal and 2 legume plot-seasons. Each farm has 9 plot-seasons. Any plan can be simulated. Both recommendation paths filter out plans that miss an active target. Among the candidates evaluated, total unmet demand ranks first, followed by heat and family repetition. Crop cover changes appear in the report so learners can see the cost of a lower deficit. Candidate exploration is local and does not guarantee a global optimum.

[FAO-56 Chapter 3](https://www.fao.org/4/x0490e/x0490e07.htm)

## Relative yield

The FAO-33 linear water-response estimate is 100 × clamp(1 − Ky × unmet demand / demand, 0, 1). Actual crop water use is modeled as demand minus unmet demand. Summary values average plot-season percentages by area. This measures the modeled fraction of each crop’s own no-water-stress reference, not tonnes or a common yield benchmark across crops. Single edits must meet farm targets, keep or improve the index, and lower unmet demand. The hindsight plan keeps the index when a feasible candidate does so and otherwise shows the lowest-deficit feasible plan among those tested.

Seasonal Ky inputs: wheat 1.05 (winter wheat FAO-33 reference), barley 1.05 (illustrative cereal proxy), chickpea 1.06 (one Turkish field study), lentil 1.0 (illustrative neutral proxy). All require local calibration.

[FAO yield response](https://www.fao.org/4/i2800e/i2800e.pdf) · [Chickpea field study](https://libratez.cu.edu.tr/tezler/8437.pdf)

The primary comparison includes the player, the unshifted reference plan and three best-found plans by water deficit, relative yield, and crop cover. The bounded search simulates feasible seeds and their single crop or sowing-date changes in the same climate. The water plan preserves the player’s relative yield whenever a tested feasible option permits it. Different objectives may select the same plan.
