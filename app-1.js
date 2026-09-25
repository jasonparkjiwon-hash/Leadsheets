'use strict';
const TPB=12;
const STORE_KEY='leadsheets:v4', DRAFT_KEY='leadsheets:draft', PREF_KEY='leadsheets:v5:prefs', CMAJOR_KEY='leadsheets:cmajor';
const KEY_NAMES_SHARP=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
const KEY_NAMES_FLAT=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'];
const MAJOR=[0,2,4,5,7,9,11], MINOR=[0,2,3,5,7,8,10];
const LETTERS=['C','D','E','F','G','A','B'], LETTER_PC=[0,2,4,5,7,9,11];
const TONIC_MAJOR=['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B'], TONIC_MINOR=['C','C#','D','Eb','E','F','F#','G','G#','A','Bb','B'];
const FLAT_KEYS_MAJOR=[1,3,5,6,8,10], FLAT_KEYS_MINOR=[0,2,3,5,7,10];
// How a pitch relative to the tonic is written as a degree: bII bIII #IV bVI bVII in major; minor raises 6 and 7.
const CHROMATIC_MAJOR=[[1,''],[2,'b'],[2,''],[3,'b'],[3,''],[4,''],[4,'#'],[5,''],[6,'b'],[6,''],[7,'b'],[7,'']];
const CHROMATIC_MINOR=[[1,''],[2,'b'],[2,''],[3,''],[3,'#'],[4,''],[4,'#'],[5,''],[6,''],[6,'#'],[7,''],[7,'#']];
const DIATONIC_MAJOR=['','m','m','','','m','dim'];
const DIATONIC_MINOR=['m','dim','','m','m','',''];
const QUALITY_IVS={'':[0,4,7],m:[0,3,7],7:[0,4,7,10],maj7:[0,4,7,11],m7:[0,3,7,10],m9:[0,3,7,10,14],add9:[0,4,7,14],sus2:[0,2,7],sus4:[0,5,7],6:[0,4,7,9],m6:[0,3,7,9],dim:[0,3,6],m7b5:[0,3,6,10],dim7:[0,3,6,9],'7sus4':[0,5,7,10],9:[0,4,7,10,14],maj9:[0,4,7,11,14],11:[0,5,7,10,14],13:[0,4,7,10,21],'7b9':[0,4,7,10,13],'7#9':[0,4,7,10,15],5:[0,7],aug:[0,4,8]};
const PIANO_KEYS=['a','w','s','e','d','f','t','g','y','h','u','j','k','o','l','p',';','\''];
const CHORD_TEMPLATES=[
  [[0,7],'5'],[[0,4,7],''],[[0,3,7],'m'],[[0,3,6],'dim'],[[0,4,8],'aug'],[[0,5,7],'sus4'],[[0,2,7],'sus2'],
  [[0,4,7,9],'6'],[[0,3,7,9],'m6'],[[0,4,7,10],'7'],[[0,4,7,11],'maj7'],[[0,3,7,10],'m7'],[[0,3,6,10],'m7b5'],
  [[0,2,4,7],'add9'],[[0,2,4,7,10],'9'],[[0,2,4,7,11],'maj9'],[[0,2,3,7,10],'m9']
];

const $=s=>document.querySelector(s), app=$('#app');
const clone=o=>JSON.parse(JSON.stringify(o));
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const uid=p=>p+Date.now()+Math.random().toString(36).slice(2,6);
let state={view:'library',sheets:[],cMajor:[],cMajorShown:null,draft:null,selected:null,staged:null,asLetters:true,filter:'all',sort:'recent',query:'',playing:false,playPos:-1,playPlan:null,metronome:false,volume:1,saveState:'',undo:[],redo:[],toast:'',modal:null,prefs:{},pianoHeld:[],pianoLatch:true,pianoOctave:0};
let audio={ctx:null,nodes:[],live:{},timer:null,raf:null};

function migrate(s){
  if(!s) return null; let blocks=s.blocks;
  if(!blocks&&Array.isArray(s.sections)) blocks=s.sections.map((x,i)=>({id:uid('b'),name:x.name||'',chords:(x.chords||[]).map(c=>({...c,ticks:c.ticks??((c.beats||1)*TPB)})),repeats:x.repeats||1,note:x.note||''}));
  if(!Array.isArray(blocks)||!blocks.length) blocks=[blankBlock()];
  blocks=blocks.map(b=>({id:b.id||uid('b'),name:b.name||'',chords:Array.isArray(b.chords)?b.chords.map(c=>({...c,ticks:c.ticks??12})):[],repeats:Math.max(1,b.repeats||1),note:b.note||''}));
  const out={kind:'transcription',tempo:90,cents:0,beatUnit:'quarter',feel:'',swing:false,mode:'major',bpb:4,unit:4,keyPc:0,...s,blocks};out.keyName=tonicName(out.keyPc,out.mode);out.useFlats=keyUsesFlats(out.keyPc,out.mode);return out;
}
function blankBlock(){return {id:uid('b'),name:'',chords:[],repeats:1,note:''}}
function blankSheet(kind='transcription'){const idea=kind==='original'; return {id:uid('s'),kind,title:idea?new Date().toLocaleDateString(undefined,{month:'short',day:'numeric'})+' idea':'',artist:idea?'Me':'',keyPc:0,keyName:'C',useFlats:false,mode:'major',bpb:4,unit:4,tempo:90,beatUnit:'quarter',cents:0,feel:'',swing:false,blocks:[blankBlock()]}}
function load(){
  try{const raw=localStorage.getItem(STORE_KEY)||localStorage.getItem('leadsheets:v3')||localStorage.getItem('leadsheets:v2');if(raw){const v=JSON.parse(raw);if(v&&Array.isArray(v.sheets)) state.sheets=v.sheets.map(migrate).filter(Boolean)}}catch(e){}
  try{state.prefs=JSON.parse(localStorage.getItem(PREF_KEY)||'{}');state.volume=state.prefs.volume??1;state.asLetters=state.prefs.asLetters??true}catch(e){}
  try{state.cMajor=cleanCMajor(JSON.parse(localStorage.getItem(CMAJOR_KEY)||'[]'))}catch(e){}
  render();
}
function persistSheets(){localStorage.setItem(STORE_KEY,JSON.stringify({version:4,savedAt:Date.now(),sheets:state.sheets}))}
function cleanCMajor(list){return Array.isArray(list)?list.filter(x=>x&&typeof x.title==='string'&&x.title.trim()).map(x=>({id:x.id||uid('c'),title:x.title.trim().slice(0,120),artist:String(x.artist||'').trim().slice(0,120)})):[]}
function saveCMajor(){localStorage.setItem(CMAJOR_KEY,JSON.stringify(state.cMajor))}
function cMajorKey(x){return (x.title+'|'+x.artist).toLowerCase()}
function cMajorSorted(){return [...state.cMajor].sort((a,b)=>a.title.localeCompare(b.title,undefined,{sensitivity:'base'}))}
function addCMajor(title,artist){const entry={id:uid('c'),title:title.trim().slice(0,120),artist:artist.trim().slice(0,120)};if(!entry.title)return;if(state.cMajor.some(x=>cMajorKey(x)===cMajorKey(entry))){toast('Already on the list');return}state.cMajor.push(entry);state.cMajorShown=entry.id;saveCMajor();render();$('#cmTitle')?.focus()}
function removeCMajor(id){const i=state.cMajor.findIndex(x=>x.id===id);if(i<0)return;const [gone]=state.cMajor.splice(i,1);if(state.cMajorShown===id)state.cMajorShown=null;saveCMajor();render();toast('Removed '+gone.title,{label:'Undo',run:()=>restoreCMajor(gone,i)})}
function restoreCMajor(entry,index){if(state.cMajor.some(x=>x.id===entry.id||cMajorKey(x)===cMajorKey(entry)))return;state.cMajor.splice(Math.min(index,state.cMajor.length),0,entry);state.cMajorShown=entry.id;saveCMajor();render()}
function savePrefs(){localStorage.setItem(PREF_KEY,JSON.stringify({volume:state.volume,asLetters:state.asLetters}))}
let saveTimer=null;
function scheduleSave(){state.saveState='saving';renderTopOnly();clearTimeout(saveTimer);saveTimer=setTimeout(()=>{if(!state.draft)return; state.draft.savedAt=Date.now(); const i=state.sheets.findIndex(s=>s.id===state.draft.id); if(i>=0)state.sheets[i]=clone(state.draft);else state.sheets.unshift(clone(state.draft));persistSheets();localStorage.removeItem(DRAFT_KEY);state.saveState='saved';renderTopOnly();},450)}
function updateDraft(mut,history=true){if(!state.draft)return;if(history){state.undo.push(clone(state.draft));if(state.undo.length>60)state.undo.shift();state.redo=[]}mut(state.draft);state.draft=migrate(state.draft);scheduleSave();render()}
function undo(){if(!state.undo.length)return;state.redo.push(clone(state.draft));state.draft=state.undo.pop();state.selected=null;state.staged=null;scheduleSave();render()}
function redo(){if(!state.redo.length)return;state.undo.push(clone(state.draft));state.draft=state.redo.pop();state.selected=null;state.staged=null;scheduleSave();render()}
let toastTimer=null,toastAction=null;
function toast(msg,action){state.toast=msg;toastAction=action||null;renderToast();clearTimeout(toastTimer);toastTimer=setTimeout(()=>{state.toast='';toastAction=null;renderToast()},action?6000:1600)}
function renderToast(){let el=$('#toast');if(!state.toast){if(el)el.remove();return}if(!el){el=document.createElement('div');el.id='toast';el.className='toast';document.body.appendChild(el)}el.textContent='';const msg=document.createElement('span');msg.className='toast-msg';msg.textContent=state.toast;el.appendChild(msg);el.classList.toggle('has-action',!!toastAction);if(toastAction){const b=document.createElement('button');b.type='button';b.className='toast-action';b.textContent=toastAction.label;const run=toastAction.run;b.addEventListener('click',()=>{clearTimeout(toastTimer);state.toast='';toastAction=null;renderToast();run()});el.appendChild(b)}}
function keyName(pc,flats){pc=(pc%12+12)%12;return (flats?KEY_NAMES_FLAT:KEY_NAMES_SHARP)[pc]}
function tonicName(pc,mode){return (mode==='minor'?TONIC_MINOR:TONIC_MAJOR)[(pc%12+12)%12]}
function keyUsesFlats(pc,mode){return (mode==='minor'?FLAT_KEYS_MINOR:FLAT_KEYS_MAJOR).includes((pc%12+12)%12)}
// Name a degree by its letter in the key (IV of F is B-something, so Bb, never A#).
function spellDegree(s,degree,acc){const d=clamp(degree||1,1,7),li=(LETTERS.indexOf(tonicName(s.keyPc,s.mode)[0])+d-1)%7,pc=(s.keyPc+degreePc(d,acc,s.mode))%12,off=(pc-LETTER_PC[li]+18)%12-6,name=LETTERS[li]+(off>0?'#'.repeat(off):'b'.repeat(-off));if(Math.abs(off)>1||(acc&&/^(Cb|Fb|E#|B#)$/.test(name)))return keyName(pc,keyUsesFlats(s.keyPc,s.mode));return name}
function scale(mode){return mode==='minor'?MINOR:MAJOR}
function degreePc(degree,acc='',mode='major'){let x=scale(mode)[clamp((degree||1)-1,0,6)]; if(acc==='#')x++; if(acc==='b')x--; return (x+12)%12}
function defaultQuality(deg,mode){return (mode==='minor'?DIATONIC_MINOR:DIATONIC_MAJOR)[clamp((deg||1)-1,0,6)]}
function actualQuality(c,mode){return c.quality==null?defaultQuality(c.degree,mode):(c.quality||'')}
function chordParts(c,s){if(c.rest)return {root:'R',sfx:'',bass:''};const rootPc=(s.keyPc+degreePc(c.degree,c.acc,s.mode))%12;const root=state.asLetters?spellDegree(s,c.degree,c.acc):(c.acc||'')+c.degree;let q=actualQuality(c,s.mode);let bass='';if(c.bass){const bpc=(s.keyPc+degreePc(c.bass.degree,c.bass.acc,s.mode))%12;bass=state.asLetters?spellDegree(s,c.bass.degree,c.bass.acc):(c.bass.acc||'')+c.bass.degree}return {root,sfx:q,bass}}
function chordLabel(c,s){const p=chordParts(c,s);if(c.rest)return 'Rest';return p.root+(p.sfx||'')+(p.bass?'/'+p.bass:'')}
function pcToDegree(pc,keyPc,mode){const [degree,acc]=(mode==='minor'?CHROMATIC_MINOR:CHROMATIC_MAJOR)[((pc-keyPc)%12+12)%12];return{degree,acc}}
function detectChords(pcs,bassPc){if(!pcs.length)return[];const out=[];for(let root=0;root<12;root++)for(const [ivs,sfx] of CHORD_TEMPLATES){const want=ivs.map(i=>(root+i)%12),matched=pcs.filter(p=>want.includes(p)).length,missing=want.length-matched,extra=pcs.length-matched;let score=matched*3-missing*2.5-extra*2.5;if(root===bassPc)score+=1.5;score+=want.length*.15;if(matched>=2&&score>0)out.push({root,sfx,score,size:want.length})}out.sort((a,b)=>b.score-a.score||b.size-a.size);const seen=new Set;return out.filter(x=>{const k=x.root+x.sfx;if(seen.has(k))return false;seen.add(k);return true}).slice(0,7)}
function detectedToChord(m,bassPc,s){const r=pcToDegree(m.root,s.keyPc,s.mode),diat=defaultQuality(r.degree,s.mode),c={degree:r.degree,acc:r.acc,quality:m.sfx===diat?null:m.sfx,bass:null,ticks:TPB};if(bassPc!=null&&bassPc!==m.root)c.bass=pcToDegree(bassPc,s.keyPc,s.mode);return c}
function pianoBase(){return 60+(state.draft?.keyPc||0)+state.pianoOctave*12}
function pianoInfo(){const base=pianoBase(),pcs=[];state.pianoHeld.slice().sort((a,b)=>a-b).forEach(semi=>{const pc=(base+semi)%12;if(!pcs.includes(pc))pcs.push(pc)});const bass=state.pianoHeld.length?(base+Math.min(...state.pianoHeld))%12:null;return{base,pcs,bass,matches:detectChords(pcs,bass)}}

function barsCount(s){const bt=s.bpb*TPB;return s.blocks.reduce((n,b)=>n+Math.ceil((b.chords||[]).reduce((a,c)=>a+c.ticks,0)/bt)*Math.max(1,b.repeats||1),0)}
function layoutBars(chords,barTicks){const bars=[];let bar=[],used=0;chords.forEach((c,index)=>{let left=Math.max(1,c.ticks||TPB),first=true;while(left>0){if(used>=barTicks){bars.push(bar);bar=[];used=0}const take=Math.min(left,barTicks-used);bar.push({chord:c,index,ticks:take,tied:!first,last:left-take<=0});used+=take;left-=take;first=false;if(used===barTicks){bars.push(bar);bar=[];used=0}}});if(bar.length)bars.push(bar);return bars.length?bars:[[]]}
function sheetDate(s){if(!s.savedAt)return'';try{return new Date(s.savedAt).toLocaleDateString(undefined,{month:'short',day:'numeric'})}catch(e){return''}}
function openSheet(id){stopPlayback();state.draft=clone(state.sheets.find(s=>s.id===id));state.view='editor';state.selected=null;state.staged=null;state.undo=[];state.redo=[];window.scrollTo({top:0});render()}
function newSheet(kind){stopPlayback();state.draft=blankSheet(kind);state.view='editor';state.selected=null;state.staged=null;state.undo=[];state.redo=[];localStorage.setItem(DRAFT_KEY,JSON.stringify(state.draft));window.scrollTo({top:0});render()}
function backLibrary(){stopPlayback();state.view='library';state.draft=null;state.selected=null;state.staged=null;render()}
function duplicateSheet(id){const s=clone(state.sheets.find(x=>x.id===id));s.id=uid('s');s.title=(s.title||'Untitled')+' (copy)';s.savedAt=Date.now();state.sheets.unshift(s);persistSheets();render();toast('Duplicated')}
function deleteSheet(id){state.sheets=state.sheets.filter(s=>s.id!==id);persistSheets();render();toast('Deleted')}
function download(name,text,type='application/json'){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([text],{type}));a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
function exportAll(){download('lead-sheets.json',JSON.stringify({version:4,savedAt:Date.now(),sheets:state.sheets,cMajor:state.cMajor},null,2))}
function importJson(file){const r=new FileReader();r.onload=()=>{try{const p=JSON.parse(String(r.result));const inc=Array.isArray(p)?p:p.sheets;if(!Array.isArray(inc))throw 0;const clean=inc.map(migrate).filter(Boolean);const ids=new Set(clean.map(s=>s.id));state.sheets=[...clean,...state.sheets.filter(s=>!ids.has(s.id))];persistSheets();if(!Array.isArray(p)){const have=new Set(state.cMajor.map(cMajorKey));cleanCMajor(p.cMajor).forEach(x=>{if(!have.has(cMajorKey(x))){have.add(cMajorKey(x));state.cMajor.push(x)}});saveCMajor()}render();toast(`Imported ${clean.length} sheet${clean.length===1?'':'s'}`)}catch(e){alert('That file does not look like a Lead Sheets JSON backup.')}};r.readAsText(file)}
function chartText(s){let out=[`${s.title||'Untitled'}${s.artist?' — '+s.artist:''}`,`${s.keyName} ${s.mode} · ${s.bpb}/${s.unit} · ${s.tempo||90} bpm${s.feel?' · '+s.feel:''}`,''];s.blocks.forEach((b,bi)=>{out.push(`${b.name||'Section '+(bi+1)}${b.repeats>1?' ×'+b.repeats:''}`);const bt=s.bpb*TPB;layoutBars(b.chords,bt).forEach(bar=>out.push('| '+bar.map(x=>x.tied?'~':chordLabel(x.chord,s)+(x.ticks!==TPB?`(${fmtBeats(x.ticks)})`:'')).join('  ')+' |'));if(b.note)out.push('  '+b.note);out.push('')});return out.join('\n')}
async function copyChart(){try{await navigator.clipboard.writeText(chartText(state.draft));toast('Chart copied')}catch(e){state.modal='text';render()}}
function fmtBeats(t){const n=t/TPB;return Number.isInteger(n)?String(n):String(Math.round(n*100)/100)}
function fracLabel(t){const rem=((t%TPB)+TPB)%TPB;if(!rem)return '';const whole=Math.floor(t/TPB);return rem===TPB/2?(whole||'')+'½':fmtBeats(t)}
function showSettings(){state.modal='settings';render()}
function saveMetaFromModal(){const t=$('#metaTitle').value.trim()||'Untitled',a=$('#metaArtist').value.trim();updateDraft(d=>{d.title=t;d.artist=a},false);state.modal=null;render()}
function setKey(pc){updateDraft(d=>{d.keyPc=pc})}
function transpose(dir){updateDraft(d=>{d.keyPc=(d.keyPc+dir+12)%12})}
function selectChord(b,c){if(state.selected&&state.selected.b===b&&state.selected.c===c){state.selected=null;render();return}state.staged=null;state.selected={b,c};previewChord(state.draft.blocks[b].chords[c]);render()}
function selectedChord(){return state.selected?state.draft.blocks[state.selected.b]?.chords[state.selected.c]:null}
function patchSelected(patch){if(!state.selected)return;updateDraft(d=>{Object.assign(d.blocks[state.selected.b].chords[state.selected.c],patch)})}
function blankStaged(){return {degree:1,acc:'',quality:null,bass:null,ticks:TPB,rest:false}}
function patchActive(patch){if(state.selected){patchSelected(patch);return}if(!state.staged)return;state.staged={...state.staged,...patch};previewChord(state.staged);render()}
