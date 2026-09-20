(function(){
  // Touch interface: tap a chord to select it, tap the same chord again to
  // deselect it, drag a chord block to reorder it, and drag the small handle
  // at a chord's right edge to change its length. While resizing, sliding
  // your finger up snaps to finer beat subdivisions, the way a video scrubber
  // slows down when you slide away from the timeline.
  const GRAIN_FULL=TPB, GRAIN_HALF=TPB/2, GRAIN_QUARTER=TPB/4;
  const MOVE_THRESHOLD=7;

  function grainLabel(g){return g===GRAIN_QUARTER?'¼ beat snap':g===GRAIN_HALF?'½ beat snap':'1 beat snap'}
  function ensureBadge(){let el=document.getElementById('dragGrainBadge');if(!el){el=document.createElement('div');el.id='dragGrainBadge';el.className='drag-grain-badge';document.body.appendChild(el)}return el}
  function removeBadge(){document.getElementById('dragGrainBadge')?.remove()}
  function clearDropHighlight(){document.querySelectorAll('.drop-before,.drop-after,.drop-end').forEach(x=>x.classList.remove('drop-before','drop-after','drop-end'))}

  function startResize(e,bi,ci,handle){
    e.preventDefault();e.stopPropagation();
    const s=state.draft,chord=s.blocks[bi]?.chords[ci];
    if(!chord)return;
    const cell=handle.closest('.chord-cell'),bar=cell&&cell.closest('.bar');
    if(!bar)return;
    const barTicks=s.bpb*TPB,barRect=bar.getBoundingClientRect(),pxPerTick=Math.max(1,barRect.width)/barTicks;
    const startX=e.clientX,startY=e.clientY,startTicks=chord.ticks;
    let previewTicks=startTicks,moved=false;
    try{handle.setPointerCapture(e.pointerId)}catch(err){}
    const badge=ensureBadge();
    badge.style.display='block';
    function onMove(ev){
      moved=true;
      const dx=ev.clientX-startX,dy=startY-ev.clientY;
      const grain=dy>90?GRAIN_QUARTER:dy>36?GRAIN_HALF:GRAIN_FULL;
      const raw=startTicks+dx/pxPerTick;
      previewTicks=Math.max(grain,Math.round(raw/grain)*grain);
      cell.style.flex=previewTicks;
      badge.textContent=`${fmtBeats(previewTicks)} beats · ${grainLabel(grain)}`;
      badge.style.left=ev.clientX+'px';
      badge.style.top=ev.clientY+'px';
    }
    function onUp(){
      handle.removeEventListener('pointermove',onMove);
      handle.removeEventListener('pointerup',onUp);
      handle.removeEventListener('pointercancel',onUp);
      removeBadge();
      if(moved&&previewTicks!==startTicks)updateDraft(d=>{d.blocks[bi].chords[ci].ticks=previewTicks});
      else{cell.style.flex='';render()}
    }
    handle.addEventListener('pointermove',onMove);
    handle.addEventListener('pointerup',onUp);
    handle.addEventListener('pointercancel',onUp);
  }

  let currentDropTarget=null;
  function updateDropTarget(x,y,fromB,fromC){
    clearDropHighlight();
    const el=document.elementFromPoint(x,y);
    const cell=el&&el.closest('[data-chord]');
    if(cell){
      const [bi,ci]=cell.dataset.chord.split(':').map(Number);
      if(bi===fromB&&ci===fromC){currentDropTarget=null;return}
      const rect=cell.getBoundingClientRect(),before=x<rect.left+rect.width/2;
      currentDropTarget={bi,ci,before};
      cell.classList.add(before?'drop-before':'drop-after');
      return;
    }
    const barEl=el&&el.closest('.bar');
    if(barEl){currentDropTarget={bi:Number(barEl.dataset.bar.split(':')[0]),end:true};barEl.classList.add('drop-end');return}
    const sectionEl=el&&el.closest('.section');
    if(sectionEl){currentDropTarget={bi:Number(sectionEl.dataset.section),end:true};sectionEl.classList.add('drop-end');return}
    currentDropTarget=null;
  }

  function moveChordTo(fromB,fromC,target){
    if(target.bi===fromB&&!target.end&&target.ci===fromC)return;
    updateDraft(d=>{
      const [item]=d.blocks[fromB].chords.splice(fromC,1);
      const destArr=d.blocks[target.bi].chords;
      let insertAt;
      if(target.end)insertAt=destArr.length;
      else{let ci=target.ci;if(target.bi===fromB&&ci>fromC)ci-=1;insertAt=target.before?ci:ci+1}
      destArr.splice(clamp(insertAt,0,destArr.length),0,item);
    });
    state.selected=null;
  }

  function startMove(e,bi,ci,cell){
    e.preventDefault();
    const startX=e.clientX,startY=e.clientY;
    let dragging=false,ghost=null;
    try{cell.setPointerCapture(e.pointerId)}catch(err){}
    function onMove(ev){
      const dx=ev.clientX-startX,dy=ev.clientY-startY;
      if(!dragging&&Math.hypot(dx,dy)>MOVE_THRESHOLD){
        dragging=true;
        cell.classList.add('dragging-source');
        const rect=cell.getBoundingClientRect();
        ghost=cell.cloneNode(true);
        ghost.classList.add('chord-ghost');
        ghost.querySelectorAll('.chord-resize-handle').forEach(h=>h.remove());
        ghost.style.width=rect.width+'px';
        ghost.style.height=rect.height+'px';
        document.body.appendChild(ghost);
      }
      if(dragging){
        ghost.style.left=ev.clientX+'px';
        ghost.style.top=ev.clientY+'px';
        updateDropTarget(ev.clientX,ev.clientY,bi,ci);
      }
    }
    function onUp(){
      cell.removeEventListener('pointermove',onMove);
      cell.removeEventListener('pointerup',onUp);
      cell.removeEventListener('pointercancel',onUp);
      cell.classList.remove('dragging-source');
      if(dragging){
        ghost?.remove();
        clearDropHighlight();
        const target=currentDropTarget;
        currentDropTarget=null;
        if(target)moveChordTo(bi,ci,target);
      } else selectChord(bi,ci);
    }
    cell.addEventListener('pointermove',onMove);
    cell.addEventListener('pointerup',onUp);
    cell.addEventListener('pointercancel',onUp);
  }

  wireChordCells=function(){
    document.querySelectorAll('.chord-cell[data-chord]').forEach(cell=>{
      cell.addEventListener('pointerdown',e=>{
        if(e.button!=null&&e.button!==0)return;
        const [bi,ci]=cell.dataset.chord.split(':').map(Number);
        startMove(e,bi,ci,cell);
      });
    });
    document.querySelectorAll('[data-resize]').forEach(handle=>{
      handle.addEventListener('pointerdown',e=>{
        if(e.button!=null&&e.button!==0)return;
        const [bi,ci]=handle.dataset.resize.split(':').map(Number);
        startResize(e,bi,ci,handle);
      });
    });
  };

  if(state.view==='editor')wireChordCells();
})();
