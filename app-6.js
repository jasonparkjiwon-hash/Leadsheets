(function(){
  const baseRender=render;

  function ensureResponsivePolish(){
    if(document.getElementById('mobile-editor-polish'))return;
    const style=document.createElement('style');
    style.id='mobile-editor-polish';
    style.textContent=`
      @media(max-width:900px){.transport-panel{margin-bottom:10px}}
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
          font-size:clamp(21px,6vw,27px)!important;
          line-height:1.06!important;
          letter-spacing:-.025em!important;
          overflow-wrap:break-word!important;
          word-break:normal!important;
          hyphens:none!important;
        }
        .editor-artist{font-size:12px!important;margin-top:3px!important}
        .editor-tags{margin-top:6px!important;gap:5px!important}
        .editor-head{margin-bottom:2px!important}
        .panel{padding:11px!important}
        .panel-title{margin-bottom:8px!important}
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

  // Narrow screens stack the studio below the whole chart, which buries the
  // transport. Move the real panel up under the header rather than building a
  // second copy of it, so there is only ever one set of playback controls.
  function placeTransport(){
    if(state.view!=='editor')return;
    const panel=document.querySelector('.transport-panel');
    const head=document.querySelector('.editor-head');
    const studio=document.querySelector('.studio');
    if(!panel||!head||!studio)return;
    if(window.matchMedia('(max-width:900px)').matches){
      if(panel.previousElementSibling!==head)head.insertAdjacentElement('afterend',panel);
    }else if(panel.parentElement!==studio){
      studio.insertAdjacentElement('afterbegin',panel);
    }
  }

  function enhance(){
    ensureResponsivePolish();
    cleanEditorHeader();
    placeTransport();
    movePdfExportToLibrary();
  }

  render=function(){
    baseRender();
    enhance();
  };

  window.addEventListener('resize',enhance);

  enhance();
})();
