(function(){
  const baseEditorHTML=editorHTML;
  const baseAct=act;

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

  function printSheetHTML(s,si){
    const barTicks=s.bpb*TPB;
    const sections=(s.blocks||[]).map((b,bi)=>{
      const bars=layoutBars(b.chords||[],barTicks);
      return `<section class="section">
        <div class="section-head"><div class="section-name">${esc(b.name||`Section ${bi+1}`)}</div>${(b.repeats||1)>1?`<div class="repeat">×${b.repeats}</div>`:''}</div>
        <div class="bars">${bars.map(bar=>`<div class="bar">${bar.length?bar.map(x=>`<div class="chord" style="flex:${Math.max(1,x.ticks)}">${printChordHTML(x,s)}</div>`).join(''):'<div class="empty-bar">—</div>'}</div>`).join('')}</div>
        ${b.note?`<div class="note">${esc(b.note)}</div>`:''}
      </section>`;
    }).join('');
    return `<article class="sheet ${si?'new-page':''}">
      <header class="sheet-head">
        <div><h1>${esc(s.title||'Untitled')}</h1>${s.artist?`<div class="artist">${esc(s.artist)}</div>`:''}</div>
        <div class="meta">${esc(s.keyName)} ${s.mode==='minor'?'minor':'major'} · ${s.bpb}/${s.unit} · ${s.tempo||90} bpm${s.feel?` · ${esc(s.feel)}`:''}</div>
      </header>
      ${sections||'<div class="no-content">No sections</div>'}
    </article>`;
  }

  function exportAllAsPDF(){
    stopPlayback();
    const sheets=mergedSheetsForPdf();
    if(!sheets.length){toast('No sheets to export');return;}
    const w=window.open('','_blank');
    if(!w){alert('Safari blocked the PDF window. Allow pop-ups for this site, then try again.');return;}
    const css=`
      *{box-sizing:border-box}html,body{margin:0;background:#eef2f6;color:#101820;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .toolbar{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;background:#071a35;color:white}
      .toolbar strong{font-size:14px}.toolbar span{font-size:12px;color:#b8c8dc}.toolbar button{border:0;border-radius:10px;padding:9px 13px;font:700 13px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;background:white;color:#071a35}
      .book{max-width:900px;margin:20px auto;padding:0 16px 40px}.sheet{background:white;padding:28px 30px 32px;margin:0 auto 20px;box-shadow:0 10px 35px rgba(7,26,53,.08)}
      .sheet-head{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;border-bottom:1px solid #cbd5e1;padding-bottom:12px;margin-bottom:14px}.sheet h1{font-family:Georgia,serif;font-size:26px;line-height:1.05;margin:0}.artist{font-size:12px;color:#64748b;margin-top:5px}.meta{font:11px ui-monospace,SFMono-Regular,Menlo,monospace;color:#475569;text-align:right;white-space:nowrap}
      .section{break-inside:avoid;margin:0 0 14px}.section-head{display:flex;justify-content:space-between;align-items:center;margin:0 0 6px}.section-name{font:700 14px Georgia,serif}.repeat{font:700 11px ui-monospace,SFMono-Regular,Menlo,monospace;color:#475569}.bars{display:grid;gap:6px}.bar{display:flex;min-height:46px;border-left:1.5px solid #0f172a;border-right:1.5px solid #0f172a;position:relative}.bar:before,.bar:after{content:"";position:absolute;left:0;right:0;border-top:1px solid rgba(15,23,42,.08)}.bar:before{top:15px}.bar:after{top:30px}
      .chord{position:relative;z-index:1;display:flex;align-items:center;justify-content:center;min-width:28px;padding:9px 3px;border-right:1px dotted #cbd5e1;font:700 16px Georgia,serif}.chord:last-child{border-right:0}.chord sup{font-size:.62em;vertical-align:super;margin-left:1px}.bass{font-size:.72em}.tie,.rest{font-family:Georgia,serif;color:#64748b}.empty-bar{padding:14px;color:#94a3b8}.note{font-size:10.5px;color:#64748b;font-style:italic;margin-top:5px}.no-content{color:#64748b;font-size:12px}
      @media print{html,body{background:white}.toolbar{display:none}.book{max-width:none;margin:0;padding:0}.sheet{box-shadow:none;margin:0;padding:0}.sheet.new-page{break-before:page;page-break-before:always}@page{margin:12mm}}
    `;
    w.document.open();
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Lead Sheets — All charts</title><style>${css}</style></head><body><div class="toolbar"><div><strong>All lead sheets</strong><br><span>${sheets.length} sheet${sheets.length===1?'':'s'} · choose Save as PDF in the print sheet</span></div><button onclick="window.print()">Export / Save as PDF</button></div><main class="book">${sheets.map(printSheetHTML).join('')}</main></body></html>`);
    w.document.close();
    setTimeout(()=>{try{w.focus();w.print()}catch(e){}},450);
  }

  editorHTML=function(){
    const html=baseEditorHTML();
    return html.replace('<button class="btn small" data-act="edit-meta">Edit info</button>','<div style="display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end"><button class="btn small" data-act="export-pdf-all">Export all as PDF</button><button class="btn small" data-act="edit-meta">Edit info</button></div>');
  };

  act=function(a,e){
    if(a==='export-pdf-all'){exportAllAsPDF();return;}
    return baseAct(a,e);
  };

  if(state.view==='editor')render();
})();
