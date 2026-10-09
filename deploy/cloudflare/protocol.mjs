// An allowlist, not a general-purpose reverse proxy or remote terminal.
export const MAX_BODY = 400000; // Bounded resumable research upload chunks.
export const MAX_RESPONSE = 2200000;
export const PUBLIC_HEADERS = ['content-type','content-disposition','cache-control','set-cookie','content-security-policy',
  'x-content-type-options','referrer-policy','permissions-policy'];
export const REQUEST_HEADERS = ['cookie','content-type','origin','sec-fetch-site','x-csrf-token'];
export function allowedAPI(method, path) {
  if (typeof path !== 'string' || path.length > 200 || path.includes('?') || path.includes('%')) return false;
  if(method==='GET' && /^\/api\/research\/(catalog|projects|projects\/[a-f0-9]{24}|jobs\/[a-f0-9]{24}|uploads\/[a-f0-9]{32}\/(manifest|graph|source|step)|exports\/[a-f0-9]{24}\/(report.json|nodes.csv|comparison.log|training.log|history.jsonl|result.json)(?:\/[0-9]{1,12})?|files\/[a-f0-9]{24}\/[a-zA-Z0-9_.-]{1,80}(?:\/[0-9]{1,12})?)$/.test(path))return true;
  if(method==='POST' && /^\/api\/research\/(login|jobs|projects|projects\/[a-f0-9]{24}\/action|jobs\/[a-f0-9]{24}\/(stop|resume)|chunks\/[a-f0-9]{32}\/(manifest|graph|source|step))$/.test(path))return true;
  if (method === 'GET') return /^\/api\/(health|session|catalog|geometry\/[a-zA-Z0-9_-]{1,80}|jobs\/[a-zA-Z0-9_-]{1,80}(?:\/export)?)$/.test(path);
  if (method === 'POST') return /^\/api\/(chat|predict|design|jobs\/[a-zA-Z0-9_-]{1,80}\/cancel)$/.test(path);
  return false;
}
export function workerOrigin(value) {
  if (typeof value !== 'string' || !/^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev$/.test(value)) throw new Error('Exact workers.dev origin required');
  return value;
}
export function jsonError(error, status=503) {
  return new Response(JSON.stringify({error}), {status,headers:{'Content-Type':'application/json',
    'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
}
export async function boundedBody(request, maximum=MAX_BODY) {
  const length=request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length)>maximum)) throw new Error('request_too_large');
  if (!request.body) return new Uint8Array();
  const reader=request.body.getReader(), chunks=[];let total=0;
  try {for (;;) {const {done,value}=await reader.read();if(done)break;total+=value.length;
    if(total>maximum){await reader.cancel();throw new Error('request_too_large');}chunks.push(value);}}
  finally {reader.releaseLock();}
  const data=new Uint8Array(total);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}return data;
}
export function base64(bytes) {
  let result='';for(let i=0;i<bytes.length;i+=16384)result+=String.fromCharCode(...bytes.subarray(i,i+16384));
  return btoa(result);
}
export function unbase64(text, maximum=MAX_RESPONSE) {
  if(typeof text!=='string'||text.length>Math.ceil(maximum/3)*4+4||!/^[A-Za-z0-9+/]*={0,2}$/.test(text))throw new Error('Invalid bridge body');
  const raw=atob(text);if(raw.length>maximum)throw new Error('Invalid bridge body');
  return Uint8Array.from(raw,c=>c.charCodeAt(0));
}
export function masterAuthorized(request, token) {
  if (typeof token!=='string'||!/^[A-Za-z0-9_-]{43}$/.test(token))return false;
  const values=(request.headers.get('Sec-WebSocket-Protocol')||'').split(',').map(x=>x.trim());
  const expected='key.'+token;
  // No secret in URLs or application logs. Equal-length comparison visits every character.
  const key=values.find(x=>x.startsWith('key.'))||'';let diff=key.length^expected.length;
  for(let i=0;i<expected.length;i++)diff|=expected.charCodeAt(i)^(key.charCodeAt(i)||0);
  return values.includes('cooling-master-v1')&&diff===0;
}
