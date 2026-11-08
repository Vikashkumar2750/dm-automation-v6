import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { expect, it } from 'vitest';

const source = readFileSync(new URL('./team-desk.functions.ts',import.meta.url),'utf8');
const section = source.slice(source.indexOf('export const getTeamDesk'),source.indexOf('export const assignConversation'));
const body = section.slice(section.indexOf('.handler(')+9).trim().replace(/\);$/, '')
  .replace('(await import("@/lib/contact-name")).fillSiblingNames', 'fillSiblingNames');
const js = ts.transpileModule(`return (${body});`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
const handler = new Function('myRole','fillSiblingNames',js)(async ()=>'manager',(rows: unknown)=>rows);
const tables = ['conversation_assignments','team_settings','reply_approvals'];
function client(failed?: string) {
  return {from(table:string) {
    const q = {select:()=>q,eq:()=>q,or:()=>q,order:()=>q,limit:()=>q,maybeSingle:()=>q,
      then:(resolve:(v:unknown)=>unknown)=>Promise.resolve(resolve({data:table==='team_settings'?null:[],error:table===failed?{code:'42P01'}:null}))};
    return q;
  }};
}
it.each(tables)('rejects missing %s instead of showing empty/off',async(table)=>{
  await expect(handler({data:{organizationId:'workspace'},context:{supabase:client(table),userId:'user'}})).rejects.toThrow('Team Desk data unavailable');
});
it('allows confirmed empty Team Desk tables',async()=>{
  await expect(handler({data:{organizationId:'workspace'},context:{supabase:client(),userId:'user'}})).resolves.toMatchObject({requireApproval:false,assignment:{},approvals:[],conversations:[]});
});