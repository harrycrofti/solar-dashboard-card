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

const CARD_VERSION = "1.0.0";

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
  quarter_days: 91,
  import_energy_sensor: undefined, // optional kWh total for the quarter
  export_energy_sensor: undefined, // optional kWh total for the quarter

  // Behaviour
  poll_interval: 10, // seconds
  use_rest: false, // optional /api/states REST polling

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

  _bezier(a, b) {
    // Smooth vertical S-curve between two percentage points.
    const my = (a.y + b.y) / 2;
    return `M ${a.x} ${a.y} C ${a.x} ${my}, ${b.x} ${my}, ${b.x} ${b.y}`;
  }

  _build() {
    const n = this._config.nodes;
    const flows = [
      { id: "solar-home", from: n.solar, to: n.home, cls: "solar" },
      { id: "solar-battery", from: n.solar, to: n.battery, cls: "battery" },
      { id: "solar-grid", from: n.solar, to: n.grid, cls: "grid" },
      { id: "battery-home", from: n.battery, to: n.home, cls: "battery" },
      { id: "grid-home", from: n.grid, to: n.home, cls: "grid" },
    ];

    const flowPaths = flows
      .map(
        (f) =>
          `<path id="flow-${f.id}" class="sdc-flow ${f.cls}" d="${this._bezier(
            f.from,
            f.to
          )}" vector-effect="non-scaling-stroke" />`
      )
      .join("");

    const node = (id, label) => `
      <button class="sdc-node sdc-node-${id}" data-node="${id}"
              style="left:${n[id].x}%;top:${n[id].y}%"
              title="${label}">
        <span class="sdc-node-label">${label}</span>
        <span class="sdc-node-value" id="val-${id}">—</span>
      </button>`;

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

          <div class="sdc-panel sdc-cost-card">
            <div class="sdc-panel-head">
              <span>Quarter Cost</span>
              <span class="sdc-cost-tag" id="cost-tag">ESTIMATE</span>
            </div>
            <div class="sdc-cost-value" id="cost-value">—</div>
            <div class="sdc-panel-foot" id="cost-foot"></div>
          </div>
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
      stSolar: $("st-solar"),
      stBatt: $("st-batt"),
      stGrid: $("st-grid"),
      stHome: $("st-home"),
      battStatus: $("batt-status"),
      battPct: $("batt-pct"),
      battBar: $("batt-bar"),
      battHealth: $("batt-health"),
      costTag: $("cost-tag"),
      costValue: $("cost-value"),
      costFoot: $("cost-foot"),
      details: $("details"),
    };
    flows.forEach((f) => {
      this._els.flows[f.id] = $(`flow-${f.id}`);
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
    const solarToBattery = (chargeW || 0) > 0;
    const batteryToHome = (dischargeW || 0) > 0;
    const gridToHome = (importW || 0) > 0;
    const solarToGrid = (exportW || 0) > 0;
    const solarToHome = (solarW || 0) > 0 && (loadW || 0) > 0;

    this._setFlow("solar-home", solarToHome);
    this._setFlow("solar-battery", solarToBattery);
    this._setFlow("solar-grid", solarToGrid);
    this._setFlow("battery-home", batteryToHome);
    this._setFlow("grid-home", gridToHome);

    // solar node "active" glow
    this.shadowRoot
      .querySelector(".sdc-node-solar")
      ?.classList.toggle("active", (solarW || 0) > 0);
    this.shadowRoot
      .querySelector(".sdc-node-battery")
      ?.classList.toggle("active", solarToBattery || batteryToHome);
    this.shadowRoot
      .querySelector(".sdc-node-grid")
      ?.classList.toggle("active", gridToHome || solarToGrid);
    this.shadowRoot
      .querySelector(".sdc-node-home")
      ?.classList.toggle("active", (loadW || 0) > 0);

    // ---- stats strip ----
    this._els.stSolar.textContent = this._fmtPower(solarW);
    this._els.stBatt.textContent = this._fmtPercent(soc);
    const imp = importW !== null && importW > 0 ? this._fmtPower(importW) : "0 W";
    const exp = exportW !== null && exportW > 0 ? this._fmtPower(exportW) : "0 W";
    this._els.stGrid.innerHTML = `<span class="sdc-imp">↓${imp}</span> <span class="sdc-exp">↑${exp}</span>`;
    this._els.stHome.textContent = this._fmtPower(loadW);

    // ---- battery card ----
    let status = "Idle";
    let statusCls = "idle";
    if (batteryToHome) {
      status = "Discharging";
      statusCls = "discharging";
    } else if (solarToBattery) {
      status = "Charging";
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

  _updateCost(importW, exportW) {
    const C = this._config;
    const impTariff = Number(C.import_tariff);
    const expTariff = Number(C.export_tariff);
    const impKwh = C.import_energy_sensor
      ? this._energyKwh(C.import_energy_sensor)
      : null;
    const expKwh = C.export_energy_sensor
      ? this._energyKwh(C.export_energy_sensor)
      : null;

    if (impKwh !== null || expKwh !== null) {
      // Accurate: from real energy totals.
      const cost = (impKwh || 0) * impTariff - (expKwh || 0) * expTariff;
      this._els.costTag.textContent = "FROM ENERGY";
      this._els.costTag.className = "sdc-cost-tag actual";
      this._els.costValue.textContent = this._fmtMoney(cost);
      this._els.costFoot.textContent = `Import ${(impKwh || 0).toFixed(
        1
      )} kWh @ $${impTariff} · Export ${(expKwh || 0).toFixed(
        1
      )} kWh @ $${expTariff}`;
    } else {
      // Rough projection from instantaneous power (clearly flagged).
      const days = Number(C.quarter_days) || 91;
      const impKw = importW !== null ? Math.max(0, importW) / 1000 : 0;
      const expKw = exportW !== null ? Math.max(0, exportW) / 1000 : 0;
      const projImp = impKw * 24 * days;
      const projExp = expKw * 24 * days;
      const cost = projImp * impTariff - projExp * expTariff;
      this._els.costTag.textContent = "ESTIMATE";
      this._els.costTag.className = "sdc-cost-tag";
      this._els.costValue.textContent = this._fmtMoney(cost);
      this._els.costFoot.textContent =
        "Rough projection of current power over the quarter. Configure import_energy_sensor / export_energy_sensor (kWh) for an accurate figure.";
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
    return `
      :host { display:block; }
      ha-card {
        --sdc-bg: var(--card-background-color, #11151c);
        --sdc-fg: var(--primary-text-color, #e1e1e1);
        --sdc-muted: var(--secondary-text-color, #9aa0a6);
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
      .sdc-flow {
        fill:none;
        stroke: var(--sdc-muted);
        stroke-width: 2;
        opacity: 0.22;
        stroke-linecap: round;
        transition: opacity .4s ease;
      }
      .sdc-flow.solar.active { stroke: var(--sdc-solar); }
      .sdc-flow.grid.active  { stroke: var(--sdc-grid); }
      .sdc-flow.battery.active { stroke: var(--sdc-battery); }
      .sdc-flow.active {
        opacity: 1;
        stroke-width: 3;
        stroke-dasharray: 6 6;
        animation: sdc-dash 0.9s linear infinite;
        filter: drop-shadow(0 0 3px currentColor);
      }
      @keyframes sdc-dash { to { stroke-dashoffset: -12; } }

      /* Nodes */
      .sdc-node {
        position:absolute;
        transform: translate(-50%, -50%);
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:2px;
        padding:6px 10px;
        min-width:64px;
        border:none;
        border-radius:14px;
        background: rgba(10,14,20,0.72);
        backdrop-filter: blur(4px);
        color: var(--sdc-fg);
        font-family: inherit;
        cursor:pointer;
        box-shadow: 0 2px 8px rgba(0,0,0,0.45);
        border:1px solid rgba(255,255,255,0.08);
        transition: transform .15s ease, box-shadow .2s ease, border-color .2s ease;
        line-height:1.1;
      }
      .sdc-node:hover { transform: translate(-50%, -50%) scale(1.06); }
      .sdc-node.active { border-color: currentColor; }
      .sdc-node-solar.active   { color: var(--sdc-solar); }
      .sdc-node-grid.active    { color: var(--sdc-grid); }
      .sdc-node-battery.active { color: var(--sdc-battery); }
      .sdc-node-home.active    { color: var(--sdc-home); }
      .sdc-node-label {
        font-size:0.62rem;
        letter-spacing:0.06em;
        text-transform:uppercase;
        color: var(--sdc-muted);
        font-weight:600;
      }
      .sdc-node.active .sdc-node-label { color: currentColor; }
      .sdc-node-value { font-size:0.86rem; font-weight:700; color: var(--sdc-fg); }

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
        grid-template-columns: 1fr 1fr;
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
        .sdc-node { min-width:52px; padding:4px 7px; }
        .sdc-node-value { font-size:0.74rem; }
        .sdc-node-label { font-size:0.55rem; }
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
      ["import_energy_sensor", "Import energy (kWh)"],
      ["export_energy_sensor", "Export energy (kWh)"],
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
        .sdc-f input[type=text], .sdc-f input[type=number] {
          background: var(--secondary-background-color, #1c1f26);
          color: var(--primary-text-color, #e1e1e1);
          border:1px solid var(--divider-color, rgba(255,255,255,0.12));
          border-radius:6px; padding:7px 8px; font-size:0.85rem; width:100%;
          box-sizing:border-box;
        }
        .sdc-f.sdc-check { flex-direction:row; align-items:center; gap:8px; }
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
