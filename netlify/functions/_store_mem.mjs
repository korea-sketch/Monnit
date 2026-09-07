
export async function get(s,k){return (globalThis.__MEM[s]||{})[k]||null;}
export async function set(s,k,t){(globalThis.__MEM[s]=globalThis.__MEM[s]||{})[k]=t;return true;}
export async function append(s,k,o){const c=await get(s,k)||'';return set(s,k,c?c+'\n'+JSON.stringify(o):JSON.stringify(o));}
export async function readLines(s,k){const t=await get(s,k);if(!t)return [];
  return t.split('\n').filter(Boolean).map(l=>{try{return JSON.parse(l);}catch{return null;}}).filter(Boolean);}
export async function available(){return true;}
export async function diag(){return {sdk:true};}
