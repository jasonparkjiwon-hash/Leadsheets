(function(){
  const baseRender=render;

  function ensureResponsivePolish(){
    if(document.getElementById('mobile-editor-polish'))return;
    const style=document.createElement('style');
    style.id='mobile-editor-polish';
    style.textContent=`
      .mobile-play-row{display:none}
      @media(max-width:600px){
        .editor-head{
          display:grid!important;
          grid-template-columns:1fr auto!important;
          grid-template-rows:auto auto!important;
          grid-template-areas:"back edit" "main main"!important;
          gap:10px 8px!important;
          align-items:center!important;
          margin-bottom:4px!important;
        }
        .editor-head > [data-act="back"]{grid-area:back;justify-self:start}
        .editor-head > [data-act="edit-meta"]{grid-area:edit;justify-self:end}
        .editor-head-main{
          grid-area:main;
          width:100%;
          min-width:0;
          padding:2px 1px 0;
        }
        .editor-title{
          max-width:none!important;
          width:100%!important;
          font-size:clamp(29px,9.2vw,38px)!important;
          line-height:1.04!important;
          letter-spacing:-.025em!important;
          overflow-wrap:break-word!important;
          word-break:normal!important;
          hyphens:none!important;
        }
        .editor-artist{font-size:14px!important;margin-top:6px!important}
        .editor-tags{margin-top:9px!important;gap:6px!important}
        .mobile-play-row{
          display:flex;
          flex-wrap:wrap;
          gap:8px;
          margin:8px 0 12px;
          padding:8px;
          border:1px solid var(--line);
          border-radius:14px;
          background:rgba(255,255,255,.92);
          box-shadow:0 5px 18px rgba(7,26,53,.05);
        }
        .mobile-play-row .mobile-play-main{flex:1 1 100%}
        .mobile-play-row .btn{min-height:42px}
        .mobile-play-row .mobile-vol{flex:1 1 auto;display:flex;align-items:center;gap:7px;min-width:0;padding:0 4px;color:var(--muted);font-size:13px}
        .mobile-play-row .mobile-vol input{flex:1;accent-color:var(--teal)}
        .mobile-play-row .mobile-vol span{font:11px var(--mono);width:34px;text-align:right;flex:0 0 auto}
      }
    `;
    document.head.appendChild(style);
  }

  function movePdfExportToLibrary(){
    if(state.view!=='library')return;
    const backup=document.querySelector('.backup .card-actions');
    if(!backup||backup.querySelector('[data-mobile-pdf-all]'))return;
    const importBtn=backup.querySelector('[data-act="import"]');
    const btn=document.createElement('button');
    btn.className='btn';
    btn.type='button';
    btn.dataset.mobilePdfAll='1';
    btn.textContent='Export all as PDF';
    btn.addEventListener('click',e=>act('export-pdf-all',e));
    if(importBtn)backup.insertBefore(btn,importBtn);else backup.appendChild(btn);
  }

  function cleanEditorHeader(){
    if(state.view!=='editor')return;
    const pdfBtn=document.querySelector('.editor-head [data-act="export-pdf-all"]');
    if(pdfBtn){
      const wrap=pdfBtn.parentElement;
      const edit=wrap?.querySelector('[data-act="edit-meta"]');
      pdfBtn.remove();
      if(wrap&&edit&&wrap.children.length===1)wrap.replaceWith(edit);
      else if(wrap&&wrap.children.length===0)wrap.remove();
    }
  }

  function addMobilePlayback(){
    if(state.view!=='editor')return;
    const head=document.querySelector('.editor-head');
    if(!head||document.querySelector('.mobile-play-row'))return;
    const row=document.createElement('div');
    row.className='mobile-play-row';

    const playBtn=document.createElement('button');
    playBtn.type='button';
    playBtn.className=`btn mobile-play-main ${state.playing?'accent':'primary'}`;
    playBtn.textContent=state.playing?'■ Stop':'▶ Play lead sheet';
    playBtn.addEventListener('click',e=>act(state.playing?'stop':'play',e));
    row.appendChild(playBtn);

    const fromBtn=document.createElement('button');
    fromBtn.type='button';
    fromBtn.className='btn';
    fromBtn.textContent='From selected';
    fromBtn.disabled=!state.selected;
    fromBtn.addEventListener('click',e=>act('play-selected',e));
    row.appendChild(fromBtn);

    const vol=document.createElement('div');
    vol.className='mobile-vol';
    vol.innerHTML=`<span>\u{1F50A}</span><input type="range" min="0" max="250" value="${Math.round(state.volume*100)}"><span>${Math.round(state.volume*100)}%</span>`;
    vol.querySelector('input').addEventListener('input',e=>{
      state.volume=Number(e.target.value)/100;
      savePrefs();
      vol.querySelector('span:last-child').textContent=Math.round(state.volume*100)+'%';
      const sidebarVol=document.querySelector('#volume');
      if(sidebarVol){sidebarVol.value=e.target.value;sidebarVol.nextElementSibling.textContent=Math.round(state.volume*100)+'%'}
    });
    row.appendChild(vol);

    head.insertAdjacentElement('afterend',row);
  }

  function enhance(){
    ensureResponsivePolish();
    cleanEditorHeader();
    addMobilePlayback();
    movePdfExportToLibrary();
  }

  render=function(){
    baseRender();
    enhance();
  };

  enhance();
})();
