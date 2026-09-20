(function(){
  // Touch interface: tap a chord to select it, tap the same chord again to
  // deselect it, drag a chord block to reorder it, drag the small handle on
  // its right edge to change its length (it clicks to whole beats, or half
  // beats while your finger is held below the start of the drag), and
  // press-and-hold a chord to change its type.
  const GRAIN_FULL=TPB, GRAIN_HALF=TPB/2;
  const HALF_BEAT_REACH=36;
  const MOVE_THRESHOLD=7;
  const LONG_PRESS_MS=480;
  // A chord ending at the right margin has almost no room left to drag into,
  // so holding the pointer against either screen edge keeps stepping the
  // length instead of dead-ending there.
  const EDGE_ZONE=72, EDGE_STEP_MS=420;

  // Chord types are picked category first, then the specific voicing inside
  // it, so a hold shows six choices instead of two dozen.
  const CHORD_GROUPS=[
    ['Major','quality',[['','Maj'],['maj7','maj7'],['maj9','maj9'],['6','6'],['add9','add9']]],
    ['Minor','quality',[['m','m'],['m7','m7'],['m9','m9'],['m6','m6']]],
    ['Dominant','quality',[['7','7'],['9','9'],['11','11'],['13','13'],['7sus4','7sus4'],['7b9','7♭9'],['7#9','7♯9']]],
    ['Sus / 5','quality',[['sus2','sus2'],['sus4','sus4'],['5','5']]],
    ['Dim / Aug','quality',[['dim','dim'],['dim7','dim7'],['m7b5','ø7'],['aug','aug']]],
    ['♭ / ♯','acc',[['b','♭ flat'],['','♮ natural'],['#','♯ sharp']]]
  ];

  function clearDropHighlight(){document.querySelectorAll('.drop-before,.drop-after,.drop-end').forEach(x=>x.classList.remove('drop-before','drop-after','drop-end'))}

  function startResize(e,bi,ci,handle){
    e.preventDefault();e.stopPropagation();
    const s=state.draft,chord=s.blocks[bi]?.chords[ci];
    if(!chord)return;
    const cell=handle.closest('.chord-cell'),bar=cell&&cell.closest('.bar');
    if(!bar)return;
    const barTicks=s.bpb*TPB,barRect=bar.getBoundingClientRect(),pxPerTick=Math.max(1,barRect.width)/barTicks;
    // On a chord that wraps across bars the handle rides its last segment,
    // which only shows the remainder, so the live preview sizes that piece.
    const segOffset=Number(handle.dataset.segOffset)||0;
    const startX=e.clientX,startY=e.clientY,startTicks=chord.ticks;
    let previewTicks=startTicks,moved=false,extra=0,edgeTimer=null,last={x:startX,y:startY};
    try{handle.setPointerCapture(e.pointerId)}catch(err){}
    cell.classList.add('resizing');
    function flashSnap(){cell.classList.remove('snap-flash');void cell.offsetWidth;cell.classList.add('snap-flash')}
    function grainFor(y){return y-startY>HALF_BEAT_REACH?GRAIN_HALF:GRAIN_FULL}
    function compute(){
      const grain=grainFor(last.y);
      const raw=startTicks+extra+(last.x-startX)/pxPerTick;
      const next=Math.max(grain,Math.round(raw/grain)*grain);
      if(next!==previewTicks){
        previewTicks=next;
        cell.style.flexGrow=Math.max(1,previewTicks-segOffset);
        flashSnap();
      }
    }
    function stopEdge(){if(edgeTimer){clearInterval(edgeTimer);edgeTimer=null}cell.classList.remove('edge-extending')}
    function checkEdge(){
      const dx=last.x-startX;
      const dir=(last.x>window.innerWidth-EDGE_ZONE&&dx>2)?1:(last.x<EDGE_ZONE&&dx<-2)?-1:0;
      if(!dir){stopEdge();return}
      if(edgeTimer)return;
      cell.classList.add('edge-extending');
      edgeTimer=setInterval(()=>{
        const grain=grainFor(last.y);
        if(dir<0&&previewTicks<=grain)return;
        extra+=dir*grain;
        moved=true;
        compute();
      },EDGE_STEP_MS);
    }
    function onMove(ev){
      moved=true;
      last={x:ev.clientX,y:ev.clientY};
      compute();
      checkEdge();
    }
    function onUp(){
      stopEdge();
      handle.removeEventListener('pointermove',onMove);
      handle.removeEventListener('pointerup',onUp);
      handle.removeEventListener('pointercancel',onUp);
      cell.classList.remove('resizing','snap-flash');
      if(moved&&previewTicks!==startTicks)updateDraft(d=>{d.blocks[bi].chords[ci].ticks=previewTicks});
      else{cell.style.flexGrow='';render()}
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

  function closeChordPopup(){document.getElementById('chordPopup')?.remove()}
  function placePopup(pop,rect){
    pop.classList.remove('below');
    pop.style.left='-9999px';
    pop.style.top='0px';
    const pw=pop.offsetWidth,ph=pop.offsetHeight,half=pw/2;
    let left=clamp(rect.left+rect.width/2,8+half,Math.max(8+half,window.innerWidth-8-half));
    let top=rect.top-10;
    if(rect.top-ph-14<8){top=rect.bottom+10;pop.classList.add('below')}
    pop.style.left=left+'px';
    pop.style.top=top+'px';
  }
  function showChordPopup(bi,ci,cell){
    closeChordPopup();
    const chord=state.draft.blocks[bi]?.chords[ci];
    if(!chord||chord.rest)return;
    const rect=cell.getBoundingClientRect();
    const quality=chord.quality==null?null:(chord.quality||'');
    const pop=document.createElement('div');
    pop.id='chordPopup';
    pop.className='chord-popup';
    document.body.appendChild(pop);

    function button(label,cls,onTap){
      const b=document.createElement('button');
      b.type='button';
      b.className='choice'+(cls?' '+cls:'');
      b.textContent=label;
      b.addEventListener('pointerdown',ev=>ev.stopPropagation());
      b.addEventListener('click',ev=>{ev.stopPropagation();onTap()});
      return b;
    }
    function apply(kind,v){
      updateDraft(d=>{const c=d.blocks[bi].chords[ci];if(kind==='acc')c.acc=v;else c.quality=v});
      const after=state.draft.blocks[bi]?.chords[ci];
      if(after)previewChord(after);
      closeChordPopup();
    }
    function showCategories(){
      pop.innerHTML='';
      pop.appendChild(button('Auto',quality===null?'active':'',()=>apply('quality',null)));
      CHORD_GROUPS.forEach(([name,kind,items],i)=>{
        const active=kind==='acc'?!!(chord.acc||''):items.some(([v])=>v===quality);
        pop.appendChild(button(name+' ›',active?'active':'',()=>showGroup(i)));
      });
      placePopup(pop,rect);
    }
    function showGroup(i){
      const [,kind,items]=CHORD_GROUPS[i];
      pop.innerHTML='';
      pop.appendChild(button('‹',' back',showCategories));
      items.forEach(([v,l])=>{
        const active=kind==='acc'?(chord.acc||'')===v:quality===v;
        pop.appendChild(button(l,active?'active':'',()=>apply(kind,v)));
      });
      placePopup(pop,rect);
    }
    showCategories();
    const onOutside=ev=>{if(!pop.contains(ev.target)){closeChordPopup();document.removeEventListener('pointerdown',onOutside,true)}};
    setTimeout(()=>document.addEventListener('pointerdown',onOutside,true),0);
  }

  function startMove(e,bi,ci,cell){
    e.preventDefault();
    const startX=e.clientX,startY=e.clientY;
    let dragging=false,ghost=null,longPressed=false;
    try{cell.setPointerCapture(e.pointerId)}catch(err){}
    const chord=state.draft.blocks[bi]?.chords[ci];
    let pressTimer=(chord&&!chord.rest)?setTimeout(()=>{
      longPressed=true;
      pressTimer=null;
      try{cell.releasePointerCapture(e.pointerId)}catch(err){}
      showChordPopup(bi,ci,cell);
    },LONG_PRESS_MS):null;
    function onMove(ev){
      if(longPressed)return;
      const dx=ev.clientX-startX,dy=ev.clientY-startY;
      if(!dragging&&Math.hypot(dx,dy)>MOVE_THRESHOLD){
        if(pressTimer){clearTimeout(pressTimer);pressTimer=null}
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
      if(pressTimer){clearTimeout(pressTimer);pressTimer=null}
      cell.removeEventListener('pointermove',onMove);
      cell.removeEventListener('pointerup',onUp);
      cell.removeEventListener('pointercancel',onUp);
      cell.classList.remove('dragging-source');
      if(longPressed)return;
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
      // A hold is our gesture, so keep the browser from turning it into a
      // text selection or a callout menu over the chord name.
      cell.addEventListener('selectstart',e=>e.preventDefault());
      cell.addEventListener('contextmenu',e=>e.preventDefault());
      cell.addEventListener('dragstart',e=>e.preventDefault());
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
