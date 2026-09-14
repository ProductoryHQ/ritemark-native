// Small bounded CDP client for this audit's isolated app only.
export async function connectCdp(url) {
  const ws=new WebSocket(url);const pending=new Map();const listeners=new Map();let nextId=0;
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  ws.onmessage=event=>{
    const msg=JSON.parse(event.data);
    if(msg.id&&pending.has(msg.id)){
      const p=pending.get(msg.id);pending.delete(msg.id);clearTimeout(p.timer);
      if(msg.error)p.reject(new Error(JSON.stringify(msg.error)));else p.resolve(msg.result);
    } else if(msg.method)for(const listener of listeners.get(msg.method)??[])listener(msg.params);
  };
  return {
    send(method,params={}){
      return new Promise((resolve,reject)=>{
        const id=++nextId;
        const timer=setTimeout(()=>{pending.delete(id);reject(new Error('CDP timeout: '+method));},7000);
        pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));
      });
    },
    on(method,fn){const group=listeners.get(method)??[];group.push(fn);listeners.set(method,group);},
    close(){for(const p of pending.values()){clearTimeout(p.timer);p.reject(new Error('CDP closed'));}pending.clear();ws.close();},
  };
}

export async function targets() {
  const response=await fetch('http://127.0.0.1:9237/json/list',{signal:AbortSignal.timeout(1500)});
  return response.json();
}

export const layoutExpression=`(()=>{
  const active=document.activeElement;
  const visible=s=>{const e=document.querySelector(s);return !!e&&e.getBoundingClientRect().width>0&&e.getBoundingClientRect().height>0;};
  return {ready:document.readyState,title:document.title,active:{tag:active?.tagName,id:active?.id,classes:typeof active?.className==='string'?active.className:'',label:active?.getAttribute('aria-label')},terminalVisible:visible('.terminal-wrapper'),auxiliaryTitle:document.querySelector('.part.auxiliarybar .title-label')?.textContent?.trim()??null,auxiliaryVisible:visible('.part.auxiliarybar'),editorVisible:visible('.part.editor'),tabs:[...document.querySelectorAll('.tabs-container .tab')].map(e=>({label:e.getAttribute('aria-label'),selected:e.getAttribute('aria-selected')}))};
})()`;
