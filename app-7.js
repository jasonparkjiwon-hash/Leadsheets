(function(){
  // Entry rule: the degree grid always adds/edits straight away (or edits an
  // already-selected chart chord in place). Only chords built on the "play it
  // in" piano get staged as an audible preview, since matching a played chord
  // to a chip is the one case where you want to hear it before committing.

  addChord=function(degree){
    const d=state.draft;
    if(!d)return;

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
      state.selected=null;
    });
    previewChord(added);
  };

  addRest=function(){
    if(state.selected){
      patchSelected({rest:true,degree:undefined,acc:undefined,quality:undefined,bass:undefined});
      return;
    }
    state.staged=null;
    updateDraft(x=>{
      const b=x.blocks[x.blocks.length-1],bt=x.bpb*TPB;
      const used=b.chords.reduce((a,c)=>a+c.ticks,0);
      const room=bt-(used%bt||0);
      b.chords.push({rest:true,ticks:room||bt});
      state.selected=null;
    });
  };

  stageDetected=function(i=0){
    const info=pianoInfo(),m=info.matches[i];
    if(!m)return;
    const chord=detectedToChord(m,info.bass,state.draft);

    if(state.selected){
      const ticks=selectedChord().ticks;
      updateDraft(d=>{
        d.blocks[state.selected.b].chords[state.selected.c]={...chord,ticks};
      });
      previewChord(selectedChord());
      return;
    }

    state.staged=chord;
    previewChord(state.staged);
    render();
  };

  commitStaged=function(){
    if(!state.staged||state.selected)return;
    const chord=state.staged;
    updateDraft(x=>{
      const b=x.blocks[x.blocks.length-1],bt=x.bpb*TPB;
      const used=b.chords.reduce((a,c)=>a+c.ticks,0);
      const room=bt-(used%bt||0);
      b.chords.push({...chord,ticks:room||bt});
      state.selected=null;
    });
    state.staged=null;
    clearPiano();
    toast('Chord added');
  };

  cancelStaged=function(){
    if(!state.staged)return;
    state.staged=null;
    clearPiano();
  };

  if(state.view==='editor')render();
})();
