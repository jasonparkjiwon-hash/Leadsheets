(function(){
  // New-entry rule: adding a chord/rest from the capture controls must append and
  // leave selection empty. Selection is reserved for chords the user explicitly
  // taps in the chart for editing.

  addChord=function(degree){
    const d=state.draft;
    if(!d)return;

    // Explicitly selected chart chord: edit it and keep it selected so the user
    // can continue adjusting quality, bass, duration, etc.
    if(state.selected){
      updateDraft(x=>{
        const c=x.blocks[state.selected.b].chords[state.selected.c],ticks=c.ticks;
        x.blocks[state.selected.b].chords[state.selected.c]={degree,acc:'',quality:null,bass:null,ticks};
      });
      previewChord(selectedChord());
      return;
    }

    let added=null;
    updateDraft(x=>{
      const b=x.blocks[x.blocks.length-1],bt=x.bpb*TPB;
      const used=b.chords.reduce((a,c)=>a+c.ticks,0);
      const room=bt-(used%bt||0);
      added={degree,acc:'',quality:null,bass:null,ticks:room||bt};
      b.chords.push(added);
      // Do not auto-select newly entered chords.
      state.selected=null;
    });
    previewChord(added);
  };

  addRest=function(){
    if(state.selected){
      patchSelected({rest:true,degree:undefined,acc:undefined,quality:undefined,bass:undefined});
      return;
    }
    updateDraft(x=>{
      const b=x.blocks[x.blocks.length-1],bt=x.bpb*TPB;
      const used=b.chords.reduce((a,c)=>a+c.ticks,0);
      const room=bt-(used%bt||0);
      b.chords.push({rest:true,ticks:room||bt});
      state.selected=null;
    });
  };

  commitDetected=function(i=0){
    const info=pianoInfo(),m=info.matches[i];
    if(!m)return;
    const chord=detectedToChord(m,info.bass,state.draft);

    if(state.selected){
      const ticks=selectedChord().ticks;
      updateDraft(d=>{
        d.blocks[state.selected.b].chords[state.selected.c]={...chord,ticks};
      });
      clearPiano();
      previewChord(selectedChord());
      return;
    }

    let added=null;
    updateDraft(d=>{
      const b=d.blocks[d.blocks.length-1],bt=d.bpb*TPB;
      const used=b.chords.reduce((a,c)=>a+c.ticks,0);
      const room=bt-(used%bt||0);
      added={...chord,ticks:room||bt};
      b.chords.push(added);
      state.selected=null;
    });
    clearPiano();
    previewChord(added);
  };

  if(state.view==='editor')render();
})();
