(function(){
  const baseEditorHTML=editorHTML;
  const baseAct=act;
  const MEASURES_PER_SYSTEM=4;

  function mergedSheetsForPdf(){
    const sheets=state.sheets.map(clone);
    if(state.draft){
      const current=clone(state.draft);
      const i=sheets.findIndex(s=>s.id===current.id);
      if(i>=0)sheets[i]=current;else sheets.unshift(current);
    }
    return sheets;
  }

  function printChordHTML(x,s){
    if(x.tied)return '<span class="tie">·</span>';
    if(x.chord.rest)return '<span class="rest">𝄽</span>';
    const p=chordParts(x.chord,s);
    return `${esc(p.root)}${p.sfx?`<sup>${esc(p.sfx)}</sup>`:''}${p.bass?`<span class="bass">/${esc(p.bass)}</span>`:''}`;
  }

  function systemsForBars(bars){
    const systems=[];
    for(let i=0;i<bars.length;i+=MEASURES_PER_SYSTEM){
      const row=bars.slice(i,i+MEASURES_PER_SYSTEM);
      while(row.length<MEASURES_PER_SYSTEM)row.push(null);
      systems.push(row);
    }
    if(!systems.length)systems.push(Array(MEASURES_PER_SYSTEM).fill(null));
    return systems;
  }

  function measureHTML(bar,s,measureNo){
    if(!bar)return `<div class="measure empty-measure"><span class="measure-no">${measureNo}</span></div>`;
    return `<div class="measure"><span class="measure-no">${measureNo}</span><div class="measure-chords">${bar.length?bar.map(x=>`<div class="chord" style="flex:${Math.max(1,x.ticks)}">${printChordHTML(x,s)}</div>`).join(''):'<div class="chord rest-fill">—</div>'}</div></div>`;
  }

  function printSheetHTML(s,si){
    const barTicks=s.bpb*TPB;
    let measureNo=1;
    const sections=(s.blocks||[]).map((b,bi)=>{
      const bars=layoutBars(b.chords||[],barTicks);
      const systems=systemsForBars(bars);
      const systemsHtml=systems.map(row=>{
        const first=measureNo;
        const html=row.map((bar,idx)=>measureHTML(bar,s,first+idx)).join('');
        measureNo+=row.filter(Boolean).length;
        return `<div class="system">${html}</div>`;
      }).join('');
      return `<section class="section">
        <div class="section-head"><div class="section-name">${esc(b.name||`Section ${bi+1}`)}</div>${(b.repeats||1)>1?`<div class="repeat">× ${b.repeats}</div>`:''}</div>
        <div class="systems">${systemsHtml}</div>
        ${b.note?`<div class="note">${esc(b.note)}</div>`:''}
      </section>`;
    }).join('');
    const mode=s.mode==='minor'?'minor':'major';
    return `<article class="sheet ${si?'new-page':''}">
      <header class="sheet-head">
        <div class="title-block"><h1>${esc(s.title||'Untitled')}</h1>${s.artist?`<div class="artist">${esc(s.artist)}</div>`:''}</div>
        <div class="orientation">
          <div class="key-box"><span class="orientation-label">KEY</span><strong>${esc(s.keyName)}</strong><small>${mode}</small></div>
          <div class="meter-box" aria-label="${s.bpb}/${s.unit}"><span class="orientation-label">TIME</span><div class="time-signature"><span>${s.bpb}</span><span>${s.unit}</span></div></div>
          <div class="tempo-box"><span class="orientation-label">TEMPO</span><strong>♩ = ${s.tempo||90}</strong>${s.feel?`<small>${esc(s.feel)}</small>`:''}</div>
        </div>
      </header>
      ${sections||'<div class="no-content">No sections</div>'}
    </article>`;
  }

  function cMajorPrintHTML(){
    const list=cMajorSorted();
    if(!list.length)return '';
    return `<section class="sheet cmajor-page"><h2>Songs in C major</h2><ul>${list.map(x=>`<li><b>${esc(x.title)}</b>${x.artist?` <span>— ${esc(x.artist)}</span>`:''}</li>`).join('')}</ul></section>`;
  }

  function exportAllAsPDF(){
    stopPlayback();
    const sheets=mergedSheetsForPdf();
    const songCount=state.cMajor.length;
    if(!sheets.length&&!songCount){toast('Nothing to export');return;}
    const w=window.open('','_blank');
    if(!w){alert('Safari blocked the PDF window. Allow pop-ups for this site, then try again.');return;}
    const css=`
      *{box-sizing:border-box}html,body{margin:0;background:#e9edf2;color:#101820;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .toolbar{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;background:#071a35;color:white}.toolbar strong{font-size:14px}.toolbar span{font-size:12px;color:#b8c8dc}.toolbar button{border:0;border-radius:10px;padding:9px 13px;font:700 13px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:white;color:#071a35}
      .book{max-width:920px;margin:20px auto;padding:0 16px 40px}.sheet{background:white;padding:28px 32px 34px;margin:0 auto 20px;box-shadow:0 10px 35px rgba(7,26,53,.08)}
      .sheet-head{display:flex;justify-content:space-between;align-items:flex-start;gap:22px;border-bottom:2px solid #172033;padding-bottom:14px;margin-bottom:18px}.title-block{min-width:0;flex:1}.sheet h1{font-family:Georgia,serif;font-size:27px;line-height:1.08;margin:0;letter-spacing:-.01em}.artist{font-size:12px;color:#5f6978;margin-top:5px}
      .orientation{display:flex;align-items:stretch;gap:8px;flex:0 0 auto}.orientation>div{border:1.5px solid #172033;border-radius:5px;min-width:70px;padding:5px 8px;text-align:center;display:flex;flex-direction:column;justify-content:center}.orientation-label{font:700 8px/1 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.12em;color:#687386;margin-bottom:4px}.key-box strong{font:700 25px/1 Georgia,serif}.key-box small,.tempo-box small{font-size:9px;color:#5f6978;margin-top:3px;text-transform:uppercase;letter-spacing:.05em}.tempo-box strong{font:700 13px/1.1 Georgia,serif;white-space:nowrap}.time-signature{font:700 22px/.78 Georgia,serif;display:flex;flex-direction:column;align-items:center}.time-signature span+span{margin-top:4px}
      .section{break-inside:auto;margin:0 0 16px}.section-head{display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #aab2bd;margin:0 0 7px;padding-bottom:3px}.section-name{font:700 14px Georgia,serif;letter-spacing:.02em}.repeat{font:700 11px ui-monospace,SFMono-Regular,Menlo,monospace;color:#3f4a59}.systems{display:grid;gap:9px}.system{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));width:100%;min-height:58px;break-inside:avoid}.measure{position:relative;min-width:0;height:58px;border-left:1.5px solid #111827;background:repeating-linear-gradient(to bottom,transparent 0 10px,rgba(17,24,39,.10) 10px 11px);display:flex;align-items:stretch}.measure:last-child{border-right:1.5px solid #111827}.measure-no{position:absolute;left:4px;top:2px;font:8px ui-monospace,SFMono-Regular,Menlo,monospace;color:#8b95a3;z-index:2}.measure-chords{display:flex;width:100%;height:100%;align-items:stretch}.chord{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;min-width:0;padding:13px 3px 7px;border-right:1px dotted rgba(107,114,128,.38);font:700 17px Georgia,serif;white-space:nowrap}.chord:last-child{border-right:0}.chord sup{font-size:.62em;vertical-align:super;margin-left:1px}.bass{font-size:.72em}.tie,.rest{font-family:Georgia,serif;color:#667085}.rest-fill{color:#9aa3af;font-weight:400}.empty-measure{background:repeating-linear-gradient(to bottom,transparent 0 10px,rgba(17,24,39,.06) 10px 11px)}.note{font-size:10.5px;color:#596475;font-style:italic;margin-top:5px}.no-content{color:#64748b;font-size:12px}
      .cmajor-page h2{font:700 20px Georgia,serif;margin:0 0 12px;padding-bottom:8px;border-bottom:2px solid #172033;break-after:avoid}.cmajor-page ul{margin:0;padding-left:20px;columns:2;column-gap:36px}.cmajor-page li{font-size:13px;line-height:1.45;margin:0 0 4px;break-inside:avoid}.cmajor-page li span{color:#5f6978}
      @media(max-width:620px){.cmajor-page ul{columns:1}.sheet{padding:20px 18px}.sheet-head{display:block}.orientation{margin-top:12px;justify-content:flex-start}.orientation>div{min-width:66px}.sheet h1{font-size:24px}.chord{font-size:14px}}
      @media print{html,body{background:white}.toolbar{display:none}.book{max-width:none;margin:0;padding:0}.sheet{box-shadow:none;margin:0;padding:0}.sheet.new-page{break-before:page;page-break-before:always}.sheet.cmajor-page{margin-top:26px}.system{break-inside:avoid}.section-head{break-after:avoid}@page{size:auto;margin:11mm 12mm}}
    `;
    w.document.open();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lead Sheets — All charts</title><style>${css}</style></head><body><div class="toolbar"><div><strong>All lead sheets</strong><br><span>${[sheets.length?`${sheets.length} sheet${sheets.length===1?'':'s'}`:'',songCount?`${songCount} song${songCount===1?'':'s'} in C`:'',sheets.length?'4 measures per system':''].filter(Boolean).join(' · ')}</span></div><button onclick="window.print()">Export / Save as PDF</button></div><main class="book">${sheets.map(printSheetHTML).join('')}${cMajorPrintHTML()}</main></body></html>`);
    w.document.close();
    setTimeout(()=>{try{w.focus();w.print()}catch(e){}},450);
  }

  editorHTML=function(){
    const html=baseEditorHTML();
    return html.replace('<button class="btn small" data-act="edit-meta">Edit info</button>','<div style="display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end"><button class="btn small" data-act="export-pdf-all">Export all as PDF</button><button class="btn small" data-act="edit-meta">Edit info</button></div>');
  };

  act=function(a,e){if(a==='export-pdf-all'){exportAllAsPDF();return;}return baseAct(a,e);};
  if(state.view==='editor')render();
})();
