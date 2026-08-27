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

const CARD_VERSION = "1.10.0";

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
  tariff_mode: "single", // "single" (flat import_tariff) | "tou" (time-of-use bands)
  import_tariff: 0.24, // used in single mode (and as a fallback)
  export_tariff: 0.4, // feed-in credit — always a single flat rate
  // Time-of-use import tariff. Each band has a $/kWh rate and a "windows"
  // string of "HH:MM-HH:MM" ranges (comma-separated; a range may wrap past
  // midnight, e.g. "22:00-06:00"). Off-peak is the CATCH-ALL: any time not
  // matched by free/peak/shoulder is billed at the off-peak rate, so you never
  // have to cover the whole 24h exactly. Free (when enabled) overrides every
  // other band at $0 during its windows.
  tou: {
    peak: { rate: 0.45, windows: "" },
    shoulder: { rate: 0.3, windows: "" },
    offpeak: { rate: 0.2, windows: "" }, // fallback for any uncovered time
    free: { enabled: false, windows: "11:00-14:00" }, // $0 usage window
  },
  // Time-of-use export (feed-in) tariff. Same window syntax as `tou`, but the
  // feed-in peak/shoulder/off-peak times are usually DIFFERENT from the import
  // ones, so these windows are configured independently. Off-peak is the
  // CATCH-ALL: any time not matched by peak/shoulder is credited at the
  // off-peak rate (which may be 0). Only used in TOU mode, and only when at
  // least one export window is set — otherwise the flat export_tariff above is
  // applied to all exported energy (backwards-compatible).
  export_tou: {
    peak: { rate: 0, windows: "" },
    mid_peak: { rate: 0, windows: "" }, // 4th tier, between peak and shoulder
    shoulder: { rate: 0, windows: "" },
    offpeak: { rate: 0, windows: "" }, // catch-all for any uncovered time
  },
  daily_connection_fee: 0, // $/day fixed grid supply charge (added to every period)
  // Zero-import bonus: some plans credit a fixed daily amount when grid import
  // over a window stays near-zero (e.g. $1/day if < 0.03 kWh/h import 6-9pm).
  // Toggle off if you switch provider. The cost estimate credits it per day.
  zero_import_bonus: false, // master toggle
  zero_import_bonus_amount: 1, // $/day credited when earned
  zero_import_bonus_window: "18:00-21:00", // window the near-zero import applies to
  zero_import_bonus_threshold: 0.03, // kWh/hour import ceiling to still qualify
  // "quarter" | "month" | "weeks" | "both" (= month + quarter). Combine any of
  // them with "+" or "," to show several at once, e.g. "weeks+month".
  cost_period: "quarter",
  month_start_day: 1, // day-of-month the billing month starts (1-31)
  quarter_start_date: "", // anchor "YYYY-MM-DD" or "MM-DD"; blank = Jan 1
  quarter_days: 91, // legacy fallback if the quarter anchor can't be computed
  // Some retailers bill every N weeks (e.g. 4-weekly) instead of monthly, so a
  // billing cycle drifts against the calendar. week_cycle_start anchors the
  // phase: set it to the first day of any known cycle and every later cycle is
  // counted forward from there in N-week steps.
  week_cycle_weeks: 4, // weeks per billing cycle (1-13)
  week_cycle_start: "", // anchor "YYYY-MM-DD"; blank = 1 Jan of the current year
  // Optional kWh totals for accurate cost (utility_meter sensors).
  import_energy_month_sensor: undefined,
  export_energy_month_sensor: undefined,
  import_energy_quarter_sensor: undefined,
  export_energy_quarter_sensor: undefined,
  import_energy_weeks_sensor: undefined,
  export_energy_weeks_sensor: undefined,
  // Legacy aliases — used as the quarter sensors if the *_quarter_* keys are unset.
  import_energy_sensor: undefined,
  export_energy_sensor: undefined,
  // Fast, EXACT TOU cost via per-band energy meters that carry long-term
  // statistics (e.g. utility_meter sensors). When set, the card reads each
  // billing period's per-band kWh from recorder statistics — a tiny query that
  // returns a handful of daily buckets — instead of fetching and integrating a
  // whole month/quarter of raw POWER history in the browser (huge payload that
  // hangs the page and, until it loads, leaves a bogus instantaneous-power
  // projection on screen). Keys are the CARD bands (peak/shoulder/offpeak/free)
  // mapped to the entity_id of the matching import meter; a missing band = 0.
  // Works for any period because statistics sum the meter's deltas across its
  // daily resets, so the same daily meters serve month AND quarter windows.
  tou_import_band_sensors: {}, // { peak, shoulder, offpeak, free }: entity_id
  // Optional statistics-backed total export meter, credited at the export TOU
  // average (or flat export_tariff) since there is no per-band export split.
  tou_export_energy_sensor: undefined,

  // Behaviour
  poll_interval: 10, // seconds
  use_rest: false, // optional /api/states REST polling

  // Appearance — flow-dot colours, set per direction (no per-kind defaults).
  // Keys: solar_home, solar_battery, solar_grid, battery_home, grid_home,
  // grid_battery, battery_grid. Anything unset uses FLOW_DEFAULTS.
  flow_colors: {}, // per-direction overrides

  // Node accent colours (the ring/glow shown when a node is active). Home has
  // no bubble — it is the house glow (home_glow_color), configured separately.
  // Keys: solar, battery, grid. Anything unset uses NODE_COLOR_DEFAULTS.
  node_colors: {}, // per-node overrides

  // Home is rendered as a glow over the house (no node bubble).
  home_glow_enabled: true,
  home_glow_color: "#ffcf6b", // warm glow when the home is consuming
  home_glow_blur: 14, // glow softness/size in px (used by both glow modes)
  home_glow: { x: 46, y: 36, w: 58, h: 52 }, // radial-glow centre + size (% of image)
  // Optional transparent PNG of JUST the house, authored at the same canvas /
  // registration as the weather images. When set, the glow is applied as a
  // drop-shadow on its alpha channel, so it hugs the house silhouette exactly.
  house_overlay_image: undefined,

  // Reporting / statistics
  show_graphs: true,
  graphs_collapsed: false,
  graph_poll_interval: 300, // seconds between history refreshes
  report_default_range: "today",
  report_default_tab: "overview",
  report_show_previous: true,
  battery_capacity_kwh: undefined,
  battery_reserve_soc: 20,
  battery_low_soc: 10, // low-battery warning threshold — "time to X%" at current draw
  battery_full_soc: 100,
  battery_charge_efficiency: 0.92,
  solar_inverter_ac_capacity_w: undefined,
  solar_forecast_remaining_sensor: undefined,
  load_forecast_remaining_sensor: undefined,
  metrics: [],
  // Optional daily kWh-today sensors (override the integrated estimates)
  pv_energy_today_sensor: undefined,
  load_energy_today_sensor: undefined,
  import_energy_today_sensor: undefined,
  export_energy_today_sensor: undefined,
  battery_charge_energy_today_sensor: undefined,
  battery_discharge_energy_today_sensor: undefined,

  // Images (all must use /local/, never Windows paths)
  images: {
    default: "/local/Sunny.png",
    sunny_day: "/local/Sunny.png",
    rainy_day: "/local/Raining.png",
    lightning_rainy_day: "/local/Thunderstorm.png",
    cloudy_day: "/local/Cloudy.png",
    partly_cloudy_day: "/local/Cloudy.png",
    fog_day: "/local/Cloudy.png",
    clear_night: "/local/Night.png",
    cloudy_night: undefined,
    partly_cloudy_night: undefined,
    fog_night: undefined,
    rainy_night: "/local/Night Raining.png",
    lightning_rainy_night: "/local/Night Thunderstorm.png",
  },

  // Node positions in percentages of the image (0-100).
  // Defaults tuned to the reference house image; "home" is now just the
  // invisible anchor the home-bound flow lines converge on (no bubble).
  nodes: {
    solar: { x: 36, y: 21 }, // roof solar panels
    home: { x: 46, y: 40 }, // house centre (flow anchor)
    battery: { x: 29, y: 50 }, // wall battery unit
    grid: { x: 18, y: 34 }, // power pole
  },
};

/* ------------------------------------------------------------------ *
 * Graph palette
 * ------------------------------------------------------------------ */

const GRAPH_PALETTE = {
  pv: "#f5c542", // generated / solar (yellow)
  load: "#5aa9ff", // used / load (blue)
  imp: "#ff5d5d", // imported / bought (red)
  exp: "#21e065", // exported / sold (green)
  chg: "#7c5cff", // charged / stored (violet)
  dis: "#38d39f", // discharged (teal)
  soc: "#21e065", // battery state of charge
};

const REPORT_RANGES = [
  ["today", "Today"],
  ["yesterday", "Yesterday"],
  ["7d", "7 days"],
  ["30d", "30 days"],
  ["billing_month", "Billing month"],
  ["billing_weeks", "Billing cycle"],
  ["billing_quarter", "Billing quarter"],
];

const REPORT_TABS = [
  ["overview", "Overview"],
  ["energy", "Energy"],
  ["cost", "Cost"],
  ["battery", "Battery"],
  ["grid", "Grid"],
  ["solar", "Solar/PV"],
  ["inverter", "Inverter"],
  ["events", "Events"],
  ["metrics", "Metrics"],
];

/* Per-direction flow-dot colours. There is no per-"kind" grouping any more —
 * each direction has its own colour, overridable via the flow_colors config. */
const FLOW_DEFAULTS = {
  solar_home: "#21e065",
  solar_battery: "#21e065",
  solar_grid: "#21e065",
  battery_home: "#21e065",
  grid_home: "#ffc233",
  grid_battery: "#7c5cff",
  battery_grid: "#7c5cff",
};

/* Per-node accent colours (home is the house glow, configured separately). */
const NODE_COLOR_DEFAULTS = {
  solar: "#f5c542",
  battery: "#38d39f",
  grid: "#ff5d5d",
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
    this._reportRange = undefined;
    this._reportTab = undefined;
    this._seriesEnabled = {};
    this._chartViews = {}; // per-chart zoom window {start,end}
    this._chartDefs = {}; // per-chart series defs + options, kept across re-renders
    this._chartPan = null; // active drag-to-pan state
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
    merged.home_glow = { ...DEFAULTS.home_glow, ...(config.home_glow || {}) };
    // Per-band deep-merge so a user only needs to set the keys they change.
    const utou = config.tou || {};
    merged.tou = {
      peak: { ...DEFAULTS.tou.peak, ...(utou.peak || {}) },
      shoulder: { ...DEFAULTS.tou.shoulder, ...(utou.shoulder || {}) },
      offpeak: { ...DEFAULTS.tou.offpeak, ...(utou.offpeak || {}) },
      free: { ...DEFAULTS.tou.free, ...(utou.free || {}) },
    };
    const uxtou = config.export_tou || {};
    merged.export_tou = {
      peak: { ...DEFAULTS.export_tou.peak, ...(uxtou.peak || {}) },
      mid_peak: { ...DEFAULTS.export_tou.mid_peak, ...(uxtou.mid_peak || {}) },
      shoulder: { ...DEFAULTS.export_tou.shoulder, ...(uxtou.shoulder || {}) },
      offpeak: { ...DEFAULTS.export_tou.offpeak, ...(uxtou.offpeak || {}) },
    };
    merged.flow_colors = { ...(config.flow_colors || {}) };
    merged.node_colors = { ...(config.node_colors || {}) };
    merged.tou_import_band_sensors = {
      ...(config.tou_import_band_sensors || {}),
    };
    merged.metrics = this._normaliseMetrics(config.metrics || []);
    this._config = this._resolveEntities(merged);
    // Drop any cached TOU cost so edited rates/windows/mode take effect at once.
    this._touCardCost = undefined;
    this._touCardFetchedAt = undefined;
    this._reportRange = this._reportRange || merged.report_default_range || "today";
    this._reportTab = this._reportTab || merged.report_default_tab || "overview";
    this._built = false; // force rebuild
    if (this.shadowRoot) this.shadowRoot.innerHTML = "";
    this._maybeBuild();
  }

  set hass(hass) {
    this._hass = hass;
    this._maybeBuild();
    this._update();
    this._maybeFetchGraphs();
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
    this._maybeFetchGraphs();
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

  _normaliseMetrics(metrics) {
    const src = Array.isArray(metrics)
      ? metrics
      : Object.entries(metrics || {}).map(([key, value]) => ({
          key,
          ...(value || {}),
        }));
    return src
      .filter((m) => m && m.entity)
      .map((m, i) => {
        const key = String(m.key || m.name || m.entity || `metric_${i}`)
          .toLowerCase()
          .replace(/[^a-z0-9_]+/g, "_")
          .replace(/^_+|_+$/g, "");
        return {
          key: key || `metric_${i}`,
          label: String(m.label || m.name || m.entity),
          entity: m.entity,
          type: String(m.type || "raw").toLowerCase(), // power, energy, percent, temp, raw
          aggregate: String(m.aggregate || "avg").toLowerCase(), // avg, max, min, last, sum, integrate
          chart: String(m.chart || "metrics").toLowerCase(),
          unit: m.unit,
          color: m.color || this._metricColor(i),
        };
      });
  }

  _metricColor(i) {
    const colors = [
      "#f5c542",
      "#5aa9ff",
      "#38d39f",
      "#ff5d5d",
      "#7c5cff",
      "#21e065",
      "#ff9f43",
      "#00d2d3",
    ];
    return colors[i % colors.length];
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

  _fmtKwh(v, digits = 2) {
    if (v === null || v === undefined || !Number.isFinite(v)) return "—";
    return `${v.toFixed(digits)} kWh`;
  }

  _fmtDuration(hours) {
    if (hours === null || hours === undefined || !Number.isFinite(hours) || hours < 0)
      return "—";
    const mins = Math.round(hours * 60);
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  }

  _fmtDateTime(ms) {
    if (!Number.isFinite(ms)) return "—";
    return new Date(ms).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }

  _esc(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
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
    const day = this._isDaytime();
    const wRaw = this._rawState(this._config.weather_entity);
    const cond = wRaw ? String(wRaw).toLowerCase() : "";

    let keys = ["default"];
    if (day) {
      switch (cond) {
        case "sunny":
        case "clear":
        case "clear-day":
          keys = ["sunny_day", "default"];
          break;
        case "rainy":
        case "pouring":
        case "snowy-rainy":
          keys = ["rainy_day", "default"];
          break;
        case "lightning-rainy":
        case "lightning":
          keys = ["lightning_rainy_day", "rainy_day", "default"];
          break;
        case "cloudy":
          keys = ["cloudy_day", "default"];
          break;
        case "partlycloudy":
          keys = ["partly_cloudy_day", "cloudy_day", "default"];
          break;
        case "fog":
          keys = ["fog_day", "cloudy_day", "default"];
          break;
        default:
          keys = ["default"];
      }
    } else {
      switch (cond) {
        case "clear-night":
        case "clear":
        case "sunny":
          keys = ["clear_night", "default"];
          break;
        case "rainy":
        case "pouring":
        case "snowy-rainy":
          keys = ["rainy_night", "rainy_day", "clear_night", "default"];
          break;
        case "lightning-rainy":
        case "lightning":
          keys = [
            "lightning_rainy_night",
            "lightning_rainy_day",
            "rainy_night",
            "clear_night",
            "default",
          ];
          break;
        case "cloudy":
          keys = ["cloudy_night", "cloudy_day", "clear_night", "default"];
          break;
        case "partlycloudy":
          keys = [
            "partly_cloudy_night",
            "cloudy_night",
            "partly_cloudy_day",
            "cloudy_day",
            "clear_night",
            "default",
          ];
          break;
        case "fog":
          keys = [
            "fog_night",
            "cloudy_night",
            "fog_day",
            "cloudy_day",
            "clear_night",
            "default",
          ];
          break;
        default:
          keys = ["clear_night", "default"];
      }
    }
    return this._imageFromKeys(keys);
  }

  _imageFromKeys(keys) {
    const img = this._config.images || {};
    for (const key of keys) {
      if (img[key]) return img[key];
    }
    return img.default || DEFAULTS.images.default;
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

  /** Per-direction flow-dot colour. */
  _resolveFlowColor(f) {
    const fc = this._config.flow_colors || {};
    const key = f.id.split("-").join("_"); // "solar-home" -> "solar_home"
    return fc[key] || FLOW_DEFAULTS[key] || "#21e065";
  }

  /** Per-node accent colour (used for the active ring/glow). */
  _resolveNodeColor(id) {
    const nc = this._config.node_colors || {};
    return nc[id] || NODE_COLOR_DEFAULTS[id] || "#21e065";
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
    // Each carries its own resolved colour via the --fc custom property.
    const overlayPaths = flows
      .map(
        (f) =>
          `<path id="flow-${f.id}" class="sdc-flow ${
            f.kind
          }" style="--fc:${this._resolveFlowColor(f)}" d="${this._line(
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
              style="left:${n[id].x}%;top:${n[id].y}%;--nc:${this._resolveNodeColor(
      id
    )}"
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
    const periods = this._resolveCostPeriods();
    this._costPeriods = periods;
    const periodLabel = {
      month: "Monthly Cost",
      quarter: "Quarter Cost",
      weeks: `${this._weekCycleWeeks()}-Week Cost`,
    };
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

    this._graphsCollapsed = !!this._config.graphs_collapsed;
    const graphsBlock =
      this._config.show_graphs === false
        ? ""
        : `
        <div class="sdc-graphs-wrap ${
          this._graphsCollapsed ? "collapsed" : ""
        }" id="graphs-wrap">
          <button class="sdc-graphs-toggle" id="graphs-toggle">
            <ha-icon icon="mdi:chart-areaspline"></ha-icon>
            <span>Statistics &amp; Graphs</span>
            <ha-icon class="sdc-chevron" icon="mdi:chevron-down"></ha-icon>
          </button>
          <div class="sdc-graphs" id="graphs">
            <div class="sdc-g-empty">Loading report...</div>
          </div>
        </div>`;

    const hg = this._config.home_glow || {};
    const hgColor = this._config.home_glow_color || "#ffcf6b";
    const hgBlur = (this._config.home_glow_blur ?? 14) + "px";
    let homeGlow = "";
    if (this._config.house_overlay_image) {
      // Alpha-masked overlay: glow traces the house silhouette via drop-shadow.
      homeGlow = `<img class="sdc-house-overlay" id="home-overlay" alt="Home" loading="lazy"
              src="${this._config.house_overlay_image}"
              style="--hg:${hgColor};--hg-blur:${hgBlur}" />`;
    } else if (this._config.home_glow_enabled !== false) {
      // Fallback: soft radial glow box positioned over the house.
      homeGlow = `<button class="sdc-home-glow" id="home-glow" title="Home"
              style="left:${hg.x}%;top:${hg.y}%;width:${hg.w}%;height:${hg.h}%;--hg:${hgColor};--hg-blur:${hgBlur}"></button>`;
    }

    const title = this._config.title
      ? `<div class="sdc-title">${this._config.title}</div>`
      : "";

    this.shadowRoot.innerHTML = `
      <style>${this._styles()}</style>
      <ha-card>
        ${title}
        <div class="sdc-stage" id="stage">
          <img class="sdc-bg" id="bg" alt="House" />
          ${homeGlow}
          <svg class="sdc-flows" viewBox="0 0 100 100" preserveAspectRatio="none">
            ${flowPaths}
          </svg>
          ${node("solar", this._config.solar_label || "Solar")}
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

        ${graphsBlock}
      </ha-card>
    `;

    // cache refs
    const $ = (id) => this.shadowRoot.getElementById(id);
    this._els = {
      bg: $("bg"),
      flows: {},
      vals: {
        solar: $("val-solar"),
        battery: $("val-battery"),
        grid: $("val-grid"),
      },
      homeGlow: $("home-glow"),
      homeOverlay: $("home-overlay"),
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
      graphsWrap: $("graphs-wrap"),
      graphsToggle: $("graphs-toggle"),
      graphsEl: $("graphs"),
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
      battery: this._config.battery_soc_sensor,
      grid: this._config.grid_import_sensor,
    };
    this.shadowRoot.querySelectorAll(".sdc-node").forEach((el) => {
      el.addEventListener("click", () =>
        this._openMoreInfo(nodeEntity[el.dataset.node])
      );
    });

    // home glow / overlay opens more-info for the load entity
    [this._els.homeGlow, this._els.homeOverlay].forEach((el) => {
      if (el)
        el.addEventListener("click", () =>
          this._openMoreInfo(this._config.load_power_sensor)
        );
    });

    // graphs collapse toggle
    if (this._els.graphsToggle) {
      this._els.graphsToggle.addEventListener("click", () => {
        this._graphsCollapsed = !this._graphsCollapsed;
        this._els.graphsWrap.classList.toggle(
          "collapsed",
          this._graphsCollapsed
        );
        if (!this._graphsCollapsed) {
          if (this._graphData) this._drawGraphs();
          this._maybeFetchGraphs();
        }
      });
    }
    if (this._els.graphsEl) {
      const gel = this._els.graphsEl;
      gel.addEventListener("click", (e) => this._handleReportClick(e));
      gel.addEventListener("change", (e) => this._handleReportChange(e));
      // interactive zoom / pan / tooltip on charts
      gel.addEventListener("wheel", (e) => this._onChartWheel(e), { passive: false });
      gel.addEventListener("pointerdown", (e) => this._onChartPointerDown(e));
      gel.addEventListener("pointermove", (e) => this._onChartPointerMove(e));
      gel.addEventListener("pointerup", () => this._onChartPointerUp());
      gel.addEventListener("pointercancel", () => this._onChartPointerUp());
      gel.addEventListener("pointerleave", (e) => {
        this._onChartPointerUp();
        // On touch there's no hover, so keep the last readout visible after the
        // finger lifts; only clear it when a real mouse pointer leaves.
        if (!e || e.pointerType === "mouse") this._hideChartOverlays();
      });
      gel.addEventListener("dblclick", (e) => this._onChartDblClick(e));
    }

    this._built = true;
    this._maybeFetchGraphs();
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
    // home is a glow over the house (no node) — lit when consuming
    const homeLit = this._config.home_glow_enabled !== false && l > 0;
    this._els.homeGlow?.classList.toggle("active", homeLit);
    this._els.homeOverlay?.classList.toggle("active", homeLit);

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

  /**
   * Which cost cards to render. Accepts a single period, the legacy "both"
   * (month + quarter), or several joined by "+" / "," e.g. "weeks+month".
   * Order is preserved, duplicates dropped; falls back to ["quarter"].
   */
  _resolveCostPeriods() {
    const raw = String(this._config.cost_period || "quarter").toLowerCase();
    const out = [];
    const add = (p) => {
      if (!out.includes(p)) out.push(p);
    };
    raw
      .split(/[+,\s]+/)
      .filter(Boolean)
      .forEach((tok) => {
        if (tok === "both") {
          add("month");
          add("quarter");
        } else if (tok === "month" || tok === "quarter" || tok === "weeks") {
          add(tok);
        } else if (tok === "week" || tok === "weekly") {
          add("weeks");
        }
      });
    return out.length ? out : ["quarter"];
  }

  /** Weeks per billing cycle, clamped to 1-13. */
  _weekCycleWeeks() {
    let w = parseInt(this._config.week_cycle_weeks, 10);
    if (!Number.isFinite(w) || w < 1) w = 4;
    return Math.min(13, w);
  }

  /** Days per billing cycle for the "weeks" period. */
  _weekCycleDays() {
    return this._weekCycleWeeks() * 7;
  }

  /**
   * Local-midnight anchor for the weeks cycle. Accepts "YYYY-MM-DD" (or with
   * "/" separators); blank or unparseable falls back to 1 Jan of the current
   * year so the phase stays deterministic until a real cycle start is set.
   */
  _weekCycleAnchor() {
    const now = new Date();
    const v = String(this._config.week_cycle_start || "").trim();
    if (v) {
      const p = v.split(/[-/]/).map((x) => parseInt(x, 10));
      if (p.length >= 3 && p.every(Number.isFinite)) {
        const d = new Date(p[0], p[1] - 1, p[2]);
        if (!Number.isNaN(d.getTime())) return d;
      }
    }
    return new Date(now.getFullYear(), 0, 1);
  }

  /** Billing period backing a report range, or null for rolling ranges. */
  _periodForRange(range) {
    if (range === "billing_month") return "month";
    if (range === "billing_quarter") return "quarter";
    if (range === "billing_weeks") return "weeks";
    return null;
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
      if (period === "weeks") return this._weekCycleDays();
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

  /** Start date (local midnight) of the current billing period. */
  _periodStart(period) {
    const now = new Date();
    if (period === "weeks") {
      // Step whole cycles from the anchor with date arithmetic rather than
      // epoch ms, so a DST change inside a cycle can't shift the boundary.
      const anchor = this._weekCycleAnchor();
      const cycle = this._weekCycleDays();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const n = Math.floor(Math.round((today - anchor) / 86400000) / cycle);
      return new Date(
        anchor.getFullYear(),
        anchor.getMonth(),
        anchor.getDate() + n * cycle
      );
    }
    if (period === "month") {
      let d = parseInt(this._config.month_start_day, 10);
      if (!Number.isFinite(d) || d < 1) d = 1;
      if (d > 31) d = 31;
      let start = new Date(now.getFullYear(), now.getMonth(), d);
      if (now.getDate() < d)
        start = new Date(now.getFullYear(), now.getMonth() - 1, d);
      return start;
    }
    // quarter
    const a = this._quarterAnchor();
    let start = new Date(now.getFullYear() - 1, a.month, a.day);
    for (let i = 0; i < 12; i++) {
      const next = new Date(start.getFullYear(), start.getMonth() + 3, a.day);
      if (now >= start && now < next) return start;
      start = next;
    }
    return start;
  }

  /**
   * Days elapsed from the period start up to and including today — used for
   * "cost so far". E.g. month_start_day 2 and today the 3rd → 2 days. Always
   * at least 1 and never more than the full period length.
   */
  _periodElapsedDays(period) {
    try {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const start = this._periodStart(period);
      const elapsed = Math.round((today - start) / 86400000) + 1;
      return Math.min(this._periodDays(period), Math.max(1, elapsed));
    } catch (e) {
      return 1;
    }
  }

  _energySensorsFor(period) {
    const C = this._config;
    if (period === "weeks") {
      return [C.import_energy_weeks_sensor, C.export_energy_weeks_sensor];
    }
    if (period === "month") {
      return [C.import_energy_month_sensor, C.export_energy_month_sensor];
    }
    return [
      C.import_energy_quarter_sensor || C.import_energy_sensor,
      C.export_energy_quarter_sensor || C.export_energy_sensor,
    ];
  }

  _updateCost(importW, exportW) {
    // In TOU mode, keep an exact by-time cost for each period fresh in the
    // background (see _maybeFetchTouCard); the render below uses it when ready.
    this._maybeFetchTouCard();
    (this._costPeriods || ["quarter"]).forEach((p) =>
      this._updateCostPeriod(p, importW, exportW)
    );
  }

  /**
   * TOU only: fetch import/export/load history for each shown billing period,
   * integrate imports into peak/shoulder/off-peak/free bands by the actual
   * time they occurred, and cache the exact cost. Throttled (billing totals
   * move slowly) so the always-on card stays cheap even for a quarter range.
   */
  _maybeFetchTouCard() {
    if (!this._isTou()) return;
    if (!this._hass || !this._hass.callWS) return;
    if (!this._config.grid_import_sensor) return; // nothing to integrate
    const interval = Math.max(
      (Number(this._config.graph_poll_interval) || 300) * 1000,
      900000 // at least 15 min
    );
    this._touCardFetchedAt = this._touCardFetchedAt || {};
    this._touCardFetching = this._touCardFetching || {};
    const useStats = this._hasTouBandStats();
    (this._costPeriods || ["quarter"]).forEach((p) => {
      if (this._touCardFetching[p]) return;
      if (Date.now() - (this._touCardFetchedAt[p] || 0) < interval) return;
      if (useStats) this._fetchTouCardStats(p);
      else this._fetchTouCard(p);
    });
  }

  /** True when per-band import meters (statistics-backed) are configured. */
  _hasTouBandStats() {
    if (!this._isTou()) return false;
    const b = this._config.tou_import_band_sensors || {};
    return Object.values(b).some(Boolean);
  }

  /**
   * Exact per-band cost for a billing period, read from recorder STATISTICS of
   * the configured per-band energy meters. This is the cheap path: instead of
   * pulling a month/quarter of raw power history and integrating it in the
   * browser, it asks the recorder for each meter's per-day `change` over the
   * window and sums them — a few dozen numbers per sensor. Statistics sum the
   * meter's deltas across its daily resets, so a daily utility_meter yields the
   * correct month/quarter total.
   */
  async _fetchTouCardStats(period) {
    this._touCardFetching[period] = true;
    try {
      const C = this._config;
      const bandSensors = C.tou_import_band_sensors || {};
      const ids = [...new Set(Object.values(bandSensors).filter(Boolean))];
      const expId = C.tou_export_energy_sensor;
      if (expId) ids.push(expId);
      if (!ids.length) return;
      const start = this._periodStart(period);
      const end = new Date();
      const totals = await this._fetchStatChange(ids, start, end);
      const impBand = { peak: 0, mid_peak: 0, shoulder: 0, offpeak: 0, free: 0 };
      for (const band of ["peak", "shoulder", "offpeak", "free"]) {
        const sid = bandSensors[band];
        if (sid && Number.isFinite(totals[sid])) impBand[band] = totals[sid];
      }
      const exportKwh =
        expId && Number.isFinite(totals[expId]) ? totals[expId] : 0;
      const importKwh =
        impBand.peak + impBand.shoulder + impBand.offpeak + impBand.free;
      this._touCardCost = this._touCardCost || {};
      this._touCardCost[period] = {
        usage: this._touCost(impBand, this._touRates()),
        noSolarImport: null,
        importKwh,
        exportKwh,
        impBand,
        expBand: null, // no per-band export meter → credit uses avg/flat rate
        exportCredit: null,
      };
      this._touCardFetchedAt[period] = Date.now();
      this._updateCostPeriod(period, null, null); // re-render with exact figures
    } catch (e) {
      // Leave any existing figure / fallback in place on failure.
    } finally {
      this._touCardFetching[period] = false;
    }
  }

  /**
   * Sum each statistic's per-day `change` over [start, end]. Returns
   * { statistic_id: totalKwh }. Robust to HA returning `change` (preferred),
   * or falling back to first/last `state` deltas if `change` is absent.
   */
  async _fetchStatChange(ids, start, end) {
    const out = {};
    if (!ids.length || !this._hass || !this._hass.callWS) return out;
    const res = await this._hass.callWS({
      type: "recorder/statistics_during_period",
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      statistic_ids: ids,
      period: "day",
      types: ["change", "state"],
    });
    for (const id of ids) {
      const rows = (res && res[id]) || [];
      let sum = 0;
      let haveChange = false;
      for (const r of rows) {
        if (r && Number.isFinite(r.change)) {
          sum += r.change;
          haveChange = true;
        }
      }
      if (!haveChange && rows.length) {
        // Fallback: last cumulative state minus first (approximate; ignores a
        // reset inside the very first bucket).
        const first = rows[0];
        const last = rows[rows.length - 1];
        const a = Number(first && (first.state ?? first.sum));
        const b = Number(last && (last.state ?? last.sum));
        if (Number.isFinite(a) && Number.isFinite(b) && b >= a) sum = b - a;
      }
      out[id] = sum;
    }
    return out;
  }

  async _fetchTouCard(period) {
    this._touCardFetching[period] = true;
    try {
      const C = this._config;
      const map = {
        import: { entity: C.grid_import_sensor, mode: "power" },
        export: { entity: C.grid_export_sensor, mode: "power" },
        load: { entity: C.load_power_sensor, mode: "power" },
      };
      const start = this._periodStart(period);
      const end = new Date();
      const series = await this._fetchHistory(map, start, end);
      if (!series.import || !series.import.length) return; // keep fallback
      const rates = this._touRates();
      const impBand = this._integrateByBand(series.import);
      const loadBand = this._integrateByBand(series.load);
      const hasExpTou = this._hasExportTou();
      const expBand = hasExpTou
        ? this._integrateExportByBand(series.export)
        : null;
      this._touCardCost = this._touCardCost || {};
      this._touCardCost[period] = {
        usage: this._touCost(impBand, rates),
        noSolarImport: this._touCost(loadBand, rates),
        importKwh: this._integrate(series.import),
        exportKwh: this._integrate(series.export),
        impBand,
        expBand,
        exportCredit: expBand
          ? this._exportTouCredit(expBand, this._exportTouRates())
          : null,
      };
      this._touCardFetchedAt[period] = Date.now();
      this._updateCostPeriod(period, null, null); // re-render with exact figures
    } catch (e) {
      // Leave the avg-rate fallback in place on failure.
    } finally {
      this._touCardFetching[period] = false;
    }
  }

  _updateCostPeriod(period, importW, exportW) {
    const els = this._costEls && this._costEls[period];
    if (!els) return;
    const C = this._config;
    const isTou = this._isTou();
    const hasExpTou = this._hasExportTou();
    // Flat feed-in rate, or (when TOU export is configured) the duration-
    // weighted average used only where no by-time breakdown is available.
    const expTariff = hasExpTou
      ? this._exportTouAvgRate()
      : Number(C.export_tariff);
    const dailyFee = Number(C.daily_connection_fee) || 0;
    // Days so far in the current billing period (start day → today, inclusive).
    const days = this._periodElapsedDays(period);
    const connection = dailyFee * days;
    const feeNote = dailyFee
      ? ` · Supply ${days}d @ $${dailyFee}/day = ${this._fmtMoney(connection)}`
      : "";
    // Zero-import bonus: a per-day credit (assumes earned each day when enabled).
    const bonusPerDay = this._zeroImportBonusPerDay();
    const bonus = bonusPerDay * days;
    const bonusNote = bonusPerDay
      ? ` · Bonus ${days}d @ $${bonusPerDay}/day = -${this._fmtMoney(bonus)}`
      : "";

    // TOU (preferred): exact by-time cost from billing-period history — imports
    // split into bands by the actual time they occurred (see _fetchTouCard).
    const touExact = isTou && this._touCardCost && this._touCardCost[period];
    if (touExact) {
      const t = touExact;
      const b = t.impBand;
      // By-time feed-in credit when TOU export is configured; else flat rate.
      const credit =
        t.exportCredit !== null && t.exportCredit !== undefined
          ? t.exportCredit
          : (t.exportKwh || 0) * expTariff;
      const cost = t.usage - credit + connection - bonus;
      const eb = t.expBand;
      const exportNote = eb
        ? ` · Export TOU P ${eb.peak.toFixed(1)} · M ${(eb.mid_peak || 0).toFixed(1)} · S ${eb.shoulder.toFixed(1)} · O ${eb.offpeak.toFixed(1)} kWh = ${this._fmtMoney(credit)}`
        : ` · Export ${(t.exportKwh || 0).toFixed(1)} kWh @ $${expTariff}`;
      els.tag.textContent = "TOU";
      els.tag.className = "sdc-cost-tag actual";
      els.value.textContent = this._fmtMoney(cost);
      els.foot.textContent =
        `Peak ${b.peak.toFixed(1)} · Shoulder ${b.shoulder.toFixed(1)} · Off-peak ${b.offpeak.toFixed(1)}` +
        (b.free > 0.05 ? ` · Free ${b.free.toFixed(1)}` : "") +
        ` kWh${exportNote}${feeNote}${bonusNote}`;
      return;
    }

    // Band-statistics mode: the exact figure arrives via a tiny stats query
    // (_fetchTouCardStats). Until it lands, show a neutral placeholder instead
    // of the wildly-off instantaneous-power projection below. Keep any figure
    // already on screen to avoid flicker on refresh.
    if (isTou && this._hasTouBandStats()) {
      els.tag.textContent = "TOU";
      els.tag.className = "sdc-cost-tag";
      const cur = els.value.textContent;
      if (!cur || cur === "—") els.value.textContent = "…";
      els.foot.textContent = "Calculating exact cost from meter statistics…";
      return;
    }

    // Single mode uses the flat import tariff; TOU falls back to a duration-
    // weighted average rate until the by-time history above has loaded.
    const impTariff = isTou ? this._touAvgImportRate() : Number(C.import_tariff);
    const rateNote = isTou
      ? ` (TOU avg $${impTariff.toFixed(3)}/kWh until by-time history loads)`
      : "";
    // Label for the flat/averaged export rate shown in the fallback footers.
    const expLabel = hasExpTou
      ? `${expTariff.toFixed(3)} (TOU avg)`
      : `${expTariff}`;
    const [impSensor, expSensor] = this._energySensorsFor(period);
    const impKwh = impSensor ? this._energyKwh(impSensor) : null;
    const expKwh = expSensor ? this._energyKwh(expSensor) : null;

    if (impKwh !== null || expKwh !== null) {
      // From real energy totals (utility_meter etc.).
      const cost =
        (impKwh || 0) * impTariff - (expKwh || 0) * expTariff + connection - bonus;
      els.tag.textContent = isTou ? "TOU · EST" : "FROM ENERGY";
      els.tag.className = "sdc-cost-tag" + (isTou ? "" : " actual");
      els.value.textContent = this._fmtMoney(cost);
      els.foot.textContent = `Import ${(impKwh || 0).toFixed(
        1
      )} kWh @ $${impTariff.toFixed(isTou ? 3 : 2)} · Export ${(expKwh || 0).toFixed(
        1
      )} kWh @ $${expLabel}${feeNote}${bonusNote}${rateNote}`;
    } else {
      // Rough projection from instantaneous power (clearly flagged).
      const impKw = importW !== null ? Math.max(0, importW) / 1000 : 0;
      const expKw = exportW !== null ? Math.max(0, exportW) / 1000 : 0;
      const cost =
        impKw * 24 * days * impTariff -
        expKw * 24 * days * expTariff +
        connection -
        bonus;
      els.tag.textContent = isTou ? "ESTIMATE · TOU" : "ESTIMATE";
      els.tag.className = "sdc-cost-tag";
      els.value.textContent = this._fmtMoney(cost);
      els.foot.textContent = `Rough projection of current power over the ${days} days so far this ${period}${feeNote}${bonusNote}${rateNote}. Configure ${period} energy sensors (kWh) for accuracy.`;
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

  /* ---- graphs: fetch + compute + draw ---- */

  _maybeFetchGraphs() {
    if (this._config.show_graphs === false) return;
    if (!this._hass || !this._hass.callWS) return;
    if (this._graphsCollapsed) return; // only fetch while visible
    const win = this._reportWindow(this._reportRange);
    const windowKey = `${win.range}:${win.start.toDateString()}:${win.end.toDateString()}`;
    const interval = (Number(this._config.graph_poll_interval) || 300) * 1000;
    const stale =
      !this._lastGraphFetch ||
      Date.now() - this._lastGraphFetch > interval ||
      this._graphWindowKey !== windowKey;
    if (stale && !this._graphFetching) this._fetchGraphs();
  }

  async _fetchGraphs() {
    this._graphFetching = true;
    try {
      const win = this._reportWindow(this._reportRange);
      const map = this._historyMap();
      const series = await this._fetchHistory(map, win.start, win.end);
      let previousSeries = null;
      if (this._config.report_show_previous !== false) {
        previousSeries = await this._fetchHistory(
          map,
          win.previousStart,
          win.previousEnd
        );
      }
      this._graphData = this._computeGraphs(
        series,
        win,
        previousSeries
      );
      this._lastGraphFetch = Date.now();
      this._graphWindowKey = `${win.range}:${win.start.toDateString()}:${win.end.toDateString()}`;
      this._drawGraphs();
    } catch (e) {
      if (this._els.graphsEl && !this._graphData) {
        this._els.graphsEl.innerHTML =
          '<div class="sdc-g-empty">History unavailable for this period.</div>';
      }
    } finally {
      this._graphFetching = false;
    }
  }

  _reportWindow(range) {
    const now = new Date();
    const startOfDay = (d) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    const addDays = (d, days) =>
      new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, 0, 0, 0, 0);
    const today = startOfDay(now);
    let start = today;
    let end = now;
    let label = "Today";
    switch (range) {
      case "yesterday":
        start = addDays(today, -1);
        end = today;
        label = "Yesterday";
        break;
      case "7d":
        start = addDays(today, -6);
        label = "Last 7 days";
        break;
      case "30d":
        start = addDays(today, -29);
        label = "Last 30 days";
        break;
      case "billing_month":
        start = this._periodStart("month");
        label = "Billing month";
        break;
      case "billing_weeks":
        start = this._periodStart("weeks");
        label = `Billing cycle (${this._weekCycleWeeks()} wk)`;
        break;
      case "billing_quarter":
        start = this._periodStart("quarter");
        label = "Billing quarter";
        break;
      case "today":
      default:
        range = "today";
        label = "Today";
    }
    const span = Math.max(3600000, end.getTime() - start.getTime());
    let previousStart = new Date(start.getTime() - span);
    let previousEnd = new Date(start.getTime());
    if (range === "today") {
      previousStart = addDays(start, -1);
      previousEnd = new Date(previousStart.getTime() + span);
    }
    return {
      range,
      label,
      start,
      end,
      previousStart,
      previousEnd,
    };
  }

  _historyMap() {
    const C = this._config;
    const map = {
      solar: { entity: C.solar_generation_sensor, mode: "power" },
      load: { entity: C.load_power_sensor, mode: "power" },
      charge: { entity: C.battery_charge_sensor, mode: "power" },
      discharge: { entity: C.battery_discharge_sensor, mode: "power" },
      import: { entity: C.grid_import_sensor, mode: "power" },
      export: { entity: C.grid_export_sensor, mode: "power" },
      soc: { entity: C.battery_soc_sensor, mode: "raw" },
    };
    (C.metrics || []).forEach((m) => {
      map[`metric_${m.key}`] = {
        entity: m.entity,
        mode: this._metricSeriesMode(m),
        metric: m,
      };
    });
    return map;
  }

  _metricSeriesMode(metric) {
    if (metric.type === "power") return "power";
    if (metric.type === "energy") return "energy";
    return "raw";
  }

  async _fetchHistory(map, start, end) {
    const ids = [
      ...new Set(
        Object.values(map)
          .map((m) => m.entity)
          .filter(Boolean)
      ),
    ];
    if (!ids.length) return {};
    const res = await this._hass.callWS({
      type: "history/history_during_period",
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      entity_ids: ids,
      minimal_response: false,
      no_attributes: true,
    });
    const series = {};
    for (const key in map) {
      series[key] = this._series(res, map[key].entity, end.getTime(), map[key].mode);
    }
    return series;
  }

  /** Normalise a history response series to [{t(ms), v(number)}]. */
  _series(res, entity, endMs, mode = "power") {
    if (!entity || !res || !res[entity]) return [];
    const unit = String(
      (this._stateObj(entity)?.attributes || {}).unit_of_measurement || ""
    ).toLowerCase();
    let scale = 1;
    if (mode === "power") {
      if (unit.includes("kw") && !unit.includes("kwh")) scale = 1000;
      else if (unit.includes("mw")) scale = 1000000;
    } else if (mode === "energy") {
      if (unit.includes("mwh")) scale = 1000;
      else if (unit.includes("wh") && !unit.includes("kwh")) scale = 1 / 1000;
    }
    const pts = [];
    for (const p of res[entity]) {
      const raw = p.s !== undefined ? p.s : p.state;
      if (raw === null || raw === undefined || this._isUnavailable(raw))
        continue;
      const v = parseFloat(raw);
      if (!Number.isFinite(v)) continue;
      const t =
        p.lu !== undefined
          ? p.lu * 1000
          : Date.parse(p.last_changed || p.last_updated);
      if (!Number.isFinite(t)) continue;
      pts.push({ t, v: v * scale });
    }
    pts.sort((a, b) => a.t - b.t);
    // Home Assistant's recorder only stores a state when it CHANGES, so a sensor
    // that sits at a constant value (e.g. grid import at 0 while exporting, for
    // hours) leaves one sample then a long gap until the next change. Linear /
    // trapezoidal interpolation across that gap fabricates a ramp between the two
    // samples — which both draws a phantom slope on the graph and, once
    // integrated, invents energy in whatever tariff band the gap's midpoint falls
    // in. Convert to a STEP series: carry each value forward until the instant it
    // changes, then jump. This makes the line render as steps and makes the
    // trapezoidal integral equal an exact left-Riemann (hold-last-value) sum.
    const stepped = [];
    for (let i = 0; i < pts.length; i++) {
      if (i > 0) stepped.push({ t: pts[i].t, v: pts[i - 1].v });
      stepped.push(pts[i]);
    }
    if (stepped.length)
      stepped.push({ t: endMs, v: stepped[stepped.length - 1].v }); // extend to now
    return stepped;
  }

  /** Trapezoidal integral of a power(W) series → kWh. */
  _integrate(series) {
    let wh = 0;
    for (let i = 1; i < series.length; i++) {
      const dtH = (series[i].t - series[i - 1].t) / 3600000;
      if (dtH > 0) wh += ((series[i].v + series[i - 1].v) / 2) * dtH;
    }
    return wh / 1000;
  }

  /* ------------------------------------------------------------------ *
   * Time-of-use (TOU) tariff helpers
   * ------------------------------------------------------------------ */

  /** True when the card is configured for a time-of-use import tariff. */
  _isTou() {
    return String(this._config.tariff_mode || "single").toLowerCase() === "tou";
  }

  /**
   * Parse "HH:MM-HH:MM, HH:MM-HH:MM" into [{s,e}] minute-of-day ranges.
   * A range whose end is <= its start is treated as wrapping past midnight
   * and split into two ranges. Invalid segments are ignored.
   */
  _parseTouWindows(str) {
    const out = [];
    String(str || "")
      .split(",")
      .forEach((seg) => {
        const m = seg
          .trim()
          .match(/^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/);
        if (!m) return;
        const s = (+m[1]) * 60 + +m[2];
        const e = (+m[3]) * 60 + +m[4];
        if (s < 0 || s > 1440 || e < 0 || e > 1440 || s === e) return;
        if (e > s) out.push({ s, e });
        else {
          out.push({ s, e: 1440 }); // start → midnight
          out.push({ s: 0, e }); // midnight → end
        }
      });
    return out;
  }

  _touWindowsContain(mins, ranges) {
    return ranges.some((r) => mins >= r.s && mins < r.e);
  }

  /**
   * Build a 1440-entry (per-minute-of-day) lookup of {band, rate}. Precedence:
   * free (if enabled) > peak > shoulder > off-peak (the catch-all fallback).
   */
  _touMinuteTable() {
    const t = this._config.tou || {};
    const free = t.free || {};
    const freeOn = !!free.enabled;
    const wFree = freeOn ? this._parseTouWindows(free.windows) : [];
    const wPeak = this._parseTouWindows((t.peak || {}).windows);
    const wShoulder = this._parseTouWindows((t.shoulder || {}).windows);
    const rPeak = Number((t.peak || {}).rate) || 0;
    const rShoulder = Number((t.shoulder || {}).rate) || 0;
    const rOff = Number((t.offpeak || {}).rate) || 0;
    const table = new Array(1440);
    for (let m = 0; m < 1440; m++) {
      if (freeOn && this._touWindowsContain(m, wFree))
        table[m] = { band: "free", rate: 0 };
      else if (this._touWindowsContain(m, wPeak))
        table[m] = { band: "peak", rate: rPeak };
      else if (this._touWindowsContain(m, wShoulder))
        table[m] = { band: "shoulder", rate: rShoulder };
      else table[m] = { band: "offpeak", rate: rOff }; // catch-all
    }
    return table;
  }

  /**
   * Duration-weighted average import rate across a full day ($/kWh). Used by
   * the always-on cost card, which has no time-of-day breakdown of energy.
   */
  _touAvgImportRate() {
    const table = this._touMinuteTable();
    let sum = 0;
    for (let m = 0; m < 1440; m++) sum += table[m].rate;
    return sum / 1440;
  }

  /** Current band rates as configured (free is always 0). */
  _touRates() {
    const t = this._config.tou || {};
    return {
      peak: Number((t.peak || {}).rate) || 0,
      shoulder: Number((t.shoulder || {}).rate) || 0,
      offpeak: Number((t.offpeak || {}).rate) || 0,
      free: 0,
    };
  }

  /**
   * Integrate a power(W) series into per-band kWh using the local time each
   * interval occurred. Returns {peak, shoulder, offpeak, free} in kWh.
   */
  _integrateByBand(series, table) {
    const bands = { peak: 0, mid_peak: 0, shoulder: 0, offpeak: 0, free: 0 };
    if (series && series.length > 1) {
      table = table || this._touMinuteTable();
      for (let i = 1; i < series.length; i++) {
        const dtH = (series[i].t - series[i - 1].t) / 3600000;
        if (dtH <= 0) continue;
        const wh = ((series[i].v + series[i - 1].v) / 2) * dtH;
        const mid = new Date((series[i].t + series[i - 1].t) / 2);
        const mins = mid.getHours() * 60 + mid.getMinutes();
        bands[table[mins].band] += wh;
      }
    }
    for (const k in bands) bands[k] /= 1000; // Wh → kWh
    return bands;
  }

  /** Total TOU import cost from per-band kWh × per-band rate. */
  _touCost(bandKwh, rates) {
    return (
      (bandKwh.peak || 0) * rates.peak +
      (bandKwh.shoulder || 0) * rates.shoulder +
      (bandKwh.offpeak || 0) * rates.offpeak
    ); // free band is $0
  }

  /* --- Time-of-use export (feed-in) tariff --------------------------- */

  /**
   * True when TOU export/feed-in bands are in effect: TOU mode is on AND at
   * least one export window is configured. Otherwise the flat export_tariff
   * is applied to all exported energy.
   */
  _hasExportTou() {
    if (!this._isTou()) return false;
    const t = this._config.export_tou;
    if (!t) return false;
    return ["peak", "mid_peak", "shoulder", "offpeak"].some(
      (b) => t[b] && String(t[b].windows || "").trim() !== ""
    );
  }

  /**
   * Per-minute-of-day {band, rate} table for export. No free band; off-peak
   * is the catch-all. Precedence: peak > shoulder > off-peak.
   */
  _exportTouMinuteTable() {
    const t = this._config.export_tou || {};
    const wPeak = this._parseTouWindows((t.peak || {}).windows);
    const wMid = this._parseTouWindows((t.mid_peak || {}).windows);
    const wShoulder = this._parseTouWindows((t.shoulder || {}).windows);
    const rPeak = Number((t.peak || {}).rate) || 0;
    const rMid = Number((t.mid_peak || {}).rate) || 0;
    const rShoulder = Number((t.shoulder || {}).rate) || 0;
    const rOff = Number((t.offpeak || {}).rate) || 0;
    const table = new Array(1440);
    for (let m = 0; m < 1440; m++) {
      if (this._touWindowsContain(m, wPeak))
        table[m] = { band: "peak", rate: rPeak };
      else if (this._touWindowsContain(m, wMid))
        table[m] = { band: "mid_peak", rate: rMid };
      else if (this._touWindowsContain(m, wShoulder))
        table[m] = { band: "shoulder", rate: rShoulder };
      else table[m] = { band: "offpeak", rate: rOff }; // catch-all
    }
    return table;
  }

  /** Current export band rates as configured. */
  _exportTouRates() {
    const t = this._config.export_tou || {};
    return {
      peak: Number((t.peak || {}).rate) || 0,
      mid_peak: Number((t.mid_peak || {}).rate) || 0,
      shoulder: Number((t.shoulder || {}).rate) || 0,
      offpeak: Number((t.offpeak || {}).rate) || 0,
    };
  }

  /** Integrate an export power(W) series into per-band kWh by local time. */
  _integrateExportByBand(series) {
    return this._integrateByBand(series, this._exportTouMinuteTable());
  }

  /** Total feed-in credit from per-band exported kWh × per-band rate. */
  _exportTouCredit(bandKwh, rates) {
    return (
      (bandKwh.peak || 0) * rates.peak +
      (bandKwh.mid_peak || 0) * rates.mid_peak +
      (bandKwh.shoulder || 0) * rates.shoulder +
      (bandKwh.offpeak || 0) * rates.offpeak
    );
  }

  /**
   * Duration-weighted average export rate across a full day ($/kWh). Used as a
   * fallback by the always-on cost card when only total exported kWh is known.
   */
  _exportTouAvgRate() {
    const table = this._exportTouMinuteTable();
    let sum = 0;
    for (let m = 0; m < 1440; m++) sum += table[m].rate;
    return sum / 1440;
  }

  /** Daily zero-import bonus credit ($/day); 0 when the toggle is off. */
  _zeroImportBonusPerDay() {
    if (!this._config.zero_import_bonus) return 0;
    const amt = Number(this._config.zero_import_bonus_amount);
    return Number.isFinite(amt) ? amt : 0;
  }

  _coreKwh(series, useTodayOverrides) {
    const C = this._config;
    let generated = this._integrate(series.solar);
    let used = this._integrate(series.load);
    let imported = this._integrate(series.import);
    let exported = this._integrate(series.export);
    let charged = this._integrate(series.charge);
    let discharged = this._integrate(series.discharge);

    // Optional overrides from dedicated daily kWh sensors.
    if (useTodayOverrides) {
      const ov = (k) => (C[k] ? this._num(C[k]) : null);
      const o = {
        pv: ov("pv_energy_today_sensor"),
        load: ov("load_energy_today_sensor"),
        imp: ov("import_energy_today_sensor"),
        exp: ov("export_energy_today_sensor"),
        chg: ov("battery_charge_energy_today_sensor"),
        dis: ov("battery_discharge_energy_today_sensor"),
      };
      if (o.pv !== null) generated = o.pv;
      if (o.load !== null) used = o.load;
      if (o.imp !== null) imported = o.imp;
      if (o.exp !== null) exported = o.exp;
      if (o.chg !== null) charged = o.chg;
      if (o.dis !== null) discharged = o.dis;
    }
    return { generated, used, imported, exported, charged, discharged };
  }

  _computeGraphs(series, win, previousSeries) {
    const kwh = this._coreKwh(series, win.range === "today");
    const previousKwh = previousSeries
      ? this._coreKwh(previousSeries, false)
      : null;
    const c0 = (x) => Math.max(0, x);
    const solarSelf = c0(kwh.generated - kwh.exported - kwh.charged); // solar used on-site
    const loadStats = this._seriesStats(series.load);
    const solarStats0 = this._seriesStats(series.solar);
    const co2Factor = Number(this._config.co2_factor_kg_per_kwh);
    const stats = {
      selfSufficiency:
        kwh.used > 0 ? Math.min(1, c0(1 - kwh.imported / kwh.used)) : 0,
      selfConsumption:
        kwh.generated > 0 ? Math.min(1, c0(1 - kwh.exported / kwh.generated)) : 0,
      solarCoverage: kwh.used > 0 ? Math.min(1, solarSelf / kwh.used) : 0,
      avgLoad: loadStats.avg,
      peakLoad: loadStats.max,
      peakLoadTime: loadStats.peakTime,
      peakSolar: solarStats0.max,
      co2Avoided: kwh.generated * (Number.isFinite(co2Factor) ? co2Factor : 0.79),
      gridFreeHours: this._durationWhere(series.import, (v) => v < 20),
    };
    const customMetrics = this._computeCustomMetrics(series);
    return {
      kwh,
      previousKwh,
      disp: {
        solarSelf,
        charged: kwh.charged,
        exported: kwh.exported,
        homeFromSolar: solarSelf,
        homeFromBattery: kwh.discharged,
        homeFromGrid: kwh.imported,
      },
      stats,
      battery: this._batteryStats(series, kwh),
      cost: this._costReport(kwh, previousKwh, win, series, previousSeries),
      solar: this._solarStats(series, kwh),
      inverter: this._inverterReport(),
      forecast: this._batteryForecast(),
      customMetrics,
      series,
      window: win,
      domain: { start: win.start.getTime(), end: win.end.getTime(), now: Date.now() },
    };
  }

  _seriesStats(series) {
    const pts = (series || []).filter((p) => Number.isFinite(p.v));
    if (!pts.length)
      return { min: null, max: null, avg: null, last: null, peakTime: null };
    let min = pts[0].v;
    let max = pts[0].v;
    let sum = 0;
    let peakTime = pts[0].t;
    pts.forEach((p) => {
      if (p.v < min) min = p.v;
      if (p.v > max) {
        max = p.v;
        peakTime = p.t;
      }
      sum += p.v;
    });
    return {
      min,
      max,
      avg: sum / pts.length,
      last: pts[pts.length - 1].v,
      peakTime,
    };
  }

  _valueAt(series, t) {
    if (!series || !series.length) return null;
    let v = series[0].v;
    for (const p of series) {
      if (p.t > t) break;
      v = p.v;
    }
    return v;
  }

  _durationWhere(series, predicate) {
    if (!series || series.length < 2) return 0;
    let h = 0;
    for (let i = 1; i < series.length; i++) {
      const v = (series[i].v + series[i - 1].v) / 2;
      if (predicate(v)) h += (series[i].t - series[i - 1].t) / 3600000;
    }
    return h;
  }

  _integrateWhen(powerSeries, conditionSeries, predicate) {
    if (!powerSeries || powerSeries.length < 2) return 0;
    let wh = 0;
    for (let i = 1; i < powerSeries.length; i++) {
      const mid = (powerSeries[i].t + powerSeries[i - 1].t) / 2;
      const power = (powerSeries[i].v + powerSeries[i - 1].v) / 2;
      const other = this._valueAt(conditionSeries, mid) || 0;
      if (predicate(power, other)) {
        wh += power * ((powerSeries[i].t - powerSeries[i - 1].t) / 3600000);
      }
    }
    return wh / 1000;
  }

  _batteryStats(series, kwh) {
    const C = this._config;
    const soc = this._seriesStats(series.soc);
    const capacity = Number(C.battery_capacity_kwh);
    const reserve = Number(C.battery_reserve_soc);
    const full = Number(C.battery_full_soc) || 100;
    const cycleEstimate =
      Number.isFinite(capacity) && capacity > 0
        ? (kwh.discharged || 0) / capacity
        : null;
    const efficiency =
      kwh.charged > 0 ? Math.min(1.5, Math.max(0, kwh.discharged / kwh.charged)) : null;
    const reserveHours = Number.isFinite(reserve)
      ? this._durationWhere(series.soc, (v) => v <= reserve)
      : 0;
    const fullHours = this._durationWhere(series.soc, (v) => v >= full);
    const gridCharged = this._integrateWhen(
      series.charge,
      series.import,
      (charge, imp) => charge > 20 && imp > 20
    );
    return {
      soc,
      capacity: Number.isFinite(capacity) ? capacity : null,
      cycleEstimate,
      efficiency,
      reserveSoc: Number.isFinite(reserve) ? reserve : null,
      reserveHours,
      fullSoc: full,
      fullHours,
      gridCharged,
      solarCharged: Math.max(0, kwh.charged - gridCharged),
    };
  }

  _costReport(kwh, previousKwh, win, series, previousSeries) {
    const C = this._config;
    const isTou = this._isTou();
    const hasExpTou = this._hasExportTou();
    const exportTariff = Number(C.export_tariff) || 0;
    const dailyFee = Number(C.daily_connection_fee) || 0;
    let days = Math.max(
      1,
      Math.ceil((win.end.getTime() - win.start.getTime()) / 86400000)
    );
    const billingPeriod = this._periodForRange(win.range);
    if (billingPeriod) days = this._periodElapsedDays(billingPeriod);

    // Import cost. In TOU mode we split the imported-power history into bands by
    // the actual local time each interval occurred — this is exact by-time cost.
    // In single mode it's a flat rate on total imported kWh.
    let usage;
    let tou = null;
    let noSolarImport = 0;
    const importTariff = isTou
      ? this._touAvgImportRate()
      : Number(C.import_tariff) || 0;
    if (isTou) {
      const rates = this._touRates();
      const importByBand = this._integrateByBand((series || {}).import);
      // No-solar scenario bills the whole load at TOU rates by its own timing.
      const loadByBand = this._integrateByBand((series || {}).load);
      usage = this._touCost(importByBand, rates);
      tou = { rates, importByBand };
      noSolarImport = this._touCost(loadByBand, rates);
    } else {
      usage = kwh.imported * importTariff;
    }
    // Feed-in credit. In TOU-export mode we split the exported-power history
    // into feed-in bands by the local time each interval occurred; otherwise a
    // flat rate on total exported kWh.
    let credit;
    let touExport = null;
    if (hasExpTou) {
      const exportRates = this._exportTouRates();
      const exportByBand = this._integrateExportByBand((series || {}).export);
      credit = this._exportTouCredit(exportByBand, exportRates);
      touExport = { rates: exportRates, exportByBand };
    } else {
      credit = kwh.exported * exportTariff;
    }
    const supply = dailyFee * days;
    const bonus = this._zeroImportBonusPerDay() * days;
    const net = usage - credit + supply - bonus;
    // what the bill would have been with no solar/battery (import the whole load, no export credit)
    const noSolarBill =
      (isTou ? noSolarImport : kwh.used * importTariff) + supply;
    const savings = noSolarBill - net;
    let previous = null;
    if (previousKwh && this._config.report_show_previous !== false) {
      const prevUsage =
        isTou && previousSeries
          ? this._touCost(
              this._integrateByBand(previousSeries.import),
              this._touRates()
            )
          : previousKwh.imported * importTariff;
      const prevCredit =
        hasExpTou && previousSeries
          ? this._exportTouCredit(
              this._integrateExportByBand(previousSeries.export),
              this._exportTouRates()
            )
          : previousKwh.exported * exportTariff;
      previous = prevUsage - prevCredit + dailyFee * days - bonus;
    }
    let projected = null;
    if (billingPeriod) {
      projected =
        (net / Math.max(1, this._periodElapsedDays(billingPeriod))) *
        this._periodDays(billingPeriod);
    }
    return { importTariff, exportTariff, dailyFee, days, usage, credit, supply, bonus, net, previous, projected, noSolarBill, savings, tou, touExport };
  }

  _solarStats(series, kwh) {
    const C = this._config;
    const solar = this._seriesStats(series.solar);
    const capacity = Number(C.solar_inverter_ac_capacity_w);
    const clippingHours =
      Number.isFinite(capacity) && capacity > 0
        ? this._durationWhere(series.solar, (v) => v >= capacity * 0.98)
        : 0;
    const strings = [1, 2, 3, 4]
      .map((i) => {
        const p = this._powerW(C[`pv${i}_power_sensor`]);
        const v = this._num(C[`pv${i}_voltage_sensor`]);
        const a = this._num(C[`pv${i}_current_sensor`]);
        if (p === null && v === null && a === null) return null;
        return { id: `PV${i}`, power: p || 0, voltage: v, current: a };
      })
      .filter(Boolean);
    const maxString = strings.length ? Math.max(...strings.map((s) => s.power)) : 0;
    strings.forEach((s) => {
      s.relative = maxString > 0 ? s.power / maxString : null;
      s.low = maxString > 0 && s.power < maxString * 0.75;
    });
    return { generated: kwh.generated, solar, capacity: Number.isFinite(capacity) ? capacity : null, clippingHours, strings };
  }

  _inverterReport() {
    const C = this._config;
    const raw = (entity) => this._rawState(entity);
    return {
      workMode: raw(C.work_mode_select) || "—",
      state: raw(C.inverter_state_sensor) || "—",
      fault: raw(C.inverter_fault_sensor) || "—",
      inverterTemp: this._fmtTemp(C.inverter_temp_sensor),
      ambientTemp: this._fmtTemp(C.ambient_temp_sensor),
      batteryTemp: this._fmtTemp(C.battery_temp_sensor),
      gridVoltage: this._fmtNum(C.grid_voltage_sensor, 1, "V"),
      gridCurrent: this._fmtNum(C.grid_current_sensor, 2, "A"),
    };
  }

  _batteryForecast() {
    const C = this._config;
    const capacity = Number(C.battery_capacity_kwh);
    const soc = this._num(C.battery_soc_sensor);
    const target = Number(C.battery_full_soc) || 100;
    const reserve = Number(C.battery_reserve_soc);
    const reserveSoc = Number.isFinite(reserve) ? reserve : 0;
    const eff = Number(C.battery_charge_efficiency) || 1;
    const chargeW = this._powerW(C.battery_charge_sensor) || 0;
    const dischargeW = this._powerW(C.battery_discharge_sensor) || 0;
    const loadW = this._powerW(C.load_power_sensor);
    const solarRemaining = C.solar_forecast_remaining_sensor
      ? this._energyKwh(C.solar_forecast_remaining_sensor)
      : null;
    const loadRemaining = C.load_forecast_remaining_sensor
      ? this._energyKwh(C.load_forecast_remaining_sensor)
      : null;
    if (!Number.isFinite(capacity) || capacity <= 0 || soc === null) {
      return {
        available: false,
        message:
          "Set battery_capacity_kwh and battery_soc_sensor for charge/discharge estimates.",
      };
    }
    const lowRaw = Number(C.battery_low_soc);
    const lowSoc = Number.isFinite(lowRaw) ? Math.max(0, Math.min(100, lowRaw)) : 10;
    const now = Date.now();
    const remainingKwh = Math.max(0, ((target - soc) / 100) * capacity); // to full target
    const usableKwh = Math.max(0, ((soc - reserveSoc) / 100) * capacity); // down to reserve
    const lowKwh = Math.max(0, ((soc - lowSoc) / 100) * capacity); // down to low threshold
    const emptyKwh = Math.max(0, (soc / 100) * capacity); // down to 0%

    // live mode from measured power
    let mode = "idle";
    if (chargeW > 20 && chargeW >= dischargeW) mode = "charging";
    else if (dischargeW > 20 && dischargeW > chargeW) mode = "discharging";

    // ---- charge timing ----
    const currentChargeEta = chargeW > 20 ? remainingKwh / (chargeW / 1000) : null;
    const sunset = Date.parse(this._rawState(C.sunset_sensor) || "");
    const daylightHours = Number.isFinite(sunset)
      ? Math.max(0.25, (sunset - now) / 3600000)
      : 6;
    const forecastSurplus =
      solarRemaining !== null
        ? Math.max(0, solarRemaining - (loadRemaining || 0))
        : null;
    const forecastCharge = forecastSurplus !== null ? forecastSurplus * eff : null;
    const forecastEta =
      forecastCharge && forecastCharge > 0
        ? remainingKwh / Math.max(0.05, forecastCharge / daylightHours)
        : null;
    const chargeEtaHours = currentChargeEta !== null ? currentChargeEta : forecastEta;
    const fullAt = chargeEtaHours !== null ? now + chargeEtaHours * 3600000 : null;
    const likelyFull =
      remainingKwh <= 0 ||
      (forecastCharge !== null && forecastCharge >= remainingKwh) ||
      (currentChargeEta !== null && currentChargeEta <= daylightHours + 0.5);

    // ---- discharge timing ----
    // prefer the measured discharge power; fall back to current house load draw
    const drawW = dischargeW > 20 ? dischargeW : mode === "discharging" && loadW ? loadW : dischargeW;
    const timeToReserve = drawW > 20 ? usableKwh / (drawW / 1000) : null;
    const timeToLow = drawW > 20 ? lowKwh / (drawW / 1000) : null;
    const timeToEmpty = drawW > 20 ? emptyKwh / (drawW / 1000) : null;
    const reserveAt = timeToReserve !== null ? now + timeToReserve * 3600000 : null;
    const lowAt = timeToLow !== null ? now + timeToLow * 3600000 : null;
    const emptyAt = timeToEmpty !== null ? now + timeToEmpty * 3600000 : null;

    let message;
    if (mode === "charging")
      message =
        remainingKwh <= 0
          ? "Battery is at or above the full target."
          : likelyFull
          ? "On track to reach the full target."
          : "Charging, but forecast surplus may not reach the full target.";
    else if (mode === "discharging")
      message =
        timeToLow !== null
          ? `Discharging at ${this._fmtPower(drawW)} — about ${this._fmtDuration(
              timeToLow
            )} until ${lowSoc}% at the current draw (${this._fmtDuration(
              timeToReserve
            )} to the ${reserveSoc}% reserve).`
          : "Battery is discharging.";
    else message = "Battery idle — no significant charge or discharge right now.";

    return {
      available: true,
      mode,
      soc,
      target,
      reserveSoc,
      lowSoc,
      capacity,
      remainingKwh,
      usableKwh,
      lowKwh,
      emptyKwh,
      chargeW,
      dischargeW,
      drawW,
      currentChargeEta,
      forecastEta,
      chargeEtaHours,
      fullAt,
      timeToReserve,
      timeToLow,
      timeToEmpty,
      reserveAt,
      lowAt,
      emptyAt,
      solarRemaining,
      loadRemaining,
      forecastSurplus,
      forecastCharge,
      likelyFull,
      message,
    };
  }

  _computeCustomMetrics(series) {
    return (this._config.metrics || []).map((m) => {
      const key = `metric_${m.key}`;
      const s = series[key] || [];
      const st = this._seriesStats(s);
      let value = st.avg;
      let unit = m.unit || "";
      if (m.aggregate === "integrate" || (m.type === "power" && m.aggregate === "sum")) {
        value = this._integrate(s);
        unit = m.unit || "kWh";
      } else if (m.aggregate === "max") value = st.max;
      else if (m.aggregate === "min") value = st.min;
      else if (m.aggregate === "last") value = st.last;
      else if (m.aggregate === "sum") value = s.reduce((a, p) => a + p.v, 0);
      return { ...m, series: s, stats: st, value, unit };
    });
  }

  /* ---- chart primitives ---- */

  _scaleX(t, d) {
    return ((t - d.start) / (d.end - d.start)) * 100;
  }

  _linePath(series, d, vmin, vmax, h) {
    if (!series.length) return "";
    const span = vmax - vmin || 1;
    let out = "";
    series.forEach((p, i) => {
      const x = this._scaleX(p.t, d).toFixed(2);
      const y = (h - ((p.v - vmin) / span) * h).toFixed(2);
      out += (i ? " L" : "M") + x + " " + y;
    });
    return out;
  }

  _areaPath(series, d, vmin, vmax, h) {
    if (!series.length) return "";
    const line = this._linePath(series, d, vmin, vmax, h);
    const x0 = this._scaleX(series[0].t, d).toFixed(2);
    const x1 = this._scaleX(series[series.length - 1].t, d).toFixed(2);
    return `${line} L ${x1} ${h} L ${x0} ${h} Z`;
  }

  _gridlines(h) {
    return [0.25, 0.5, 0.75]
      .map(
        (f) =>
          `<line x1="0" y1="${(h * f).toFixed(1)}" x2="100" y2="${(
            h * f
          ).toFixed(
            1
          )}" stroke="rgba(255,255,255,0.07)" stroke-width="0.5" vector-effect="non-scaling-stroke" />`
      )
      .join("");
  }

  _barRow(label, value, max, color) {
    const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
    return `
      <div class="sdc-g-bar">
        <span class="sdc-g-bar-l">${label}</span>
        <span class="sdc-g-bar-track"><span class="sdc-g-bar-fill" style="width:${pct.toFixed(
          1
        )}%;background:${color}"></span></span>
        <span class="sdc-g-bar-v">${value.toFixed(2)} kWh</span>
      </div>`;
  }

  _donut(segments, centerLabel) {
    const total = segments.reduce((a, s) => a + Math.max(0, s.value), 0) || 1;
    const r = 16;
    const c = 2 * Math.PI * r;
    let offset = 0;
    const rings = segments
      .map((s) => {
        const len = (Math.max(0, s.value) / total) * c;
        const seg = `<circle cx="21" cy="21" r="${r}" fill="none" stroke="${
          s.color
        }" stroke-width="7" stroke-dasharray="${len.toFixed(2)} ${(
          c - len
        ).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(
          2
        )}" transform="rotate(-90 21 21)" />`;
        offset += len;
        return seg;
      })
      .join("");
    return `
      <svg class="sdc-g-donut" viewBox="0 0 42 42">
        <circle cx="21" cy="21" r="${r}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="7" />
        ${rings}
        <text x="21" y="21" text-anchor="middle" dominant-baseline="central" class="sdc-g-donut-c">${centerLabel}</text>
      </svg>`;
  }

  _legend(items) {
    return `<div class="sdc-g-legend">${items
      .map(
        (i) =>
          `<span><i style="background:${i.c}"></i>${i.l}${
            i.v !== undefined ? ` <b>${i.v}</b>` : ""
          }</span>`
      )
      .join("")}</div>`;
  }

  _handleReportClick(e) {
    const tab = e.target.closest("[data-report-tab]");
    if (tab) {
      this._reportTab = tab.dataset.reportTab;
      this._drawGraphs();
      return;
    }
    const series = e.target.closest("[data-series]");
    if (series) {
      const key = series.dataset.series;
      this._seriesEnabled[key] = this._seriesEnabled[key] === false;
      this._drawGraphs();
      return;
    }
    const reset = e.target.closest("[data-chart-reset]");
    if (reset) {
      delete this._chartViews[reset.dataset.chartReset];
      this._redrawChart(reset.dataset.chartReset);
      return;
    }
    if (e.target.closest("[data-report-export]")) {
      this._downloadReportCsv();
    }
  }

  _handleReportChange(e) {
    const range = e.target.closest("[data-report-range]");
    if (!range) return;
    this._reportRange = range.value;
    this._graphData = null;
    this._lastGraphFetch = 0;
    this._chartViews = {}; // new range = fresh zoom
    this._els.graphsEl.innerHTML =
      '<div class="sdc-g-empty">Loading report...</div>';
    this._fetchGraphs();
  }

  _downloadReportCsv() {
    const g = this._graphData;
    if (!g) return;
    const defs = [
      ["solar_w", g.series.solar],
      ["load_w", g.series.load],
      ["import_w", g.series.import],
      ["export_w", g.series.export],
      ["battery_charge_w", g.series.charge],
      ["battery_discharge_w", g.series.discharge],
      ["battery_soc_pct", g.series.soc],
      ...g.customMetrics.map((m) => [`metric_${m.key}`, m.series]),
    ];
    const times = [
      ...new Set(
        defs.flatMap(([, series]) => (series || []).map((p) => p.t))
      ),
    ].sort((a, b) => a - b);
    const header = ["time", ...defs.map(([name]) => name)];
    const rows = times.map((t) => {
      const vals = defs.map(([, series]) => {
        const v = this._valueAt(series, t);
        return v === null || v === undefined ? "" : String(v);
      });
      return [new Date(t).toISOString(), ...vals].join(",");
    });
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `solar-dashboard-${g.window.range}-${new Date()
      .toISOString()
      .slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  _reportShell(g, body) {
    const rangeOptions = REPORT_RANGES.map(
      ([key, label]) =>
        `<option value="${key}" ${this._reportRange === key ? "selected" : ""}>${label}</option>`
    ).join("");
    const tabs = REPORT_TABS.map(
      ([key, label]) =>
        `<button class="sdc-r-tab ${this._reportTab === key ? "active" : ""}" data-report-tab="${key}">${label}</button>`
    ).join("");
    return `
      <div class="sdc-r-toolbar">
        <label>
          <span>Range</span>
          <select data-report-range>${rangeOptions}</select>
        </label>
        <div class="sdc-r-window">${this._esc(g.window.label)} · ${this._fmtDateTime(
      g.window.start.getTime()
    )} - ${this._fmtDateTime(g.window.end.getTime())}</div>
        <button class="sdc-r-export" data-report-export>CSV</button>
      </div>
      <div class="sdc-r-tabs">${tabs}</div>
      ${body}
      <div class="sdc-g-note">
        Report kWh figures are integrated from Home Assistant history for the selected range.
        Today's optional <code>*_energy_today_sensor</code> values override integrated estimates only on the Today range.
      </div>`;
  }

  _tile(label, value, color, sub = "") {
    return `<div class="sdc-g-tile">
      <span class="sdc-g-tile-v" style="color:${color || "var(--sdc-fg)"}">${value}</span>
      <span class="sdc-g-tile-k">${label}</span>
      ${sub ? `<span class="sdc-g-tile-sub">${sub}</span>` : ""}
    </div>`;
  }

  _delta(now, prev, formatter = (v) => v.toFixed(1)) {
    if (prev === null || prev === undefined || !Number.isFinite(prev)) return "";
    const diff = now - prev;
    const sign = diff > 0 ? "+" : "";
    return `${sign}${formatter(diff)} vs previous`;
  }

  _xAxis(d) {
    const mid = d.start + (d.end - d.start) / 2;
    return `<div class="sdc-g-x"><span>${this._fmtDateTime(d.start)}</span><span>${this._fmtDateTime(mid)}</span><span>${this._fmtDateTime(d.end)}</span></div>`;
  }

  _slug(s) {
    return String(s)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
  }

  /* Current zoom window for a chart, clamped to its full data domain. */
  _chartViewFor(id) {
    const def = this._chartDefs[id];
    const full = def ? def.options.domain : null;
    if (!full) return { start: 0, end: 1 };
    const v = this._chartViews[id];
    if (!v) return { start: full.start, end: full.end };
    return this._clampView(full, v.start, v.end);
  }

  _clampView(full, start, end) {
    const fullSpan = full.end - full.start;
    const minSpan = Math.max(120000, fullSpan * 0.005); // never zoom past ~2 min / 0.5%
    let span = end - start;
    if (!Number.isFinite(span) || span <= 0) return { start: full.start, end: full.end };
    if (span < minSpan) {
      const c = (start + end) / 2;
      start = c - minSpan / 2;
      end = c + minSpan / 2;
      span = minSpan;
    }
    if (span >= fullSpan) return { start: full.start, end: full.end };
    if (start < full.start) {
      end += full.start - start;
      start = full.start;
    }
    if (end > full.end) {
      start -= end - full.end;
      end = full.end;
    }
    if (start < full.start) start = full.start;
    return { start, end };
  }

  /* Recompute Y range over only the points inside the current zoom window —
   * this is what makes zoomed-in graphs show fine detail. */
  _visibleRange(defs, vd) {
    let vmax = -Infinity;
    let vmin = Infinity;
    defs.forEach((d) => {
      if (this._seriesEnabled[d.key] === false) return;
      (d.series || []).forEach((p) => {
        if (p.t < vd.start || p.t > vd.end || !Number.isFinite(p.v)) return;
        if (p.v > vmax) vmax = p.v;
        if (p.v < vmin) vmin = p.v;
      });
    });
    return { vmax, vmin };
  }

  /* Build the inner SVG markup + resolved scale for the chart's current view. */
  _chartInner(id) {
    const def = this._chartDefs[id];
    if (!def) return { svg: "", vd: { start: 0, end: 1 }, vmin: 0, vmax: 1 };
    const { defs, options } = def;
    const H = options.height || 66;
    const vd = this._chartViewFor(id);
    const visible = defs.filter((d) => this._seriesEnabled[d.key] !== false);
    const range = this._visibleRange(defs, vd);
    let vmax = options.vmax ?? 100;
    let vmin = options.vmin ?? 0;
    if (options.clamp) {
      // fixed scale (e.g. SoC 0-100), no autofit / headroom
    } else {
      if (Number.isFinite(range.vmax)) vmax = Math.max(options.vmin ?? 0, range.vmax);
      if (options.autoMin && Number.isFinite(range.vmin)) vmin = Math.min(vmin, range.vmin);
      if (vmax <= vmin) vmax = vmin + 1;
      vmax += (vmax - vmin) * 0.08; // headroom so peaks aren't clipped
    }
    const grads = visible
      .map((d) => {
        const cid = `${id}-${d.key}`;
        return `<linearGradient id="fill-${cid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="${d.color}" stop-opacity="0.85"/><stop offset="100%" stop-color="${d.color}" stop-opacity="0"/></linearGradient>`;
      })
      .join("");
    const paths = visible
      .map((d) => {
        const series = d.series || [];
        const path = this._linePath(series, vd, vmin, vmax, H);
        if (!path) return "";
        const area = this._areaPath(series, vd, vmin, vmax, H);
        const inView = series.filter((p) => p.t >= vd.start && p.t <= vd.end);
        const st = this._seriesStats(inView);
        const showPeak =
          st.peakTime !== null && st.peakTime >= vd.start && st.peakTime <= vd.end;
        const peakX = showPeak ? this._scaleX(st.peakTime, vd).toFixed(2) : null;
        const peakY = showPeak
          ? (H - ((st.max - vmin) / (vmax - vmin || 1)) * H).toFixed(2)
          : null;
        const cid = `${id}-${d.key}`;
        return `
          <path d="${area}" fill="url(#fill-${cid})" stroke="none" opacity="0.16" />
          <path d="${path}" fill="none" stroke="${d.color}" stroke-width="1.7" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke" />
          ${
            showPeak
              ? `<circle cx="${peakX}" cy="${peakY}" r="1.7" fill="${d.color}"><title>${this._esc(d.label)} peak ${this._metricFormat(st.max, d.unit)} at ${this._fmtDateTime(st.peakTime)}</title></circle>`
              : ""
          }`;
      })
      .join("");
    const svg = `<defs>${grads}</defs>${this._gridlines(H)}${paths}`;
    return { svg, vd, vmin, vmax };
  }

  _axisLabels(vd) {
    const mid = vd.start + (vd.end - vd.start) / 2;
    return `<span>${this._fmtDateTime(vd.start)}</span><span>${this._fmtDateTime(mid)}</span><span>${this._fmtDateTime(vd.end)}</span>`;
  }

  _yLabels(vmin, vmax, unit) {
    return [vmax, (vmax + vmin) / 2, vmin]
      .map((v) => `<span>${this._metricFormat(v, unit)}</span>`)
      .join("");
  }

  _seriesChart(title, defs, options = {}) {
    const id = `${this._reportTab}_${this._slug(title)}`;
    this._chartDefs[id] = { defs, options, title };
    const H = options.height || 66;
    const inner = this._chartInner(id);
    const zoomed = !!this._chartViews[id];
    const firstUnit = (defs.find((d) => this._seriesEnabled[d.key] !== false) || defs[0] || {}).unit;
    const legend = `<div class="sdc-g-legend sdc-g-legend-buttons">${defs
      .map((d) => {
        const off = this._seriesEnabled[d.key] === false;
        return `<button class="${off ? "off" : ""}" data-series="${d.key}"><i style="background:${d.color}"></i>${this._esc(d.label)}</button>`;
      })
      .join("")}</div>`;
    const summary = `<div class="sdc-r-summary">${defs
      .map((d) => {
        const st = this._seriesStats(d.series);
        return `<span>${this._esc(d.label)} <b>${this._metricFormat(st.avg, d.unit)}</b> avg · <b>${this._metricFormat(st.max, d.unit)}</b> max</span>`;
      })
      .join("")}</div>`;
    return `
      <div class="sdc-g-panel sdc-chart" data-chart="${id}">
        <div class="sdc-g-h sdc-chart-head">
          <span>${title}</span>
          <span class="sdc-chart-tools">
            <span class="sdc-chart-hint">scroll · zoom &nbsp;|&nbsp; drag · pan &nbsp;|&nbsp; touch · read</span>
            <button class="sdc-chart-reset" data-chart-reset="${id}" ${zoomed ? "" : "hidden"}>⟲ reset</button>
          </span>
        </div>
        <div class="sdc-chart-plot" style="height:${options.pixelHeight || 150}px">
          <div class="sdc-chart-y">${this._yLabels(inner.vmin, inner.vmax, firstUnit)}</div>
          <svg class="sdc-g-line" viewBox="0 0 100 ${H}" preserveAspectRatio="none">${inner.svg}</svg>
          <div class="sdc-chart-cross" hidden></div>
          <div class="sdc-chart-tip" hidden></div>
        </div>
        <div class="sdc-g-x">${this._axisLabels(inner.vd)}</div>
        ${legend}
        ${summary}
      </div>`;
  }

  /* Re-render just one chart's plot/axes in place (used during zoom & pan). */
  _redrawChart(id) {
    const host = this._els.graphsEl;
    const el = host && host.querySelector(`.sdc-chart[data-chart="${id}"]`);
    const def = this._chartDefs[id];
    if (!el || !def) return;
    const inner = this._chartInner(id);
    const svg = el.querySelector("svg.sdc-g-line");
    if (svg) svg.innerHTML = inner.svg;
    const y = el.querySelector(".sdc-chart-y");
    const firstUnit = (def.defs.find((d) => this._seriesEnabled[d.key] !== false) || def.defs[0] || {}).unit;
    if (y) y.innerHTML = this._yLabels(inner.vmin, inner.vmax, firstUnit);
    const x = el.querySelector(".sdc-g-x");
    if (x) x.innerHTML = this._axisLabels(inner.vd);
    const reset = el.querySelector(".sdc-chart-reset");
    if (reset) reset.hidden = !this._chartViews[id];
  }

  _chartTooltip(chartEl, clientX) {
    const id = chartEl.dataset.chart;
    const def = this._chartDefs[id];
    if (!def) return;
    // clear any other chart's overlays first
    this._els.graphsEl
      .querySelectorAll(".sdc-chart-cross, .sdc-chart-tip")
      .forEach((n) => (n.hidden = true));
    const plot = chartEl.querySelector(".sdc-chart-plot");
    const rect = plot.getBoundingClientRect();
    let frac = (clientX - rect.left) / rect.width;
    frac = Math.max(0, Math.min(1, frac));
    const vd = this._chartViewFor(id);
    const t = vd.start + frac * (vd.end - vd.start);
    const cross = chartEl.querySelector(".sdc-chart-cross");
    if (cross) {
      cross.hidden = false;
      cross.style.left = `${(frac * 100).toFixed(2)}%`;
    }
    const tip = chartEl.querySelector(".sdc-chart-tip");
    if (tip) {
      const rows = def.defs
        .filter((d) => this._seriesEnabled[d.key] !== false)
        .map((d) => {
          const v = this._valueAt(d.series, t);
          return `<div><i style="background:${d.color}"></i><span>${this._esc(d.label)}</span><b>${this._metricFormat(v, d.unit)}</b></div>`;
        })
        .join("");
      tip.hidden = false;
      tip.innerHTML = `<div class="sdc-tip-t">${this._fmtDateTime(t)}</div>${rows}`;
      if (frac > 0.6) {
        tip.style.left = "auto";
        tip.style.right = `${(100 - frac * 100).toFixed(2)}%`;
      } else {
        tip.style.right = "auto";
        tip.style.left = `${(frac * 100).toFixed(2)}%`;
      }
    }
  }

  _hideChartOverlays() {
    if (!this._els.graphsEl) return;
    this._els.graphsEl
      .querySelectorAll(".sdc-chart-cross, .sdc-chart-tip")
      .forEach((n) => (n.hidden = true));
  }

  _onChartWheel(e) {
    const plot = e.target.closest && e.target.closest(".sdc-chart-plot");
    if (!plot) return; // only the plot rectangle zooms; legend/header scrolls the page
    const chartEl = plot.closest(".sdc-chart");
    if (!chartEl) return;
    const id = chartEl.dataset.chart;
    const def = this._chartDefs[id];
    if (!def) return;
    e.preventDefault();
    const full = def.options.domain;
    const vd = this._chartViewFor(id);
    const rect = plot.getBoundingClientRect();
    let frac = (e.clientX - rect.left) / rect.width;
    frac = Math.max(0, Math.min(1, frac));
    const focus = vd.start + frac * (vd.end - vd.start);
    const factor = e.deltaY < 0 ? 0.82 : 1 / 0.82;
    const newSpan = (vd.end - vd.start) * factor;
    const view = this._clampView(full, focus - frac * newSpan, focus + (1 - frac) * newSpan);
    if (view.end - view.start >= full.end - full.start - 1) delete this._chartViews[id];
    else this._chartViews[id] = view;
    this._redrawChart(id);
    this._chartTooltip(chartEl, e.clientX);
  }

  _onChartPointerDown(e) {
    const plot = e.target.closest && e.target.closest(".sdc-chart-plot");
    if (!plot) return;
    const chartEl = plot.closest(".sdc-chart");
    if (!chartEl) return;
    const id = chartEl.dataset.chart;
    // Touch / pen have no hover, so a tap or drag scrubs the crosshair +
    // tooltip instead of panning — that makes the graph readable on mobile.
    // (Panning only matters when zoomed in, which needs a wheel/desktop.)
    if (e.pointerType && e.pointerType !== "mouse") {
      this._chartScrub = { id };
      this._chartTooltip(chartEl, e.clientX);
      return;
    }
    if (e.button !== 0) return;
    this._chartPan = {
      id,
      x: e.clientX,
      w: plot.getBoundingClientRect().width || 1,
      view: { ...this._chartViewFor(id) },
    };
  }

  _onChartPointerMove(e) {
    if (this._chartPan) {
      const { id, x, w, view } = this._chartPan;
      const def = this._chartDefs[id];
      if (!def) return;
      const dx = (e.clientX - x) / w;
      const span = view.end - view.start;
      const shift = -dx * span;
      this._chartViews[id] = this._clampView(def.options.domain, view.start + shift, view.end + shift);
      this._redrawChart(id);
      return;
    }
    // Touch scrub: keep updating the tooltip for the chart we started on, even
    // if the finger drifts over the axis labels or gridlines.
    if (this._chartScrub) {
      const chartEl =
        this._els.graphsEl &&
        this._els.graphsEl.querySelector(
          `.sdc-chart[data-chart="${this._chartScrub.id}"]`
        );
      if (chartEl) this._chartTooltip(chartEl, e.clientX);
      return;
    }
    const plot = e.target.closest && e.target.closest(".sdc-chart-plot");
    if (plot) this._chartTooltip(plot.closest(".sdc-chart"), e.clientX);
    else this._hideChartOverlays();
  }

  _onChartPointerUp() {
    this._chartPan = null;
    this._chartScrub = null;
  }

  _onChartDblClick(e) {
    const plot = e.target.closest && e.target.closest(".sdc-chart-plot");
    if (!plot) return;
    const chartEl = plot.closest(".sdc-chart");
    if (!chartEl) return;
    delete this._chartViews[chartEl.dataset.chart];
    this._redrawChart(chartEl.dataset.chart);
  }

  _metricFormat(value, unit, digits = 1) {
    if (value === null || value === undefined || !Number.isFinite(value)) return "—";
    if (unit === "W") return this._fmtPower(value);
    if (unit === "kWh") return this._fmtKwh(value, 2);
    if (unit === "%") return `${Math.round(value)}%`;
    return `${value.toFixed(digits)}${unit ? " " + unit : ""}`;
  }

  _forecastPanel(g) {
    const f = g.forecast;
    if (!f.available) {
      return `<div class="sdc-g-panel"><div class="sdc-g-h">Battery timing</div><div class="sdc-r-muted">${this._esc(f.message)}</div></div>`;
    }
    const P = GRAPH_PALETTE;
    const modeLabel =
      { charging: "⚡ Charging", discharging: "🔻 Discharging", idle: "• Idle" }[f.mode] || f.mode;
    const modeColor =
      { charging: P.chg, discharging: P.dis, idle: "var(--sdc-muted)" }[f.mode] || "var(--sdc-muted)";
    let tiles;
    if (f.mode === "discharging") {
      tiles =
        this._tile("Usable now", this._fmtKwh(f.usableKwh, 2), P.soc, `above ${f.reserveSoc}% reserve`) +
        this._tile("Draw", this._fmtPower(f.drawW), P.dis) +
        this._tile("To reserve", this._fmtDuration(f.timeToReserve), P.imp, f.reserveAt ? `~${this._fmtDateTime(f.reserveAt)}` : "") +
        this._tile(`To ${f.lowSoc}%`, this._fmtDuration(f.timeToLow), P.imp, f.lowAt ? `~${this._fmtDateTime(f.lowAt)}` : "") +
        this._tile("To empty", this._fmtDuration(f.timeToEmpty), P.dis, f.emptyAt ? `~${this._fmtDateTime(f.emptyAt)}` : "");
    } else {
      tiles =
        this._tile("To full", this._fmtKwh(f.remainingKwh, 2), P.soc, `to ${f.target}%`) +
        this._tile("Charge rate", this._fmtPower(f.chargeW), P.chg) +
        this._tile("Full in", this._fmtDuration(f.chargeEtaHours), P.chg, f.fullAt ? `~${this._fmtDateTime(f.fullAt)}` : "") +
        this._tile("Likely full today", f.likelyFull ? "Yes" : "No", f.likelyFull ? P.exp : P.imp, f.forecastSurplus !== null ? `surplus ${this._fmtKwh(f.forecastSurplus, 1)}` : "");
    }
    const soc = Math.max(0, Math.min(100, f.soc));
    const bar = `<div class="sdc-soc-bar">
      <div class="sdc-soc-fill" style="width:${soc}%;background:linear-gradient(90deg, ${P.dis}, ${P.soc})"></div>
      <div class="sdc-soc-mark low" style="left:${Math.max(0, Math.min(100, f.lowSoc))}%" title="Low ${f.lowSoc}%"></div>
      <div class="sdc-soc-mark" style="left:${Math.max(0, Math.min(100, f.reserveSoc))}%" title="Reserve ${f.reserveSoc}%"></div>
      <div class="sdc-soc-mark target" style="left:${Math.max(0, Math.min(100, f.target))}%" title="Target ${f.target}%"></div>
      <span class="sdc-soc-label">${Math.round(f.soc)}%</span>
    </div>`;
    return `<div class="sdc-g-panel sdc-forecast">
      <div class="sdc-g-h sdc-chart-head"><span>Battery timing</span><span class="sdc-forecast-mode" style="color:${modeColor}">${modeLabel}</span></div>
      ${bar}
      <div class="sdc-r-kpis">${tiles}</div>
      <div class="sdc-r-muted">${this._esc(f.message)}</div>
    </div>`;
  }

  _renderOverview(g) {
    const k = g.kwh;
    const p = g.previousKwh;
    const f = g.forecast;
    const P = GRAPH_PALETTE;
    const autonomy =
      f.available && g.stats.avgLoad && g.stats.avgLoad > 50
        ? f.usableKwh / (g.stats.avgLoad / 1000)
        : null;
    const tiles =
      this._tile("Generated", this._fmtKwh(k.generated, 1), P.pv, p ? this._delta(k.generated, p.generated) : "") +
      this._tile("Used", this._fmtKwh(k.used, 1), P.load, p ? this._delta(k.used, p.used) : "") +
      this._tile("Self-sufficiency", `${Math.round(g.stats.selfSufficiency * 100)}%`, P.exp) +
      this._tile("Self-consumption", `${Math.round(g.stats.selfConsumption * 100)}%`, P.chg) +
      this._tile("Net cost", this._fmtMoney(g.cost.net), g.cost.net <= 0 ? P.exp : P.imp) +
      this._tile("Saved vs no-solar", this._fmtMoney(g.cost.savings), P.exp) +
      this._tile("CO₂ avoided", `${g.stats.co2Avoided.toFixed(1)} kg`, P.dis) +
      this._tile("Battery autonomy", autonomy === null ? "—" : this._fmtDuration(autonomy), P.soc, "at avg load");
    return `
      <div class="sdc-g-tiles">${tiles}</div>
      ${this._forecastPanel(g)}
      ${this._seriesChart(
        "Power",
        [
          { key: "solar", label: "Solar", color: GRAPH_PALETTE.pv, series: g.series.solar, unit: "W" },
          { key: "load", label: "Load", color: GRAPH_PALETTE.load, series: g.series.load, unit: "W" },
          { key: "import", label: "Import", color: GRAPH_PALETTE.imp, series: g.series.import, unit: "W" },
          { key: "export", label: "Export", color: GRAPH_PALETTE.exp, series: g.series.export, unit: "W" },
        ],
        { domain: g.domain, vmax: 100 }
      )}`;
  }

  _renderEnergy(g) {
    const k = g.kwh;
    const P = GRAPH_PALETTE;
    const maxBar = Math.max(k.generated, k.used, k.imported, k.exported, k.charged, k.discharged, 0.1);
    const bars =
      this._barRow("Generated (PV)", k.generated, maxBar, P.pv) +
      this._barRow("Used (load)", k.used, maxBar, P.load) +
      this._barRow("Imported (bought)", k.imported, maxBar, P.imp) +
      this._barRow("Exported (sold)", k.exported, maxBar, P.exp) +
      this._barRow("Stored (charged)", k.charged, maxBar, P.chg) +
      this._barRow("Discharged", k.discharged, maxBar, P.dis);
    const homeDonut = this._donut(
      [
        { value: g.disp.homeFromSolar, color: P.pv },
        { value: g.disp.homeFromBattery, color: P.dis },
        { value: g.disp.homeFromGrid, color: P.imp },
      ],
      Math.round(g.stats.selfSufficiency * 100) + "%"
    );
    const solarDonut = this._donut(
      [
        { value: g.disp.solarSelf, color: P.load },
        { value: g.disp.charged, color: P.chg },
        { value: g.disp.exported, color: P.exp },
      ],
      Math.round(g.stats.selfConsumption * 100) + "%"
    );
    return `
      <div class="sdc-g-panel"><div class="sdc-g-h">Energy summary</div><div class="sdc-g-bars">${bars}</div></div>
      <div class="sdc-g-panel">
        <div class="sdc-g-h">Energy dispersion</div>
        <div class="sdc-g-donuts">
          <div class="sdc-g-donut-box">${homeDonut}<div class="sdc-g-donut-cap">Home supply</div>${this._legend([{ l: "Solar", c: P.pv }, { l: "Battery", c: P.dis }, { l: "Grid", c: P.imp }])}</div>
          <div class="sdc-g-donut-box">${solarDonut}<div class="sdc-g-donut-cap">Solar usage</div>${this._legend([{ l: "Home", c: P.load }, { l: "Battery", c: P.chg }, { l: "Grid", c: P.exp }])}</div>
        </div>
      </div>`;
  }

  _renderCost(g) {
    const c = g.cost;
    // Feed-in rows: per-band when TOU export is configured, else a single line.
    let exportRows;
    if (c.touExport) {
      const eb = c.touExport.exportByBand;
      const er = c.touExport.rates;
      const elabels = {
        peak: "Feed-in · Peak",
        mid_peak: "Feed-in · Mid-peak",
        shoulder: "Feed-in · Shoulder",
        offpeak: "Feed-in · Off-peak",
      };
      exportRows = ["peak", "mid_peak", "shoulder", "offpeak"]
        .filter((k) => (eb[k] || 0) > 0.0005 || (er[k] || 0) > 0)
        .map((k) => [
          elabels[k],
          this._fmtKwh(eb[k] || 0, 2),
          `@ $${(er[k] || 0).toFixed(3)}/kWh`,
          "-" + this._fmtMoney((eb[k] || 0) * (er[k] || 0)),
        ]);
      exportRows.push([
        "Exported total",
        this._fmtKwh(g.kwh.exported, 2),
        "",
        "-" + this._fmtMoney(c.credit),
      ]);
    } else {
      exportRows = [
        ["Exported", this._fmtKwh(g.kwh.exported, 2), `@ $${c.exportTariff}/kWh`, "-" + this._fmtMoney(c.credit)],
      ];
    }
    let rows;
    if (c.tou) {
      // Per-band import breakdown (only bands with usage or a set rate shown).
      const b = c.tou.importByBand;
      const r = c.tou.rates;
      const labels = {
        peak: "Import · Peak",
        shoulder: "Import · Shoulder",
        offpeak: "Import · Off-peak",
        free: "Import · Free",
      };
      rows = ["peak", "shoulder", "offpeak", "free"]
        .filter((k) => (b[k] || 0) > 0.0005 || (k !== "free" && r[k] > 0))
        .map((k) => [
          labels[k],
          this._fmtKwh(b[k] || 0, 2),
          `@ $${(r[k] || 0).toFixed(k === "free" ? 0 : 3)}/kWh`,
          this._fmtMoney((b[k] || 0) * (r[k] || 0)),
        ]);
      rows.push(
        ["Imported total", this._fmtKwh(g.kwh.imported, 2), "", this._fmtMoney(c.usage)],
        ...exportRows,
        ["Supply", `${c.days.toFixed(1)} days`, `@ $${c.dailyFee}/day`, this._fmtMoney(c.supply)],
        ...(c.bonus > 0.0001
          ? [["Zero-import bonus", `${c.days.toFixed(1)} days`, `@ -$${this._zeroImportBonusPerDay()}/day`, "-" + this._fmtMoney(c.bonus)]]
          : []),
        ["Net", "", "", this._fmtMoney(c.net)]
      );
    } else {
      rows = [
        ["Imported", this._fmtKwh(g.kwh.imported, 2), `@ $${c.importTariff}/kWh`, this._fmtMoney(c.usage)],
        ...exportRows,
        ["Supply", `${c.days.toFixed(1)} days`, `@ $${c.dailyFee}/day`, this._fmtMoney(c.supply)],
        ...(c.bonus > 0.0001
          ? [["Zero-import bonus", `${c.days.toFixed(1)} days`, `@ -$${this._zeroImportBonusPerDay()}/day`, "-" + this._fmtMoney(c.bonus)]]
          : []),
        ["Net", "", "", this._fmtMoney(c.net)],
      ];
    }
    return `
      <div class="sdc-r-kpis">
        ${this._tile("Net cost", this._fmtMoney(c.net), c.net <= 0 ? GRAPH_PALETTE.exp : GRAPH_PALETTE.imp, c.previous !== null ? this._delta(c.net, c.previous, (v) => this._fmtMoney(v)) : "")}
        ${this._tile("Imported cost", this._fmtMoney(c.usage), GRAPH_PALETTE.imp)}
        ${this._tile("Feed-in credit", this._fmtMoney(c.credit), GRAPH_PALETTE.exp)}
        ${this._tile("Projected bill", c.projected === null ? "—" : this._fmtMoney(c.projected), GRAPH_PALETTE.chg)}
        ${this._tile("Saved vs no-solar", this._fmtMoney(c.savings), GRAPH_PALETTE.exp)}
        ${this._tile("Bill without solar", this._fmtMoney(c.noSolarBill), GRAPH_PALETTE.imp)}
      </div>
      <div class="sdc-g-panel">
        <div class="sdc-g-h">Cost breakdown${c.tou || c.touExport ? " · time-of-use" : ""}</div>
        <div class="sdc-r-table">${rows.map((r) => `<div><span>${r[0]}</span><span>${r[1]}</span><span>${r[2]}</span><b>${r[3]}</b></div>`).join("")}</div>
      </div>`;
  }

  _renderBattery(g) {
    const b = g.battery;
    return `
      <div class="sdc-r-kpis">
        ${this._tile("SoC min/max", `${b.soc.min === null ? "—" : Math.round(b.soc.min)}% / ${b.soc.max === null ? "—" : Math.round(b.soc.max)}%`, GRAPH_PALETTE.soc)}
        ${this._tile("Charged", this._fmtKwh(g.kwh.charged, 2), GRAPH_PALETTE.chg, `Solar ${this._fmtKwh(b.solarCharged, 2)} · Grid ${this._fmtKwh(b.gridCharged, 2)}`)}
        ${this._tile("Discharged", this._fmtKwh(g.kwh.discharged, 2), GRAPH_PALETTE.dis)}
        ${this._tile("Cycles", b.cycleEstimate === null ? "—" : b.cycleEstimate.toFixed(2), GRAPH_PALETTE.pv)}
        ${this._tile("Efficiency", b.efficiency === null ? "—" : `${Math.round(b.efficiency * 100)}%`, GRAPH_PALETTE.exp)}
        ${this._tile("Below reserve", this._fmtDuration(b.reserveHours), GRAPH_PALETTE.imp, b.reserveSoc !== null ? `<= ${b.reserveSoc}%` : "")}
        ${this._tile("Full time", this._fmtDuration(b.fullHours), GRAPH_PALETTE.soc, `>= ${b.fullSoc}%`)}
      </div>
      ${this._forecastPanel(g)}
      ${this._seriesChart("Battery SoC", [{ key: "soc", label: "SoC", color: GRAPH_PALETTE.soc, series: g.series.soc, unit: "%" }], { domain: g.domain, vmin: 0, vmax: 100, clamp: true })}
      ${this._seriesChart("Battery power", [
        { key: "charge", label: "Charge", color: GRAPH_PALETTE.chg, series: g.series.charge, unit: "W" },
        { key: "discharge", label: "Discharge", color: GRAPH_PALETTE.dis, series: g.series.discharge, unit: "W" },
      ], { domain: g.domain, vmax: 100 })}`;
  }

  _renderGrid(g) {
    return `
      <div class="sdc-r-kpis">
        ${this._tile("Imported", this._fmtKwh(g.kwh.imported, 2), GRAPH_PALETTE.imp)}
        ${this._tile("Exported", this._fmtKwh(g.kwh.exported, 2), GRAPH_PALETTE.exp)}
        ${this._tile("Net grid", this._fmtKwh(g.kwh.imported - g.kwh.exported, 2), GRAPH_PALETTE.chg)}
        ${this._tile("Grid cost", this._fmtMoney(g.cost.usage - g.cost.credit), GRAPH_PALETTE.pv)}
        ${this._tile("Grid-free time", this._fmtDuration(g.stats.gridFreeHours), GRAPH_PALETTE.exp, "zero import")}
        ${this._tile("Peak load", this._fmtPower(g.stats.peakLoad), GRAPH_PALETTE.load, g.stats.peakLoadTime ? this._fmtDateTime(g.stats.peakLoadTime) : "")}
      </div>
      ${this._seriesChart("Grid power", [
        { key: "import", label: "Import", color: GRAPH_PALETTE.imp, series: g.series.import, unit: "W" },
        { key: "export", label: "Export", color: GRAPH_PALETTE.exp, series: g.series.export, unit: "W" },
      ], { domain: g.domain, vmax: 100 })}`;
  }

  _renderSolar(g) {
    const s = g.solar;
    const stringRows = s.strings.length
      ? `<div class="sdc-r-table">${s.strings
          .map(
            (pv) =>
              `<div><span>${pv.id}${pv.low ? " · check" : ""}</span><span>${this._fmtPower(pv.power)}</span><span>${pv.voltage === null ? "—" : pv.voltage.toFixed(1) + " V"}</span><b>${pv.current === null ? "—" : pv.current.toFixed(2) + " A"}</b></div>`
          )
          .join("")}</div>`
      : `<div class="sdc-r-muted">Configure PV string sensors to compare string performance.</div>`;
    return `
      <div class="sdc-r-kpis">
        ${this._tile("Generated", this._fmtKwh(g.kwh.generated, 2), GRAPH_PALETTE.pv)}
        ${this._tile("Peak", this._fmtPower(s.solar.max), GRAPH_PALETTE.pv, s.solar.peakTime ? this._fmtDateTime(s.solar.peakTime) : "")}
        ${this._tile("Self-consumed", `${Math.round(g.stats.selfConsumption * 100)}%`, GRAPH_PALETTE.exp)}
        ${this._tile("Near clipping", this._fmtDuration(s.clippingHours), GRAPH_PALETTE.imp, s.capacity ? `>= ${this._fmtPower(s.capacity * 0.98)}` : "set solar_inverter_ac_capacity_w")}
      </div>
      ${this._seriesChart("Solar generation", [{ key: "solar", label: "Solar", color: GRAPH_PALETTE.pv, series: g.series.solar, unit: "W" }], { domain: g.domain, vmax: 100 })}
      <div class="sdc-g-panel"><div class="sdc-g-h">PV strings</div>${stringRows}</div>`;
  }

  _renderInverter(g) {
    const i = g.inverter;
    const rows = [
      ["Work mode", i.workMode],
      ["Inverter state", i.state],
      ["Fault", i.fault],
      ["Inverter temp", i.inverterTemp],
      ["Ambient temp", i.ambientTemp],
      ["Battery temp", i.batteryTemp],
      ["Grid voltage", i.gridVoltage],
      ["Grid current", i.gridCurrent],
    ];
    return `<div class="sdc-g-panel"><div class="sdc-g-h">Inverter health</div><div class="sdc-r-table two">${rows.map((r) => `<div><span>${r[0]}</span><b>${this._esc(r[1])}</b></div>`).join("")}</div></div>`;
  }

  _renderEvents(g) {
    const events = [];
    if (g.cost.net < 0) events.push(["Credit period", `Feed-in credit exceeds import plus supply by ${this._fmtMoney(Math.abs(g.cost.net))}.`]);
    if (g.battery.gridCharged > 0.05) events.push(["Grid charging", `${this._fmtKwh(g.battery.gridCharged, 2)} charged while importing from grid.`]);
    if (g.battery.reserveHours > 0) events.push(["Reserve low", `Battery spent ${this._fmtDuration(g.battery.reserveHours)} at or below reserve.`]);
    if (g.solar.clippingHours > 0) events.push(["Solar clipping watch", `Solar sat near inverter capacity for ${this._fmtDuration(g.solar.clippingHours)}.`]);
    if (g.inverter.fault && g.inverter.fault !== "—" && String(g.inverter.fault).toLowerCase() !== "none") events.push(["Inverter fault", g.inverter.fault]);
    if (!events.length) events.push(["No notable events", "No cost, battery, grid or inverter exceptions detected in this range."]);
    return `<div class="sdc-g-panel"><div class="sdc-g-h">Events</div><div class="sdc-r-events">${events.map((e) => `<div><b>${this._esc(e[0])}</b><span>${this._esc(e[1])}</span></div>`).join("")}</div></div>`;
  }

  _renderMetrics(g) {
    if (!g.customMetrics.length)
      return `<div class="sdc-g-panel"><div class="sdc-g-h">Custom metrics</div><div class="sdc-r-muted">Add <code>metrics:</code> entries in YAML to track extra sensors here.</div></div>`;
    const defs = g.customMetrics.map((m) => ({
      key: `metric_${m.key}`,
      label: m.label,
      color: m.color,
      series: m.series,
      unit: m.type === "power" ? "W" : m.unit || "",
      chart: m.chart || "metrics",
    }));
    const tiles = g.customMetrics
      .map((m) => {
        const unit =
          m.unit ||
          (m.type === "power"
            ? m.aggregate === "integrate" || m.aggregate === "sum"
              ? "kWh"
              : "W"
            : "");
        return this._tile(m.label, this._metricFormat(m.value, unit), m.color, m.aggregate);
      })
      .join("");
    const charts = Object.entries(
      defs.reduce((acc, d) => {
        const group = d.chart || "metrics";
        if (!acc[group]) acc[group] = [];
        acc[group].push(d);
        return acc;
      }, {})
    )
      .map(([group, groupDefs]) =>
        this._seriesChart(`${group.replace(/_/g, " ")} metrics`, groupDefs, {
          domain: g.domain,
          vmax: 100,
          autoMin: true,
        })
      )
      .join("");
    return `<div class="sdc-g-tiles">${tiles}</div>${charts}`;
  }

  _drawGraphs() {
    const g = this._graphData;
    const host = this._els.graphsEl;
    if (!g || !host) return;
    let body = "";
    switch (this._reportTab) {
      case "energy":
        body = this._renderEnergy(g);
        break;
      case "cost":
        body = this._renderCost(g);
        break;
      case "battery":
        body = this._renderBattery(g);
        break;
      case "grid":
        body = this._renderGrid(g);
        break;
      case "solar":
        body = this._renderSolar(g);
        break;
      case "inverter":
        body = this._renderInverter(g);
        break;
      case "events":
        body = this._renderEvents(g);
        break;
      case "metrics":
        body = this._renderMetrics(g);
        break;
      case "overview":
      default:
        this._reportTab = "overview";
        body = this._renderOverview(g);
    }
    host.innerHTML = this._reportShell(g, body);
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
      /* colour is per-flow via the --fc custom property set on each path */
      .sdc-flow.active {
        opacity: 1;
        stroke: var(--fc);
        filter: drop-shadow(0 0 4px var(--fc));
        animation: sdc-flow-move 1.1s linear infinite;
      }
      @keyframes sdc-flow-move { to { stroke-dashoffset: -13.1; } }

      /* Home glow (replaces the home node) — radial-box fallback mode */
      .sdc-home-glow {
        position:absolute;
        transform: translate(-50%, -50%);
        border:none;
        padding:0;
        border-radius:50%;
        cursor:pointer;
        background: radial-gradient(ellipse at center, var(--hg) 0%, transparent 68%);
        filter: blur(var(--hg-blur, 14px));
        mix-blend-mode: screen;
        opacity: 0;
        transition: opacity .6s ease;
      }
      .sdc-home-glow.active {
        opacity: 0.6;
        animation: sdc-glow-pulse 2.6s ease-in-out infinite;
      }
      @keyframes sdc-glow-pulse {
        0%,100% { opacity: 0.38; }
        50%     { opacity: 0.72; }
      }

      /* Alpha-masked house overlay — glow follows the house silhouette */
      .sdc-house-overlay {
        position:absolute;
        inset:0;
        width:100%;
        height:100%;
        object-fit: fill;
        pointer-events:auto;
        cursor:pointer;
        filter: drop-shadow(0 0 0 transparent);
        transition: filter .6s ease;
      }
      .sdc-house-overlay.active {
        animation: sdc-overlay-glow 2.6s ease-in-out infinite;
      }
      @keyframes sdc-overlay-glow {
        0%,100% { filter: drop-shadow(0 0 calc(var(--hg-blur, 14px) * 0.55) var(--hg)); }
        50%     { filter: drop-shadow(0 0 var(--hg-blur, 14px) var(--hg))
                          drop-shadow(0 0 calc(var(--hg-blur, 14px) * 1.9) var(--hg)); }
      }

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

      /* per-node accent colour (--nc) is set inline from node_colors config;
         this fallback keeps the ring sane if it is ever missing */
      .sdc-node { --nc: #21e065; }

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

      /* Graphs */
      .sdc-graphs-wrap { border-top:1px solid rgba(255,255,255,0.06); }
      .sdc-graphs-toggle {
        width:100%;
        display:flex;
        align-items:center;
        gap:8px;
        padding:11px 14px;
        background:none;
        border:none;
        color: var(--sdc-fg);
        font-family:inherit;
        font-size:0.84rem;
        font-weight:600;
        cursor:pointer;
      }
      .sdc-graphs-toggle ha-icon { --mdc-icon-size:18px; color: var(--sdc-muted); }
      .sdc-graphs-toggle .sdc-chevron { margin-left:auto; transition: transform .25s ease; }
      .sdc-graphs-wrap.collapsed .sdc-chevron { transform: rotate(-90deg); }
      .sdc-graphs { padding: 0 12px 12px; display:flex; flex-direction:column; gap:10px; }
      .sdc-graphs-wrap.collapsed .sdc-graphs { display:none; }
      .sdc-g-empty { padding:18px; text-align:center; color: var(--sdc-muted); font-size:0.85rem; }

      .sdc-g-tiles {
        display:grid;
        grid-template-columns: repeat(4, 1fr);
        gap:8px;
      }
      .sdc-g-tile {
        background: var(--sdc-panel);
        border:1px solid rgba(255,255,255,0.06);
        border-radius:10px;
        padding:9px 6px;
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:2px;
      }
      .sdc-g-tile-v { font-size:1rem; font-weight:800; }
      .sdc-g-tile-k { font-size:0.6rem; text-transform:uppercase; letter-spacing:0.04em; color: var(--sdc-muted); text-align:center; }

      .sdc-g-panel {
        background: var(--sdc-panel);
        border:1px solid rgba(255,255,255,0.06);
        border-radius:12px;
        padding:12px 14px;
      }
      .sdc-g-h {
        font-size:0.72rem;
        text-transform:uppercase;
        letter-spacing:0.05em;
        color: var(--sdc-muted);
        margin-bottom:10px;
        font-weight:700;
      }

      .sdc-g-bars { display:flex; flex-direction:column; gap:7px; }
      .sdc-g-bar { display:grid; grid-template-columns: 110px 1fr 76px; align-items:center; gap:8px; }
      .sdc-g-bar-l { font-size:0.72rem; color: var(--sdc-muted); }
      .sdc-g-bar-track { height:10px; border-radius:6px; background: rgba(255,255,255,0.08); overflow:hidden; }
      .sdc-g-bar-fill { display:block; height:100%; border-radius:6px; transition: width .5s ease; }
      .sdc-g-bar-v { font-size:0.74rem; font-weight:700; text-align:right; }

      .sdc-g-donuts { display:grid; grid-template-columns: 1fr 1fr; gap:10px; }
      .sdc-g-donut-box { display:flex; flex-direction:column; align-items:center; gap:6px; }
      .sdc-g-donut { width:96px; height:96px; }
      .sdc-g-donut-c { fill: var(--sdc-fg); font-size:8px; font-weight:800; }
      .sdc-g-donut-cap { font-size:0.7rem; color: var(--sdc-muted); }

      .sdc-g-line { width:100%; height:140px; display:block; }
      .sdc-g-x { display:flex; justify-content:space-between; font-size:0.62rem; color: var(--sdc-muted); margin-top:3px; }

      .sdc-g-legend {
        display:flex; flex-wrap:wrap; gap:6px 12px; margin-top:8px;
        font-size:0.68rem; color: var(--sdc-muted);
      }
      .sdc-g-legend span { display:inline-flex; align-items:center; gap:4px; }
      .sdc-g-legend i { width:9px; height:9px; border-radius:2px; display:inline-block; }
      .sdc-g-legend b { color: var(--sdc-fg); font-weight:700; }
      .sdc-g-note { font-size:0.68rem; color: var(--sdc-muted); line-height:1.4; }
      .sdc-g-note code { background: rgba(255,255,255,0.08); padding:1px 4px; border-radius:4px; }

      .sdc-r-toolbar {
        display:grid;
        grid-template-columns: minmax(130px, 180px) 1fr auto;
        gap:8px;
        align-items:end;
      }
      .sdc-r-toolbar label {
        display:flex;
        flex-direction:column;
        gap:3px;
        font-size:0.66rem;
        color: var(--sdc-muted);
        text-transform:uppercase;
        letter-spacing:0.04em;
      }
      .sdc-r-toolbar select,
      .sdc-r-export {
        min-height:34px;
        border:1px solid rgba(255,255,255,0.12);
        border-radius:8px;
        background: rgba(255,255,255,0.06);
        color: var(--sdc-fg);
        font-family:inherit;
        font-size:0.8rem;
        padding:6px 9px;
      }
      .sdc-r-export { cursor:pointer; font-weight:700; }
      .sdc-r-window {
        font-size:0.74rem;
        color: var(--sdc-muted);
        align-self:center;
      }
      .sdc-r-tabs {
        display:flex;
        flex-wrap:wrap;
        gap:6px;
      }
      .sdc-r-tab {
        min-height:32px;
        border:1px solid rgba(255,255,255,0.10);
        border-radius:8px;
        background: rgba(255,255,255,0.045);
        color: var(--sdc-muted);
        font-family:inherit;
        font-size:0.74rem;
        padding:6px 9px;
        cursor:pointer;
      }
      .sdc-r-tab.active {
        color: var(--sdc-fg);
        border-color: rgba(245,197,66,0.55);
        background: rgba(245,197,66,0.12);
      }
      .sdc-r-kpis {
        display:grid;
        grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
        gap:8px;
      }
      .sdc-g-tile-sub {
        font-size:0.62rem;
        color: var(--sdc-muted);
        text-align:center;
        line-height:1.25;
      }
      .sdc-r-muted {
        font-size:0.78rem;
        color: var(--sdc-muted);
        line-height:1.4;
      }
      .sdc-r-table {
        display:flex;
        flex-direction:column;
        gap:6px;
      }
      .sdc-r-table > div {
        display:grid;
        grid-template-columns: minmax(90px, 1fr) minmax(70px, 1fr) minmax(70px, 1fr) minmax(70px, auto);
        gap:8px;
        align-items:center;
        font-size:0.78rem;
        border-bottom:1px solid rgba(255,255,255,0.06);
        padding-bottom:6px;
      }
      .sdc-r-table.two > div { grid-template-columns: minmax(110px, 1fr) 1.5fr; }
      .sdc-r-table span { color: var(--sdc-muted); }
      .sdc-r-table b { color: var(--sdc-fg); text-align:right; }
      .sdc-r-events {
        display:flex;
        flex-direction:column;
        gap:8px;
      }
      .sdc-r-events > div {
        display:flex;
        flex-direction:column;
        gap:2px;
        padding-bottom:8px;
        border-bottom:1px solid rgba(255,255,255,0.06);
      }
      .sdc-r-events b { font-size:0.82rem; }
      .sdc-r-events span { font-size:0.76rem; color: var(--sdc-muted); line-height:1.35; }
      .sdc-g-legend-buttons button {
        display:inline-flex;
        align-items:center;
        gap:4px;
        border:none;
        background:none;
        color: var(--sdc-muted);
        font:inherit;
        cursor:pointer;
        padding:0;
      }
      .sdc-g-legend-buttons button.off { opacity:0.38; text-decoration:line-through; }
      .sdc-r-summary {
        display:flex;
        flex-wrap:wrap;
        gap:5px 12px;
        margin-top:8px;
        font-size:0.66rem;
        color: var(--sdc-muted);
      }
      .sdc-r-summary b { color: var(--sdc-fg); }

      /* ===== futuristic report theme ===== */
      .sdc-graphs {
        --sdc-accent: #38e1ff;
        --sdc-accent2: #7c5cff;
        background:
          radial-gradient(120% 80% at 50% -10%, rgba(56,225,255,0.06), transparent 60%);
      }
      .sdc-g-panel {
        position: relative;
        background:
          linear-gradient(180deg, rgba(255,255,255,0.05), rgba(255,255,255,0.018));
        border: 1px solid rgba(120,200,255,0.14);
        box-shadow: inset 0 1px 0 rgba(255,255,255,0.05), 0 6px 22px -14px rgba(0,0,0,0.7);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        overflow: hidden;
      }
      .sdc-g-panel::before {
        content:"";
        position:absolute; top:0; left:0; right:0; height:1px;
        background: linear-gradient(90deg, transparent, var(--sdc-accent), transparent);
        opacity:0.5;
      }
      .sdc-g-h { color:#bcd7e6; }
      .sdc-g-tile {
        background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
        border: 1px solid rgba(120,200,255,0.12);
      }
      .sdc-g-tile-v {
        font-family: ui-monospace, "SFMono-Regular", "Roboto Mono", Menlo, monospace;
        font-variant-numeric: tabular-nums;
        letter-spacing: 0.01em;
        text-shadow: 0 0 14px currentColor;
        filter: saturate(1.1);
      }
      .sdc-r-tab {
        transition: all .18s ease;
        backdrop-filter: blur(4px);
      }
      .sdc-r-tab:hover { color: var(--sdc-fg); border-color: rgba(120,200,255,0.35); }
      .sdc-r-tab.active {
        color:#eafaff;
        border-color: rgba(56,225,255,0.7);
        background: linear-gradient(180deg, rgba(56,225,255,0.22), rgba(124,92,255,0.16));
        box-shadow: 0 0 16px -4px rgba(56,225,255,0.6);
      }
      .sdc-r-export:hover { border-color: rgba(56,225,255,0.5); }

      /* chart HUD header */
      .sdc-chart-head {
        display:flex; align-items:center; justify-content:space-between; gap:8px;
      }
      .sdc-chart-tools { display:flex; align-items:center; gap:8px; }
      .sdc-chart-hint {
        font-size:0.56rem; letter-spacing:0.04em; color: rgba(160,200,225,0.55);
        text-transform:none; white-space:nowrap;
      }
      .sdc-chart-reset {
        font: inherit; font-size:0.6rem; cursor:pointer;
        color:#cdefff; background: rgba(56,225,255,0.12);
        border:1px solid rgba(56,225,255,0.4); border-radius:6px;
        padding:2px 7px; line-height:1.2;
      }
      .sdc-chart-reset:hover { background: rgba(56,225,255,0.22); }

      /* interactive plot area */
      .sdc-chart-plot {
        position: relative;
        width: 100%;
        margin-top: 2px;
        box-sizing: border-box;
        touch-action: pan-y;
        cursor: crosshair;
        overflow: hidden;
        border-radius: 8px;
      }
      .sdc-chart-plot .sdc-g-line { width:100%; height:100%; }
      /* y labels overlay the left edge; full-width SVG keeps cursor↔data aligned */
      .sdc-chart-y {
        position:absolute; left:0; top:0; bottom:0; width:54px;
        display:flex; flex-direction:column; justify-content:space-between;
        font-family: ui-monospace, monospace; font-variant-numeric: tabular-nums;
        font-size:0.54rem; color: rgba(190,220,240,0.75);
        text-align:left; padding:1px 0 1px 3px; pointer-events:none; z-index:2;
        background: linear-gradient(90deg, rgba(14,20,28,0.55), transparent);
      }
      .sdc-chart-y span { text-shadow: 0 0 4px rgba(0,0,0,0.9); }
      .sdc-chart-cross {
        position:absolute; top:0; bottom:0; width:1px;
        background: linear-gradient(180deg, rgba(56,225,255,0.0), rgba(56,225,255,0.8), rgba(56,225,255,0.0));
        box-shadow: 0 0 8px rgba(56,225,255,0.7);
        pointer-events:none; transform: translateX(-0.5px);
      }
      .sdc-chart-tip {
        position:absolute; top:6px; transform: translateX(8px);
        min-width:120px; max-width:200px;
        background: rgba(14,20,28,0.92);
        border:1px solid rgba(120,200,255,0.3);
        border-radius:8px; padding:6px 8px;
        box-shadow: 0 8px 24px -8px rgba(0,0,0,0.8), 0 0 0 1px rgba(56,225,255,0.08) inset;
        backdrop-filter: blur(8px);
        font-size:0.66rem; pointer-events:none; z-index:5;
      }
      .sdc-chart-tip[style*="right"] { transform: translateX(-8px); }
      .sdc-tip-t {
        font-family: ui-monospace, monospace; font-size:0.6rem;
        color:#9fd6ee; margin-bottom:4px; white-space:nowrap;
      }
      .sdc-chart-tip > div {
        display:flex; align-items:center; gap:5px; line-height:1.5; white-space:nowrap;
      }
      .sdc-chart-tip i { width:8px; height:8px; border-radius:2px; flex:0 0 auto; }
      .sdc-chart-tip span { color: var(--sdc-muted); margin-right:auto; }
      .sdc-chart-tip b {
        font-family: ui-monospace, monospace; font-variant-numeric: tabular-nums; color:#fff;
      }

      /* battery SoC bar with reserve / target markers */
      .sdc-forecast-mode {
        font-size:0.7rem; font-weight:800; letter-spacing:0.03em; text-transform:none;
        text-shadow: 0 0 12px currentColor;
      }
      .sdc-soc-bar {
        position:relative; height:18px; border-radius:9px; margin:2px 0 12px;
        background: rgba(255,255,255,0.07);
        border:1px solid rgba(120,200,255,0.16); overflow:hidden;
      }
      .sdc-soc-fill {
        height:100%; border-radius:9px 0 0 9px;
        box-shadow: 0 0 16px -2px rgba(56,225,255,0.6); transition: width .6s ease;
      }
      .sdc-soc-mark {
        position:absolute; top:-2px; bottom:-2px; width:2px;
        background: rgba(255,255,255,0.65); transform: translateX(-1px);
      }
      .sdc-soc-mark.target { background: #ffd34d; box-shadow:0 0 6px #ffd34d; }
      .sdc-soc-mark.low { background: #ff5d5d; box-shadow:0 0 6px #ff5d5d; }
      .sdc-soc-label {
        position:absolute; right:7px; top:50%; transform: translateY(-50%);
        font-family: ui-monospace, monospace; font-size:0.66rem; font-weight:800;
        color:#fff; text-shadow:0 0 6px rgba(0,0,0,0.9);
      }

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
        .sdc-g-tiles { grid-template-columns: repeat(2, 1fr); }
        .sdc-g-bar { grid-template-columns: 90px 1fr 64px; }
        .sdc-g-bar-l { font-size:0.66rem; }
        .sdc-r-toolbar { grid-template-columns: 1fr auto; }
        .sdc-r-window { grid-column: 1 / -1; }
        .sdc-r-table > div { grid-template-columns: 1fr 1fr; }
        .sdc-r-table > div span:nth-child(3) { display:none; }
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
  {
    title: "Graphs — optional daily kWh sensors (override integrated values)",
    fields: [
      ["pv_energy_today_sensor", "Generated today (kWh)"],
      ["load_energy_today_sensor", "Used today (kWh)"],
      ["import_energy_today_sensor", "Imported today (kWh)"],
      ["export_energy_today_sensor", "Exported today (kWh)"],
      ["battery_charge_energy_today_sensor", "Charged today (kWh)"],
      ["battery_discharge_energy_today_sensor", "Discharged today (kWh)"],
    ],
  },
  {
    title: "Forecast — optional battery full estimate sensors",
    fields: [
      ["solar_forecast_remaining_sensor", "Solar forecast remaining (kWh)"],
      ["load_forecast_remaining_sensor", "Load forecast remaining (kWh)"],
    ],
  },
];

const NUMBER_FIELDS = [
  ["import_tariff", "Import tariff ($/kWh)", 0.01],
  ["export_tariff", "Export tariff ($/kWh)", 0.01],
  ["daily_connection_fee", "Daily connection fee ($/day)", 0.01],
  ["quarter_days", "Days in quarter", 1],
  ["poll_interval", "Poll interval (s)", 1],
  ["graph_poll_interval", "Graph refresh (s)", 10],
  ["battery_capacity_kwh", "Battery capacity (kWh)", 0.1],
  ["battery_reserve_soc", "Battery reserve SoC (%)", 1],
  ["battery_low_soc", "Battery low-warning SoC (%)", 1],
  ["battery_full_soc", "Battery full target SoC (%)", 1],
  ["battery_charge_efficiency", "Battery charge efficiency", 0.01],
  ["solar_inverter_ac_capacity_w", "Inverter AC capacity (W)", 100],
];

const IMAGE_KEYS = [
  "default",
  "sunny_day",
  "rainy_day",
  "lightning_rainy_day",
  "cloudy_day",
  "partly_cloudy_day",
  "fog_day",
  "clear_night",
  "cloudy_night",
  "partly_cloudy_night",
  "fog_night",
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

  _setFlowColor(key, value) {
    if (!this._config.flow_colors) this._config.flow_colors = {};
    this._config.flow_colors[key] = value;
    this._emit();
  }

  _setNodeColor(key, value) {
    if (!this._config.node_colors) this._config.node_colors = {};
    this._config.node_colors[key] = value;
    this._emit();
  }

  _setHomeGlow(axis, value) {
    if (!this._config.home_glow) this._config.home_glow = {};
    const n = parseFloat(value);
    if (Number.isFinite(n)) this._config.home_glow[axis] = n;
    this._emit();
  }

  _setTou(band, field, value) {
    if (!this._config.tou) this._config.tou = {};
    if (!this._config.tou[band]) this._config.tou[band] = {};
    if (value === "" || value === undefined || value === null)
      delete this._config.tou[band][field];
    else this._config.tou[band][field] = value;
    if (Object.keys(this._config.tou[band]).length === 0)
      delete this._config.tou[band];
    if (Object.keys(this._config.tou).length === 0) delete this._config.tou;
    this._emit();
  }

  _setExportTou(band, field, value) {
    if (!this._config.export_tou) this._config.export_tou = {};
    if (!this._config.export_tou[band]) this._config.export_tou[band] = {};
    if (value === "" || value === undefined || value === null)
      delete this._config.export_tou[band][field];
    else this._config.export_tou[band][field] = value;
    if (Object.keys(this._config.export_tou[band]).length === 0)
      delete this._config.export_tou[band];
    if (Object.keys(this._config.export_tou).length === 0)
      delete this._config.export_tou;
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
          <label class="sdc-f sdc-check">
            <input type="checkbox" data-boolexp="show_graphs" ${
              this._config.show_graphs === false ? "" : "checked"
            } />
            <span>Show statistics &amp; graphs</span>
          </label>
          <label class="sdc-f sdc-check">
            <input type="checkbox" data-bool="graphs_collapsed" ${
              this._config.graphs_collapsed ? "checked" : ""
            } />
            <span>Start graphs collapsed</span>
          </label>
          <label class="sdc-f sdc-check">
            <input type="checkbox" data-boolexp="report_show_previous" ${
              this._config.report_show_previous === false ? "" : "checked"
            } />
            <span>Compare against previous range</span>
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

    const reportOptions = `
      <div class="sdc-sec">
        <div class="sdc-sec-h">Reporting defaults</div>
        <div class="sdc-grid">
          ${selectInput(
            "report_default_range",
            "Default range",
            REPORT_RANGES.map((r) => r[0])
          )}
          ${selectInput(
            "report_default_tab",
            "Default tab",
            REPORT_TABS.map((t) => t[0])
          )}
        </div>
      </div>`;

    const costPeriod = `
      <div class="sdc-sec">
        <div class="sdc-sec-h">Cost period</div>
        <div class="sdc-grid">
          ${selectInput("tariff_mode", "Tariff mode", ["single", "tou"])}
          ${selectInput("cost_period", "Show", [
            "quarter",
            "month",
            "weeks",
            "both",
            "month+weeks",
            "quarter+weeks",
          ])}
          ${numberInput("month_start_day", "Month start day (1-31)", 1)}
          ${textInput(
            "quarter_start_date",
            "Quarter start (YYYY-MM-DD or MM-DD)",
            "01-01"
          )}
          ${numberInput("week_cycle_weeks", "Weeks per billing cycle", 1)}
          ${textInput(
            "week_cycle_start",
            "Cycle start (YYYY-MM-DD)",
            "2026-07-27"
          )}
        </div>
      </div>`;

    // Time-of-use tariff editor (only used when Tariff mode = tou).
    const tou = this._config.tou || {};
    const touBand = (band) => tou[band] || {};
    const touRate = (band, ph) => `
      <label class="sdc-f">
        <span>${band[0].toUpperCase() + band.slice(1)} rate ($/kWh)</span>
        <input type="number" step="0.001" data-tou="${band}" data-toufield="rate"
               value="${touBand(band).rate ?? ""}" placeholder="${ph}" />
      </label>`;
    const touWindows = (band, ph) => `
      <label class="sdc-f">
        <span>${band[0].toUpperCase() + band.slice(1)} times</span>
        <input type="text" data-tou="${band}" data-toufield="windows"
               value="${touBand(band).windows ?? ""}" placeholder="${ph}" />
      </label>`;
    const touSection = `
      <div class="sdc-sec">
        <div class="sdc-sec-h">Time-of-use import tariff (when Tariff mode = tou)</div>
        <div class="sdc-note" style="margin:0 0 8px;">Times are 24h ranges like <b>15:00-21:00</b>, comma-separated for multiple windows; a range may wrap past midnight (<b>22:00-06:00</b>). Off-peak is the catch-all for any time not matched. Free (if enabled) overrides everything at $0.</div>
        <div class="sdc-grid">
          ${touRate("peak", d.tou.peak.rate)}
          ${touWindows("peak", "e.g. 15:00-21:00")}
          ${touRate("shoulder", d.tou.shoulder.rate)}
          ${touWindows("shoulder", "e.g. 07:00-15:00,21:00-22:00")}
          ${touRate("offpeak", d.tou.offpeak.rate)}
          ${touWindows("offpeak", "(remaining time — catch-all)")}
          <label class="sdc-f sdc-check">
            <input type="checkbox" data-tou="free" data-toufield="enabled" ${
              touBand("free").enabled ? "checked" : ""
            } />
            <span>Enable free usage window ($0)</span>
          </label>
          ${touWindows("free", d.tou.free.windows)}
        </div>
      </div>`;

    // Time-of-use EXPORT (feed-in) tariff editor. Independent windows from the
    // import bands; active in TOU mode when any export window is set.
    const xtou = this._config.export_tou || {};
    const xtouBand = (band) => xtou[band] || {};
    const xtouRate = (band, ph) => `
      <label class="sdc-f">
        <span>${(band[0].toUpperCase() + band.slice(1)).replace("_", "-")} feed-in rate ($/kWh)</span>
        <input type="number" step="0.001" data-exporttou="${band}" data-toufield="rate"
               value="${xtouBand(band).rate ?? ""}" placeholder="${ph}" />
      </label>`;
    const xtouWindows = (band, ph) => `
      <label class="sdc-f">
        <span>${(band[0].toUpperCase() + band.slice(1)).replace("_", "-")} feed-in times</span>
        <input type="text" data-exporttou="${band}" data-toufield="windows"
               value="${xtouBand(band).windows ?? ""}" placeholder="${ph}" />
      </label>`;
    const exportTouSection = `
      <div class="sdc-sec">
        <div class="sdc-sec-h">Time-of-use feed-in tariff (when Tariff mode = tou)</div>
        <div class="sdc-note" style="margin:0 0 8px;">Feed-in (export) peak/mid-peak/shoulder/off-peak times are usually <b>different</b> from the import times above, so set them here independently. Same 24h format (e.g. <b>18:00-21:00</b>). Off-peak is the catch-all. Leave all times blank to use the flat Export tariff instead.</div>
        <div class="sdc-grid">
          ${xtouRate("peak", d.export_tou.peak.rate)}
          ${xtouWindows("peak", "e.g. 18:00-21:00")}
          ${xtouRate("mid_peak", d.export_tou.mid_peak.rate)}
          ${xtouWindows("mid_peak", "e.g. 16:00-18:00")}
          ${xtouRate("shoulder", d.export_tou.shoulder.rate)}
          ${xtouWindows("shoulder", "e.g. 21:00-23:00")}
          ${xtouRate("offpeak", d.export_tou.offpeak.rate)}
          ${xtouWindows("offpeak", "(remaining time — catch-all, e.g. 0)")}
        </div>
      </div>`;

    const bonusSection = `
      <div class="sdc-sec">
        <div class="sdc-sec-h">Zero-import bonus</div>
        <div class="sdc-note" style="margin:0 0 8px;">Some plans credit a fixed amount per day when grid import over a window stays near-zero (e.g. <b>$1/day</b> if import &lt; 0.03 kWh/h between 18:00-21:00). Toggle off if you change provider. The cost estimate credits it for each day in the billing period.</div>
        <div class="sdc-grid">
          <label class="sdc-f sdc-check">
            <input type="checkbox" data-bool="zero_import_bonus" ${
              this._config.zero_import_bonus ? "checked" : ""
            } />
            <span>Enable zero-import bonus</span>
          </label>
          ${numberInput("zero_import_bonus_amount", "Bonus amount ($/day)", 0.5)}
          ${textInput("zero_import_bonus_window", "Window (24h range)", "18:00-21:00")}
          ${numberInput("zero_import_bonus_threshold", "Import ceiling (kWh/hour)", 0.01)}
        </div>
      </div>`;

    const flowColorInput = (key, label) => `
      <label class="sdc-f sdc-color">
        <span>${label}</span>
        <input type="color" data-flowcolor="${key}" value="${
      (this._config.flow_colors && this._config.flow_colors[key]) ||
      FLOW_DEFAULTS[key]
    }" />
      </label>`;

    const flowColours = `
      <div class="sdc-sec">
        <div class="sdc-sec-h">Flow colours — per direction</div>
        <div class="sdc-grid">
          ${flowColorInput("solar_home", "Solar → Home")}
          ${flowColorInput("solar_battery", "Solar → Battery")}
          ${flowColorInput("solar_grid", "Solar → Grid")}
          ${flowColorInput("battery_home", "Battery → Home")}
          ${flowColorInput("grid_home", "Grid → Home")}
          ${flowColorInput("grid_battery", "Grid → Battery")}
          ${flowColorInput("battery_grid", "Battery → Grid")}
        </div>
      </div>`;

    const nodeColorInput = (key, label) => `
      <label class="sdc-f sdc-color">
        <span>${label}</span>
        <input type="color" data-nodecolor="${key}" value="${
      (this._config.node_colors && this._config.node_colors[key]) ||
      NODE_COLOR_DEFAULTS[key]
    }" />
      </label>`;

    const nodeColours = `
      <div class="sdc-sec">
        <div class="sdc-sec-h">Node colours</div>
        <div class="sdc-grid">
          ${nodeColorInput("solar", "Solar")}
          ${nodeColorInput("battery", "Battery")}
          ${nodeColorInput("grid", "Grid")}
        </div>
      </div>`;

    const hg = this._config.home_glow || {};
    const homeGlowSec = `
      <div class="sdc-sec">
        <div class="sdc-sec-h">Home glow (house)</div>
        <div class="sdc-grid">
          <label class="sdc-f sdc-check">
            <input type="checkbox" data-boolexp="home_glow_enabled" ${
              this._config.home_glow_enabled === false ? "" : "checked"
            } />
            <span>Enable home glow</span>
          </label>
          <label class="sdc-f sdc-color">
            <span>Glow colour</span>
            <input type="color" data-color="home_glow_color" value="${
              this._config.home_glow_color || d.home_glow_color
            }" />
          </label>
          <label class="sdc-f">
            <span>House overlay image (/local/…)</span>
            <input type="text" data-text="house_overlay_image" value="${
              this._config.house_overlay_image ?? ""
            }" placeholder="(optional alpha-masked PNG)" />
          </label>
          <label class="sdc-f">
            <span>Glow size / blur (px)</span>
            <input type="number" data-number="home_glow_blur" value="${
              this._config.home_glow_blur ?? ""
            }" placeholder="${d.home_glow_blur}" />
          </label>
        </div>
        <div class="sdc-grid">
          <div class="sdc-node-edit">
            <span class="sdc-node-name">centre x/y</span>
            <input type="number" min="0" max="100" data-glow="x" value="${
              hg.x ?? d.home_glow.x
            }" title="x %" />
            <input type="number" min="0" max="100" data-glow="y" value="${
              hg.y ?? d.home_glow.y
            }" title="y %" />
          </div>
          <div class="sdc-node-edit">
            <span class="sdc-node-name">size w/h</span>
            <input type="number" min="0" max="100" data-glow="w" value="${
              hg.w ?? d.home_glow.w
            }" title="w %" />
            <input type="number" min="0" max="100" data-glow="h" value="${
              hg.h ?? d.home_glow.h
            }" title="h %" />
          </div>
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
      ${reportOptions}
      ${costPeriod}
      ${touSection}
      ${exportTouSection}
      ${bonusSection}
      ${flowColours}
      ${nodeColours}
      ${homeGlowSec}
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
    root.querySelectorAll("input[data-boolexp]").forEach((el) =>
      el.addEventListener("change", (e) => {
        // explicit boolean — store true/false literally (no default fallback)
        this._config[e.target.dataset.boolexp] = e.target.checked;
        this._emit();
      })
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
    root.querySelectorAll("input[data-flowcolor]").forEach((el) =>
      el.addEventListener("change", (e) =>
        this._setFlowColor(e.target.dataset.flowcolor, e.target.value)
      )
    );
    root.querySelectorAll("input[data-nodecolor]").forEach((el) =>
      el.addEventListener("change", (e) =>
        this._setNodeColor(e.target.dataset.nodecolor, e.target.value)
      )
    );
    root.querySelectorAll("input[data-glow]").forEach((el) =>
      el.addEventListener("change", (e) =>
        this._setHomeGlow(e.target.dataset.glow, e.target.value)
      )
    );
    root.querySelectorAll("[data-tou]").forEach((el) =>
      el.addEventListener("change", (e) => {
        const t = e.target;
        let v;
        if (t.type === "checkbox") v = t.checked;
        else if (t.type === "number") v = t.value === "" ? "" : parseFloat(t.value);
        else v = t.value.trim();
        this._setTou(t.dataset.tou, t.dataset.toufield, v);
      })
    );
    root.querySelectorAll("[data-exporttou]").forEach((el) =>
      el.addEventListener("change", (e) => {
        const t = e.target;
        let v;
        if (t.type === "checkbox") v = t.checked;
        else if (t.type === "number") v = t.value === "" ? "" : parseFloat(t.value);
        else v = t.value.trim();
        this._setExportTou(t.dataset.exporttou, t.dataset.toufield, v);
      })
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
    "https://github.com/harrycrofti/solar-dashboard-card",
});
