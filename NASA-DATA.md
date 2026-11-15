# NASA POWER data

The archive contains NASA POWER Daily API v2.10.3 records for 38.35°N, 38.31°E (Malatya). Coverage is September 1, 2003 through August 31, 2025, UTC. The four series contain 8,036 valid daily records each and no missing dates.

The original API response is nasa-raw.json. The normalized scenario package contains the request URL, coordinates, date range, units, API header and SHA-256 hashes. August is included in the simulation. The ranking uses September–July precipitation totals over complete rolling three-season windows.

| Scenario | Window | Selection rainfall |
| --- | --- | ---: |
| Lowest rainfall | September 2015–August 2018 | 903.96 mm |
| Near median | September 2008–August 2011 | 1,078.80 mm |

PRECTOTCORR drives soil water input. T2M, T2M_MAX and T2M_MIN drive the temperature-based reference evapotranspiration estimate. T2M_MAX separately determines modeled heat threshold crossings.

[POWER Daily API documentation](https://power.larc.nasa.gov/docs/services/api/temporal/daily/) · [FAO-56 meteorological data](https://www.fao.org/4/x0490e/x0490e07.htm)
