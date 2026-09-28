const CFG=window.TRANSIT_APP_CONFIG;
const BASE=CFG.repositoryRawBase.replace(/\/$/,"");
export const absoluteUrl=path=>/^https?:/.test(path)?path:`${BASE}/${String(path).replace(/^\.\//,"")}`;
export async function fetchJson(path,label=path){const response=await fetch(absoluteUrl(path),{cache:"no-store"});if(!response.ok)throw new Error(`${label} returned HTTP ${response.status}`);const text=await response.text();try{return JSON.parse(text)}catch{throw new Error(`${label} did not return valid JSON`)}}
export async function firstAvailable(paths,label){let last;for(const path of paths){try{return await fetchJson(path,label)}catch(error){last=error}}throw last}
export function shortId(properties){return properties.short_id||properties.source_id||String(properties.feed_id||"").match(/(?:mdb|ntd|tld)-[\w-]+/i)?.[0]||""}
export function agencyName(properties){return properties.agency_name||properties.agency||properties.metadata_agency_names||properties.name||shortId(properties)||"Transit agency"}
export function agencyPaths(properties){const id=shortId(properties);return{routes:properties.routes_path||`${CFG.routeFolder}/${properties.routes_file||`${id}_routes.geojson`}`,stops:properties.stops_path||`${CFG.stopFolder}/${properties.stops_file||`${id}_stops.geojson`}`}}
export function metadataFor(properties,metadata){for(const key of [properties.feed_id,shortId(properties),properties.metadata_feed_id,properties.ntd_id])if(key&&metadata[key])return metadata[key];return{}}
