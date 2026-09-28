window.TRANSIT_APP_CONFIG = {
  repositoryRawBase: "https://raw.githubusercontent.com/jwilsonschutter2/TransitAgencyWebmap/main/agency_geojson",
  fallbackCentroidPaths: [
    "metadata/agency_centroids.geojson",
    "agency_centroids.geojson",
    "../agency_centroids.geojson"
  ],
  metadataPaths: ["metadata/agency_metadata.json", "metadata/agency_lookup.json"],
  routeFolder: "routes_with_metadata",
  stopFolder: "stops_with_metadata",
  initialCenter: [-98.5, 39.5],
  initialZoom: 3
};
