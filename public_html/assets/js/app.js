/* =====================  CONFIG  ===================== */
const TXT = 'api/data.php';
const LOG_URL = 'api/logger.php';
const SOLICITUD_URL = 'api/solicitudes.php';
const WHATSAPP_GROUP_URL = 'https://chat.whatsapp.com/tu-invite'; // ← pon aquí tu link real


/* =====================  UTILES  ===================== */
const CLP  = new Intl.NumberFormat('es-CL',{style:'currency',currency:'CLP',maximumFractionDigits:0});
const DTCL = new Intl.DateTimeFormat('es-CL',{timeZone:'America/Santiago',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'});

const stripBOM = s => String(s||'').replace(/^\uFEFF/,'');
const normKey  = s => String(s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');

function detectarDelimitador(t){
  const cand=['|','\t',','];
  const n=cand.map(d=>t.split(d).length-1);
  return cand[n.indexOf(Math.max(...n))]||'|';
}
function splitCSV(line,delim){
  if(delim!==',') return line.split(delim).map(s=>s.trim());
  const out=[]; let cur=''; let q=false;
  for(let i=0;i<line.length;i++){
    const ch=line[i];
    if(ch==='"'){ if(q && line[i+1]==='"'){cur+='"'; i++; continue;} q=!q; continue; }
    if(ch===',' && !q){ out.push(cur.trim()); cur=''; } else { cur+=ch; }
  }
  out.push(cur.trim()); return out;
}
const toNum=v=>{
  if(v==null) return null;
  const n=Number(String(v).replace(/\./g,'').replace(/,/g,'').replace(/\s/g,'').replace(/\$/g,'').replace(/CLP/gi,''));
  return Number.isFinite(n)?n:null;
};

function parseFecha(v){
  if(!v) return null;
  let s=String(v).trim();
  s=s.replace(/\(Chile\)/i,'').replace(/\s+/g,' ').trim();
  s=s.replace(/a\.\s*m\./ig,'AM').replace(/p\.\s*m\./ig,'PM');

  // parse directo
  let d=new Date(s); if(Number.isFinite(d.getTime())) return d;

  // YYYY-MM-DD HH:mm (AM/PM opcional)
  let m=s.match(/^(\d{4})[-\/](\d{2})[-\/](\d{2})\s+(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if(m){ let[_,Y,M,D,h,mm,ap]=m; h=+h; if(ap){ap=ap.toUpperCase(); if(ap==='PM'&&h<12)h+=12; if(ap==='AM'&&h===12)h=0;} return new Date(+Y,+M-1,+D,h,+mm); }

  // DD-MM-YYYY HH:mm (AM/PM opcional)
  m=s.match(/^(\d{2})[-\/](\d{2})[-\/](\d{4})\s+(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if(m){ let[_,D,M,Y,h,mm,ap]=m; h=+h; if(ap){ap=ap.toUpperCase(); if(ap==='PM'&&h<12)h+=12; if(ap==='AM'&&h===12)h=0;} return new Date(+Y,+M-1,+D,h,+mm); }

  return null;
}
const fmtFecha=d=>{try{return DTCL.format(d).replace(',','');}catch{return d.toLocaleString();}};

function getImageSrc(r){
  if (r.ImagenURL) return r.ImagenURL;
  if (r.SetID && r.Numero) {
    const num=String(r.Numero).split('/')[0].trim();
    return `https://images.pokemontcg.io/${r.SetID}/${num}.png`;
  }
  return '';
}
function mapLang(lang){
  const s=String(lang||'').trim().toLowerCase();
  const m={es:'es', español:'es', espanol:'es', en:'us', ingles:'us', inglés:'us', english:'us', uk:'gb', gb:'gb', pt:'pt', br:'br', fr:'fr', it:'it', de:'de', jp:'jp', ja:'jp', kr:'kr', ko:'kr', zh:'cn', cn:'cn'};
  return m[s]||null;
}
function flagHTML(lang){
  const cc=mapLang(lang); if(!cc) return '';
  return `<img src="https://flagcdn.com/w20/${cc}.png" alt="${String(lang).toUpperCase()}" width="20" height="14" loading="lazy">`;
}

function quickMeta(){
  const ua = navigator.userAgent || '';
  const device = /Mobi|Android|iPhone|iPad|iPod/i.test(ua) ? 'Mobile' : 'Desktop';
  const viewport = window.innerWidth + 'x' + window.innerHeight;
  return { device, viewport };
}

/* =====================  PARSER TXT ROBUSTO  ===================== */
function parseTexto(txt){
  const raw = String(txt||'');
  if(!raw.trim()) return [];

  const T = stripBOM(raw).replace(/\r/g,'');
  const lines = T.split('\n').filter(l => l.trim() && !l.trim().startsWith('#'));
  if (!lines.length) return [];

  let delim = detectarDelimitador(lines[0]);
  if (!/[|\t,]/.test(lines[0])) delim='|';
  const split = (line)=> splitCSV(line, delim);

  const headers = split(lines[0]).map(h=>h.trim());
  const norm = (s)=>normKey(s);
  const hmap={}; headers.forEach(h=>hmap[norm(h)]=h);
  const pick=(obj,arr,def='')=>{for(const k of arr){const nk=norm(k);if(hmap[nk]!=null)return (obj[hmap[nk]]??'').trim();}return def;};

  const rows=[];
  for(let i=1;i<lines.length;i++){
    if(!lines[i].trim()) continue;
    let cols=split(lines[i]);

    // Si hay 1 columna extra (ej. pusiste "80|132" en Numero), intenta sanear:
    if (cols.length === headers.length+1) {
      const idxNum = headers.findIndex(h=>norm(h)==='numero');
      if (idxNum>=0 && /^\d+$/.test(cols[idxNum]) && /^\d+$/.test(cols[idxNum+1])) {
        cols[idxNum] = cols[idxNum] + '/' + cols[idxNum+1];
        cols.splice(idxNum+1,1);
      }
    }
    // Si aun así sobran columnas: junta el overflow en la última
    if (cols.length > headers.length) {
      cols = cols.slice(0, headers.length-1).concat([cols.slice(headers.length-1).join(' ')]);
    }

    const row={}; headers.forEach((h,idx)=>row[h]=(cols[idx]??'').trim());
    const cierreDate = parseFecha(pick(row,['Cierre','Fecha Cierre','Fin']));

    rows.push({
      Carta:      pick(row,['Carta','Card']),
      Set:        pick(row,['Set','Coleccion','Colección']),
      Condicion:  pick(row,['Condicion','Condición','Estado']),
      BIN:        toNum(pick(row,['BIN','BuyNow','ComprarAhora'])),
      Piso:       toNum(pick(row,['Piso','Salida','PrecioSalida'])),
      Incremento: toNum(pick(row,['Incremento','Paso'])),
      UltimaPuja: toNum(pick(row,['Ultima Puja','Última Puja','UltimaPuja','Ultima_Puja','LastBid'])),
      Cierre:     cierreDate? fmtFecha(cierreDate)+' (Chile)' : '',
      CierreTS:   cierreDate? cierreDate.getTime() : 0,
      Pujar:      pick(row,['Pujar','URL','Link','Facebook','FB']),
      ImagenURL:  pick(row,['ImagenURL','Imagen','Img']),
      SetID:      pick(row,['SetID','Set Code','Set_Id','Set-Id']),
      Numero:     pick(row,['Numero','Number','#']),
      Idioma:     pick(row,['Idioma','Language','Lang']),
      Codigo:     pick(row,['Codigo','Código','CodigoSubasta','ID'])
    });
  }
  // log útil
  console.log(`[parseTexto] headers: ${headers.join(' | ')}`);
  console.log(`[parseTexto] filas: ${rows.length}`);
  return rows;
}

/* =====================  RENDER  ===================== */
let DATA=[];

function closedFigureHTML(r){
  const src = getImageSrc(r);
  const ultimaTxt = Number.isFinite(r.UltimaPuja) ? CLP.format(r.UltimaPuja) : '—';
  const img = src
    ? `<img class="thumb" loading="lazy" decoding="async" src="${src}" alt="${r.Carta}"
         onerror="if(!this.dataset.fbk){this.dataset.fbk=1; this.src=this.src.endsWith('_hires.png')? this.src.replace('_hires.png','.png') : this.src.replace('.png','_hires.png');}">`
    : `<div class="placeholder">IMG</div>`;
  return `<div class="closed-figure">${img}<div class="tag-closed">Cerrado</div><div class="tag-bid-center"><span class="val">${ultimaTxt}</span></div></div>`;
}
// ---- LOGGING ----
function sendLog(payload){
  try{
    const body = JSON.stringify(payload);
    let sent = false;
    if (navigator.sendBeacon) {
      try { sent = !!navigator.sendBeacon(LOG_URL, new Blob([body], {type:'application/json'})); } catch(_) {}
    }
    if (!sent) {
      fetch(LOG_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body, keepalive:true, cache:'no-store' })
        .catch(()=>{ /* silencioso */ });
    }
  } catch(_) {}
}

// Datos “suaves” del cliente (stub, suficiente para logging)
function collectClientMeta(){
  const ua = navigator.userAgent || '';
  const mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
  const device = mobile ? 'Mobile' : 'Desktop';
  const viewport = window.innerWidth + 'x' + window.innerHeight;
  return { device, viewport };
}

// Log de visita (una vez)
function logVisit(){
  const meta = collectClientMeta();
  sendLog({ type:'visit', path: location.pathname, ref: document.referrer || '', ...meta });
}

// Reenlazar listeners de click cada vez que se re-renderiza
// Delegación global: captura clicks en cualquier <a data-log="1"> aunque se re-renderice
function attachClickLogging(){
  if (attachClickLogging._on) return; // evitar duplicar
  attachClickLogging._on = true;

  document.addEventListener('click', (ev) => {
    const a = ev.target && ev.target.closest && ev.target.closest('a[data-log="1"], .mini-btn[data-log="1"]');
    if (!a) return;

    // Arma el payload rápido (sin esperar Promises)
    const meta = quickMeta();
    const payload = {
      type: 'click',
      codigo: a.getAttribute('data-codigo') || '',
      carta:  a.getAttribute('data-carta')  || '',
      set:    a.getAttribute('data-set')    || '',
      dest:   a.getAttribute('href')        || '',
      path:   location.pathname,
      ...meta
    };

    // Enviar lo antes posible (captura) con beacon + fallback
    try {
      const body = JSON.stringify(payload);
      let sent = false;
      if (navigator.sendBeacon) {
        try { sent = !!navigator.sendBeacon(LOG_URL, new Blob([body], { type: 'application/json' })); } catch(_) {}
      }
      if (!sent) {
        fetch(LOG_URL, { method:'POST', headers:{'Content-Type':'application/json'}, body, keepalive:true, cache:'no-store' })
          .catch(()=>{ /* silencioso */ });
      }
    } catch(_) {}
  }, true); // <-- capture: se ejecuta antes de la navegación
}


function render(){
  const q = (document.getElementById('buscar').value||'').toLowerCase().trim();
  const chkSolo = document.getElementById('solo-activas');
  const chkCerr = document.getElementById('mostrar-cerradas');
  const solo = !!(chkSolo && chkSolo.checked);
  const verCerradas = !!(chkCerr && chkCerr.checked);

  let showActivas, showCerradas;
  if (solo) { showActivas = true; showCerradas = false; }
  else if (verCerradas) { showActivas = false; showCerradas = true; }
  else { showActivas = true; showCerradas = true; }

  const listAct = document.getElementById('lista-activas'); listAct.innerHTML = '';
  const listCer = document.getElementById('lista-cerradas'); listCer.innerHTML = '';
  const titleCer = document.getElementById('cerradas-title');

  const arr = DATA.filter(r=>{
    if(q && !(r.Carta?.toLowerCase().includes(q) || r.Set?.toLowerCase().includes(q))) return false;
    return true;
  });

  const now = Date.now();
  const activas  = arr.filter(r=>r.CierreTS >  now).sort((a,b)=>a.CierreTS-b.CierreTS);
  const cerradas = arr.filter(r=>r.CierreTS <= now).sort((a,b)=>b.CierreTS-a.CierreTS);

  // ACTIVAS
  if (showActivas) {
    if (!activas.length) listAct.innerHTML = '<p class="sub">Sin subastas activas.</p>';
    activas.forEach(r=>{
      const ms=r.CierreTS-Date.now();
      const s=Math.floor(Math.max(ms,0)/1000), d=Math.floor(s/86400), h=Math.floor((s%86400)/3600), m=Math.floor((s%3600)/60), sec=s%60;
      const cd=(d?d+'d ':'')+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');
      const minsLeft = Math.floor(ms/60000);
      const state = minsLeft >= 15 ? 'ok' : (minsLeft >= 5 ? 'warn' : 'urgent');

      const src=getImageSrc(r);
      const flag=flagHTML(r.Idioma);
      const langHTML = r.Idioma ? `<span class="lang-badge">${flag}${flag?'<span style="width:6px"></span>':''}<span>${String(r.Idioma).toUpperCase().slice(0,3)}</span></span>` : '';
      const codeHTML = r.Codigo ? `<span class="code-badge">#${r.Codigo}</span>` : '';
      const openBar  = `<div class="tag-open ${state}" data-deadline="${r.CierreTS}">${cd}</div>`;
      const lastBid  = `<div class="tag-bid-center"><span class="val">${Number.isFinite(r.UltimaPuja)?CLP.format(r.UltimaPuja):'—'}</span></div>`;
      const img = src
        ? `<div class="thumb-wrap"><img class="thumb" loading="lazy" decoding="async" src="${src}" alt="${r.Carta}" onerror="if(!this.dataset.fbk){this.dataset.fbk=1; this.src=this.src.endsWith('_hires.png')? this.src.replace('_hires.png','.png') : this.src.replace('.png','_hires.png');}">${openBar}${lastBid}${langHTML}${codeHTML}</div>`
        : `<div class="thumb-wrap"><div class="placeholder">IMG</div>${openBar}${lastBid}${langHTML}${codeHTML}</div>`;

      const card=document.createElement('div'); card.className='item';
      card.innerHTML = img + `<div>
        <div class="item-head"><div><div class="title">${r.Carta||'—'}</div><div class="sub">${r.Set||'—'} · ${r.Condicion||'—'}</div></div></div>
        <div class="stats">
          <div class="pill"><span class="lbl">BIN</span><span class="val">${Number.isFinite(r.BIN)?CLP.format(r.BIN):'—'}</span></div>
          <div class="pill"><span class="lbl">Piso</span><span class="val">${Number.isFinite(r.Piso)?CLP.format(r.Piso):'—'}</span></div>
          <div class="pill"><span class="lbl">Última Puja</span><span class="val">${Number.isFinite(r.UltimaPuja)?CLP.format(r.UltimaPuja):'—'}</span></div>
        </div>
        <div class="meta">
          <div class="row"><span class="lbl">Incremento</span><span class="val">${Number.isFinite(r.Incremento)?CLP.format(r.Incremento):'—'}</span></div>
          <div class="row"><span class="lbl">Cierre</span><span class="val">${r.Cierre||'—'}</span></div>
        </div>
        <div class="cta">
          ${r.Pujar?`<a class="btn" href="${r.Pujar}" target="_blank" rel="noopener" data-log="1" data-codigo="${r.Codigo||''}" data-carta="${(r.Carta||'').replace(/"/g,'&quot;')}" data-set="${(r.Set||'').replace(/"/g,'&quot;')}">Pujar</a>`:'<span class="sub">(sin enlace de puja)</span>'}
        </div>
      </div>`;
      listAct.appendChild(card);
    });
  }

  // CERRADAS
  if (showCerradas) {
    document.getElementById('cerradas-title').style.display = cerradas.length ? 'block' : 'none';
    cerradas.forEach(r=>{
      const flag = flagHTML(r.Idioma);
      const item = document.createElement('div'); item.className='closed-item';
      item.innerHTML = `
        ${closedFigureHTML(r)}
        <div class="closed-top">
          <span class="closed-code">#${r.Codigo || '—'}</span>
          <span class="lang-chip">${flag || ''}<span>${(r.Idioma || '').toUpperCase().slice(0,3) || '—'}</span></span>
        </div>
        <div class="closed-title">${r.Carta || '—'}</div>
        <div class="closed-row"><span class="lbl">Condición</span><span class="val">${r.Condicion || '—'}</span></div>
        <div class="closed-row"><span class="lbl">Cierre</span><span class="val">${r.Cierre || '—'}</span></div>
        ${r.Pujar?`<a class="mini-btn" href="${r.Pujar}" target="_blank" rel="noopener" data-log="1" data-codigo="${r.Codigo||''}" data-carta="${(r.Carta||'').replace(/"/g,'&quot;')}" data-set="${(r.Set||'').replace(/"/g,'&quot;')}">Ver</a>`:'<span class="sub">(sin enlace)</span>'}
      `;
      listCer.appendChild(item);
    });
  }

  // Estado
  const counts=[];
  if (showActivas)  counts.push(`${activas.length} activas`);
  if (showCerradas) counts.push(`${cerradas.length} cerradas`);
  document.getElementById('status').textContent =
    `Última actualización: ${new Date().toLocaleTimeString('es-CL')} · ${DATA.length} registros (archivo) · ${counts.join(' · ')}`;

  // —— MODO RESCATE: si hay DATA pero no se pintó nada, muestro tabla de depuración ——
  if (DATA.length && !listAct.childElementCount && !listCer.childElementCount) {
    const pre = document.createElement('pre');
    pre.style.whiteSpace='pre-wrap';
    pre.style.marginTop='10px';
    pre.style.background='#0d141b';
    pre.style.border='1px dashed #1f2937';
    pre.style.padding='10px';
    pre.textContent = '[DEBUG] No se pintó ninguna tarjeta.\n' +
      'Primeras filas parseadas:\n' +
      JSON.stringify(DATA.slice(0,3), null, 2);
    listAct.appendChild(pre);
  }
}

attachClickLogging();

/* =====================  LOOP TIEMPO  ===================== */
setInterval(()=>{
  const now = Date.now();
  document.querySelectorAll('.tag-open').forEach(el=>{
    const dl = Number(el.getAttribute('data-deadline')||0);
    const ms = dl - now;
    const s=Math.floor(Math.max(ms,0)/1000), d=Math.floor(s/86400), h=Math.floor((s%86400)/3600), m=Math.floor((s%3600)/60), sec=s%60;
    const txt = (ms<=0) ? 'Cerrada' : (d?d+'d ':'')+String(h).padStart(2,'0')+':'+String(m).padStart(2,'0')+':'+String(sec).padStart(2,'0');
    el.textContent = txt;
    const minsLeft = Math.floor(ms/60000);
    el.className = 'tag-open ' + (ms<=0 ? 'urgent' : (minsLeft>=15?'ok':(minsLeft>=5?'warn':'urgent')));
  });
}, 1000);

/* =====================  CARGA DATOS + UI  ===================== */
async function loadTXT(){
  const statusEl=document.getElementById('status');
  try{
    const res=await fetch(TXT+'?ts='+Date.now(),{cache:'no-store'});
    if(!res.ok) throw new Error('HTTP '+res.status);
    const text=await res.text();
    DATA=parseTexto(text);
    statusEl.textContent = `Última actualización: ${new Date().toLocaleTimeString('es-CL')} · ${DATA.length} registros (archivo)`;
    render();
  }catch(e){
    statusEl.textContent='No se pudo leer datos. Verifica api/data.php y subastas.txt.';
    console.error(e);
  }
}
document.getElementById('btn-refresh')?.addEventListener('click', loadTXT);
document.getElementById('buscar')?.addEventListener('input', render);
const chkSolo=document.getElementById('solo-activas'); const chkCerr=document.getElementById('mostrar-cerradas');
chkSolo?.addEventListener('change',()=>{ if(chkSolo.checked) chkCerr.checked=false; render(); });
chkCerr?.addEventListener('change',()=>{ if(chkCerr.checked) chkSolo.checked=false; render(); });

/* Modal (igual que antes, reducido) */
const overlay = document.getElementById('modal-overlay');
const btnAbrir = document.getElementById('btn-solicitar');
const btnCerrar = document.querySelector('.modal-close');
const btnCancelar = document.getElementById('btn-cancelar');
const form = document.getElementById('form-solicitud');
const btnEnviar = document.getElementById('btn-enviar-solicitud');
const formMsg = document.getElementById('form-msg');
function openModal(){ if(!overlay) return; overlay.classList.add('show'); overlay.setAttribute('aria-hidden','false'); document.body.style.overflow='hidden'; }
function closeModal(){ if(!overlay) return; overlay.classList.remove('show'); overlay.setAttribute('aria-hidden','true'); document.body.style.overflow=''; if(formMsg) formMsg.textContent=''; }
btnAbrir?.addEventListener('click', openModal); btnCerrar?.addEventListener('click', closeModal); btnCancelar?.addEventListener('click', closeModal);
overlay?.addEventListener('click', e=>{ if(e.target===overlay) closeModal(); });
form?.addEventListener('submit', async (e)=>{
  e.preventDefault();

  const payload = {
    nombre:   form.nombre.value.trim(),
    pais:     form.pais.value.trim(),
    ciudad:   form.ciudad.value.trim(),
    telefono: form.telefono.value.trim(),
    carta:    form.carta.value.trim()
  };

  if (Object.values(payload).some(v => !v)) {
    if (formMsg) formMsg.textContent = 'Completa todos los campos, por favor.';
    return;
  }

  if (formMsg) formMsg.textContent = 'Enviando…';
  const btn = document.getElementById('btn-enviar-solicitud');
  if (btn) btn.disabled = true;

  // 1) Pre-abrir pestaña (evita bloqueadores)
  let waWin = null;
  try { waWin = window.open('about:blank', '_blank', 'noopener'); } catch(_) {}

  try {
    // 2) Enviar al backend
    const res = await fetch(SOLICITUD_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const out = await res.json().catch(() => ({ ok:false }));

    if (res.ok && out.ok) {
      // log opcional
      try {
        if (typeof sendLog === 'function' && typeof quickMeta === 'function') {
          sendLog({
            type:'social', platform:'whatsapp',
            dest: WHATSAPP_GROUP_URL, path: location.pathname, ...quickMeta()
          });
        }
      } catch(_){}

      // 3) Redirigir la pestaña pre-abierta al grupo
      if (waWin && !waWin.closed) { waWin.location.href = WHATSAPP_GROUP_URL; }
      else { window.open(WHATSAPP_GROUP_URL, '_blank', 'noopener'); }

      // limpiar y cerrar modal sin salir de la página
      form.reset();
      if (typeof closeModal === 'function') closeModal();
      if (formMsg) formMsg.textContent = '¡Listo! Se abrió el grupo en otra pestaña.';
      return;
    }
    throw new Error('fail');
  } catch (err) {
    if (formMsg) formMsg.textContent = 'No se pudo enviar. Intenta nuevamente.';
    if (waWin && !waWin.closed) waWin.close(); // si falló, cerramos la pestaña en blanco
  } finally {
    if (btn) btn.disabled = false;
  }
});



/* Social logging */
function sendLog(payload){
  try{
    const body = JSON.stringify(payload);
    let sent=false;
    if(navigator.sendBeacon){ try{sent=!!navigator.sendBeacon(LOG_URL,new Blob([body],{type:'application/json'}));}catch(_){}} 
    if(!sent){ fetch(LOG_URL,{method:'POST',headers:{'Content-Type':'application/json'},body,keepalive:true}).catch(()=>{}); }
  }catch(_){}
}
function collectClientMeta(){ return Promise.resolve({}); }
function attachSocialLogging(){
  document.querySelectorAll('[data-log-social="1"]').forEach(a=>{
    a.addEventListener('click', ()=> sendLog({type:'social', platform:a.getAttribute('data-social')||'', dest:a.href||'', path:location.pathname}), {passive:true});
  });
}
attachSocialLogging();

/* Exponer para depurar + arrancar */
try{ window.parseTexto=parseTexto; window.render=render; window.loadTXT=loadTXT; window.DATA=DATA; }catch(_){}
attachClickLogging();
loadTXT();
window.addEventListener('load', logVisit, { once:true });