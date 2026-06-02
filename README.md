# 🔆 Solar Dashboard Card

A responsive, production-ready **custom Lovelace card** for Home Assistant that
renders a solar-powered home as a live visualization: a weather/day-night aware
house image, four clickable node bubbles, animated energy-flow lines, a stats
strip, a battery card and a quarter cost-estimate card.

- ✅ **No build step** — single plain custom element, no external dependencies.
- ✅ **No Mushroom / card-mod / Node-RED / extra cards** required.
- ✅ Installable via **HACS** as a custom repository.
- ✅ Fully **configurable** entities, node positions (percentages) and images.
- ✅ Graceful handling of `unavailable` / `unknown` / missing sensors.
- ✅ Auto W/kW, %, °C, and currency formatting.
- ✅ Dark-theme by default; responsive for desktop & mobile.

---

## Features

| Area | Description |
|------|-------------|
| **House image** | Full-width responsive background that switches with `weather.*` state and day/night (driven by your sunrise/sunset sensors). |
| **Node bubbles** | `SOLAR`, `HOME`, `BATTERY`, `GRID` circular icon nodes positioned by percentage. Active nodes glow/pulse in the flow colour; the battery icon auto-tracks level + charging. Each is clickable and opens the HA more-info dialog for its entity. |
| **Flow lines** | Clean flat connectors with animated **moving dots**. Active flows stream green (generation/supply) or amber (grid consumption); inactive flows show a dim static track. Colours are configurable. |
| **Stats strip** | Solar generation, battery %, grid import/export, home load. |
| **Battery card** | Percentage, horizontal bar, charging/discharging/idle status, battery health (SoH). |
| **Cost card** | Quarter cost estimate with configurable tariffs. Clearly flagged as an estimate unless real kWh energy sensors are configured. |
| **Details overlay** | Optional extended grid (PV strings, temps, voltages, work mode, faults) toggled by an `input_boolean`. |

---

## Installation

### Option A — HACS (recommended, as a custom repository)

1. In Home Assistant, open **HACS**.
2. Click the **⋮ (three-dot) menu** → **Custom repositories**.
3. Enter the repository URL, e.g.
   `https://github.com/your-github-username/solar-dashboard-card`
4. For **Category / Type**, choose **Dashboard** (a.k.a. *Lovelace / Plugin*).
5. Click **Add**, then find **Solar Dashboard Card** in the list and click
   **Download**.
6. **Refresh your browser** (and clear cache if needed).

HACS automatically registers the JavaScript resource for you when installed as a
Dashboard plugin. If your dashboards are in **YAML mode**, add the resource
manually (see below).

### Option B — Manual install

1. Copy `dist/solar-dashboard-card.js` into your HA config at:
   `<config>/www/solar-dashboard-card/solar-dashboard-card.js`
   (so it is served from `/local/solar-dashboard-card/solar-dashboard-card.js`).
2. Add it as a Lovelace resource (see next section).

---

## Adding the card resource manually (if needed)

Only required for **YAML-mode dashboards** or a manual install.

**Via UI:** Settings → Dashboards → ⋮ → **Resources** → **Add resource**

- URL (HACS install): `/hacsfiles/solar-dashboard-card/solar-dashboard-card.js`
- URL (manual install): `/local/solar-dashboard-card/solar-dashboard-card.js`
- Resource type: **JavaScript Module**

**Via YAML** (`configuration.yaml` / `ui-lovelace.yaml`):

```yaml
lovelace:
  resources:
    - url: /hacsfiles/solar-dashboard-card/solar-dashboard-card.js
      type: module
```

---

## Adding the Lovelace card

Add a card to any dashboard view. Use **Manual** (the `</>` code editor) and
paste a config. A minimal example:

```yaml
type: custom:solar-dashboard-card
solar_generation_sensor: sensor.goodwe_pv_power
grid_feed_in_sensor: sensor.grid_import_power
grid_consumption_sensor: sensor.grid_export_power
battery_charge_sensor: sensor.battery_charging_2
battery_discharge_sensor: sensor.battery_discharging
battery_soc_sensor: sensor.goodwe_battery_state_of_charge
load_power_sensor: sensor.goodwe_house_consumption
weather_entity: weather.raceview
sunrise_sensor: sensor.raceview_astronomical_sunrise_time_0
sunset_sensor: sensor.raceview_astronomical_sunset_time_0
import_tariff: 0.24
export_tariff: 0.40
images:
  default: /local/Sunny.png
  sunny_day: /local/Sunny.png
  rainy_day: /local/Raining.png
  lightning_rainy_day: /local/Thunderstorm.png
  cloudy_day: /local/Cloudy.png
  clear_night: /local/Night.png
  rainy_night: /local/Night Raining.png
  lightning_rainy_night: /local/Night Thunderstorm.png
nodes:
  solar:   { x: 45, y: 18 }
  home:    { x: 50, y: 58 }
  battery: { x: 76, y: 53 }
  grid:    { x: 90, y: 30 }
```

A full, commented example with every option lives in
[`examples/lovelace-config.yaml`](examples/lovelace-config.yaml).

---

## Visual editor

The card ships with a built-in **visual editor** — when you add it through the
UI ("Add card" → search *Solar Dashboard Card*) or click **Edit** on the card,
you get a form instead of raw YAML. It covers all entities (with entity-id
autocomplete), tariffs/behaviour, node positions and image paths.

- Entity fields offer autocomplete from your live `hass.states`.
- **Leave any field blank to fall back to its built-in default** (shown as the
  placeholder).
- You can switch to YAML at any time with the **Show code editor** toggle; the
  two stay in sync.

---

## Cost cards — monthly / quarterly + billing dates

Choose which cost card(s) appear with `cost_period: quarter | month | both`.

Billing-cycle dates control the day-count used by the estimate:

```yaml
cost_period: both
month_start_day: 1            # billing month starts on the 1st
quarter_start_date: 2026-07-01  # quarters anchored to an AU financial-year start
```

### Accurate cost (`utility_meter`)

By default the cost card is an **estimate** projected from instantaneous power.
To make it accurate, give it real kWh totals that reset on the right cycle. A
ready-to-use package is in
[`examples/energy-meters.yaml`](examples/energy-meters.yaml). In short:

- **If you only have power (W) sensors** (the GoodWe defaults): add an
  `integration` (Riemann-sum) sensor to convert W→kWh, then `utility_meter`
  helpers with `cycle: monthly` and/or `cycle: quarterly`.
- **If you already have cumulative kWh sensors**: skip the integration step and
  point `utility_meter` straight at them.
- To shift the reset off the 1st, use the utility_meter `offset` option.

You can also create both from the UI: **Settings → Devices & Services → Helpers
→ "Integration - Riemann sum"** and **"Utility Meter"** (no restart needed).

Then point the matching period at them:

```yaml
# monthly card
import_energy_month_sensor: sensor.grid_import_energy_month
export_energy_month_sensor: sensor.grid_export_energy_month
# quarterly card
import_energy_quarter_sensor: sensor.grid_import_energy_quarter
export_energy_quarter_sensor: sensor.grid_export_energy_quarter
```

Each card independently switches from **`ESTIMATE`** to **`FROM ENERGY`** and
computes `import_kWh × import_tariff − export_kWh × export_tariff`.

---

## Configuration options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `type` | string | — | Must be `custom:solar-dashboard-card`. |
| `title` | string | _(none)_ | Optional header text. |
| `solar_generation_sensor` | entity | `sensor.goodwe_pv_power` | Live PV power. |
| `load_power_sensor` | entity | `sensor.goodwe_house_consumption` | House load. |
| `battery_charge_sensor` | entity | `sensor.battery_charging_2` | Battery charge power. |
| `battery_discharge_sensor` | entity | `sensor.battery_discharging` | Battery discharge power. |
| `battery_soc_sensor` | entity | `sensor.goodwe_battery_state_of_charge` | Battery % (SoC). |
| `battery_soh_sensor` | entity | `sensor.goodwe_battery_state_of_health` | Battery health % (optional). |
| `grid_import_sensor` *(or `grid_feed_in_sensor`)* | entity | `sensor.grid_import_power` | Power drawn **from** grid → Grid→Home flow. |
| `grid_export_sensor` *(or `grid_consumption_sensor`)* | entity | `sensor.grid_export_power` | Power sent **to** grid → Solar→Grid flow. |
| `weather_entity` | entity | `weather.raceview` | Drives image weather selection. |
| `sunrise_sensor` | entity | `sensor.raceview_astronomical_sunrise_time_0` | ISO timestamp of sunrise. |
| `sunset_sensor` | entity | `sensor.raceview_astronomical_sunset_time_0` | ISO timestamp of sunset. |
| `day_cycle_boolean` | entity | `input_boolean.energy_house_image_day_cycle` | When `off`, night switching is disabled (always day image). |
| `details_overlay_boolean` | entity | `input_boolean.energy_vision_details` | When `on`, shows the extended details grid. |
| `import_tariff` | number | `0.24` | $ per kWh imported. |
| `export_tariff` | number | `0.40` | $ per kWh exported (feed-in). |
| `cost_period` | string | `quarter` | Which cost card(s) to show: `quarter`, `month`, or `both`. |
| `month_start_day` | number | `1` | Day of month the billing month starts (used for the monthly day-count). |
| `quarter_start_date` | string | _(Jan 1)_ | Quarter anchor as `YYYY-MM-DD` or `MM-DD`; quarters repeat every 3 months from it. |
| `quarter_days` | number | `91` | Legacy fallback if the quarter anchor can't be computed. |
| `import_energy_month_sensor` / `export_energy_month_sensor` | entity | _(none)_ | Optional kWh totals (monthly cycle) → **accurate** monthly cost. |
| `import_energy_quarter_sensor` / `export_energy_quarter_sensor` | entity | _(none)_ | Optional kWh totals (quarterly cycle) → **accurate** quarter cost. |
| `import_energy_sensor` / `export_energy_sensor` | entity | _(none)_ | Legacy aliases — used as the quarter sensors if the `*_quarter_*` keys are unset. |
| `poll_interval` | number | `10` | Refresh interval in seconds. |
| `use_rest` | bool | `false` | Also poll `/api/states` via `hass.callApi` (usually unnecessary; `hass.states` is preferred). |
| `solar_label` | string | `Solar` | Label for the solar node. |
| `flow_power_color` | colour | `#21e065` | Colour of the moving flow dots for generation/supply (green). |
| `flow_consumption_color` | colour | `#ffc233` | Colour of the moving flow dots for grid consumption (amber). |
| `flow_battery_grid_color` | colour | `#7c5cff` | Colour for grid↔battery flows (charging **from** the grid and exporting **to** the grid). |
| `icons` | map | _(mdi defaults)_ | Override node icons: `solar`, `home`, `battery`, `grid` (any `mdi:` icon). Battery icon auto-tracks level/charging. |
| `images` | map | _(see below)_ | Image paths per weather/day-night key. |
| `nodes` | map | _(see below)_ | Node positions in percentages. |
| `inverter_temp_sensor`, `ambient_temp_sensor`, `battery_temp_sensor`, `cell_temp_low_sensor`, `cell_temp_high_sensor`, `grid_voltage_sensor`, `grid_current_sensor`, `inverter_fault_sensor`, `inverter_state_sensor`, `work_mode_select`, `pv1..4_power/voltage/current_sensor` | entity | _(GoodWe defaults)_ | Shown in the details overlay. |

> **Grid key note:** the example uses `grid_feed_in_sensor` /
> `grid_consumption_sensor` to match a supplied mapping. Internally these are
> treated as **import** and **export** respectively. If you prefer unambiguous
> names, use `grid_import_sensor` / `grid_export_sensor` — they take precedence.

---

## Adjusting image paths and node positions

### Images

1. Put your images in `<config>/www/` (this folder is served at `/local/`).
   Example: `<config>/www/Sunny.png` → `/local/Sunny.png`.
2. **Always use `/local/...` paths — never Windows paths** like `C:\...`.
   Spaces are allowed (`/local/Night Raining.png`).
3. Override any of the keys under `images:`. Only the keys you set change; the
   rest keep their defaults.

**Image selection logic**

- **Daytime** = current time is after `sunrise_sensor` and before `sunset_sensor`
  (raw ISO timestamps). Otherwise it is **nighttime**. If `day_cycle_boolean` is
  `off`, it is treated as always daytime. If the sun sensors are missing, it
  falls back to 06:00–18:00 local.
- Day: `sunny`→`sunny_day`, `rainy`→`rainy_day`,
  `lightning-rainy`→`lightning_rainy_day`, `cloudy`→`cloudy_day`.
- Night: `clear-night`→`clear_night`, `rainy`→`rainy_night`,
  `lightning-rainy`→`lightning_rainy_night`.
- Anything that doesn't match a rule falls back to `default`.

### Node positions

Positions are **percentages of the image** (`0` = left/top, `100` =
right/bottom), so they scale automatically on any screen size.

```yaml
nodes:
  solar:   { x: 45, y: 18 }   # over the roof / solar panels
  home:    { x: 50, y: 58 }   # over the front door
  battery: { x: 76, y: 53 }   # over the wall battery
  grid:    { x: 90, y: 30 }   # over the power pole
```

Tweak `x`/`y` until each bubble sits over the right part of **your** house
image. The flow lines re-route automatically to match.

---

## Energy flow logic

With `surplus = max(0, solar − load)`:

- **Solar → Home** (green) — solar generation > 0 and home load > 0.
- **Solar → Battery** (green) — charging and there is solar `surplus`.
- **Solar → Grid** (green) — exporting and there is solar `surplus`.
- **Battery → Home** (green) — discharging and `surplus` < load.
- **Grid → Home** (amber) — importing and `solar + discharge` < load.
- **Grid → Battery** (violet) — charging, grid importing, and `solar < load + charge`
  (i.e. the grid is topping up the battery).
- **Battery → Grid** (violet) — discharging, exporting, and `surplus < export`
  (i.e. the battery is feeding the grid).
- Inactive lines stay visible but dim.

> These are heuristics based on an energy balance — exact source attribution is
> impossible without directional sub-metering, but they give the right picture
> for normal operation. Power values are normalised to Watts using each
> entity's `unit_of_measurement`, so kW/W sensors both work.

---

## Limitations of the cost estimate

The **Quarter Cost** card shows one of two things:

1. **`FROM ENERGY` (accurate)** — when you configure `import_energy_sensor` and/or
   `export_energy_sensor` (kWh totals for the quarter). Cost is computed as
   `import_kWh × import_tariff − export_kWh × export_tariff`.

2. **`ESTIMATE` (rough)** — when no energy sensors are configured. The card can
   only see **instantaneous power** (W), so it projects the *current* grid
   import/export over the whole quarter. **This is deliberately crude** and will
   swing wildly as power changes — it is intended as a rough indicator only.

**Why energy sensors are far better:** instantaneous power tells you nothing
about how long you imported/exported. A `utility_meter` or your integration's
cumulative kWh sensor (ideally reset each quarter) captures the actual energy
used over time, which is what tariffs are billed on. Tariffs also vary
(time-of-use, supply charges, tiered rates) — for true billing accuracy use the
official Home Assistant **Energy dashboard** with your real cost sensors.

To get accurate figures, create quarter-resetting `utility_meter` helpers for
grid import and export and point `import_energy_sensor` / `export_energy_sensor`
at them.

---

## Troubleshooting

- **Card shows "Custom element doesn't exist"** — the resource isn't loaded.
  Refresh/clear cache, and confirm the resource URL (Option A vs B above).
- **Image is blank** — confirm the file exists under `<config>/www/` and the
  path uses `/local/` with the exact filename (case + spaces matter).
- **Nodes in the wrong spot** — adjust the `nodes:` percentages.
- **Values show `—`** — the entity is missing/`unavailable`; check the entity ID.

---

## License

[MIT](LICENSE)
