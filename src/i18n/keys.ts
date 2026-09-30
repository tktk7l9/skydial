// English dictionary — the source of truth for message keys. `ja.ts` must
// provide every key (enforced by the Record<MsgKey, string> type).

export const en = {
  appName: "Skydial",
  tagline: "Sun & moon tracker",

  // Tabs
  tabDashboard: "Home",
  tabDome: "Dome",
  tabMap: "Map",
  tabAr: "AR",

  // Scrubber
  live: "Live",
  scrubHint: "Drag to change time",

  // Bodies
  sun: "Sun",
  moon: "Moon",
  azimuth: "Azimuth",
  altitude: "Altitude",
  distance: "Distance",

  // Sun events
  sunrise: "Sunrise",
  sunset: "Sunset",
  solarNoon: "Solar noon",
  civilDawn: "Civil dawn",
  civilDusk: "Civil dusk",
  nauticalDawn: "Nautical dawn",
  nauticalDusk: "Nautical dusk",
  astronomicalDawn: "Astronomical dawn",
  astronomicalDusk: "Astronomical dusk",
  goldenHour: "Golden hour",
  blueHour: "Blue hour",
  dayLength: "Day length",
  midnightSun: "Midnight sun — the sun never sets",
  polarNight: "Polar night — the sun never rises",

  // Moon events
  moonrise: "Moonrise",
  moonset: "Moonset",
  moonTransit: "Moon transit",
  moonAge: "Moon age",
  moonAgeDays: "{days} days",
  illumination: "Illumination",
  moonAlwaysUp: "The moon stays up all day",
  moonAlwaysDown: "The moon stays below the horizon",
  noEvent: "—",

  // Phase names
  phaseNew: "New moon",
  phaseWaxingCrescent: "Waxing crescent",
  phaseFirstQuarter: "First quarter",
  phaseWaxingGibbous: "Waxing gibbous",
  phaseFull: "Full moon",
  phaseWaningGibbous: "Waning gibbous",
  phaseLastQuarter: "Last quarter",
  phaseWaningCrescent: "Waning crescent",

  // Countdown banner
  sunriseIn: "Sunrise in {t}",
  sunsetIn: "Sunset in {t}",
  goldenEndsIn: "Golden hour ends in {t}",
  blueEndsIn: "Blue hour ends in {t}",

  // Sun extras
  shadowRatio: "Shadow length ×{r}",

  // Date quick jumps
  chipPrevDay: "Previous day",
  chipNextDay: "Next day",
  chipNextFull: "Next full moon",
  chipNextNew: "Next new moon",

  // Timeline bands
  night: "Night",
  twilight: "Twilight",
  daytime: "Day",

  // Location
  location: "Location",
  useGps: "Use my location",
  gpsDenied: "Location unavailable — set it on the map",
  manualLocation: "Manual",
  latitude: "Latitude",
  longitude: "Longitude",
  tapMapToSet: "Tap the map to set the location",
  changeLocationOnMap: "Change the location on the map",

  // Settings
  settings: "Settings",
  language: "Language",
  theme: "Theme",
  themeAuto: "Auto",
  themeLight: "Light",
  themeDark: "Dark",
  mapTiles: "Map tiles",
  tilesOsm: "OpenStreetMap",
  tilesGsi: "GSI (Japan)",
  utcOffset: "UTC offset",
  utcOffsetDevice: "Device",
  accuracyNote:
    "Positions are approximate (sun ~0.01°, moon ~0.3°) — for photography and daylight planning, not navigation.",

  // House / insolation study
  houseChip: "House",
  houseEdit: "Edit",
  houseResults: "Gain",
  houseEditTitle: "House settings",
  houseResultsTitle: "Solar gain (clear sky)",
  hWidth: "Frontage (m)",
  hDepth: "Depth (m)",
  hEaveH: "Eave height (m)",
  hRoof: "Roof",
  roofFlat: "Flat",
  roofGable: "Gable",
  roofShed: "Shed",
  hPitch: "Pitch (sun)",
  hRidgeAxis: "Ridge",
  ridgeW: "Along frontage",
  ridgeD: "Along depth",
  hLowSide: "Low side",
  hEaveOut: "Eave overhang (m)",
  hAzimuth: "Facing azimuth (°)",
  hAlbedo: "Ground albedo (0–1)",
  hTurbidity: "Haze (turbidity 2–5.5)",
  hWindows: "Windows",
  hAddWindow: "+ Window",
  hObstacles: "Neighbors / obstacles",
  hAddObstacle: "+ Obstacle",
  hRemove: "✕",
  hFace: "Face",
  hWinW: "W (m)",
  hWinH: "H (m)",
  hSill: "Sill (m)",
  hOff: "From left (m)",
  hShgc: "Solar gain (0–1)",
  hObsX: "E(+)/W(−) m",
  hObsY: "N(+)/S(−) m",
  hObsW: "W (m)",
  hObsD: "D (m)",
  hObsH: "H (m)",
  hRot: "Rotation (°)",
  resSunshine: "Sunshine",
  resNoSunshine: "no direct sun",
  windowLabel: "Window {n}",
  resTotal: "Total",
  resDirect: "Beam",
  resDiffuse: "Diffuse",
  resReflected: "Reflected",
  resComputing: "Computing…",
  resRoomDepth: "Reaches",
  resRoomArea: "Floor lit",
  resRoomHours: "Room sunshine",
  resNoFloorPatch: "No floor patch (blocked, or beam too low to reach the floor)",
  houseNote:
    "Clear-sky estimate (Ineichen–Perez model, adjustable haze). Constant solar gain, unshaded ground reflection — real weather yields less.",
  houseInteriorNote:
    "The floor patch is a simplification: the whole house is treated as one room, and a beam that would reach the far wall before the floor is shown as not reaching the floor at all.",

  // Dome
  domeToday: "Today",
  domeSummerSolstice: "Jun solstice",
  domeWinterSolstice: "Dec solstice",
  domeDragHint: "Drag to orbit · pinch to zoom",

  // Map
  mapOffline: "The map needs a network connection",
  sunDirection: "Sun direction",
  moonDirection: "Moon direction",
  sunriseDirection: "Sunrise",
  sunsetDirection: "Sunset",
  moonriseDirection: "Moonrise",
  moonsetDirection: "Moonset",

  // AR
  arIntroTitle: "AR compass",
  arIntroBody:
    "See the sun and moon paths over your camera view. Skydial asks for motion-sensor and camera access — both stay on this device.",
  arStart: "Start AR",
  arVirtualTitle: "Virtual view",
  arVirtualBody: "No compass here — drag to look around instead.",
  arSensorDenied: "Motion sensors unavailable — drag to look around",
  arCameraDenied: "Camera unavailable — showing sky gradient",
  arDragHint: "Drag to look around",

  // SHIG review (2026-09)
  undo: "Undo",
  windowRemoved: "Window removed",
  obstacleRemoved: "Obstacle removed",
  hRemoveWindow: "Remove window {n}",
  hRemoveObstacle: "Remove obstacle {n}",
  hClamped: "Enter {lo}–{hi} (adjusted to {v})",
  hRounded: "Rounded to {v}",
  hReset: "Reset to defaults",
  houseResetDone: "House reset to defaults",
  defaultLocationBanner: "Showing times for Tokyo — no location set yet",
  pickOnMap: "Pick on the map",
  gpsLocating: "Locating…",
  openMap: "Open the map",
  locationChanged: "Location changed",
  coordInputLabel: "Latitude, longitude",
  coordInputPlaceholder: "e.g. 35.4876, 139.4061",
  coordGo: "Go",
  coordInvalid: "Enter “latitude, longitude” (e.g. 35.48, 139.40)",
  locationName: "Location name",
  locationNamePlaceholder: "e.g. Home",
  backToNow: "Back to now",
  scrubTickBefore: "{h}h ago",
  scrubTickAfter: "in {h}h",
  scrubFirstHint: "Drag left or right to change the time",

  // Accessible names (landmarks, dialogs, canvases)
  tabsNav: "Views",
  timeControls: "Time",
  pickDateTime: "Pick a date and time",
  close: "Close",
  domeCanvasLabel: "3D dome of the sun and moon paths",

  // Lazy views
  loadingView: "Loading…",
  loadFailed: "Could not load this view",
  retry: "Retry",

  // PWA
  updateReady: "New version ready — tap to update",

  // Compass points (16-wind)
  dirN: "N",
  dirNNE: "NNE",
  dirNE: "NE",
  dirENE: "ENE",
  dirE: "E",
  dirESE: "ESE",
  dirSE: "SE",
  dirSSE: "SSE",
  dirS: "S",
  dirSSW: "SSW",
  dirSW: "SW",
  dirWSW: "WSW",
  dirW: "W",
  dirWNW: "WNW",
  dirNW: "NW",
  dirNNW: "NNW",
} as const;

export type MsgKey = keyof typeof en;
