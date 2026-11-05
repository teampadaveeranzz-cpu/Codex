import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root=process.cwd();
const out=path.join(root,'dist');
const staticFiles=['index.html','styles.css','app.js','admin.html','admin.css','admin.js'];
const pages={
  '/':['ZEVON ENTERTAINMENT | Robotics for Better Experiences','Premium autonomous robots for advertising, hospitality and customer engagement. Explore ZEVON robots for events and business.'],
  '/about':['About ZEVON Entertainment | Thoughtful Robotics','Learn about ZEVON Entertainment and our approach to advertising, hospitality and customer engagement robots.'],
  '/robots':['Our Robots | ZEVON Entertainment','Meet the Z-01 advertising robot, Z-02 serving robot and Z-03 companion robot.'],
  '/robots/advertising':['Z-01 Advertising Robot | ZEVON','Discover the Z-01 advertising robot for events, exhibitions, malls and promotional campaigns.'],
  '/robots/serving':['Z-02 Serving Robot | ZEVON','Discover the Z-02 serving robot for weddings, restaurants, hotels and hospitality teams.'],
  '/robots/companion':['Z-03 Companion Robot | ZEVON','Discover the friendly Z-03 companion robot for family events and guest experiences.'],
  '/rental':['Robot Rental | ZEVON Entertainment','Enquire about renting ZEVON robots for weddings, corporate events, exhibitions and celebrations.'],
  '/purchase':['Purchase ZEVON Robots | Business Enquiries','Request purchase details and a demonstration for advertising, serving and companion robots.'],
  '/applications':['Robot Applications | ZEVON Entertainment','Explore robotic solutions for events, hotels, restaurants, malls, retail and family venues.'],
  '/contact':['Contact ZEVON Entertainment | Book a Demo','Contact ZEVON for robot rental, purchase, demonstrations and general enquiries.'],
  '/privacy':['Privacy Policy | ZEVON Entertainment','How ZEVON handles details submitted through website enquiries.'],
  '/terms':['Terms & Conditions | ZEVON Entertainment','Website terms and information about ZEVON rental and purchase enquiries.']
};
const escapeAttr=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
for(const file of staticFiles)await cp(path.join(root,file),path.join(out,file));
await cp(path.join(root,'assets'),path.join(out,'assets'),{recursive:true});
const base=(process.env.URL||'').replace(/\/$/,'');
for(const [route,[title,description]] of Object.entries(pages)){
  let html=await readFile(path.join(root,'index.html'),'utf8');
  const t=escapeAttr(title),d=escapeAttr(description),canonical=base?base+(route==='/'?'/':route):'';
  html=html.replace(/<title>.*?<\/title>/,`<title>${t}</title>`)
    .replace(/(<meta name="description" content=")[^"]*(">)/,`$1${d}$2`)
    .replace(/(<meta property="og:title" content=")[^"]*(">)/,`$1${t}$2`)
    .replace(/(<meta property="og:description" content=")[^"]*(">)/,`$1${d}$2`);
  if(canonical){html=html.replace(/(<meta property="og:url" content=")[^"]*(">)/,`$1${escapeAttr(canonical)}$2`).replace(/(<link rel="canonical" href=")[^"]*(">)/,`$1${escapeAttr(canonical)}$2`).replace(/(<meta property="og:image" content=")[^"]*(">)/,`$1${escapeAttr(base+'/assets/zevon-social.svg')}$2`)}else{html=html.replace(/\s*<meta property="og:url"[^>]*>/,'').replace(/\s*<link rel="canonical"[^>]*>/,'')}
  const dir=path.join(out,route.replace(/^\//,''));await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'index.html'),html);
}
console.log(`Prepared ${Object.keys(pages).length} SEO page routes in dist/`);
