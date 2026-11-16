import { getDatabase } from "@netlify/database";
import KEY from "./key.json" with {type:"json"};
const json = (v,status=200)=>Response.json(v,{status,headers:{'Cache-Control':'no-store'}});
async function ranking(){
 const db=getDatabase();
 const rows=await db.sql`SELECT alias,score FROM (
   SELECT DISTINCT ON (pupil) id,alias,score,created FROM quiz_results
   ORDER BY pupil,score DESC,created,id
 ) best ORDER BY score DESC,created,id LIMIT 10`;
 return json(rows);
}
function clean(v,max){
 return typeof v==='string'?v.normalize('NFKC').trim().replace(/\s+/g,' ').slice(0,max):'';
}
async function post(req){
 if(req.headers.get('origin') && req.headers.get('origin')!==new URL(req.url).origin)return json({},403);
 const body=await req.json().catch(()=>null);
 if(!body)return json({error:'Permintaan tidak sah.'},400);
 if(body.mode==='guru'||body.mode==='padam'){
   const secret=process.env.GURU_CODE;
   if(!secret || req.headers.get('authorization')!=='Bearer '+secret)return json({error:'Kod akses guru tidak tepat.'},403);
   if(body.mode==='padam'){
     if(typeof body.id!=='string'|| !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(body.id))return json({},400);
     await getDatabase().sql`DELETE FROM quiz_results WHERE id=${body.id}`;
     return json({ok:true});
   }
   const rows=await getDatabase().sql`SELECT id,name,classroom,alias,score,answers,created::double precision AS created FROM quiz_results ORDER BY created DESC,id`;
   return json(rows);
 }
 const {id,a}=body;
 const name=clean(body.name,80), classroom=clean(body.group,40).toUpperCase();
 if(!name||!classroom||typeof id!=='string'|| !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id)||
    !Array.isArray(a)||a.length!==25||!a.every(v=>Number.isInteger(v)&&v>=0&&v<=3))return json({error:'Lengkapkan semua 25 soalan sebelum menghantar.'},400);
 const score=a.reduce((v,n,i)=>v+(n===KEY[i]?1:0),0);
 const alias=['Pari','Penyu','Helang','Merak','Rusa','Kancil','Enggang','Dolphin'][parseInt(id[0],16)%8]+' '+id.slice(0,6).toUpperCase();
 const pupil=JSON.stringify([name.toLocaleLowerCase('ms'),classroom]);
 const db=getDatabase();
 await db.sql`INSERT INTO quiz_results(id,pupil,name,classroom,alias,score,answers,created)
 VALUES(${id},${pupil},${name},${classroom},${alias},${score},${JSON.stringify(a)},${Date.now()})
 ON CONFLICT(id) DO NOTHING`;
 const [saved]=await db.sql`SELECT score,alias FROM quiz_results WHERE id=${id}`;
 return json({...saved,status:'Lengkap'});
}
export const config={path:'/api/kuiz'};
export default async function handler(request){
 try {
   if(request.method==='GET')return await ranking();
   if(request.method==='POST')return await post(request);
   return json({},405);
 } catch {
   return json({error:'Rekod belum dapat dicapai. Semak sambungan pangkalan data.'},503);
 }
}
