import { getStore } from '@netlify/blobs';
import nodemailer from 'nodemailer';
import crypto from 'node:crypto';

const TTL = 8 * 60 * 60 * 1000;
const MAX_JSON = 7_100_000;
const PHONE_DEFAULT = '+91 90876 9065';
const EMAIL_DEFAULT = 'zevonentertainment@gmail.com';
const DEFAULT_CONTENT = {
  hero_title: 'Robotics That Transform Every Experience.',
  hero_subtitle: 'Discover intelligent robotic solutions for advertising, hospitality and customer engagement. From unforgettable event experiences to practical business applications, ZEVON brings innovation closer to you.',
  phone: PHONE_DEFAULT,
  email: EMAIL_DEFAULT,
  hero_robot: 'advertising',
  images: {}
};
const IMAGE_TYPES = {
  'image/jpeg': { ext: 'jpg', valid: b => b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  'image/png': { ext: 'png', valid: b => b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) },
  'image/webp': { ext: 'webp', valid: b => b.length > 12 && b.toString('ascii',0,4) === 'RIFF' && b.toString('ascii',8,12) === 'WEBP' },
  'image/avif': { ext: 'avif', valid: b => b.length > 12 && ['ftypavif','ftypavis'].includes(b.toString('ascii',4,12)) }
};
const CONTENT_LIMITS = { hero_title: 140, hero_subtitle: 500, phone: 40, email: 180 };
const memoryRates = new Map();
const privateStore = () => getStore({ name: 'zevon-private', consistency: 'strong' });
const imageStore = () => getStore({ name: 'zevon-public-images', consistency: 'strong' });

function response(body, status=200, headers={}) {
  return new Response(body, {status, headers:{
    'Content-Type':'application/json; charset=utf-8',
    'Cache-Control':'no-store',
    'X-Content-Type-Options':'nosniff',
    'X-Frame-Options':'DENY',
    'Referrer-Policy':'strict-origin-when-cross-origin',
    'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    ...headers
  }});
}
const json = (body,status=200,headers={}) => response(JSON.stringify(body),status,headers);
const error = (message,status=400) => json({error:message},status);
async function bodyJSON(req){const n=Number(req.headers.get('content-length')||0);if(Number.isFinite(n)&&n>MAX_JSON)throw new Error('Invalid request size.');const raw=await req.text();if(Buffer.byteLength(raw,'utf8')>MAX_JSON)throw new Error('Invalid request size.');const body=JSON.parse(raw);if(!body||typeof body!=='object'||Array.isArray(body))throw new Error('Invalid request data.');return body;}
function clean(value,max=1000){return (typeof value==='string'||typeof value==='number')?String(value).replaceAll('\0','').trim().slice(0,max):'';}
function validEmail(value){return /^[^\s@<>]{1,100}@[^\s@<>]{1,100}\.[A-Za-z]{2,24}$/.test(value||'');}
function constantEqual(a,b){const left=Buffer.from(String(a||'')),right=Buffer.from(String(b||''));return left.length===right.length&&crypto.timingSafeEqual(left,right)}
function signedCookie(token){return `${token}.${crypto.createHmac('sha256',process.env.SESSION_SECRET||'').update(token).digest('hex')}`;}
function cookieOptions(value,maxAge){return `zevon_session=${value}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;}
function hostMatches(req){const origin=req.headers.get('origin');if(!origin)return true;try{return new URL(origin).host.toLowerCase()===new URL(req.url).host.toLowerCase()}catch{return false}}
async function getContent(){const store=privateStore();const existing=await store.get('site-content',{type:'json'});const value=existing&&typeof existing==='object'?existing:{};const data={...DEFAULT_CONTENT,...value};data.images={};for(const [slot,url] of Object.entries(value.images||{})){if(['hero','advertising','serving','companion'].includes(slot)&&typeof url==='string'&&/^\/api\/image\/[a-f0-9]{32}\.(jpg|png|webp|avif)$/.test(url))data.images[slot]=url}if(!['advertising','serving','companion'].includes(data.hero_robot))data.hero_robot='advertising';return data;}
async function session(req){const raw=req.headers.get('cookie')||'';const value=raw.split(';').map(s=>s.trim()).find(s=>s.startsWith('zevon_session='))?.slice('zevon_session='.length)||'';const dot=value.lastIndexOf('.');if(dot<1)return null;const token=value.slice(0,dot),sig=value.slice(dot+1);const expected=crypto.createHmac('sha256',process.env.SESSION_SECRET||'').update(token).digest('hex');if(!constantEqual(sig,expected))return null;const key=crypto.createHash('sha256').update(token).digest('hex');const store=privateStore();const record=await store.get(`session/${key}`,{type:'json'});if(!record||record.expires<Date.now()){if(record)await store.delete(`session/${key}`);return null}return {key,csrf:record.csrf,email:record.email};}
async function requireAdmin(req,csrf=false){const s=await session(req);if(!s)return {error:error('Please sign in again.',401)};if(csrf&&(!hostMatches(req)||!constantEqual(req.headers.get('x-csrf-token'),s.csrf)))return {error:error('Request could not be verified.',403)};return {session:s};}
async function rateAllowed(kind,ip,max,windowMs){const now=Date.now(),windowStart=now-windowMs;const key=`ratelimit/${kind}/${crypto.createHmac('sha256',process.env.SESSION_SECRET||'').update(ip||'unknown').digest('hex')}`;const store=privateStore();for(let attempt=0;attempt<4;attempt++){const prior=await store.getWithMetadata(key,{type:'json'});const times=(prior?.data?.times||[]).filter(t=>Number.isFinite(t)&&t>windowStart);if(times.length>=max)return false;times.push(now);const opts=prior?{onlyIfMatch:prior.etag,metadata:{updatedAt:now}}:{onlyIfNew:true,metadata:{updatedAt:now}};const result=await store.setJSON(key,{times},opts);if(result.modified)return true;}return false;}
async function sendMail(enquiry){if(!process.env.SMTP_HOST)return;try{const port=Number(process.env.SMTP_PORT||587);const transporter=nodemailer.createTransport({host:process.env.SMTP_HOST,port,secure:(process.env.SMTP_SSL||'').toLowerCase()==='true'||port===465,auth:process.env.SMTP_USER?{user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD||''}:undefined});const detail=Object.entries(enquiry.details).map(([k,v])=>`${k.replaceAll('_',' ')}: ${v}`).join('\n');await transporter.sendMail({from:process.env.SMTP_FROM||process.env.SMTP_USER,to:process.env.OWNER_EMAIL||EMAIL_DEFAULT,replyTo:enquiry.email,subject:`ZEVON website enquiry · ${enquiry.kind}`,text:`New ${enquiry.kind} enquiry\n\nName: ${enquiry.name}\nEmail: ${enquiry.email}\nPhone: ${enquiry.phone}\n\n${detail}`});}catch(e){console.error('Email delivery failed:',e?.name||'Error')}}
function csvCell(value){let text=String(value??'');if(/^[=+\-@\t\r]/.test(text))text="'"+text;return `"${text.replaceAll('"','""')}"`;}

export default async function handler(req, context) {
  const url=new URL(req.url);
  const path=url.pathname;
  const store=privateStore();
  try {
    if(path==='/robots.txt'&&req.method==='GET')return new Response('User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /api/\nSitemap: /sitemap.xml\n',{headers:{'Content-Type':'text/plain; charset=utf-8','X-Content-Type-Options':'nosniff'}});
    if(path==='/sitemap.xml'&&req.method==='GET'){const base=(process.env.URL||new URL(req.url).origin).replace(/\/$/,'');const pages=['/','/about','/robots','/robots/advertising','/robots/serving','/robots/companion','/rental','/purchase','/applications','/contact','/privacy','/terms'];const locs=pages.map(p=>`<url><loc>${base}${p}</loc></url>`).join('');return new Response(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locs}</urlset>`,{headers:{'Content-Type':'application/xml; charset=utf-8','X-Content-Type-Options':'nosniff'}})}
    if(path==='/api/site-content'&&req.method==='GET')return json(await getContent(),200,{'Cache-Control':'public, max-age=60'});
    const imageMatch=path.match(/^\/api\/image\/([a-f0-9]{32}\.(?:jpg|png|webp|avif))$/);
    if(imageMatch&&req.method==='GET'){const item=await imageStore().getWithMetadata(imageMatch[1]);if(!item)return new Response('Not found',{status:404});return new Response(item.data,{headers:{'Content-Type':item.metadata?.contentType||'application/octet-stream','Cache-Control':'public, max-age=31536000, immutable','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox"}})}
    if(path==='/api/enquiries'&&req.method==='POST'){
      if((process.env.SESSION_SECRET||'').length<32)return error('Site security is not configured yet.',503);
      if(!hostMatches(req))return error('Request could not be verified.',403);
      if(!(await rateAllowed('enquiry',context.ip,6,3600000)))return error('Too many enquiries from this connection. Please try again later.',429);
      let data;try{data=await bodyJSON(req)}catch{return error('Please check the form and try again.')}
      if(clean(data.website,200))return json({ok:true});
      const kind=clean(data.kind,20),name=clean(data.name,120),email=clean(data.email,180).toLowerCase(),phone=clean(data.phone,40);
      if(!['rental','purchase','contact'].includes(kind)||!name||!phone||!validEmail(email))return error('Please enter your name, a valid email address and phone number.');
      const details={};for(const key of ['company','event_type','event_date','location','robot','duration','business_type','subject','message','call_time'])if(key in data)details[key]=clean(data[key],key==='message'?3000:250);
      if(kind==='rental'&&!['event_type','event_date','location','robot','duration'].every(k=>details[k]))return error('Please complete the required event details.');
      if(kind==='purchase'&&!['robot','business_type','location'].every(k=>details[k]))return error('Please complete the required purchase details.');
      const id=crypto.randomBytes(16).toString('hex');const enquiry={id,kind,name,email,phone,details,status:'new',created_at:new Date().toISOString()};
      await store.setJSON(`enquiries/${id}`,enquiry);await sendMail(enquiry);return json({ok:true,id},201);
    }
    if(path==='/api/admin/login'&&req.method==='POST'){
      if((process.env.SESSION_SECRET||'').length<32)return error('Admin access is not configured yet.',503);
      if(!hostMatches(req))return error('Request could not be verified.',403);
      if(!(await rateAllowed('login',context.ip,5,900000)))return error('Too many sign-in attempts. Wait 15 minutes before trying again.',429);
      let data;try{data=await bodyJSON(req)}catch{return error('Please check your sign-in details.')}
      const email=clean(data.email,180).toLowerCase(),password=data.password;
      const envEmail=(process.env.ADMIN_EMAIL||'').trim().toLowerCase(),saltHex=process.env.ADMIN_PASSWORD_SALT||'',hashHex=process.env.ADMIN_PASSWORD_HASH||'';
      if(!envEmail||!saltHex||!hashHex)return error('Admin access is not configured yet.',503);
      if(typeof password!=='string'||password.length>1024||email!==envEmail)return error('Email or password is incorrect.',401);
      let salt,expected;try{salt=Buffer.from(saltHex,'hex');expected=Buffer.from(hashHex,'hex')}catch{return error('Admin credentials are not configured correctly.',503)}
      if(salt.length<16||expected.length!==32)return error('Admin credentials are not configured correctly.',503);
      const actual=await new Promise((resolve,reject)=>crypto.pbkdf2(password,salt,310000,32,'sha256',(e,b)=>e?reject(e):resolve(b)));
      if(!crypto.timingSafeEqual(actual,expected))return error('Email or password is incorrect.',401);
      const token=crypto.randomBytes(32).toString('base64url'),csrf=crypto.randomBytes(32).toString('base64url'),key=crypto.createHash('sha256').update(token).digest('hex');
      await store.setJSON(`session/${key}`,{email,csrf,expires:Date.now()+TTL});
      return json({ok:true,csrf},200,{'Set-Cookie':cookieOptions(signedCookie(token),Math.floor(TTL/1000))});
    }
    if(path==='/api/admin/session'&&req.method==='GET'){const s=await session(req);return json({authenticated:!!s,csrf:s?.csrf||''})}
    if(path==='/api/admin/logout'&&req.method==='POST'){
      const auth=await requireAdmin(req,true);if(auth.error)return auth.error;
      await store.delete(`session/${auth.session.key}`);return json({ok:true},200,{'Set-Cookie':cookieOptions('',0)});
    }
    if(path==='/api/admin/enquiries'&&req.method==='GET'){
      const auth=await requireAdmin(req);if(auth.error)return auth.error;
      const {blobs}=await store.list({prefix:'enquiries/'});const rows=await Promise.all(blobs.map(b=>store.get(b.key,{type:'json'})));
      const enquiries=rows.filter(Boolean).sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,500);return json({enquiries});
    }
    if(path==='/api/admin/export.csv'&&req.method==='GET'){
      const auth=await requireAdmin(req);if(auth.error)return auth.error;
      const {blobs}=await store.list({prefix:'enquiries/'});const rows=await Promise.all(blobs.map(b=>store.get(b.key,{type:'json'})));
      const ordered=rows.filter(Boolean).sort((a,b)=>b.created_at.localeCompare(a.created_at));const output=[['id','type','name','email','phone','status','created_at','details'],...ordered.map(x=>[x.id,x.kind,x.name,x.email,x.phone,x.status,x.created_at,JSON.stringify(x.details)])].map(row=>row.map(csvCell).join(',')).join('\r\n');return new Response(output,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="zevon-enquiries.csv"','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
    }
    if(path==='/api/admin/content'&&req.method==='GET'){
      const auth=await requireAdmin(req);if(auth.error)return auth.error;return json(await getContent());
    }
    if(path==='/api/admin/enquiries/status'&&req.method==='POST'){
      const auth=await requireAdmin(req,true);if(auth.error)return auth.error;let data;try{data=await bodyJSON(req)}catch{return error('Invalid enquiry update.')}
      const id=clean(data.id,32),status=clean(data.status,20);if(!/^[a-f0-9]{32}$/.test(id)||!['new','contacted','closed'].includes(status))return error('Invalid status.');
      const key=`enquiries/${id}`,record=await store.get(key,{type:'json'});if(!record)return error('Enquiry not found.',404);record.status=status;await store.setJSON(key,record);return json({ok:true,updated:1});
    }
    if(path==='/api/admin/content'&&req.method==='POST'){
      const auth=await requireAdmin(req,true);if(auth.error)return auth.error;let data;try{data=await bodyJSON(req)}catch{return error('Invalid content update.')}
      const config=await getContent();for(const [key,max] of Object.entries(CONTENT_LIMITS))if(key in data){const value=clean(data[key],max);if(key==='email'&&!validEmail(value))return error('Enter a valid contact email.');if(key==='phone'&&!/^[+0-9 ()-]{7,40}$/.test(value))return error('Enter a valid phone number.');config[key]=value}
      if(['advertising','serving','companion'].includes(data.hero_robot))config.hero_robot=data.hero_robot;
      await store.setJSON('site-content',config);return json({ok:true});
    }
    if(path==='/api/admin/image'&&req.method==='POST'){
      const auth=await requireAdmin(req,true);if(auth.error)return auth.error;let data;try{data=await bodyJSON(req)}catch{return error('Invalid image upload.')}
      const slot=clean(data.slot,30),mime=clean(data.mime,40),spec=IMAGE_TYPES[mime];if(!['hero','advertising','serving','companion'].includes(slot)||!spec||typeof data.data!=='string'||data.data.length>5_700_000)return error('Use a JPG, PNG, WebP or AVIF image up to 4 MB.');
      let image;try{image=Buffer.from(data.data,'base64')}catch{return error('The image could not be read.')};if(image.length>4*1024*1024||!spec.valid(image))return error('The file does not match a supported image format or is over 4 MB.');
      const key=`${crypto.randomBytes(16).toString('hex')}.${spec.ext}`;await imageStore().set(key,image,{metadata:{contentType:mime}});const config=await getContent();config.images[slot]=`/api/image/${key}`;await store.setJSON('site-content',config);return json({ok:true,url:config.images[slot]},201);
    }
    if(path.startsWith('/api/'))return error('Not found.',404);
    return error('Not found.',404);
  } catch (e) {
    console.error('ZEVON API request failed:',e?.name||'Error');
    return error('The request could not be completed. Please try again.',500);
  }
}

export const config = { path: ['/api/*','/robots.txt','/sitemap.xml'] };
