const CENTROIDS_URL = "https://raw.githubusercontent.com/jwilsonschutter2/Transit-Agency-GTFS/main/agency_geojson/agency_centroids.geojson";
const AGENCY_BASE_URL = "https://raw.githubusercontent.com/jwilsonschutter2/Transit-Agency-GTFS/main/agency_geojson/";

let map = null;
const tokenInput = document.getElementById("tokenInput");
const statusBox = document.getElementById("status");
const loadButton = document.getElementById("loadMapBtn");
const toggleButton = document.getElementById("toggleToken");
const savedToken = localStorage.getItem("transit_mapbox_token");
if (savedToken) tokenInput.value = savedToken;

toggleButton.addEventListener("click", () => {
  const showing = tokenInput.type === "text";
  tokenInput.type = showing ? "password" : "text";
  toggleButton.textContent = showing ? "Show" : "Hide";
});

function setStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.style.background = isError ? "#7f1d1d" : "#1e293b";
  statusBox.style.color = isError ? "#fee2e2" : "#cbd5e1";
}

async function fetchJson(url, label) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error(`${label} returned HTTP ${response.status}`);
  return response.json();
}

function routeFilename(properties) {
  const exactFile = properties.file || properties.filename || properties.source_file;
  if (exactFile) return exactFile;
  const agency = properties.agency;
  if (!agency) throw new Error("The selected centroid lacks both a file and agency property.");
  return agency.toString().endsWith(".geojson") ? agency.toString() : `${agency}.geojson`;
}

function encodedFileUrl(filename) {
  return AGENCY_BASE_URL + filename.split("/").map(encodeURIComponent).join("/");
}

function extendBounds(bounds, geometry) {
  if (!geometry) return;
  if (geometry.type === "LineString") geometry.coordinates.forEach(c => bounds.extend(c));
  if (geometry.type === "MultiLineString") geometry.coordinates.forEach(line => line.forEach(c => bounds.extend(c)));
}

function modeFromRouteType(value) {
  const n = Number(value);
  if ([0, 1, 2, 5, 6, 7, 11, 12].includes(n) || (n >= 100 && n < 200)) return "Rail";
  if ([3, 11].includes(n) || (n >= 700 && n < 800)) return "Bus";
  if (n === 4 || (n >= 1000 && n < 1100)) return "Ferry";
  return "Other";
}

function hashColor(text) {
  let hash = 0;
  for (let i = 0; i < text.length; i++) hash = text.charCodeAt(i) + ((hash << 5) - hash);
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue},72%,54%)`;
}

function normalizeHexColor(value) {
  if (!value) return null;
  const v = String(value).trim().replace(/^#/, "");
  return /^[0-9a-fA-F]{6}$/.test(v) ? `#${v}` : null;
}

function enrichRoutes(routes) {
  routes.features.forEach((feature, index) => {
    const p = feature.properties ||= {};
    const routeKey = String(p.route_id || p.route_short_name || p.route_long_name || p.shape_id || `Route ${index + 1}`);
    p._route_key = routeKey;
    p._route_label = String(p.route_short_name || p.route_long_name || p.route_id || p.shape_id || `Route ${index + 1}`);
    p._mode = modeFromRouteType(p.route_type);
    p._route_color = normalizeHexColor(p.route_color) || hashColor(routeKey);
  });
  return routes;
}

function renderLegend(routes) {
  const unique = new Map();
  routes.features.forEach(f => {
    const p = f.properties || {};
    if (!unique.has(p._route_key)) unique.set(p._route_key, p);
  });
  const items = [...unique.values()].slice(0, 40);
  document.getElementById("legend").hidden = items.length === 0;
  document.getElementById("legendItems").innerHTML = items.map(p =>
    `<div class="legend-row"><span class="legend-line" style="background:${p._route_color}"></span><span>${escapeHtml(p._route_label)}</span><span class="legend-mode">${escapeHtml(p._mode)}</span></div>`
  ).join("") + (unique.size > 40 ? `<div class="legend-mode">Showing 40 of ${unique.size} routes</div>` : "");
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
}

async function loadAgency(feature) {
  const props = feature.properties || {};
  const agency = props.agency || "Unnamed agency";
  const filename = routeFilename(props);
  setStatus(`Loading ${agency}...`);
  const routes = enrichRoutes(await fetchJson(encodedFileUrl(filename), filename));
  if (!Array.isArray(routes.features)) throw new Error(`${filename} is not a GeoJSON FeatureCollection.`);

  ["route-labels", "rail-routes", "bus-routes", "other-routes", "route-casing"].forEach(id => {
    if (map.getLayer(id)) map.removeLayer(id);
  });
  if (map.getSource("agency-routes")) map.removeSource("agency-routes");
  map.addSource("agency-routes", { type: "geojson", data: routes });

  map.addLayer({ id: "route-casing", type: "line", source: "agency-routes", paint: { "line-color": "#0f172a", "line-width": ["interpolate", ["linear"], ["zoom"], 4, 3.5, 12, 7], "line-opacity": 0.7 } });
  map.addLayer({ id: "bus-routes", type: "line", source: "agency-routes", filter: ["==", ["get", "_mode"], "Bus"], paint: { "line-color": ["get", "_route_color"], "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.5, 12, 4], "line-opacity": 0.9 } });
  map.addLayer({ id: "rail-routes", type: "line", source: "agency-routes", filter: ["==", ["get", "_mode"], "Rail"], paint: { "line-color": ["get", "_route_color"], "line-width": ["interpolate", ["linear"], ["zoom"], 4, 2.5, 12, 6], "line-opacity": 1 } });
  map.addLayer({ id: "other-routes", type: "line", source: "agency-routes", filter: ["!in", ["get", "_mode"], ["literal", ["Bus", "Rail"]]], paint: { "line-color": ["get", "_route_color"], "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.8, 12, 4.5], "line-dasharray": [2, 1], "line-opacity": 0.9 } });
  map.addLayer({ id: "route-labels", type: "symbol", source: "agency-routes", minzoom: 10, layout: { "symbol-placement": "line", "text-field": ["get", "_route_label"], "text-size": 11, "text-allow-overlap": false, "text-ignore-placement": false, "symbol-spacing": 450 }, paint: { "text-color": "#ffffff", "text-halo-color": "#0f172a", "text-halo-width": 1.5 } });

  const bounds = new mapboxgl.LngLatBounds();
  routes.features.forEach(f => extendBounds(bounds, f.geometry));
  if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 900 });
  renderLegend(routes);
  document.getElementById("agencyInfo").hidden = false;
  document.getElementById("agencyName").textContent = agency;
  document.getElementById("routeCount").textContent = new Set(routes.features.map(f => f.properties?._route_key)).size;
  document.getElementById("vertexCount").textContent = props.vertex_count || "Not provided";
  document.getElementById("sourceFile").textContent = filename;
  setStatus(`Loaded ${agency}. Rail, bus, and individual routes are styled separately where attributes are available.`);
}

async function initializeMap() {
  const token = tokenInput.value.trim();
  if (!token) return setStatus("Enter a Mapbox public token.", true);
  if (map) return setStatus("The map is already loaded.");
  localStorage.setItem("transit_mapbox_token", token);
  mapboxgl.accessToken = token;
  setStatus("Loading map and agency centroids...");
  map = new mapboxgl.Map({ container: "map", style: "mapbox://styles/mapbox/dark-v11", center: [-98.5, 39.5], zoom: 3 });
  map.addControl(new mapboxgl.NavigationControl(), "top-right");
  map.on("error", event => { if (event.error) setStatus(`Map error: ${event.error.message}`, true); });

  map.on("load", async () => {
    try {
      const centroids = await fetchJson(CENTROIDS_URL, "agency_centroids.geojson");
      map.addSource("agency-centroids", { type: "geojson", data: centroids, cluster: true, clusterMaxZoom: 9, clusterRadius: 45 });
      map.addLayer({ id: "clusters", type: "circle", source: "agency-centroids", filter: ["has", "point_count"], paint: { "circle-color": "#2563eb", "circle-radius": ["step", ["get", "point_count"], 17, 25, 22, 100, 28], "circle-stroke-color": "#fff", "circle-stroke-width": 1 } });
      map.addLayer({ id: "cluster-count", type: "symbol", source: "agency-centroids", filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 }, paint: { "text-color": "#fff" } });
      map.addLayer({ id: "agency-centroids", type: "circle", source: "agency-centroids", filter: ["!", ["has", "point_count"]], paint: { "circle-radius": 6, "circle-color": "#38bdf8", "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 } });
      map.addLayer({ id: "agency-labels", type: "symbol", source: "agency-centroids", filter: ["!", ["has", "point_count"]], layout: { "text-field": ["coalesce", ["get", "agency"], "Transit agency"], "text-size": 10, "text-offset": [0, 1.25], "text-anchor": "top", "text-max-width": 14, "text-allow-overlap": false, "text-optional": true }, paint: { "text-color": "#f8fafc", "text-halo-color": "#0f172a", "text-halo-width": 1.2 } });

      map.on("click", "clusters", e => {
        const feature = map.queryRenderedFeatures(e.point, { layers: ["clusters"] })[0];
        map.getSource("agency-centroids").getClusterExpansionZoom(feature.properties.cluster_id, (error, zoom) => { if (!error) map.easeTo({ center: feature.geometry.coordinates, zoom }); });
      });
      map.on("click", "agency-centroids", async e => { try { await loadAgency(e.features[0]); } catch (error) { console.error(error); setStatus(error.message, true); } });
      ["clusters", "agency-centroids", "agency-labels"].forEach(layer => {
        map.on("mouseenter", layer, () => map.getCanvas().style.cursor = "pointer");
        map.on("mouseleave", layer, () => map.getCanvas().style.cursor = "");
      });
      setStatus(`Loaded ${centroids.features?.length || 0} agency centroids. Click a point or label to view routes.`);
    } catch (error) { console.error(error); setStatus(error.message, true); }
  });
}

loadButton.addEventListener("click", initializeMap);
tokenInput.addEventListener("keydown", event => { if (event.key === "Enter") initializeMap(); });
