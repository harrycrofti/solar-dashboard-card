/**
 * Solar Dashboard Card
 * A responsive solar-energy home visualization for Home Assistant / Lovelace.
 *
 * - No build step required (plain custom element, no external deps).
 * - No Mushroom / card-mod / Node-RED / extra cards required.
 * - Configurable entities, node positions (percentages) and images.
 *
 * Author: Crofti
 * License: MIT
 */

const CARD_VERSION = "1.2.0";

/* eslint-disable no-console */
console.info(
  `%c SOLAR-DASHBOARD-CARD %c v${CARD_VERSION} `,
  "color:#fff;background:#0a84ff;font-weight:700;border-radius:4px 0 0 4px;padding:2px 6px;",
  "color:#0a84ff;background:#11151c;border-radius:0 4px 4px 0;padding:2px 6px;"
);

/* ------------------------------------------------------------------ *
 * Defaults
 * ------------------------------------------------------------------ */

const DEFAULTS = {
  // Core energy entities
  solar_generation_sensor: "sensor.goodwe_pv_power",
  load_power_sensor: "sensor.goodwe_house_consumption",
  battery_charge_sensor: "sensor.battery_charging_2",
  battery_discharge_sensor: "sensor.battery_discharging",
  battery_soc_sensor: "sensor.goodwe_battery_state_of_charge",
  battery_soh_sensor: "sensor.goodwe_battery_state_of_health",

  // Grid. The user-supplied config uses grid_feed_in_sensor / grid_consumption_sensor.
  // We treat the *import* value as power drawn FROM the grid (Grid -> Home),
  // and the *export* value as power sent TO the grid (Solar -> Grid).
  // Preferred keys are grid_import_sensor / grid_export_sensor, but the
  // feed_in / consumption keys are accepted as aliases for backwards-compat.
  grid_import_sensor: undefined, // fallback handled in _resolveEntities()
  grid_export_sensor: undefined,
  grid_feed_in_sensor: "sensor.grid_import_power",
  grid_consumption_sensor: "sensor.grid_export_power",

  // Optional extended/detail entities (shown when details overlay is on)
  inverter_temp_sensor: "sensor.goodwe_inverter_temperature_module",
  ambient_temp_sensor: "sensor.goodwe_inverter_temperature_air",
  battery_temp_sensor: "sensor.goodwe_battery_temperature",
  cell_temp_low_sensor: "sensor.goodwe_battery_min_cell_temperature",
  cell_temp_high_sensor: "sensor.goodwe_battery_max_cell_temperature",
  grid_voltage_sensor: "sensor.goodwe_on_grid_l1_voltage",
  grid_current_sensor: "sensor.goodwe_on_grid_l1_current",
  inverter_fault_sensor: "sensor.goodwe_errors",
  inverter_state_sensor: "sensor.goodwe_grid_mode",
  work_mode_select: "sensor.goodwe_work_mode",
  pv1_power_sensor: "sensor.goodwe_pv1_power",
  pv1_current_sensor: "sensor.goodwe_pv1_current",
  pv1_voltage_sensor: "sensor.goodwe_pv1_voltage",
  pv2_power_sensor: "sensor.goodwe_pv2_power",
  pv2_current_sensor: "sensor.goodwe_pv2_current",
  pv2_voltage_sensor: "sensor.goodwe_pv2_voltage",
  pv3_power_sensor: "sensor.goodwe_pv3_power",
  pv3_current_sensor: "sensor.goodwe_pv3_current",
  pv3_voltage_sensor: "sensor.goodwe_pv3_voltage",
  pv4_power_sensor: "sensor.goodwe_pv4_power",
  pv4_current_sensor: "sensor.goodwe_pv4_current",
  pv4_voltage_sensor: "sensor.goodwe_pv4_voltage",

  // Booleans / weather / sun
  day_cycle_boolean: "input_boolean.energy_house_image_day_cycle",
  details_overlay_boolean: "input_boolean.energy_vision_details",
  weather_entity: "weather.raceview",
  sunrise_sensor: "sensor.raceview_astronomical_sunrise_time_0",
  sunset_sensor: "sensor.raceview_astronomical_sunset_time_0",

  // Labels
  solar_label: "Solar",
  title: "",

  // Tariffs / cost estimate
  import_tariff: 0.24,
  export_tariff: 0.4,
  cost_period: "quarter", // "quarter" | "month" | "both"
  month_start_day: 1, // day-of-month the billing month starts (1-31)
  quarter_start_date: "", // anchor "YYYY-MM-DD" or "MM-DD"; blank = Jan 1
  quarter_days: 91, // legacy fallback if the quarter anchor can't be computed
  // Optional kWh totals for accurate cost (utility_meter sensors).
  import_energy_month_sensor: undefined,
  export_energy_month_sensor: undefined,
  import_energy_quarter_sensor: undefined,
  export_energy_quarter_sensor: undefined,
  // Legacy aliases — used as the quarter sensors if the *_quarter_* keys are unset.
  import_energy_sensor: undefined,
  export_energy_sensor: undefined,

  // Behaviour
  poll_interval: 10, // seconds
  use_rest: false, // optional /api/states REST polling

  // Appearance — flow-dot colours
  flow_power_color: "#21e065", // green: generation / supply
  flow_consumption_color: "#ffc233", // amber: grid draw to home
  flow_battery_grid_color: "#7c5cff", // violet: grid<->battery (charge from / export to grid)

  // Images (all must use /local/, never Windows paths)
  images: {
    default: "/local/Sunny.png",
    sunny_day: "/local/Sunny.png",
    rainy_day: "/local/Raining.png",
    lightning_rainy_day: "/local/Thunderstorm.png",
    cloudy_day: "/local/Cloudy.png",
    clear_night: "/local/Night.png",
    rainy_night: "/local/Night Raining.png",
    lightning_rainy_night: "/local/Night Thunderstorm.png",
  },

  // Node positions in percentages of the image (0-100)
  nodes: {
    solar: { x: 45, y: 18 },
    home: { x: 50, y: 58 },
    battery: { x: 76, y: 53 },
    grid: { x: 90, y: 30 },
  },
};

/* ------------------------------------------------------------------ *
 * Card
 * ------------------------------------------------------------------ */

class SolarDashboardCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._hass = undefined;
    this._config = undefined;
    this._built = false;
    this._els = {};
    this._timer = undefined;
    this._restStates = undefined; // cache from REST polling
  }

  /* ---- Lovelace lifecycle ---- */

  setConfig(config) {
    if (!config || typeof config !== "object") {
      throw new Error("Invalid configuration");
    }
    // Deep-merge user config over defaults (images + nodes merged per-key).
    const merged = { ...DEFAULTS, ...config };
    merged.images = { ...DEFAULTS.images, ...(config.images || {}) };
    merged.nodes = {
      solar: { ...DEFAULTS.nodes.solar, ...((config.nodes || {}).solar || {}) },
      home: { ...DEFAULTS.nodes.home, ...((config.nodes || {}).home || {}) },
      battery: {
        ...DEFAULTS.nodes.battery,
        ...((config.nodes || {}).battery || {}),
      },
      grid: { ...DEFAULTS.nodes.grid, ...((config.nodes || {}).grid || {}) },
    };
    this._config = this._resolveEntities(merged);
    this._built = false; // force rebuild
    if (this.shadowRoot) this.shadowRoot.innerHTML = "";
    this._maybeBuild();
  }

  set hass(hass) {
    this._hass = hass;
    this._maybeBuild();
    this._update();
  }

  get hass() {
    return this._hass;
  }

  getCardSize() {
    return 9;
  }

  static getConfigElement() {
    return document.createElement("solar-dashboard-card-editor");
  }

  static getStubConfig() {
    return {
      type: "custom:solar-dashboard-card",
      solar_generation_sensor: "sensor.goodwe_pv_power",
      load_power_sensor: "sensor.goodwe_house_consumption",
      battery_soc_sensor: "sensor.goodwe_battery_state_of_charge",
      weather_entity: "weather.raceview",
    };
  }

  connectedCallback() {
    this._startTimer();
  }

  disconnectedCallback() {
    this._stopTimer();
  }

  /* ---- polling ---- */

  _startTimer() {
    this._stopTimer();
    const secs = Number(this._config?.poll_interval) || 10;
    this._timer = window.setInterval(() => this._tick(), secs * 1000);
  }

  _stopTimer() {
    if (this._timer) {
      window.clearInterval(this._timer);
      this._timer = undefined;
    }
  }

  async _tick() {
    // Optional REST polling fallback (off by default — hass.states is preferred).
    if (this._config?.use_rest && this._hass?.callApi) {
      try {
        const states = await this._hass.callApi("GET", "states");
        this._restStates = {};
        for (const s of states) this._restStates[s.entity_id] = s;
      } catch (e) {
        // Silent: fall back to hass.states.
        this._restStates = undefined;
      }
    }
    this._update();
  }

  /* ---- entity resolution / aliases ---- */

  _resolveEntities(cfg) {
    // grid_import / grid_export with feed_in / consumption aliases.
    cfg.grid_import_sensor =
      cfg.grid_import_sensor || cfg.grid_feed_in_sensor || "sensor.grid_import_power";
    cfg.grid_export_sensor =
      cfg.grid_export_sensor ||
      cfg.grid_consumption_sensor ||
      "sensor.grid_export_power";
    return cfg;
  }

  /* ---- state helpers (prefer hass.states, fall back to REST cache) ---- */

  _stateObj(entityId) {
    if (!entityId) return undefined;
    if (this._hass && this._hass.states && this._hass.states[entityId]) {
      return this._hass.states[entityId];
    }
    if (this._restStates && this._restStates[entityId]) {
      return this._restStates[entityId];
    }
    return undefined;
  }

  _rawState(entityId) {
    const s = this._stateObj(entityId);
    return s ? s.state : undefined;
  }

  _isUnavailable(v) {
    return (
      v === undefined ||
      v === null ||
      v === "" ||
      v === "unavailable" ||
      v === "unknown"
    );
  }

  /** Numeric value of an entity, or null if missing/unavailable/non-numeric. */
  _num(entityId) {
    const s = this._stateObj(entityId);
    if (!s || this._isUnavailable(s.state)) return null;
    const n = parseFloat(s.state);
    return Number.isFinite(n) ? n : null;
  }

  /** Power normalised to Watts. Honours the entity's unit_of_measurement. */
  _powerW(entityId) {
    const s = this._stateObj(entityId);
    if (!s || this._isUnavailable(s.state)) return null;
    const n = parseFloat(s.state);
    if (!Number.isFinite(n)) return null;
    const unit = String(
      (s.attributes && s.attributes.unit_of_measurement) || "W"
    ).toLowerCase();
    if (unit.includes("kw")) return n * 1000;
    if (unit.includes("mw")) return n * 1000000;
    return n; // assume W
  }

  /** Energy normalised to kWh. */
  _energyKwh(entityId) {
    const s = this._stateObj(entityId);
    if (!s || this._isUnavailable(s.state)) return null;
    const n = parseFloat(s.state);
    if (!Number.isFinite(n)) return null;
    const unit = String(
      (s.attributes && s.attributes.unit_of_measurement) || "kWh"
    ).toLowerCase();
    if (unit.includes("wh") && !unit.includes("kwh")) return n / 1000;
    return n; // assume kWh
  }

  /* ---- formatting ---- */

  _fmtPower(watts) {
    if (watts === null || watts === undefined) return "—";
    const a = Math.abs(watts);
    if (a >= 1000) return `${(watts / 1000).toFixed(2)} kW`;
    return `${Math.round(watts)} W`;
  }

  _fmtPercent(n) {
    if (n === null || n === undefined) return "—";
    return `${Math.round(n)}%`;
  }

  _fmtTemp(entityId) {
    const s = this._stateObj(entityId);
    if (!s || this._isUnavailable(s.state)) return "—";
    const n = parseFloat(s.state);
    if (!Number.isFinite(n)) return s.state; // non-numeric, show raw
    const unit =
      (s.attributes && s.attributes.unit_of_measurement) || "°C";
    return `${n.toFixed(1)} ${unit}`;
  }

  _fmtNum(entityId, digits, fallbackUnit) {
    const s = this._stateObj(entityId);
    if (!s || this._isUnavailable(s.state)) return "—";
    const n = parseFloat(s.state);
    if (!Number.isFinite(n)) return s.state;
    const unit =
      (s.attributes && s.attributes.unit_of_measurement) || fallbackUnit || "";
    return `${n.toFixed(digits)}${unit ? " " + unit : ""}`;
  }

  _fmtMoney(v) {
    if (v === null || v === undefined || !Number.isFinite(v)) return "—";
    const sign = v < 0 ? "-" : "";
    return `${sign}$${Math.abs(v).toFixed(2)}`;
  }

  /* ---- day / night + image selection ---- */

  _isDaytime() {
    // If a day-cycle boolean is configured and OFF, disable night switching.
    const dc = this._rawState(this._config.day_cycle_boolean);
    if (dc !== undefined && dc === "off") return true;

    const srRaw = this._rawState(this._config.sunrise_sensor);
    const ssRaw = this._rawState(this._config.sunset_sensor);
    const sr = srRaw ? Date.parse(srRaw) : NaN;
    const ss = ssRaw ? Date.parse(ssRaw) : NaN;
    const now = Date.now();
    if (!Number.isNaN(sr) && !Number.isNaN(ss)) {
      return now >= sr && now < ss;
    }
    // Fallback: assume daytime between 06:00 and 18:00 local.
    const h = new Date().getHours();
    return h >= 6 && h < 18;
  }

  _selectImage() {
    const img = this._config.images;
    const day = this._isDaytime();
    const wRaw = this._rawState(this._config.weather_entity);
    const cond = wRaw ? String(wRaw).toLowerCase() : "";

    let key = "default";
    if (day) {
      switch (cond) {
        case "sunny":
        case "clear":
        case "clear-day":
          key = "sunny_day";
          break;
        case "rainy":
        case "pouring":
        case "snowy-rainy":
          key = "rainy_day";
          break;
        case "lightning-rainy":
        case "lightning":
          key = "lightning_rainy_day";
          break;
        case "cloudy":
        case "partlycloudy":
        case "fog":
          key = "cloudy_day";
          break;
        default:
          key = "default";
      }
    } else {
      switch (cond) {
        case "clear-night":
        case "clear":
        case "sunny":
          key = "clear_night";
          break;
        case "rainy":
        case "pouring":
        case "snowy-rainy":
          key = "rainy_night";
          break;
        case "lightning-rainy":
        case "lightning":
          key = "lightning_rainy_night";
          break;
        case "cloudy":
        case "partlycloudy":
        case "fog":
          key = "clear_night"; // no dedicated night-cloudy image supplied
          break;
        default:
          key = "clear_night";
      }
    }
    return img[key] || img.default || DEFAULTS.images.default;
  }

  /* ---- more-info dialog ---- */

  _openMoreInfo(entityId) {
    if (!entityId) return;
    const ev = new Event("hass-more-info", { bubbles: true, composed: true });
    ev.detail = { entityId };
    this.dispatchEvent(ev);
  }

  /* ---- build / render ---- */

  _maybeBuild() {
    if (!this._config || this._built || !this.shadowRoot) return;
    this._build();
  }

  _line(a, b) {
    // Flat straight connector between two percentage points.
    return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
  }

  _bezier(a, b) {
    // (kept for reference) Smooth vertical S-curve between two points.
    const my = (a.y + b.y) / 2;
    return `M ${a.x} ${a.y} C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`;
  }

  _batteryIcon(soc, charging) {
    if (soc === null || soc === undefined) return "mdi:battery-unknown";
    let lvl = Math.round(soc / 10) * 10;
    if (lvl > 100) lvl = 100;
    if (lvl < 0) lvl = 0;
    if (charging) return `mdi:battery-charging-${lvl === 0 ? 10 : lvl}`;
    if (lvl >= 100) return "mdi:battery";
    if (lvl <= 0) return "mdi:battery-outline";
    return `mdi:battery-${lvl}`;
  }

  _build() {
    const n = this._config.nodes;
    // kind: "power" (green supply), "consume" (amber grid draw),
    //       "battgrid" (violet grid<->battery: charge from grid / export to grid)
    const flows = [
      { id: "solar-home", from: n.solar, to: n.home, kind: "power" },
      { id: "solar-battery", from: n.solar, to: n.battery, kind: "power" },
      { id: "solar-grid", from: n.solar, to: n.grid, kind: "power" },
      { id: "battery-home", from: n.battery, to: n.home, kind: "power" },
      { id: "grid-home", from: n.grid, to: n.home, kind: "consume" },
      { id: "grid-battery", from: n.grid, to: n.battery, kind: "battgrid" },
      { id: "battery-grid", from: n.battery, to: n.grid, kind: "battgrid" },
    ];

    // Static dim tracks (deduped per segment so overlapping pairs don't double up).
    const seen = new Set();
    const trackPaths = flows
      .map((f) => {
        const key = [`${f.from.x},${f.from.y}`, `${f.to.x},${f.to.y}`]
          .sort()
          .join("|");
        if (seen.has(key)) return "";
        seen.add(key);
        return `<path class="sdc-track" d="${this._line(
          f.from,
          f.to
        )}" vector-effect="non-scaling-stroke" />`;
      })
      .join("");

    // Animated moving-dot overlays (one per flow, on top of the tracks).
    const overlayPaths = flows
      .map(
        (f) =>
          `<path id="flow-${f.id}" class="sdc-flow ${f.kind}" d="${this._line(
            f.from,
            f.to
          )}" vector-effect="non-scaling-stroke" />`
      )
      .join("");

    const flowPaths = trackPaths + overlayPaths;

    const ic = this._config.icons || {};
    const icons = {
      solar: ic.solar || "mdi:solar-power-variant",
      home: ic.home || "mdi:home-lightning-bolt",
      battery: ic.battery || "mdi:battery-high",
      grid: ic.grid || "mdi:transmission-tower",
    };

    const node = (id, label) => `
      <button class="sdc-node sdc-node-${id}" data-node="${id}"
              style="left:${n[id].x}%;top:${n[id].y}%"
              title="${label}">
        <span class="sdc-node-ring">
          <ha-icon id="icon-${id}" icon="${icons[id]}"></ha-icon>
        </span>
        <span class="sdc-node-meta">
          <span class="sdc-node-label">${label}</span>
          <span class="sdc-node-value" id="val-${id}">—</span>
        </span>
      </button>`;

    // Which cost period card(s) to render.
    const cp = String(this._config.cost_period || "quarter").toLowerCase();
    const periods =
      cp === "both"
        ? ["month", "quarter"]
        : cp === "month"
        ? ["month"]
        : ["quarter"];
    this._costPeriods = periods;
    const periodLabel = { month: "Monthly Cost", quarter: "Quarter Cost" };
    const costPanels = periods
      .map(
        (p) => `
          <div class="sdc-panel sdc-cost-card">
            <div class="sdc-panel-head">
              <span>${periodLabel[p]}</span>
              <span class="sdc-cost-tag" id="cost-tag-${p}">ESTIMATE</span>
            </div>
            <div class="sdc-cost-value" id="cost-value-${p}">—</div>
            <div class="sdc-panel-foot" id="cost-foot-${p}"></div>
          </div>`
      )
      .join("");

    const title = this._config.title
      ? `<div class="sdc-title">${this._config.title}</div>`
      : "";

    this.shadowRoot.innerHTML = `
      <style>${this._styles()}</style>
      <ha-card>
        ${title}
        <div class="sdc-stage" id="stage">
          <img class="sdc-bg" id="bg" alt="House" />
          <svg class="sdc-flows" viewBox="0 0 100 100" preserveAspectRatio="none">
            ${flowPaths}
          </svg>
          ${node("solar", this._config.solar_label || "Solar")}
          ${node("home", "Home")}
          ${node("battery", "Battery")}
          ${node("grid", "Grid")}
        </div>

        <div class="sdc-stats" id="stats">
          <div class="sdc-stat"><span class="sdc-stat-k">Solar</span><span class="sdc-stat-v" id="st-solar">—</span></div>
          <div class="sdc-stat"><span class="sdc-stat-k">Battery</span><span class="sdc-stat-v" id="st-batt">—</span></div>
          <div class="sdc-stat"><span class="sdc-stat-k">Grid</span><span class="sdc-stat-v" id="st-grid">—</span></div>
          <div class="sdc-stat"><span class="sdc-stat-k">Home</span><span class="sdc-stat-v" id="st-home">—</span></div>
        </div>

        <div class="sdc-cards">
          <div class="sdc-panel sdc-battery-card">
            <div class="sdc-panel-head">
              <span>Battery</span>
              <span class="sdc-batt-status" id="batt-status">—</span>
            </div>
            <div class="sdc-batt-pct" id="batt-pct">—</div>
            <div class="sdc-bar"><div class="sdc-bar-fill" id="batt-bar"></div></div>
            <div class="sdc-panel-foot" id="batt-health"></div>
          </div>

          ${costPanels}
        </div>

        <div class="sdc-details" id="details" hidden></div>
      </ha-card>
    `;

    // cache refs
    const $ = (id) => this.shadowRoot.getElementById(id);
    this._els = {
      bg: $("bg"),
      flows: {},
      vals: {
        solar: $("val-solar"),
        home: $("val-home"),
        battery: $("val-battery"),
        grid: $("val-grid"),
      },
      battIcon: $("icon-battery"),
      stSolar: $("st-solar"),
      stBatt: $("st-batt"),
      stGrid: $("st-grid"),
      stHome: $("st-home"),
      battStatus: $("batt-status"),
      battPct: $("batt-pct"),
      battBar: $("batt-bar"),
      battHealth: $("batt-health"),
      details: $("details"),
    };
    flows.forEach((f) => {
      this._els.flows[f.id] = $(`flow-${f.id}`);
    });
    // per-period cost card refs
    this._costEls = {};
    periods.forEach((p) => {
      this._costEls[p] = {
        tag: $(`cost-tag-${p}`),
        value: $(`cost-value-${p}`),
        foot: $(`cost-foot-${p}`),
      };
    });

    // node clicks -> more-info
    const nodeEntity = {
      solar: this._config.solar_generation_sensor,
      home: this._config.load_power_sensor,
      battery: this._config.battery_soc_sensor,
      grid: this._config.grid_import_sensor,
    };
    this.shadowRoot.querySelectorAll(".sdc-node").forEach((el) => {
      el.addEventListener("click", () =>
        this._openMoreInfo(nodeEntity[el.dataset.node])
      );
    });

    this._built = true;
  }

  /* ---- live update ---- */

  _setFlow(id, active) {
    const el = this._els.flows[id];
    if (el) el.classList.toggle("active", !!active);
  }

  _update() {
    if (!this._built || !this._config) return;
    const C = this._config;

    // ---- read values ----
    const solarW = this._powerW(C.solar_generation_sensor);
    const loadW = this._powerW(C.load_power_sensor);
    const chargeW = this._powerW(C.battery_charge_sensor);
    const dischargeW = this._powerW(C.battery_discharge_sensor);
    const importW = this._powerW(C.grid_import_sensor);
    const exportW = this._powerW(C.grid_export_sensor);
    const soc = this._num(C.battery_soc_sensor);
    const soh = this._num(C.battery_soh_sensor);

    // ---- background image ----
    const src = this._selectImage();
    if (this._els.bg.getAttribute("src") !== src) {
      this._els.bg.setAttribute("src", src);
    }

    // ---- node values ----
    this._els.vals.solar.textContent = this._fmtPower(solarW);
    this._els.vals.home.textContent = this._fmtPower(loadW);
    this._els.vals.battery.textContent = this._fmtPercent(soc);
    if (importW !== null && importW > 0) {
      this._els.vals.grid.textContent = "↓ " + this._fmtPower(importW);
    } else if (exportW !== null && exportW > 0) {
      this._els.vals.grid.textContent = "↑ " + this._fmtPower(exportW);
    } else {
      this._els.vals.grid.textContent = "0 W";
    }

    // ---- flow activity ----
    // Safe numerics + a simple energy-balance attribution. Exact attribution is
    // impossible without directional sensors, so these are sensible heuristics.
    const s = solarW || 0;
    const l = loadW || 0;
    const ch = chargeW || 0;
    const dis = dischargeW || 0;
    const imp = importW || 0;
    const exp = exportW || 0;
    const surplus = Math.max(0, s - l); // solar left after the house load

    const isCharging = ch > 0;
    const isDischarging = dis > 0;

    const solarToHome = s > 0 && l > 0;
    const solarToBattery = isCharging && surplus > 0; // charged by solar surplus
    const gridToBattery = isCharging && imp > 0 && s < l + ch; // charged by grid
    const solarToGrid = exp > 0 && surplus > 0; // exporting solar surplus
    const batteryToGrid = isDischarging && exp > 0 && surplus < exp; // battery exports
    const gridToHome = imp > 0 && s + dis < l; // grid covers remaining load
    const batteryToHome = isDischarging && l > 0 && surplus < l; // battery covers load

    // battery node icon reflects level + charging
    if (this._els.battIcon) {
      this._els.battIcon.setAttribute(
        "icon",
        this._batteryIcon(soc, isCharging)
      );
    }

    this._setFlow("solar-home", solarToHome);
    this._setFlow("solar-battery", solarToBattery);
    this._setFlow("solar-grid", solarToGrid);
    this._setFlow("battery-home", batteryToHome);
    this._setFlow("grid-home", gridToHome);
    this._setFlow("grid-battery", gridToBattery);
    this._setFlow("battery-grid", batteryToGrid);

    // solar node "active" glow
    this.shadowRoot
      .querySelector(".sdc-node-solar")
      ?.classList.toggle("active", s > 0);
    this.shadowRoot
      .querySelector(".sdc-node-battery")
      ?.classList.toggle("active", isCharging || isDischarging);
    this.shadowRoot
      .querySelector(".sdc-node-grid")
      ?.classList.toggle("active", imp > 0 || exp > 0);
    this.shadowRoot
      .querySelector(".sdc-node-home")
      ?.classList.toggle("active", l > 0);

    // ---- stats strip ----
    this._els.stSolar.textContent = this._fmtPower(solarW);
    this._els.stBatt.textContent = this._fmtPercent(soc);
    const impStr =
      importW !== null && importW > 0 ? this._fmtPower(importW) : "0 W";
    const expStr =
      exportW !== null && exportW > 0 ? this._fmtPower(exportW) : "0 W";
    this._els.stGrid.innerHTML = `<span class="sdc-imp">↓${impStr}</span> <span class="sdc-exp">↑${expStr}</span>`;
    this._els.stHome.textContent = this._fmtPower(loadW);

    // ---- battery card ----
    let status = "Idle";
    let statusCls = "idle";
    if (isDischarging) {
      status = "Discharging";
      statusCls = "discharging";
    } else if (isCharging) {
      status = gridToBattery ? "Charging (grid)" : "Charging";
      statusCls = "charging";
    }
    this._els.battStatus.textContent = status;
    this._els.battStatus.className = "sdc-batt-status " + statusCls;
    this._els.battPct.textContent = this._fmtPercent(soc);
    const pct = soc === null ? 0 : Math.max(0, Math.min(100, soc));
    this._els.battBar.style.width = pct + "%";
    this._els.battBar.className = "sdc-bar-fill " + statusCls;
    this._els.battHealth.textContent =
      soh !== null ? `Health: ${Math.round(soh)}%` : "";

    // ---- cost card ----
    this._updateCost(importW, exportW);

    // ---- details overlay ----
    this._updateDetails();
  }

  _quarterAnchor() {
    const v = this._config.quarter_start_date;
    if (v) {
      const p = String(v).split("-").map((x) => parseInt(x, 10));
      if (p.length >= 3 && p.every(Number.isFinite))
        return { month: p[1] - 1, day: p[2] };
      if (p.length === 2 && p.every(Number.isFinite))
        return { month: p[0] - 1, day: p[1] };
    }
    return { month: 0, day: 1 }; // Jan 1
  }

  /** Number of days in the current billing period (month or quarter). */
  _periodDays(period) {
    try {
      const now = new Date();
      if (period === "month") {
        let d = parseInt(this._config.month_start_day, 10);
        if (!Number.isFinite(d) || d < 1) d = 1;
        if (d > 31) d = 31;
        let start = new Date(now.getFullYear(), now.getMonth(), d);
        if (now.getDate() < d)
          start = new Date(now.getFullYear(), now.getMonth() - 1, d);
        const end = new Date(start.getFullYear(), start.getMonth() + 1, d);
        return Math.max(1, Math.round((end - start) / 86400000));
      }
      // quarter
      const a = this._quarterAnchor();
      let start = new Date(now.getFullYear() - 1, a.month, a.day);
      for (let i = 0; i < 12; i++) {
        const next = new Date(start.getFullYear(), start.getMonth() + 3, a.day);
        if (now >= start && now < next)
          return Math.max(1, Math.round((next - start) / 86400000));
        start = next;
      }
    } catch (e) {
      /* fall through */
    }
    return period === "month" ? 30 : Number(this._config.quarter_days) || 91;
  }

  _energySensorsFor(period) {
    const C = this._config;
    if (period === "month") {
      return [C.import_energy_month_sensor, C.export_energy_month_sensor];
    }
    return [
      C.import_energy_quarter_sensor || C.import_energy_sensor,
      C.export_energy_quarter_sensor || C.export_energy_sensor,
    ];
  }

  _updateCost(importW, exportW) {
    (this._costPeriods || ["quarter"]).forEach((p) =>
      this._updateCostPeriod(p, importW, exportW)
    );
  }

  _updateCostPeriod(period, importW, exportW) {
    const els = this._costEls && this._costEls[period];
    if (!els) return;
    const C = this._config;
    const impTariff = Number(C.import_tariff);
    const expTariff = Number(C.export_tariff);
    const [impSensor, expSensor] = this._energySensorsFor(period);
    const impKwh = impSensor ? this._energyKwh(impSensor) : null;
    const expKwh = expSensor ? this._energyKwh(expSensor) : null;

    if (impKwh !== null || expKwh !== null) {
      // Accurate: from real energy totals (utility_meter etc.).
      const cost = (impKwh || 0) * impTariff - (expKwh || 0) * expTariff;
      els.tag.textContent = "FROM ENERGY";
      els.tag.className = "sdc-cost-tag actual";
      els.value.textContent = this._fmtMoney(cost);
      els.foot.textContent = `Import ${(impKwh || 0).toFixed(
        1
      )} kWh @ $${impTariff} · Export ${(expKwh || 0).toFixed(
        1
      )} kWh @ $${expTariff}`;
    } else {
      // Rough projection from instantaneous power (clearly flagged).
      const days = this._periodDays(period);
      const impKw = importW !== null ? Math.max(0, importW) / 1000 : 0;
      const expKw = exportW !== null ? Math.max(0, exportW) / 1000 : 0;
      const cost =
        impKw * 24 * days * impTariff - expKw * 24 * days * expTariff;
      els.tag.textContent = "ESTIMATE";
      els.tag.className = "sdc-cost-tag";
      els.value.textContent = this._fmtMoney(cost);
      els.foot.textContent = `Rough projection of current power over ~${days} days. Configure ${period} energy sensors (kWh) for accuracy.`;
    }
  }

  _updateDetails() {
    const C = this._config;
    const show = this._rawState(C.details_overlay_boolean) === "on";
    const d = this._els.details;
    if (!show) {
      d.hidden = true;
      d.innerHTML = "";
      return;
    }
    d.hidden = false;

    const row = (label, value, entity) =>
      `<div class="sdc-d-row" data-entity="${entity || ""}">
        <span class="sdc-d-label">${label}</span>
        <span class="sdc-d-value">${value}</span>
      </div>`;

    const pvBlock = (i) => {
      const p = C[`pv${i}_power_sensor`];
      const v = C[`pv${i}_voltage_sensor`];
      const c = C[`pv${i}_current_sensor`];
      if (!this._stateObj(p) && !this._stateObj(v) && !this._stateObj(c))
        return "";
      return row(
        `PV${i}`,
        `${this._fmtPower(this._powerW(p))} · ${this._fmtNum(
          v,
          1,
          "V"
        )} · ${this._fmtNum(c, 2, "A")}`,
        p
      );
    };

    d.innerHTML = `
      <div class="sdc-d-grid">
        ${pvBlock(1)}${pvBlock(2)}${pvBlock(3)}${pvBlock(4)}
        ${row("Inverter temp", this._fmtTemp(C.inverter_temp_sensor), C.inverter_temp_sensor)}
        ${row("Ambient temp", this._fmtTemp(C.ambient_temp_sensor), C.ambient_temp_sensor)}
        ${row("Battery temp", this._fmtTemp(C.battery_temp_sensor), C.battery_temp_sensor)}
        ${row("Cell temp (lo/hi)", `${this._fmtTemp(C.cell_temp_low_sensor)} / ${this._fmtTemp(C.cell_temp_high_sensor)}`, C.cell_temp_low_sensor)}
        ${row("Grid voltage", this._fmtNum(C.grid_voltage_sensor, 1, "V"), C.grid_voltage_sensor)}
        ${row("Grid current", this._fmtNum(C.grid_current_sensor, 2, "A"), C.grid_current_sensor)}
        ${row("Work mode", this._rawState(C.work_mode_select) || "—", C.work_mode_select)}
        ${row("Inverter state", this._rawState(C.inverter_state_sensor) || "—", C.inverter_state_sensor)}
        ${row("Fault", this._rawState(C.inverter_fault_sensor) || "—", C.inverter_fault_sensor)}
      </div>`;

    d.querySelectorAll(".sdc-d-row").forEach((el) => {
      const ent = el.dataset.entity;
      if (ent) {
        el.classList.add("clickable");
        el.addEventListener("click", () => this._openMoreInfo(ent));
      }
    });
  }

  /* ---- styles ---- */

  _styles() {
    const powerColor = this._config.flow_power_color || "#21e065";
    const consumeColor = this._config.flow_consumption_color || "#ffc233";
    const battgridColor = this._config.flow_battery_grid_color || "#7c5cff";
    return `
      :host { display:block; }
      ha-card {
        --sdc-bg: var(--card-background-color, #11151c);
        --sdc-fg: var(--primary-text-color, #e1e1e1);
        --sdc-muted: var(--secondary-text-color, #9aa0a6);
        --sdc-flow-power: ${powerColor};
        --sdc-flow-consume: ${consumeColor};
        --sdc-flow-battgrid: ${battgridColor};
        --sdc-solar: #f5c542;
        --sdc-grid: #ff5d5d;
        --sdc-battery: #38d39f;
        --sdc-home: #5aa9ff;
        --sdc-panel: rgba(255,255,255,0.04);
        background: var(--sdc-bg);
        color: var(--sdc-fg);
        overflow:hidden;
        border-radius: var(--ha-card-border-radius, 12px);
        padding: 0;
      }
      .sdc-title {
        padding: 12px 16px 0;
        font-size: 1.1rem;
        font-weight: 600;
      }

      /* Stage / image */
      .sdc-stage {
        position: relative;
        width: 100%;
        line-height: 0;
      }
      .sdc-bg {
        width: 100%;
        height: auto;
        display:block;
        object-fit: cover;
      }
      .sdc-flows {
        position:absolute;
        inset:0;
        width:100%;
        height:100%;
        pointer-events:none;
        overflow:visible;
      }
      /* dim static track under every connection */
      .sdc-track {
        fill:none;
        stroke: rgba(255,255,255,0.12);
        stroke-width: 2;
        stroke-linecap: round;
      }
      /* animated moving-dot overlay (only visible when active) */
      .sdc-flow {
        fill:none;
        stroke: transparent;
        stroke-width: 4;
        stroke-linecap: round;
        stroke-dasharray: 0.1 13;
        opacity: 0;
        transition: opacity .35s ease;
      }
      .sdc-flow.active {
        opacity: 1;
        animation: sdc-flow-move 1.1s linear infinite;
      }
      .sdc-flow.power.active {
        stroke: var(--sdc-flow-power);
        filter: drop-shadow(0 0 4px var(--sdc-flow-power));
      }
      .sdc-flow.consume.active {
        stroke: var(--sdc-flow-consume);
        filter: drop-shadow(0 0 4px var(--sdc-flow-consume));
      }
      .sdc-flow.battgrid.active {
        stroke: var(--sdc-flow-battgrid);
        filter: drop-shadow(0 0 4px var(--sdc-flow-battgrid));
      }
      @keyframes sdc-flow-move { to { stroke-dashoffset: -13.1; } }

      /* Nodes — circular icon + label/value chip */
      .sdc-node {
        position:absolute;
        transform: translate(-50%, -50%);
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:5px;
        padding:0;
        border:none;
        background:none;
        color: var(--sdc-fg);
        font-family: inherit;
        cursor:pointer;
        transition: transform .15s ease;
      }
      .sdc-node:hover { transform: translate(-50%, -50%) scale(1.07); }
      .sdc-node-ring {
        width:52px;
        height:52px;
        border-radius:50%;
        display:flex;
        align-items:center;
        justify-content:center;
        color: var(--sdc-muted);
        background: radial-gradient(circle at 32% 28%, rgba(255,255,255,0.12), rgba(10,14,20,0.82));
        border:2px solid rgba(255,255,255,0.16);
        box-shadow: 0 4px 14px rgba(0,0,0,0.45), inset 0 0 10px rgba(0,0,0,0.45);
        backdrop-filter: blur(6px);
        transition: color .25s ease, border-color .25s ease, box-shadow .25s ease;
      }
      .sdc-node-ring ha-icon {
        --mdc-icon-size: 26px;
        width:26px;
        height:26px;
      }
      .sdc-node-meta {
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:1px;
        padding:2px 9px;
        border-radius:10px;
        background: rgba(10,14,20,0.72);
        backdrop-filter: blur(4px);
        line-height:1.15;
      }
      .sdc-node-label {
        font-size:0.56rem;
        letter-spacing:0.09em;
        text-transform:uppercase;
        color: var(--sdc-muted);
        font-weight:700;
      }
      .sdc-node-value { font-size:0.82rem; font-weight:700; color: var(--sdc-fg); }

      /* per-node accent colour (ties into the flow palette) */
      .sdc-node-solar   { --nc: var(--sdc-flow-power); }
      .sdc-node-battery { --nc: var(--sdc-flow-power); }
      .sdc-node-home    { --nc: var(--sdc-flow-consume); }
      .sdc-node-grid    { --nc: var(--sdc-flow-consume); }

      .sdc-node.active .sdc-node-ring {
        color: var(--nc);
        border-color: var(--nc);
        animation: sdc-pulse 1.9s ease-in-out infinite;
      }
      .sdc-node.active .sdc-node-label { color: var(--nc); }
      @keyframes sdc-pulse {
        0%,100% { box-shadow: 0 0 0 3px rgba(255,255,255,0.03), 0 0 10px var(--nc); }
        50%     { box-shadow: 0 0 0 6px rgba(255,255,255,0.06), 0 0 22px var(--nc); }
      }

      /* Stats strip */
      .sdc-stats {
        display:grid;
        grid-template-columns: repeat(4, 1fr);
        gap:1px;
        background: rgba(255,255,255,0.06);
        margin-top: 1px;
      }
      .sdc-stat {
        background: var(--sdc-bg);
        padding:10px 8px;
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:3px;
      }
      .sdc-stat-k {
        font-size:0.66rem;
        text-transform:uppercase;
        letter-spacing:0.05em;
        color: var(--sdc-muted);
      }
      .sdc-stat-v { font-size:0.98rem; font-weight:700; }
      .sdc-imp { color: var(--sdc-grid); }
      .sdc-exp { color: var(--sdc-battery); }

      /* Cards */
      .sdc-cards {
        display:grid;
        grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
        gap:10px;
        padding:12px;
      }
      .sdc-panel {
        background: var(--sdc-panel);
        border:1px solid rgba(255,255,255,0.06);
        border-radius:12px;
        padding:12px 14px;
      }
      .sdc-panel-head {
        display:flex;
        justify-content:space-between;
        align-items:center;
        font-size:0.78rem;
        color: var(--sdc-muted);
        text-transform:uppercase;
        letter-spacing:0.05em;
        margin-bottom:8px;
      }
      .sdc-batt-status {
        font-size:0.7rem;
        padding:2px 8px;
        border-radius:8px;
        background: rgba(255,255,255,0.08);
      }
      .sdc-batt-status.charging { color:#0c2c20; background: var(--sdc-battery); }
      .sdc-batt-status.discharging { color:#2c0c0c; background: var(--sdc-solar); }
      .sdc-batt-status.idle { color: var(--sdc-muted); }
      .sdc-batt-pct { font-size:1.8rem; font-weight:800; margin-bottom:8px; }
      .sdc-bar {
        height:12px;
        border-radius:8px;
        background: rgba(255,255,255,0.10);
        overflow:hidden;
      }
      .sdc-bar-fill {
        height:100%;
        width:0%;
        border-radius:8px;
        background: var(--sdc-battery);
        transition: width .6s ease;
      }
      .sdc-bar-fill.charging { background: var(--sdc-battery); }
      .sdc-bar-fill.discharging { background: var(--sdc-solar); }
      .sdc-bar-fill.idle { background: var(--sdc-home); }
      .sdc-panel-foot { margin-top:8px; font-size:0.72rem; color: var(--sdc-muted); }
      .sdc-cost-tag {
        font-size:0.66rem;
        padding:2px 8px;
        border-radius:8px;
        background: var(--sdc-solar);
        color:#2c2400;
        font-weight:700;
      }
      .sdc-cost-tag.actual { background: var(--sdc-battery); color:#062018; }
      .sdc-cost-value { font-size:1.8rem; font-weight:800; }

      /* Details */
      .sdc-details { padding: 0 12px 12px; }
      .sdc-d-grid {
        display:grid;
        grid-template-columns: repeat(2, 1fr);
        gap:6px 16px;
        background: var(--sdc-panel);
        border:1px solid rgba(255,255,255,0.06);
        border-radius:12px;
        padding:12px 14px;
      }
      .sdc-d-row {
        display:flex;
        justify-content:space-between;
        gap:8px;
        font-size:0.82rem;
        padding:2px 0;
      }
      .sdc-d-row.clickable { cursor:pointer; }
      .sdc-d-row.clickable:hover .sdc-d-value { text-decoration: underline; }
      .sdc-d-label { color: var(--sdc-muted); }
      .sdc-d-value { font-weight:600; text-align:right; }

      /* Responsive */
      @media (max-width: 600px) {
        .sdc-node-ring { width:42px; height:42px; }
        .sdc-node-ring ha-icon { --mdc-icon-size:21px; width:21px; height:21px; }
        .sdc-node-meta { padding:1px 7px; }
        .sdc-node-value { font-size:0.72rem; }
        .sdc-node-label { font-size:0.5rem; }
        .sdc-cards { grid-template-columns: 1fr; }
        .sdc-d-grid { grid-template-columns: 1fr; }
        .sdc-stat-v { font-size:0.86rem; }
      }
    `;
  }
}

customElements.define("solar-dashboard-card", SolarDashboardCard);

/* ------------------------------------------------------------------ *
 * Visual editor
 * ------------------------------------------------------------------ *
 * Dependency-free: native inputs with an entity-id <datalist> for
 * autocomplete (populated from hass.states). Emits `config-changed`.
 * Empty fields are removed from the config so the card falls back to
 * its built-in defaults.
 * ------------------------------------------------------------------ */

const ENTITY_SECTIONS = [
  {
    title: "Core energy entities",
    fields: [
      ["solar_generation_sensor", "Solar generation"],
      ["load_power_sensor", "Home load"],
      ["battery_charge_sensor", "Battery charge"],
      ["battery_discharge_sensor", "Battery discharge"],
      ["battery_soc_sensor", "Battery SoC (%)"],
      ["battery_soh_sensor", "Battery health (SoH %)"],
    ],
  },
  {
    title: "Grid",
    fields: [
      ["grid_feed_in_sensor", "Grid import (from grid)"],
      ["grid_consumption_sensor", "Grid export (to grid)"],
    ],
  },
  {
    title: "Weather & sun",
    fields: [
      ["weather_entity", "Weather entity"],
      ["sunrise_sensor", "Sunrise sensor"],
      ["sunset_sensor", "Sunset sensor"],
      ["day_cycle_boolean", "Day-cycle boolean"],
      ["details_overlay_boolean", "Details overlay boolean"],
    ],
  },
  {
    title: "Cost — optional energy sensors (kWh) for accurate figures",
    fields: [
      ["import_energy_month_sensor", "Import energy — month (kWh)"],
      ["export_energy_month_sensor", "Export energy — month (kWh)"],
      ["import_energy_quarter_sensor", "Import energy — quarter (kWh)"],
      ["export_energy_quarter_sensor", "Export energy — quarter (kWh)"],
    ],
  },
];

const NUMBER_FIELDS = [
  ["import_tariff", "Import tariff ($/kWh)", 0.01],
  ["export_tariff", "Export tariff ($/kWh)", 0.01],
  ["quarter_days", "Days in quarter", 1],
  ["poll_interval", "Poll interval (s)", 1],
];

const IMAGE_KEYS = [
  "default",
  "sunny_day",
  "rainy_day",
  "lightning_rainy_day",
  "cloudy_day",
  "clear_night",
  "rainy_night",
  "lightning_rainy_night",
];

const NODE_KEYS = ["solar", "home", "battery", "grid"];

class SolarDashboardCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: "open" });
    this._config = {};
    this._hass = undefined;
    this._rendered = false;
  }

  setConfig(config) {
    // Work on a deep copy so we never mutate Lovelace's object directly.
    this._config = JSON.parse(JSON.stringify(config || {}));
    if (!this._config.type) this._config.type = "custom:solar-dashboard-card";
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._fillDatalist();
  }

  /* ---- value helpers ---- */

  _emit() {
    const ev = new CustomEvent("config-changed", {
      detail: { config: this._config },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(ev);
  }

  _set(key, value) {
    if (value === "" || value === undefined || value === null) {
      delete this._config[key];
    } else {
      this._config[key] = value;
    }
    this._emit();
  }

  _setNode(node, axis, value) {
    if (!this._config.nodes) this._config.nodes = {};
    if (!this._config.nodes[node]) this._config.nodes[node] = {};
    const n = parseFloat(value);
    if (Number.isFinite(n)) this._config.nodes[node][axis] = n;
    this._emit();
  }

  _setImage(key, value) {
    if (!this._config.images) this._config.images = {};
    if (value === "") delete this._config.images[key];
    else this._config.images[key] = value;
    if (Object.keys(this._config.images).length === 0) delete this._config.images;
    this._emit();
  }

  _defaults() {
    return DEFAULTS;
  }

  /* ---- datalist (entity autocomplete) ---- */

  _fillDatalist() {
    if (!this._rendered || !this._hass) return;
    const dl = this.shadowRoot.getElementById("sdc-entities");
    if (!dl || dl.childElementCount) return; // fill once
    const ids = Object.keys(this._hass.states || {}).sort();
    dl.innerHTML = ids.map((id) => `<option value="${id}"></option>`).join("");
  }

  /* ---- render ---- */

  _render() {
    const d = this._defaults();
    const ev = (k) => this._config[k] ?? ""; // entity value
    const ph = (k) => d[k] || ""; // placeholder = default

    const entityInput = (key, label) => `
      <label class="sdc-f">
        <span>${label}</span>
        <input type="text" list="sdc-entities" data-entity="${key}"
               value="${ev(key)}" placeholder="${ph(key)}" />
      </label>`;

    const numberInput = (key, label, step) => `
      <label class="sdc-f">
        <span>${label}</span>
        <input type="number" step="${step}" data-number="${key}"
               value="${this._config[key] ?? ""}" placeholder="${d[key]}" />
      </label>`;

    const textInput = (key, label, placeholder) => `
      <label class="sdc-f">
        <span>${label}</span>
        <input type="text" data-text="${key}" value="${
      this._config[key] ?? ""
    }" placeholder="${placeholder}" />
      </label>`;

    const selectInput = (key, label, options) => `
      <label class="sdc-f">
        <span>${label}</span>
        <select data-select="${key}">
          ${options
            .map(
              (o) =>
                `<option value="${o}" ${
                  (this._config[key] || d[key]) === o ? "selected" : ""
                }>${o}</option>`
            )
            .join("")}
        </select>
      </label>`;

    const sections = ENTITY_SECTIONS.map(
      (s) => `
      <div class="sdc-sec">
        <div class="sdc-sec-h">${s.title}</div>
        <div class="sdc-grid">
          ${s.fields.map((f) => entityInput(f[0], f[1])).join("")}
        </div>
      </div>`
    ).join("");

    const numbers = `
      <div class="sdc-sec">
        <div class="sdc-sec-h">Cost & behaviour</div>
        <div class="sdc-grid">
          ${NUMBER_FIELDS.map((f) => numberInput(f[0], f[1], f[2])).join("")}
          <label class="sdc-f sdc-check">
            <input type="checkbox" data-bool="use_rest" ${
              this._config.use_rest ? "checked" : ""
            } />
            <span>Also poll /api/states (REST)</span>
          </label>
          <label class="sdc-f">
            <span>Title (optional)</span>
            <input type="text" data-text="title" value="${ev("title")}" placeholder="(none)" />
          </label>
          <label class="sdc-f">
            <span>Solar label</span>
            <input type="text" data-text="solar_label" value="${ev(
              "solar_label"
            )}" placeholder="${d.solar_label}" />
          </label>
        </div>
      </div>`;

    const colorInput = (key, label) => `
      <label class="sdc-f sdc-color">
        <span>${label}</span>
        <input type="color" data-color="${key}" value="${
      this._config[key] || d[key]
    }" />
      </label>`;

    const costPeriod = `
      <div class="sdc-sec">
        <div class="sdc-sec-h">Cost period</div>
        <div class="sdc-grid">
          ${selectInput("cost_period", "Show", ["quarter", "month", "both"])}
          ${numberInput("month_start_day", "Month start day (1-31)", 1)}
          ${textInput(
            "quarter_start_date",
            "Quarter start (YYYY-MM-DD or MM-DD)",
            "01-01"
          )}
        </div>
      </div>`;

    const appearance = `
      <div class="sdc-sec">
        <div class="sdc-sec-h">Flow colours</div>
        <div class="sdc-grid">
          ${colorInput("flow_power_color", "Power / generation (green)")}
          ${colorInput("flow_consumption_color", "Grid consumption (amber)")}
          ${colorInput("flow_battery_grid_color", "Grid ↔ battery (violet)")}
        </div>
      </div>`;

    const nodes = `
      <div class="sdc-sec">
        <div class="sdc-sec-h">Node positions (% of image)</div>
        <div class="sdc-grid">
          ${NODE_KEYS.map((nk) => {
            const nx = this._config.nodes?.[nk]?.x ?? d.nodes[nk].x;
            const ny = this._config.nodes?.[nk]?.y ?? d.nodes[nk].y;
            return `
            <div class="sdc-node-edit">
              <span class="sdc-node-name">${nk}</span>
              <input type="number" min="0" max="100" data-node="${nk}" data-axis="x" value="${nx}" title="x %" />
              <input type="number" min="0" max="100" data-node="${nk}" data-axis="y" value="${ny}" title="y %" />
            </div>`;
          }).join("")}
        </div>
      </div>`;

    const images = `
      <div class="sdc-sec">
        <div class="sdc-sec-h">Images (use /local/… paths)</div>
        <div class="sdc-grid">
          ${IMAGE_KEYS.map(
            (ik) => `
            <label class="sdc-f">
              <span>${ik}</span>
              <input type="text" data-image="${ik}"
                     value="${this._config.images?.[ik] ?? ""}"
                     placeholder="${d.images[ik]}" />
            </label>`
          ).join("")}
        </div>
      </div>`;

    this.shadowRoot.innerHTML = `
      <style>
        :host { display:block; font-family: inherit; color: var(--primary-text-color, #e1e1e1); }
        .sdc-sec { margin-bottom: 18px; }
        .sdc-sec-h {
          font-weight:700; font-size:0.82rem; text-transform:uppercase;
          letter-spacing:0.05em; color: var(--secondary-text-color, #9aa0a6);
          margin-bottom:8px; border-bottom:1px solid var(--divider-color, rgba(255,255,255,0.1));
          padding-bottom:4px;
        }
        .sdc-grid {
          display:grid; grid-template-columns: repeat(2, 1fr); gap:8px 14px;
        }
        @media (max-width: 480px) { .sdc-grid { grid-template-columns: 1fr; } }
        .sdc-f { display:flex; flex-direction:column; gap:3px; font-size:0.8rem; }
        .sdc-f > span { color: var(--secondary-text-color, #9aa0a6); }
        .sdc-f input[type=text], .sdc-f input[type=number], .sdc-f select {
          background: var(--secondary-background-color, #1c1f26);
          color: var(--primary-text-color, #e1e1e1);
          border:1px solid var(--divider-color, rgba(255,255,255,0.12));
          border-radius:6px; padding:7px 8px; font-size:0.85rem; width:100%;
          box-sizing:border-box;
        }
        .sdc-f.sdc-check { flex-direction:row; align-items:center; gap:8px; }
        .sdc-f.sdc-color input[type=color] {
          width:100%; height:34px; padding:2px; border-radius:6px;
          background: var(--secondary-background-color, #1c1f26);
          border:1px solid var(--divider-color, rgba(255,255,255,0.12)); cursor:pointer;
        }
        .sdc-node-edit {
          display:grid; grid-template-columns: 1fr 64px 64px; gap:6px; align-items:center;
        }
        .sdc-node-name { text-transform:capitalize; font-size:0.85rem; }
        .sdc-node-edit input {
          background: var(--secondary-background-color, #1c1f26);
          color: var(--primary-text-color, #e1e1e1);
          border:1px solid var(--divider-color, rgba(255,255,255,0.12));
          border-radius:6px; padding:6px; font-size:0.85rem; width:100%; box-sizing:border-box;
        }
        .sdc-note { font-size:0.72rem; color: var(--secondary-text-color,#9aa0a6); margin-top:-8px; margin-bottom:14px; }
      </style>
      <datalist id="sdc-entities"></datalist>
      <div class="sdc-note">Leave a field blank to use its built-in default (shown as placeholder).</div>
      ${sections}
      ${numbers}
      ${costPeriod}
      ${appearance}
      ${nodes}
      ${images}
    `;

    this._rendered = true;
    this._wire();
    this._fillDatalist();
  }

  _wire() {
    const root = this.shadowRoot;
    root.querySelectorAll("input[data-entity]").forEach((el) =>
      el.addEventListener("change", (e) =>
        this._set(e.target.dataset.entity, e.target.value.trim())
      )
    );
    root.querySelectorAll("input[data-text]").forEach((el) =>
      el.addEventListener("change", (e) =>
        this._set(e.target.dataset.text, e.target.value)
      )
    );
    root.querySelectorAll("input[data-number]").forEach((el) =>
      el.addEventListener("change", (e) => {
        const v = e.target.value;
        this._set(
          e.target.dataset.number,
          v === "" ? "" : parseFloat(v)
        );
      })
    );
    root.querySelectorAll("input[data-bool]").forEach((el) =>
      el.addEventListener("change", (e) =>
        this._set(e.target.dataset.bool, e.target.checked ? true : "")
      )
    );
    root.querySelectorAll("input[data-node]").forEach((el) =>
      el.addEventListener("change", (e) =>
        this._setNode(
          e.target.dataset.node,
          e.target.dataset.axis,
          e.target.value
        )
      )
    );
    root.querySelectorAll("input[data-image]").forEach((el) =>
      el.addEventListener("change", (e) =>
        this._setImage(e.target.dataset.image, e.target.value.trim())
      )
    );
    root.querySelectorAll("input[data-color]").forEach((el) =>
      el.addEventListener("change", (e) =>
        this._set(e.target.dataset.color, e.target.value)
      )
    );
    root.querySelectorAll("select[data-select]").forEach((el) =>
      el.addEventListener("change", (e) =>
        this._set(e.target.dataset.select, e.target.value)
      )
    );
  }
}

customElements.define(
  "solar-dashboard-card-editor",
  SolarDashboardCardEditor
);

// Register with the Lovelace card picker.
window.customCards = window.customCards || [];
window.customCards.push({
  type: "solar-dashboard-card",
  name: "Solar Dashboard Card",
  description:
    "Responsive solar-powered home visualization with animated energy flows, node bubbles, battery and cost cards.",
  preview: false,
  documentationURL:
    "https://github.com/your-github-username/solar-dashboard-card",
});
