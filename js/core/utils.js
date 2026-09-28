export const byId=id=>document.getElementById(id);
export const escapeHtml=value=>String(value??"").replace(/[&<>'"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
export const formatNumber=value=>value===null||value===undefined||value===""?"Not available":Number.isFinite(Number(value))?Number(value).toLocaleString():String(value);
export function downloadJson(data,fileName){const blob=new Blob([JSON.stringify(data,null,2)],{type:"application/json"});const link=document.createElement("a");link.href=URL.createObjectURL(blob);link.download=fileName;link.click();setTimeout(()=>URL.revokeObjectURL(link.href),1000)}
export function extendBounds(bounds,geometry){if(!geometry)return;const walk=coords=>typeof coords?.[0]==="number"?bounds.extend(coords):(coords||[]).forEach(walk);walk(geometry.coordinates)}
