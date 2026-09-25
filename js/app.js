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
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("json") && !contentType.includes("text/plain")) {
    throw new Error(`${label} returned ${contentType || "an unexpected content type"}`);
  }
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

async function loadAgency(feature) {
  const props = feature.properties || {};
  const agency = props.agency || "Unnamed agency";
  const filename = routeFilename(props);
  const url = encodedFileUrl(filename);
  setStatus(`Loading ${agency}...`);

  const routes = await fetchJson(url, filename);
  if (!routes.features || !Array.isArray(routes.features)) throw new Error(`${filename} is not a GeoJSON FeatureCollection.`);

  const existingSource = map.getSource("agency-routes");
  if (existingSource) existingSource.setData(routes);
  else {
    map.addSource("agency-routes", { type: "geojson", data: routes });
    map.addLayer({
      id: "agency-routes",
      type: "line",
      source: "agency-routes",
      paint: { "line-color": "#f97316", "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.5, 12, 4], "line-opacity": 0.9 }
    });
  }

  const bounds = new mapboxgl.LngLatBounds();
  routes.features.forEach(f => extendBounds(bounds, f.geometry));
  if (!bounds.isEmpty()) map.fitBounds(bounds, { padding: 60, maxZoom: 13, duration: 900 });

  document.getElementById("agencyInfo").hidden = false;
  document.getElementById("agencyName").textContent = agency;
  document.getElementById("routeCount").textContent = props.routes || routes.features.length;
  document.getElementById("vertexCount").textContent = props.vertex_count || "Not provided";
  document.getElementById("sourceFile").textContent = filename;
  setStatus(`Loaded ${agency}.`);
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

  map.on("error", event => {
    if (event.error) setStatus(`Map error: ${event.error.message}`, true);
  });

  map.on("load", async () => {
    try {
      const centroids = await fetchJson(CENTROIDS_URL, "agency_centroids.geojson");
      map.addSource("agency-centroids", { type: "geojson", data: centroids, cluster: true, clusterMaxZoom: 9, clusterRadius: 45 });
      map.addLayer({ id: "clusters", type: "circle", source: "agency-centroids", filter: ["has", "point_count"], paint: { "circle-color": "#2563eb", "circle-radius": ["step", ["get", "point_count"], 17, 25, 22, 100, 28], "circle-stroke-color": "#fff", "circle-stroke-width": 1 } });
      map.addLayer({ id: "cluster-count", type: "symbol", source: "agency-centroids", filter: ["has", "point_count"], layout: { "text-field": ["get", "point_count_abbreviated"], "text-size": 12 }, paint: { "text-color": "#fff" } });
      map.addLayer({ id: "agency-centroids", type: "circle", source: "agency-centroids", filter: ["!", ["has", "point_count"]], paint: { "circle-radius": 6, "circle-color": "#38bdf8", "circle-stroke-color": "#fff", "circle-stroke-width": 1.5 } });

      map.on("click", "clusters", e => {
        const feature = map.queryRenderedFeatures(e.point, { layers: ["clusters"] })[0];
        map.getSource("agency-centroids").getClusterExpansionZoom(feature.properties.cluster_id, (error, zoom) => {
          if (!error) map.easeTo({ center: feature.geometry.coordinates, zoom });
        });
      });
      map.on("click", "agency-centroids", async e => {
        try { await loadAgency(e.features[0]); }
        catch (error) { console.error(error); setStatus(error.message, true); }
      });
      ["clusters", "agency-centroids"].forEach(layer => {
        map.on("mouseenter", layer, () => map.getCanvas().style.cursor = "pointer");
        map.on("mouseleave", layer, () => map.getCanvas().style.cursor = "");
      });
      setStatus(`Loaded ${centroids.features?.length || 0} agency centroids. Click a point to view routes.`);
    } catch (error) {
      console.error(error);
      setStatus(error.message, true);
    }
  });
}

loadButton.addEventListener("click", initializeMap);
tokenInput.addEventListener("keydown", event => { if (event.key === "Enter") initializeMap(); });
