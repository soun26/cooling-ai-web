import {allowedAPI,workerOrigin,jsonError,boundedBody,base64,unbase64,masterAuthorized,
  PUBLIC_HEADERS,REQUEST_HEADERS,MAX_RESPONSE} from './protocol.mjs';

const ASSETS=new Set(['chat-stream.js','home.html','home.js','home.css','index.html','app.css','app.js','garage.js','result-interaction.js','sw.js','manifest.webmanifest',
  'icon.svg','icon-192.png','icon-512.png','research/index.html','research/research.css','research/research.js','research/intro.js','research/intro-3d.js','research/intro-real.js','research/intro-data.json']);
const SECURITY={
  'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'",
  'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',
  'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
};
export default {
  async fetch(request,env) {
    const url=new URL(request.url),path=url.pathname;
    try {workerOrigin(url.origin);}catch{return jsonError('invalid_host',403);}
    if(request.method==='GET'&&path==='/user')return Response.redirect(url.origin+'/user/',302);
    if(path==='/connect') {
      if(request.method!=='GET'||request.headers.get('Upgrade')?.toLowerCase()!=='websocket'||
          !masterAuthorized(request,env.MASTER_TOKEN))return jsonError('unauthorized',403);
      return env.MASTER.get(env.MASTER.idFromName('master')).fetch(request);
    }
    if(path.startsWith('/api/')) {
      if(!allowedAPI(request.method,path)||url.search)return jsonError('unsupported_action',403);
      if(request.method==='POST'&&(request.headers.get('Origin')!==url.origin||
          !['same-origin','none'].includes(request.headers.get('Sec-Fetch-Site')||'same-origin')))return jsonError('invalid_origin',403);
      if(request.method==='POST'&&request.headers.get('Content-Type')?.split(';')[0]!=='application/json')return jsonError('json_required',415);
      return env.MASTER.get(env.MASTER.idFromName('master')).fetch(request);
    }
    if(request.method!=='GET')return jsonError('unsupported_action',405);
    const name=path==='/'?'home.html':['/user','/user/'].includes(path)?'index.html':['/research','/research/'].includes(path)?'research/index.html':path.startsWith('/research/')?path.slice(1):path.startsWith('/user/')?path.slice(6):'';
    if(!ASSETS.has(name))return jsonError('not_found',404);
    const assetURL=new URL('/'+name,url.origin),result=await env.ASSETS.fetch(new Request(assetURL,request));
    const headers=new Headers(result.headers);for(const [key,value]of Object.entries(SECURITY))headers.set(key,value);
    headers.set('Cache-Control','no-cache');if(name==='sw.js')headers.set('Service-Worker-Allowed','/user/');
    return new Response(result.body,{status:result.status,headers});
  }
};

// SQLite-backed namespace on the Free plan; no prompts, cases or predictions written to storage.
export class MasterLink {
  constructor(ctx,env) {this.ctx=ctx;this.env=env;this.pending=new Map();}
  async fetch(request) {
    const url=new URL(request.url);
    if(url.pathname==='/connect') {
      if(!masterAuthorized(request,this.env.MASTER_TOKEN))return jsonError('unauthorized',403);
      const existing=this.ctx.getWebSockets('master').filter(ws=>ws.readyState===1);
      if(existing.length)return jsonError('master_already_connected',409);
      const [client,server]=Object.values(new WebSocketPair());
      this.ctx.acceptWebSocket(server,['master']);
      return new Response(null,{status:101,webSocket:client,headers:{'Sec-WebSocket-Protocol':'cooling-master-v1'}});
    }
    if(!allowedAPI(request.method,url.pathname))return jsonError('unsupported_action',403);
    const socket=this.ctx.getWebSockets('master').find(ws=>ws.readyState===1);
    if(!socket)return jsonError('master_offline');
    if(this.pending.size>=12)return jsonError('server_busy');
    let body;try{body=await boundedBody(request);}catch{return jsonError('request_too_large',413);}
    const id=crypto.randomUUID(),headers={};for(const key of REQUEST_HEADERS){const v=request.headers.get(key);if(v)headers[key]=v;}
    return new Promise(resolve=>{
      const timer=setTimeout(()=>{this.pending.delete(id);resolve(jsonError('master_timeout',504));},12000);
      this.pending.set(id,{resolve,timer,socket});
      try{socket.send(JSON.stringify({id,method:request.method,path:url.pathname,headers,body:base64(body)}));}
      catch{clearTimeout(timer);this.pending.delete(id);resolve(jsonError('master_offline'));}
    });
  }
  webSocketMessage(ws,message) {
    if(typeof message!=='string'||message.length>Math.ceil(MAX_RESPONSE/3)*4+8192)return;
    let row;try{row=JSON.parse(message);}catch{return;}
    const entry=this.pending.get(row.id);if(!entry||entry.socket!==ws)return;
    clearTimeout(entry.timer);this.pending.delete(row.id);
    try {
      if(!Number.isInteger(row.status)||row.status<200||row.status>599||!row.headers||typeof row.headers!=='object')throw new Error('Invalid response');
      const headers=new Headers();for(const key of PUBLIC_HEADERS){const value=row.headers[key];if(typeof value==='string'&&value.length<=8192)headers.set(key,value);}
      headers.set('Cache-Control','no-store');entry.resolve(new Response(unbase64(row.body),{status:row.status,headers}));
    } catch {entry.resolve(jsonError('master_error',502));}
  }
  webSocketClose(ws,code) {this.disconnect(ws);try{ws.close(code===1000?1000:1011,'Master disconnected');}catch{}}
  webSocketError(ws) {this.disconnect(ws);try{ws.close(1011,'Master disconnected');}catch{}}
  disconnect(ws) {for(const [id,entry]of this.pending){if(entry.socket!==ws)continue;clearTimeout(entry.timer);entry.resolve(jsonError('master_offline'));this.pending.delete(id);}}
}
