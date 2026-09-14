(function(){
  try{
    const reduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
    const LS="jai_demo_complete";
    const root=document.getElementById("jaiRoot");
    const openers=[...document.querySelectorAll("[data-jai-open]")];
    if(!root||!openers.length)return;

    const topics=[
      {id:"projects",label:"Projects"},
      {id:"stack",label:"Tech Stack"},
      {id:"workflow",label:"AI Workflow"},
      {id:"food",label:"Food Search"}
    ];

    root.innerHTML=`
      <div class="jai-scrim" data-jai-close></div>
      <div class="jai-panel" role="dialog" aria-modal="true" aria-labelledby="jaiTitle" tabindex="-1">
        <div class="jai-head">
          <span class="jai-kicker" id="jaiTitle">J.AI // Portfolio Intelligence</span>
          <button type="button" class="jai-close" data-jai-close>Close [ESC]</button>
        </div>
        <div class="jai-orbwrap">
          <div class="jai-orb" aria-hidden="true"></div>
          <div class="jai-wave" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
        </div>
        <p class="jai-status" id="jaiStatus">Voice online</p>
        <p class="jai-prompt" id="jaiPrompt">Ask me about Jamel's work.</p>
        <div class="jai-topics" id="jaiTopics">${topics.map(t=>`<button type="button" class="jai-topic" data-topic="${t.id}">${t.label}</button>`).join("")}</div>
        <div class="jai-actions">
          <button type="button" class="jai-btn primary" id="jaiMic" hidden>Stop listening</button>
        </div>
        <p class="jai-reply" id="jaiReply" aria-live="polite"></p>
        <div class="jai-foot">
          <span>OpenAI Voice</span>
          <span id="jaiDemo">Demo session: Available</span>
        </div>
      </div>`;

    const panel=root.querySelector(".jai-panel");
    const statusEl=$("#jaiStatus");
    const promptEl=$("#jaiPrompt");
    const replyEl=$("#jaiReply");
    const demoEl=$("#jaiDemo");
    const micBtn=$("#jaiMic");
    const topicBtns=[...root.querySelectorAll(".jai-topic")];
    let audioEl=null,recorder=null,chunks=[],activeTopic="",busy=false,complete=localStorage.getItem(LS)==="1";

    function $(id){return root.querySelector("#"+id.replace("#",""))}
    function setState(s){root.dataset.state=s;}
    function setStatus(t){statusEl.textContent=t;}
    function setDemo(t){demoEl.textContent=t;}
    function lockTopics(on){topicBtns.forEach(b=>b.disabled=on||complete);}

    function showComplete(){
      complete=true;
      localStorage.setItem(LS,"1");
      setState("complete");
      setStatus("J.AI // DEMO COMPLETE");
      promptEl.textContent="J.AI has completed its portfolio demonstration. Explore the rest of J.dev to learn more about Jamel's work.";
      replyEl.textContent="";
      setDemo("Demo session: Complete");
      lockTopics(true);
      micBtn.hidden=true;
    }

    function showOffline(){
      setState("offline");
      setStatus("J.AI // TEMPORARILY UNAVAILABLE");
      promptEl.textContent="Voice interaction is currently unavailable. You can still explore J.dev manually.";
      setDemo("Demo session: Offline");
      lockTopics(true);
      micBtn.hidden=true;
    }

    async function api(path, body){
      const r=await fetch(path,{
        method:"POST",
        headers: body?{"Content-Type":"application/json"}:undefined,
        credentials:"same-origin",
        body: body?JSON.stringify(body):"{}"
      });
      const data=await r.json().catch(()=>({}));
      if(data.status==="complete")return data;
      if(r.status===503||r.status===429||r.status===409||data.status==="offline"||data.status==="unavailable")
        throw Object.assign(new Error("offline"),{offline:true,unavailable:true});
      return data;
    }

    async function ensureSession(){
      const data=await api("/api/jai/session",{});
      if(data.status==="complete"){showComplete();return false;}
      setDemo("Demo session: Available");
      return true;
    }

    function blobToBase64(blob){
      return new Promise((resolve,reject)=>{
        const fr=new FileReader();
        fr.onload=()=>{
          const s=String(fr.result||"");
          resolve(s.includes(",")?s.split(",")[1]:s);
        };
        fr.onerror=reject;
        fr.readAsDataURL(blob);
      });
    }

    async function sendTurn(topic, audio, mime){
      setState("thinking");
      setStatus("Processing");
      const data=await api("/api/jai/turn",{topic,audio,mime});
      if(data.status==="complete"&&!data.reply){showComplete();return;}
      replyEl.textContent=data.reply||"";
      if(data.audio){
        if(audioEl){try{audioEl.pause();}catch(e){}}
        audioEl=new Audio("data:"+(data.mime||"audio/mpeg")+";base64,"+data.audio);
        setState("speaking");
        setStatus("Speaking");
        audioEl.onended=()=>{
          setState("idle");
          setStatus("Voice online");
          if(data.status==="complete")showComplete();
        };
        await audioEl.play().catch(()=>{
          setState("idle");
          setStatus("Voice online");
          if(data.status==="complete")showComplete();
        });
      }else if(data.status==="complete"){
        showComplete();
      }else{
        setState("idle");
        setStatus("Voice online");
      }
    }

    async function startListen(topic){
      if(busy||complete)return;
      if(!navigator.mediaDevices||!window.MediaRecorder){
        showOffline();
        return;
      }
      busy=true;
      activeTopic=topic;
      topicBtns.forEach(b=>b.setAttribute("aria-pressed",b.dataset.topic===topic?"true":"false"));
      try{
        const ok=await ensureSession();
        if(!ok){busy=false;return;}
        const stream=await navigator.mediaDevices.getUserMedia({audio:true});
        chunks=[];
        const mime=MediaRecorder.isTypeSupported("audio/webm")?"audio/webm":"";
        recorder=new MediaRecorder(stream, mime?{mimeType:mime}:{});
        recorder.ondataavailable=e=>{if(e.data&&e.data.size)chunks.push(e.data);};
        recorder.onstop=async()=>{
          stream.getTracks().forEach(t=>t.stop());
          micBtn.hidden=true;
          const blob=new Blob(chunks,{type:recorder.mimeType||"audio/webm"});
          recorder=null;
          if(blob.size<800){
            replyEl.textContent="No speech captured. Choose a topic and try again.";
            setState("idle");setStatus("Voice online");busy=false;return;
          }
          try{
            const b64=await blobToBase64(blob);
            await sendTurn(topic,b64,blob.type||"audio/webm");
          }catch(err){
            if(err&&err.offline)showOffline();
            else{setStatus("Voice online");setState("idle");replyEl.textContent="That turn could not be completed. Explore J.dev manually if needed.";}
          }
          busy=false;
        };
        recorder.start();
        setState("listening");
        setStatus("Listening");
        promptEl.textContent="Ask me about Jamel's work.";
        micBtn.hidden=false;
        micBtn.focus();
        if(!reduce)setTimeout(()=>{if(recorder&&recorder.state==="recording")stopListen();},10000);
      }catch(err){
        busy=false;
        if(err&&err.offline)showOffline();
        else{
          setStatus("Microphone unavailable");
          promptEl.textContent="Microphone permission is needed for the voice demo. You can still explore J.dev manually.";
          setState("idle");
        }
      }
    }

    function stopListen(){
      if(recorder&&recorder.state==="recording")recorder.stop();
    }

    function open(){
      root.classList.add("open");
      document.body.classList.add("modal-open");
      setState(complete?"complete":"idle");
      if(complete)showComplete();
      else{
        setStatus("Voice online");
        promptEl.textContent="Ask me about Jamel's work.";
        lockTopics(false);
        ensureSession().catch(()=>showOffline());
      }
      panel.focus();
    }

    function close(){
      stopListen();
      if(audioEl){try{audioEl.pause();}catch(e){}}
      root.classList.remove("open");
      document.body.classList.remove("modal-open");
    }

    openers.forEach(el=>el.addEventListener("click",e=>{e.preventDefault();open();}));
    root.addEventListener("click",e=>{if(e.target.closest("[data-jai-close]"))close();});
    topicBtns.forEach(b=>b.addEventListener("click",()=>startListen(b.dataset.topic)));
    micBtn.addEventListener("click",stopListen);
    addEventListener("keydown",e=>{
      if(!root.classList.contains("open"))return;
      if(e.key==="Escape"){e.preventDefault();close();}
    });
  }catch(err){
    console.warn("J.AI overlay failed to initialize",err);
  }
})();
