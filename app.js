// Global error handlers para capturar "Script error." y otros errores cross-origin
window.addEventListener('error', function(ev){
  try{
    const box = document.getElementById('errorBox');
    const msg = (ev && ev.message) ? ev.message : 'Script error.';
    const src = ev && ev.filename ? '\nFile: ' + ev.filename : '';
    const ln = ev && ev.lineno ? '\nLine: ' + ev.lineno : '';
    box.style.display = 'block';
    box.textContent = `ERROR CAPTURADO: ${msg}${src}${ln}`;
    console.error('Global error handler:', ev);
  }catch(e){ console.error('Error mostrando caja de error', e); }
});
window.addEventListener('unhandledrejection', function(ev){
  try{
    const box = document.getElementById('errorBox');
    box.style.display = 'block';
    box.textContent = 'Unhandled Promise Rejection: ' + (ev.reason && ev.reason.toString ? ev.reason.toString() : JSON.stringify(ev.reason));
    console.error('Unhandled rejection:', ev);
  }catch(e){ console.error('Error mostrando rejection', e); }
});

// --- Definición del PDA ---
const PDA = (function(){
  return {
    Q: ['q0','q1','q2','q3','q4','q5','qf'],
    Sigma: ['0','1','2'],
    Gamma: ['Z','X','Y'],
    q0: 'q0',
    Z0: 'Z',
    F: ['qf'],
    delta: {
      'q0,1,Z': [{ to:'q0', pop:false, push:[], consume:true }],
      'q0,0,Z': [{ to:'q1', pop:false, push:['X','Z'], consume:true }],

      'q1,0,X': [{ to:'q1', pop:false, push:['X','X'], consume:true }],
      'q1,1,X': [{ to:'q2', pop:false, push:['Y','X'], consume:true }],
      'q2,1,Y': [{ to:'q2', pop:false, push:['Y','Y'], consume:true }],

      'q2,1,X': [{ to:'q3', pop:true, push:[], consume:true }],

      'q3,2,X': [{ to:'q3', pop:true, push:[], consume:true }],

      'q3,0,Y': [{ to:'q4', pop:true, push:[], consume:true }],
      'q4,0,Y': [{ to:'q4', pop:true, push:[], consume:true }],

      'q2,ε,X': [{ to:'q3', pop:true, push:[], consume:false }],
      'q2,ε,Y': [{ to:'q2', pop:true, push:[], consume:false }],

      'q3,ε,X': [{ to:'q3', pop:true, push:[], consume:false }],
      'q3,ε,Y': [{ to:'q3', pop:true, push:[], consume:false }],

      'q3,ε,Z': [{ to:'q4', pop:false, push:[], consume:false }],
      'q4,ε,Z': [{ to:'q5', pop:false, push:[], consume:false }],
      'q5,ε,Z': [{ to:'qf', pop:false, push:[], consume:false }],

      'q1,ε,Z': [{ to:'qf', pop:false, push:[], consume:false }]
    }
  };
})();

// --- Helpers de render y seguridad ---
function safe(fn){
  return function(){
    try{ return fn.apply(this, arguments); }catch(err){
      const box = document.getElementById('errorBox');
      if(box){ box.style.display='block'; box.textContent = 'Runtime error: ' + (err && err.message ? err.message : err.toString()); }
      console.error('Safe wrapper caught:', err);
    }
  };
}

function renderSeven(){
  document.getElementById('valQ').textContent = '{' + PDA.Q.join(', ') + '}';
  document.getElementById('valSigma').textContent = '{' + PDA.Sigma.join(', ') + '}';
  document.getElementById('valGamma').textContent = '{' + PDA.Gamma.join(', ') + '}';
  document.getElementById('valQ0').textContent = PDA.q0;
  document.getElementById('valZ0').textContent = PDA.Z0;
  document.getElementById('valF').textContent = '{' + PDA.F.join(', ') + '}';
}

const grammarText = `S -> T '1' U
T -> 1 T | 0 A
A -> 0 A | 0
U -> 2 U | 0 V
V -> 0 V | ε
`;
function renderGrammar(){ document.getElementById('grammar').textContent = grammarText; }

let cy = null;
function createGraph(){
  try{
    if(!window.cytoscape){ console.warn('cytoscape not loaded; grafo no mostrado.'); return; }
    // asegurar que el plugin dagre esté registrado
    if(window.cytoscapeDagre && typeof cytoscape !== 'undefined' && cytoscape.use){
      try{ cytoscape.use(window.cytoscapeDagre); }catch(e){ /* already registered */ }
    }

    if(cy){ try{ cy.destroy(); }catch(e){} cy = null; }
    cy = cytoscape({ container: document.getElementById('cyContainer'), style: [
      { selector: 'node', style: { 'background-color':'#fff', 'label':'data(label)','border-color':'#444','border-width':2,'color':'#111','text-valign':'center','text-halign':'center','width':46,'height':46,'font-size':12 } },
      { selector: 'node.final', style: { 'border-width':5, 'border-color':'#0b63c6' } },
      { selector: 'edge', style: { 'curve-style':'bezier', 'target-arrow-shape':'triangle', 'label':'data(label)', 'font-size':12, 'text-margin-y':-14, 'text-rotation':'none', 'text-background-color':'#fff', 'text-background-opacity':1, 'line-color':'#888', 'target-arrow-color':'#888' } }
    ]});

    // crear nodos/edges
    PDA.Q.forEach(q => {
      try{ cy.add({ data: { id: q, label: q } }); }catch(e){ console.warn('cy.add node failed for', q, e); }
    });
    PDA.F.forEach(f => { try{ const n = cy.getElementById(f); if(n) n.addClass('final'); }catch(e){} });
    const sId = '__start_'+Math.random().toString(36).slice(2,6);
    try{
      cy.add({ data: { id: sId, label: '' } });
      cy.add({ data: { id: 'e_'+sId+'_'+PDA.q0, source: sId, target: PDA.q0, label: '' } });
    }catch(e){ console.warn('start edge add failed', e); }

    Object.entries(PDA.delta).forEach(([k, acts])=>{
      const parts = k.split(',');
      const q = parts[0] || '';
      const sym = parts[1] || '';
      const top = parts[2] || '';
      acts.forEach((a,i)=>{
        try{
          const lbl = `${sym};${top}→${(a.push&&a.push.length)?a.push.join(''):'ε'}`;
          const id = 'edge_'+q+'_'+a.to+'_'+i+'_'+Math.random().toString(36).slice(2,5);
          cy.add({ data: { id: id, source: q, target: a.to, label: lbl } });
        }catch(e){ console.warn('edge add failed', e, k, a); }
      });
    });

    if(cy.layout){ try{ cy.layout({ name: 'dagre', rankDir: 'LR', nodeSep: 80, rankSep: 100 }).run(); }catch(e){ console.warn('layout failure', e); } }
  }catch(err){
    console.error('createGraph error', err);
    const box = document.getElementById('errorBox'); if(box){ box.style.display='block'; box.textContent = 'Error creando grafo: ' + (err.message||err.toString()); }
  }
}

// --- Simulación ---
let sim = { stack: [], state: null, pos: 0, w: '', stepCount: 0, playing: false, interval: null };
function pushSymbols(arr){ if(!arr || !arr.length) return; for(let i=arr.length-1;i>=0;i--){ const s=arr[i]; if(s !== 'ε') sim.stack.push(s); } }
function popSymbol(){ if(sim.stack.length) return sim.stack.pop(); return null; }

function fillDeltaTable(){
  const tbody = document.querySelector('#deltaTable tbody');
  if(!tbody) return;
  tbody.innerHTML='';
  Object.entries(PDA.delta).forEach(([key,acts])=>{
    const parts = key.split(',');
    const q = parts[0] || '';
    const sym = parts[1] || '';
    const top = parts[2] || '';
    acts.forEach(a=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${escapeHtml(q)}</td><td>${escapeHtml(sym)}</td><td>${escapeHtml(top)}</td><td>${a.pop? 'pop' : ''} ${a.push && a.push.length ? 'push ' + a.push.join('') : ''}</td><td>${escapeHtml(a.to)}</td>`;
      tbody.appendChild(tr);
    });
  });
}

function escapeHtml(s){ if(!s && s!==0) return ''; return String(s).replace(/[&<>\"']/g, function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

function appendID(action){
  const tbody = document.querySelector('#execTable tbody'); if(!tbody) return;
  const tr = document.createElement('tr');
  tr.innerHTML = `<td>${++sim.stepCount}</td><td>(${escapeHtml(sim.state||'—')}, ${escapeHtml(sim.w.slice(sim.pos))}, ${escapeHtml(sim.stack.slice().reverse().join(''))})</td><td>${escapeHtml(action)}</td>`;
  tbody.appendChild(tr);
}

function prepare(){
  const w = (document.getElementById('inputStr').value || '').trim();
  sim.w = w; sim.pos = 0; sim.state = PDA.q0; sim.stack = [PDA.Z0]; sim.stepCount = 0; sim.playing=false;
  const execT = document.querySelector('#execTable tbody'); if(execT) execT.innerHTML = '';
  fillDeltaTable(); createGraph(); appendID('Inicial');
}

function stepPDA(){
  try{
    const cur = sim.pos < sim.w.length ? sim.w[sim.pos] : 'ε';
    const top = sim.stack.length ? sim.stack[sim.stack.length -1] : PDA.Z0;
    const key1 = `${sim.state},${cur},${top}`;
    const key2 = `${sim.state},ε,${top}`;
    const acts = PDA.delta[key1] || PDA.delta[key2] || [];
    if(!acts.length){
      appendID('Sin transición -> Rechazo parcial');
      stopPlaying();
      return;
    }
    const a = acts[0];
    if(a.pop) popSymbol();
    if(Array.isArray(a.push) && a.push.length) pushSymbols(a.push);
    if(cur !== 'ε' && (a.consume !== false)) sim.pos++;
    const prev = sim.state;
    sim.state = a.to;
    appendID(`${prev},${cur},${top} → ${sim.state}`);
    if(PDA.F.includes(sim.state) && sim.pos >= sim.w.length){
      appendID('✅ Cadena aceptada');
      stopPlaying();
    }
  }catch(err){
    const box = document.getElementById('errorBox'); if(box){ box.style.display='block'; box.textContent = 'Error en stepPDA: ' + (err.message||err.toString()); }
    console.error('stepPDA caught', err);
    stopPlaying();
  }
}

function play(){ if(sim.playing) return; sim.playing = true; sim.interval = setInterval(()=>{ stepPDA(); }, 600); }
function stopPlaying(){ if(sim.interval) clearInterval(sim.interval); sim.playing=false; sim.interval=null; }
function resetAll(){ stopPlaying(); const et = document.querySelector('#execTable tbody'); if(et) et.innerHTML=''; const dt = document.querySelector('#deltaTable tbody'); if(dt) dt.innerHTML=''; sim = { stack: [], state: null, pos: 0, w: '', stepCount:0, playing:false, interval:null }; if(cy){ try{ cy.destroy(); }catch(e){} cy=null; } }

function showDerivation(){
  const d = `S ⇒ T1U ⇒ 0A1U ⇒ 0 1 2 0 ... (esquemático)`;
  try{ document.getElementById('derivation').textContent = `Ejemplo (esquemático):\n${d}`; }catch(err){ console.error('derivation render', err); }
}

// --- Pruebas automáticas rápidas ---
function runTestSync(input){
  document.getElementById('inputStr').value = input;
  prepare();
  let max = 1000;
  while(max-- > 0){
    if(PDA.F.includes(sim.state) && sim.pos >= sim.w.length) return { input, result: 'ACCEPT', steps: sim.stepCount };
    const cur = sim.pos < sim.w.length ? sim.w[sim.pos] : 'ε';
    const top = sim.stack.length ? sim.stack[sim.stack.length -1] : PDA.Z0;
    const key1 = `${sim.state},${cur},${top}`;
    const key2 = `${sim.state},ε,${top}`;
    const acts = PDA.delta[key1] || PDA.delta[key2] || [];
    if(!acts.length) return { input, result: 'REJECT_PARTIAL', steps: sim.stepCount };
    stepPDA();
  }
  return { input, result: 'TIMEOUT', steps: sim.stepCount };
}

function runAllTests(){
  const tests = ['00112200','1001112200','111001122000','1012200','11011220','0',''];
  const out = [];
  tests.forEach(t=>{ try{ out.push(runTestSync(t)); }catch(e){ out.push({input:t, result:'ERROR', err:e.toString()}); } });
  const el = document.getElementById('testResults');
  if(el) el.innerHTML = '<strong>Resultados:</strong><br>' + out.map(r=>`<div>${r.input} → ${r.result} (steps: ${r.steps || '-'})${r.err? ' — '+r.err : ''}</div>`).join('');
}

// inicialización protegida
safe(function init(){ renderSeven(); renderGrammar(); try{ createGraph(); }catch(e){ console.warn('createGraph on init failed', e); } fillDeltaTable(); showDerivation(); })();

// eventos UI (envolver en safe)
document.getElementById('btnPrepare').addEventListener('click', safe(()=>{ prepare(); }));
document.getElementById('btnStep').addEventListener('click', safe(()=>{ stepPDA(); }));
document.getElementById('btnPlay').addEventListener('click', safe(()=>{ play(); }));
document.getElementById('btnPause').addEventListener('click', safe(()=>{ stopPlaying(); }));
document.getElementById('btnReset').addEventListener('click', safe(()=>{ resetAll(); renderSeven(); renderGrammar(); try{ createGraph(); }catch(e){} fillDeltaTable(); }));

document.getElementById('ex1').addEventListener('click', safe(()=>{ document.getElementById('inputStr').value='00112200'; }));
document.getElementById('ex2').addEventListener('click', safe(()=>{ document.getElementById('inputStr').value='1001112200'; }));
document.getElementById('ex3').addEventListener('click', safe(()=>{ document.getElementById('inputStr').value='111001122000'; }));

document.getElementById('runTests').addEventListener('click', safe(()=>{ runAllTests(); }));