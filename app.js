
const CAT={
  edu:{label:'Educație',cls:'t-edu',color:'#2c6e8f',bg:'#e2edf3'},
  env:{label:'Mediu',cls:'t-env',color:'#3c5a40',bg:'#e4ebdf'},
  soc:{label:'Social',cls:'t-soc',color:'#7a5230',bg:'#efe5d6'},
  civ:{label:'Drepturi civice',cls:'t-civ',color:'#9d4632',bg:'#f2e4dc'}
};
const ROLE={ong:['ONG','#2c6e8f','#e2edf3'],pol:['policymaker','#3c5a40','#e4ebdf'],vol:['voluntar','#7a5230','#efe5d6'],youth:['tânăr','#9d4632','#f2e4dc']};
const CTYPE={
  partner:{l:'Caut parteneri',cls:'ct-partner',i:'ti-puzzle'},
  vol:{l:'Caut voluntari',cls:'ct-vol',i:'ti-users'},
  offer:{l:'Ofer ajutor',cls:'ct-offer',i:'ti-gift'},
  fund:{l:'Caut finanțare',cls:'ct-fund',i:'ti-coin'}
};

const NGOS=[];

const EVENTS=[];

const COLLABS=[];

const PEOPLE=[];

const FTYPE={eu:['Europeană','f-eu'],local:['Local / național','f-local'],privat:['Privat','f-privat'],premiu:['Premiu','f-premiu']};
const FUND=[];

const ngoById=id=>NGOS.find(n=>n.id===id);

/* persistent state — Supabase */
const store={reg:[],savedF:[],likes:[],follows:[],myPosts:[],myCmts:{},notifs:[],nseen:0};
const isReg=id=>store.reg.includes(id);
const isSavedF=id=>store.savedF.includes(id);
async function requireAuth(){
  const {data}=await supabaseClient.auth.getSession();
  if(!data.session){ alert('Trebuie să fii autentificat pentru această acțiune.'); return null; }
  return data.session.user;
}
async function registerEvent(id){const user=await requireAuth();if(!user)return; const name=(document.getElementById('reg-name')?.value||'').trim(); const email=(document.getElementById('reg-email')?.value||user.email||'').trim(); const {error}=await supabaseClient.from('event_registrations').upsert({event_id:id,user_id:user.id,status:'registered',full_name:name||null,email:email||null},{onConflict:'event_id,user_id'});if(error) return alert(error.message); await loadUserState(); refresh();}
async function unregisterEvent(id){const user=await requireAuth();if(!user)return; const {error}=await supabaseClient.from('event_registrations').delete().eq('event_id',id).eq('user_id',user.id);if(error)return alert(error.message);await loadUserState();refresh();}
async function saveF(id){const user=await requireAuth();if(!user)return; const {error}=await supabaseClient.from('saved_funding').upsert({funding_id:id,user_id:user.id},{onConflict:'user_id,funding_id'});if(error)return alert(error.message);await loadUserState();refresh();}
async function toggleSavedF(id){const user=await requireAuth();if(!user)return;if(isSavedF(id)){await supabaseClient.from('saved_funding').delete().eq('funding_id',id).eq('user_id',user.id);}else{await supabaseClient.from('saved_funding').upsert({funding_id:id,user_id:user.id},{onConflict:'user_id,funding_id'});}await loadUserState();refresh();}
async function refresh(){if(current==='events')renderEvents();if(current==='home')renderHome();if(current==='funding')renderFunding();if(current==='feed')renderFeed();}

/* RESOURCES */
const RTYPE={ghid:['Ghid','f-eu','ti-book'],sablon:['Șablon','f-local','ti-file-text'],webinar:['Webinar','f-premiu','ti-player-play'],date:['Set de date','f-privat','ti-database']};
const RES=[];
let resFilter='all';
const RES_FILTERS=[['all','Toate'],['ghid','Ghiduri'],['sablon','Șabloane'],['webinar','Webinarii'],['date','Date deschise']];
function setResFilter(k){resFilter=k;renderResources();}
function renderResources(){
  const q=(document.getElementById('q').value||'').toLowerCase();
  const items=RES.filter(r=>{if(q&&!(r.title+r.desc).toLowerCase().includes(q))return false;return resFilter==='all'||r.type===resFilter;});
  const chips=RES_FILTERS.map(([k,l])=>`<button class="chip ${resFilter===k?'on':''}" onclick="setResFilter('${k}')">${l}</button>`).join('');
  const cards=items.length?items.map(r=>{const t=RTYPE[r.type],c=CAT[r.cat];
    return `<div class="fund"><div class="ftop"><span class="ftag ${t[1]}"><i class="ti ${t[2]}" style="font-size:12px"></i> ${t[0]}</span><span class="tag ${c.cls}" style="margin-left:auto">${c.label}</span></div>
      <h3>${r.title}</h3><div class="ffunder">${r.fmt}</div>
      <p class="fdesc">${r.desc}</p>
      <div class="ffoot"><button class="btn primary" style="flex:1;justify-content:center" onclick="done('Resursă deschisă','Am deschis <b>${r.title.replace(/'/g,'’')}</b>. Într-o versiune reală, fișierul s-ar descărca sau s-ar deschide aici.')"><i class="ti ti-download"></i> Deschide</button></div></div>`;}).join(''):'<div class="empty">Nicio resursă găsită.</div>';
  document.getElementById('view-resources').innerHTML=`<div class="filters">${chips}</div><div class="fund-grid">${cards}</div>`;
}

/* ===== SOCIAL: FEED, FOLLOWS, NOTIFICATIONS ===== */
const esc=s=>s.replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const PTYPE={update:['Actualizare','t-edu'],anunt:['Anunț','t-on'],intrebare:['Întrebare','t-soc'],consult:['Consultare publică','t-civ'],realizare:['Reușită','t-env']};

const POSTS=[];

const NOTIFS=[];
const NC={info:['var(--info-bg)','var(--info)'],teal:['var(--teal-bg)','var(--teal)'],coral:['var(--coral-bg)','var(--coral)'],purple:['var(--purple-bg)','var(--purple)'],amber:['var(--amber-bg)','var(--amber)']};

/* follows */
const fkey=a=>a.k+':'+a.id;
const isFollowed=k=>store.follows.includes(k);
async function toggleFollow(k,name){
  const user=await requireAuth();if(!user)return;
  const parts=k.split(':');
  const query=supabaseClient.from('follows').delete().eq('user_id',user.id);
  if(isFollowed(k)){
    if(parts[0]==='n') await query.eq('ngo_id',parts.slice(1).join(':'));
    else await query.eq('person_id',parts.slice(1).join(':'));
  }else{
    await supabaseClient.from('follows').insert(parts[0]==='n'?{user_id:user.id,ngo_id:parts.slice(1).join(':')}:{user_id:user.id,person_id:parts.slice(1).join(':')});
  }
  await loadUserState();
  if(current==='feed')renderFeed();
  if(current==='ngo'&&k.startsWith('n:'))openNgo(k.slice(2));
  if(current==='person'&&k.startsWith('p:'))openPerson(k.slice(2));
}

/* notifications */
function allNotifs(){return store.notifs.concat(NOTIFS);}
function addNotif(icon,color,html){store.notifs.unshift({i:icon,c:color,text:html,time:'acum'});updateBell();}
function updateBell(){const un=allNotifs().length-store.nseen;document.getElementById('ndot').style.display=un>0?'block':'none';}
function renderNotifs(){
  const items=allNotifs().map(x=>{const c=NC[x.c]||NC.info;
    return `<div class="nitem"><div class="ni" style="background:${c[0]};color:${c[1]}"><i class="ti ${x.i}"></i></div><div><div>${x.text}</div><div class="nt">${x.time}</div></div></div>`;}).join('');
  document.getElementById('notif-panel').innerHTML=`<div class="nh">Notificări</div>${items}`;
}
function toggleNotifs(ev){
  ev.stopPropagation();
  const p=document.getElementById('notif-panel');
  const open=p.classList.toggle('open');
  if(open){renderNotifs();store.nseen=allNotifs().length;updateBell();}
}
document.addEventListener('click',e=>{
  const p=document.getElementById('notif-panel');
  if(p.classList.contains('open')&&!p.contains(e.target)&&!e.target.closest('#bell'))p.classList.remove('open');
});

/* feed */
let feedFilter='all';const openCmts=new Set();
const FEED_FILTERS=[['all','Toate'],['following','Urmăresc'],['consult','Consultări publice'],['ong','ONG-uri'],['pol','Policymakeri'],['vol','Voluntari & tineri']];
function setFeedFilter(k){feedFilter=k;renderFeed();}
const allPosts=()=>store.myPosts.concat(POSTS);
function postAuthor(a){
  if(a.k==='me')return{n:'Paul Grosu',i:'PG',sub:'voluntar · Suceava',bg:ROLE.vol[2],col:ROLE.vol[1],role:ROLE.vol[0],tag:'vol',click:''};
  if(a.k==='p'){const p=PEOPLE.find(x=>x.id===a.id),ng=ngoById(p.ngo),r=ROLE[p.tag];
    return{n:p.n,i:p.i,sub:`${p.role} · ${ng.name}`,bg:r[2],col:r[1],role:r[0],tag:p.tag,click:`openPerson('${p.id}')`};}
  const n=ngoById(a.id),c=CAT[n.cat];
  return{n:n.name,i:n.oi,sub:`organizație · ${n.city}`,bg:c.bg,col:c.color,role:'ONG',tag:'ong',click:`openNgo('${n.id}')`};
}
function attachCard(at){
  if(!at)return'';
  if(at.k==='ev'){const e=EVENTS.find(x=>x.id===at.id);if(!e)return'';const c=CAT[e.cat];
    return `<div class="attach" onclick="openReg(${e.id})"><div class="ai" style="background:${c.bg};color:${c.color}"><i class="ti ti-calendar-event"></i></div><div class="ab"><h3>${e.title}</h3><div class="as">${e.d} ${e.m} · ${e.venue}, ${e.city} · ${e.cap-e.spots} locuri libere</div></div><i class="ti ti-chevron-right chev2"></i></div>`;}
  if(at.k==='col'){const x=COLLABS.find(c=>c.id===at.id);if(!x)return'';const t=CTYPE[x.type],c=CAT[x.cat];
    return `<div class="attach" onclick="openRespond(${x.id})"><div class="ai" style="background:${c.bg};color:${c.color}"><i class="ti ${t.i}"></i></div><div class="ab"><h3>${x.title}</h3><div class="as">${t.l} · ${x.loc} · termen ${x.deadline}</div></div><i class="ti ti-chevron-right chev2"></i></div>`;}
  if(at.k==='fund'){const f=FUND.find(x=>x.id===at.id);if(!f)return'';
    return `<div class="attach" onclick="openFund(${f.id})"><div class="ai" style="background:var(--amber-bg);color:var(--amber)"><i class="ti ti-coin"></i></div><div class="ab"><h3>${f.title}</h3><div class="as">${f.funder} · ${f.amount} · termen ${f.deadline}</div></div><i class="ti ti-chevron-right chev2"></i></div>`;}
  return'';
}
function postCard(p){
  const au=postAuthor(p.a),ty=PTYPE[p.type]||PTYPE.update;
  const liked=store.likes.includes(p.id);
  const myC=(store.myCmts[p.id]||[]).map(c=>({n:'Paul Grosu',i:'PG',tag:'vol',time:c.time,text:c.text,raw:true}));
  const cmts=(p.cmts||[]).concat(myC);
  const likeN=p.likes+(liked?1:0);
  let headBtn='';
  if(p.a.k==='me')headBtn=`<button class="followb on" title="Șterge postarea" onclick="delPost('${p.id}')"><i class="ti ti-trash" style="font-size:15px"></i></button>`;
  else{const fk=fkey(p.a);
    headBtn=isFollowed(fk)?`<button class="followb on" onclick="toggleFollow('${fk}','${au.n}')"><i class="ti ti-check" style="font-size:13px"></i> Urmărit</button>`
      :`<button class="followb" onclick="toggleFollow('${fk}','${au.n}')">+ Urmărește</button>`;}
  const cHtml=openCmts.has(p.id)?`<div class="comments">${cmts.map(c=>{const r=ROLE[c.tag];
      return `<div class="cmt"><div class="pav" style="background:${r[2]};color:${r[1]}">${c.i}</div><div class="bubble"><b>${c.n}</b><span class="rb2" style="background:${r[2]};color:${r[1]}">${r[0]}</span><span class="ct">${c.time}</span><div>${c.raw?esc(c.text):c.text}</div></div></div>`;}).join('')}
    <div class="cmt-in"><div class="pav" style="background:var(--coral-bg);color:var(--coral);width:30px;height:30px;font-size:11px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:600;flex-shrink:0">PG</div><input id="cin-${p.id}" placeholder="Scrie un comentariu…" onkeydown="if(event.key==='Enter')addCmt('${p.id}')"><button class="btn primary sm" onclick="addCmt('${p.id}')" aria-label="Trimite comentariul"><i class="ti ti-send"></i></button></div></div>`:'';
  return `<div class="post ${p.type==='consult'?'consult':''}">
    <div class="phead"><div class="pav" style="background:${au.bg};color:${au.col}" onclick="${au.click}">${au.i}</div>
      <div class="who"><h3 onclick="${au.click}">${au.n}</h3><span class="rb2" style="background:${au.bg};color:${au.col}">${au.role}</span>
        <div class="sub2">${au.sub} · ${p.time}</div></div>${headBtn}</div>
    ${p.type!=='update'?`<div class="tags" style="margin-bottom:8px"><span class="tag ${ty[1]}">${ty[0]}</span></div>`:''}
    <div class="ptext">${p.a.k==='me'?esc(p.text):p.text}</div>
    ${p.type==='consult'?'<div class="consult-note"><i class="ti ti-gavel"></i> Consultare oficială — comentariile intră în sinteza trimisă comisiei.</div>':''}
    ${attachCard(p.attach)}
    <div class="pstats"><span>${likeN} ${likeN===1?'susținere':'susțineri'}</span><span>${cmts.length} ${cmts.length===1?'comentariu':'comentarii'}</span></div>
    <div class="pacts">
      <button class="pact ${liked?'on':''}" onclick="likePost('${p.id}')"><i class="ti ${liked?'ti-heart-filled':'ti-heart'}"></i> Susțin</button>
      <button class="pact ${openCmts.has(p.id)?'on':''}" onclick="toggleCmtsF('${p.id}')"><i class="ti ti-message-circle"></i> Comentează</button>
      <button class="pact" onclick="sharePost('${p.id}')"><i class="ti ti-share-3"></i> Distribuie</button>
    </div>${cHtml}</div>`;
}
function renderFeed(){
  const q=(document.getElementById('q').value||'').toLowerCase();
  document.getElementById('feed-filters').innerHTML=FEED_FILTERS.map(([k,l])=>`<button class="chip ${feedFilter===k?'on':''}" onclick="setFeedFilter('${k}')">${l}</button>`).join('');
  const items=allPosts().filter(p=>{
    const au=postAuthor(p.a);
    if(q&&!(p.text+au.n).toLowerCase().includes(q))return false;
    if(feedFilter==='all')return true;
    if(feedFilter==='following')return p.a.k==='me'||isFollowed(fkey(p.a))||(p.a.k==='p'&&isFollowed('n:'+PEOPLE.find(x=>x.id===p.a.id).ngo));
    if(feedFilter==='consult')return p.type==='consult';
    if(feedFilter==='pol')return au.tag==='pol';
    if(feedFilter==='ong')return au.tag==='ong';
    if(feedFilter==='vol')return au.tag==='vol'||au.tag==='youth';
    return true;});
  const list=items.length?items.map(postCard).join(''):`<div class="empty">${feedFilter==='following'?'Nu urmărești încă pe nimeni. Apasă „Urmărește” pe o organizație sau o persoană și postările lor apar aici.':'Nicio postare nu se potrivește.'}</div>`;
  document.getElementById('feed-list').innerHTML=`<div class="composer" onclick="openComposer()"><div class="avatar">PG</div><div class="fake">La ce lucrezi, Paul? Împărtășește cu comunitatea…</div><i class="ti ti-pencil-plus" style="color:var(--text-3);font-size:20px"></i></div>${list}`;
  document.getElementById('feed-aside').innerHTML=feedAsideHtml();
}
function feedAsideHtml(){
  const suggP=PEOPLE.filter(p=>['p2','p3','p4'].includes(p.id)&&!isFollowed('p:'+p.id)).slice(0,2);
  const suggN=NGOS.filter(n=>!isFollowed('n:'+n.id)).slice(0,2);
  const rows=[
    ...suggP.map(p=>{const r=ROLE[p.tag],ng=ngoById(p.ngo);
      return `<div class="person"><div class="oa" style="width:36px;height:36px;border-radius:50%;background:${r[2]};color:${r[1]};font-size:12px">${p.i}</div><div class="body"><h3 style="cursor:pointer" onclick="openPerson('${p.id}')">${p.n}</h3><div class="role">${r[0]} · ${ng.name}</div></div><button class="btn sm" onclick="toggleFollow('p:${p.id}','${p.n}')">Urmărește</button></div>`;}),
    ...suggN.map(n=>{const c=CAT[n.cat];
      return `<div class="person"><div class="oa" style="width:36px;height:36px;background:${c.bg};color:${c.color};font-size:12px;border-radius:9px">${n.oi}</div><div class="body"><h3 style="cursor:pointer" onclick="openNgo('${n.id}')">${n.name}</h3><div class="role">ONG · ${n.city}</div></div><button class="btn sm" onclick="toggleFollow('n:${n.id}','${n.name}')">Urmărește</button></div>`;})
  ].join('');
  return `<div class="panel"><h4><i class="ti ti-chart-bar"></i> Comunitatea azi</h4>
      <div class="stat"><span>Postări săptămâna asta</span><b>${allPosts().length+13}</b></div>
      <div class="stat"><span>Consultări publice deschise</span><b>${allPosts().filter(p=>p.type==='consult').length}</b></div>
      <div class="stat"><span>Urmărești</span><b>${store.follows.length}</b></div></div>
    <div class="panel"><h4><i class="ti ti-user-plus"></i> Pe cine să urmărești</h4>${rows||'<div style="font-size:13px;color:var(--text-3)">Urmărești deja toate sugestiile. 🎉</div>'}</div>`;
}
async function likePost(id){
  const user=await requireAuth(); if(!user)return;
  const exists=store.likes.includes(String(id));
  if(exists){await supabaseClient.from('post_likes').delete().eq('post_id',id).eq('user_id',user.id);}
  else{await supabaseClient.from('post_likes').insert({post_id:id,user_id:user.id});}
  await loadUserState();renderFeed();
}
function toggleCmtsF(id){if(openCmts.has(id))openCmts.delete(id);else openCmts.add(id);renderFeed();if(openCmts.has(id)){const el=document.getElementById('cin-'+id);if(el)el.focus();}}
function addCmt(id){
  const el=document.getElementById('cin-'+id);if(!el)return;
  const txt=el.value.trim();if(!txt)return;
  (store.myCmts[id]=store.myCmts[id]||[]).push({text:txt,time:'acum'});
  openCmts.add(id);
  const p=allPosts().find(x=>x.id===id);
  if(p&&p.type==='consult')addNotif('ti-gavel','purple','Comentariul tău a fost înregistrat în <b>consultarea publică</b>. Vei primi sinteza finală.');
  renderFeed();
}
function delPost(id){store.myPosts=store.myPosts.filter(p=>p.id!==id);delete store.myCmts[id];renderFeed();}
function sharePost(id){done('Gata de distribuit','Am copiat linkul postării (demo). Îl poți trimite pe WhatsApp, email sau în grupul de voluntari.');openModal();}
function openComposer(){
  const evO=EVENTS.map(e=>`<option value="ev:${e.id}">Eveniment: ${e.title}</option>`).join('');
  const cO=COLLABS.map(c=>`<option value="col:${c.id}">Colaborare: ${c.title}</option>`).join('');
  const fO=FUND.map(f=>`<option value="fund:${f.id}">Finanțare: ${f.title}</option>`).join('');
  document.getElementById('modal-content').innerHTML=`
    <h2>Postare nouă</h2>
    <div class="org" style="margin:6px 0 12px"><div class="avatar" style="width:28px;height:28px;font-size:11px">PG</div> Paul Grosu · postezi ca <b>voluntar</b></div>
    <div class="field"><textarea id="c-text" placeholder="Ce vrei să afle comunitatea? Un update, o întrebare, un anunț…" style="min-height:110px"></textarea></div>
    <div class="field"><label>Tip postare</label><select id="c-type"><option value="update">Actualizare</option><option value="anunt">Anunț</option><option value="intrebare">Întrebare</option><option value="realizare">Reușită</option></select></div>
    <div class="field"><label>Atașează (opțional)</label><select id="c-attach"><option value="">Fără atașament</option><optgroup label="Evenimente">${evO}</optgroup><optgroup label="Colaborări">${cO}</optgroup><optgroup label="Finanțări">${fO}</optgroup></select></div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">Anulează</button><button class="btn primary" onclick="publishPost()"><i class="ti ti-send"></i> Publică</button></div>`;
  openModal();
  document.getElementById('c-text').focus();
}
function publishPost(){
  const el=document.getElementById('c-text');
  const txt=el.value.trim();
  if(!txt){el.focus();return;}
  const type=document.getElementById('c-type').value;
  const atv=document.getElementById('c-attach').value;
  let attach=null;
  if(atv){const parts=atv.split(':');attach={k:parts[0],id:+parts[1]};}
  store.myPosts.unshift({id:'u'+Date.now(),a:{k:'me'},type,time:'acum',text:txt,attach,likes:0,cmts:[]});
  
  addNotif('ti-send','info','Postarea ta a fost publicată în flux.');
  done('Publicat!','Postarea ta e acum vizibilă în fluxul comunității din Bucovina.');
  if(current==='feed')renderFeed();
}


/* ============================================================
   SUPABASE DATA LAYER
   The UI keeps its existing shape; this layer maps PostgreSQL
   rows into the legacy view-model expected by the renderer.
   ============================================================ */
async function dbSelect(table, queryFn){
  let q=supabaseClient.from(table).select('*');
  if(queryFn) q=queryFn(q);
  const {data,error}=await q;
  if(error) throw error;
  return data||[];
}

function eventView(e){
  const d=new Date(e.start_at);
  const months=['ian','feb','mar','apr','mai','iun','iul','aug','sep','oct','nov','dec'];
  const days=['Duminică','Luni','Marți','Miercuri','Joi','Vineri','Sâmbătă'];
  const time=e.end_at
    ? `${d.toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'})}–${new Date(e.end_at).toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'})}`
    : d.toLocaleTimeString('ro-RO',{hour:'2-digit',minute:'2-digit'});
  return {...e,
    id:e.id,d:d.getDate(),m:months[d.getMonth()],day:days[d.getDay()],
    cat:e.category,online:!!e.is_online,city:e.city||'Suceava',venue:e.venue||'Online',
    time,ngo:e.ngo_id,spots:0,cap:e.capacity||0,desc:e.description||''
  };
}

async function loadPublicData(){
  try{
    const [ng,pe,pr,ev,co,fu,re,po,cm]=await Promise.all([
      dbSelect('ngos',q=>q.eq('status','published').order('name')),
      dbSelect('people',q=>q.order('name')),
      dbSelect('projects',q=>q.order('created_at',{ascending:false})),
      dbSelect('events',q=>q.eq('status','published').order('start_at')),
      dbSelect('collaborations',q=>q.eq('status','open').order('created_at',{ascending:false})),
      dbSelect('funding_opportunities',q=>q.in('status',['open','soon']).order('deadline_at')),
      dbSelect('resources',q=>q.eq('status','published').order('created_at',{ascending:false})),
      dbSelect('posts',q=>q.eq('status','published').order('created_at',{ascending:false})),
      dbSelect('comments',q=>q.eq('status','published').order('created_at'))
    ]);

    NGOS.splice(0,NGOS.length,...ng.map(n=>({
      ...n,id:n.id,name:n.name,cat:n.category,city:n.city,x:n.map_x??50,y:n.map_y??50,
      founded:n.founded_year||'',members:n.member_count||0,oi:n.initials||n.name.slice(0,2).toUpperCase(),
      tagline:n.tagline||n.description||'',web:n.website||'',email:n.email||'',phone:n.phone||'',
      people:pe.filter(p=>p.ngo_id===n.id).map(p=>({n:p.name,r:p.role_title||'',i:p.initials||p.name.slice(0,2).toUpperCase(),t:p.role_type||'youth'})),
      projects:pr.filter(p=>p.ngo_id===n.id).map(p=>({t:p.title,s:p.status==='active'?'active':p.status==='completed'?'done':'plan',m:p.status_text||''})),
      events:ev.filter(e=>e.ngo_id===n.id).map(e=>e.id)
    })));

    EVENTS.splice(0,EVENTS.length,...ev.map(eventView));
    COLLABS.splice(0,COLLABS.length,...co.map(c=>({...c,id:c.id,ngo:c.ngo_id,cat:c.category,loc:c.location||'Suceava',deadline:c.deadline||'fără termen',desc:c.description||''})));
    FUND.splice(0,FUND.length,...fu.map(f=>({...f,id:f.id,amount:f.amount||'',deadline:f.deadline||'',cats:f.categories||[],desc:f.description||''})));
    RES.splice(0,RES.length,...re.map(r=>({...r,id:r.id,cat:r.category,fmt:r.format||'',desc:r.description||''})));

    PEOPLE.splice(0,PEOPLE.length,...pe.map(p=>({
      ...p,id:p.id,n:p.name,i:p.initials||p.name.slice(0,2).toUpperCase(),role:p.role_title||'',tag:p.role_type||'youth',ngo:p.ngo_id,email:p.email||'',bio:p.bio||''
    })));

    POSTS.splice(0,POSTS.length,...po.map(p=>{
      const author=p.user_id?{k:'p',id:p.user_id}:p.ngo_id?{k:'n',id:p.ngo_id}:p.person_id?{k:'p',id:p.person_id}:{k:'me'};
      const comments=cm.filter(c=>c.post_id===p.id).map(c=>({n:'',i:'',tag:'youth',time:new Date(c.created_at).toLocaleDateString('ro-RO'),text:c.text_content,raw:false}));
      return {id:String(p.id),a:author,type:p.post_type,time:new Date(p.created_at).toLocaleString('ro-RO'),likes:0,attach:p.event_id?{k:'ev',id:p.event_id}:p.collaboration_id?{k:'col',id:p.collaboration_id}:p.funding_id?{k:'fund',id:p.funding_id}:null,text:p.text_content,cmts:comments};
    }));
  }catch(err){
    console.error('Supabase public data load failed:',err);
    throw err;
  }
}

async function loadUserState(){
  store.reg=[];store.savedF=[];store.likes=[];store.follows=[];store.myPosts=[];store.myCmts={};store.notifs=[];store.nseen=0;
  const {data:{session}}=await supabaseClient.auth.getSession();
  if(!session)return;
  const uid=session.user.id;
  const [r,s,l,f,p,c,n]=await Promise.all([
    supabaseClient.from('event_registrations').select('event_id').eq('user_id',uid).eq('status','registered'),
    supabaseClient.from('saved_funding').select('funding_id').eq('user_id',uid),
    supabaseClient.from('post_likes').select('post_id').eq('user_id',uid),
    supabaseClient.from('follows').select('ngo_id,person_id').eq('user_id',uid),
    supabaseClient.from('posts').select('*').eq('user_id',uid).order('created_at',{ascending:false}),
    supabaseClient.from('comments').select('*').eq('user_id',uid).order('created_at'),
    supabaseClient.from('notifications').select('*').eq('user_id',uid).is('read_at',null).order('created_at',{ascending:false})
  ]);
  store.reg=(r.data||[]).map(x=>x.event_id);
  store.savedF=(s.data||[]).map(x=>x.funding_id);
  store.likes=(l.data||[]).map(x=>String(x.post_id));
  store.follows=(f.data||[]).map(x=>x.ngo_id?`n:${x.ngo_id}`:`p:${x.person_id}`);
  store.myPosts=(p.data||[]).map(x=>({id:String(x.id),a:{k:'me'},type:x.post_type,time:new Date(x.created_at).toLocaleString('ro-RO'),likes:0,attach:x.event_id?{k:'ev',id:x.event_id}:x.collaboration_id?{k:'col',id:x.collaboration_id}:x.funding_id?{k:'fund',id:x.funding_id}:null,text:x.text_content,cmts:[]}));
  (c.data||[]).forEach(x=>{(store.myCmts[String(x.post_id)]??=[]).push({text:x.text_content,time:new Date(x.created_at).toLocaleString('ro-RO')});});
  store.notifs=(n.data||[]).map(x=>({i:x.icon||'ti-bell',c:x.color||'info',text:x.message,time:new Date(x.created_at).toLocaleString('ro-RO')}));
}

async function initApp(){
  try{
    await loadPublicData();
    await loadUserState();
    go('home');
    updateBell();
  }catch(err){
    console.error(err);
    const home=document.getElementById('view-home');
    if(home)home.innerHTML='<div class="empty">Nu am putut încărca datele din Supabase. Verifică Project URL, publishable key și politicile RLS.</div>';
  }
}

supabaseClient.auth.onAuthStateChange(async ()=>{
  await loadUserState();
  if(current==='home')renderHome();
  if(current==='feed')renderFeed();
  updateBell();
});

/* ROUTER */
let current='events',evFilter='all',mapFilter='all',colFilter='all';
const TB={
  home:['Bună, Paul','Ce se întâmplă azi în societatea civilă suceveană','Acțiune rapidă','ti-bolt'],
  events:['Hub evenimente','Tot ce se întâmplă în ecosistemul civic din Suceava','Propune eveniment','ti-plus'],
  map:['Harta ONG-urilor din Suceava','Explorează organizațiile și oamenii din spatele lor','Înregistrează ONG','ti-plus'],
  collabs:['Colaborări & nevoi','Cereri și oferte din ecosistemul civic sucevean','Postează o colaborare','ti-plus'],
  people:['Oameni','Rețeaua de oameni din spatele organizațiilor','Invită o persoană','ti-user-plus'],
  funding:['Finanțări & granturi','Apeluri deschise pentru ONG-urile sucevene','Adaugă oportunitate','ti-plus'],
  person:['Profil persoană','','Contactează','ti-mail'],
  resources:['Resurse','Ghiduri, șabloane și date pentru organizații','Propune o resursă','ti-plus'],
  ngo:['Profil organizație','','Urmărește','ti-bell']
};
function go(v){
  current=v;
  document.querySelectorAll('.view').forEach(x=>x.classList.remove('on'));
  document.getElementById('view-'+v).classList.add('on');
  document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.nav===v));
  const [t,s,c,ic]=TB[v]||TB.events;
  document.getElementById('tb-title').innerHTML=`<h1>${t}</h1>${s?`<div class="sub">${s}</div>`:''}`;
  document.getElementById('tb-cta').innerHTML=`<i class="ti ${ic}"></i> ${c}`;
  document.getElementById('q').value='';
  if(v==='home')renderHome();
  if(v==='events')renderEvents();
  if(v==='map'){renderNgoList();renderPins();}
  if(v==='collabs')renderCollabs();
  if(v==='people')renderPeople();
  if(v==='funding')renderFunding();
  if(v==='resources')renderResources();
  closeSide();
  window.scrollTo(0,0);
}
function onSearch(){if(current==='events')renderEvents();if(current==='map')renderNgoList();if(current==='collabs')renderCollabs();if(current==='people')renderPeople();if(current==='funding')renderFunding();if(current==='resources')renderResources();}

/* HOME */
function renderHome(){
  const events3=EVENTS.slice(0,3).map(e=>{const c=CAT[e.cat],ng=ngoById(e.ngo);
    return `<div class="row"><div class="datebox"><div class="d">${e.d}</div><div class="m">${e.m}</div></div>
      <div class="rb"><h3>${e.title}</h3><div class="rs"><span class="tag ${c.cls}" style="font-size:10px;padding:1px 7px">${c.label}</span><i class="ti ti-map-pin"></i> ${e.city}</div></div>
      <button class="btn primary sm" onclick="openReg(${e.id})">Înscrie-te</button></div>`;}).join('');

  const urgent=COLLABS.filter(x=>/^\d/.test(x.deadline)).slice(0,4).map(x=>{const t=CTYPE[x.type],c=CAT[x.cat],ng=ngoById(x.ngo);
    return `<div class="crow" onclick="openRespond(${x.id})"><div class="ci" style="background:${c.bg};color:${c.color}"><i class="ti ${t.i}"></i></div>
      <div class="cb"><h3>${x.title}</h3><div class="cs"><i class="ti ti-clock deadline" style="color:var(--coral)"></i> termen ${x.deadline} · ${ng.name}</div></div></div>`;}).join('');

  const counts={};NGOS.forEach(n=>counts[n.cat]=(counts[n.cat]||0)+1);
  const dots=NGOS.map(n=>`<div class="mdot" style="left:${n.x}%;top:${n.y}%;background:${CAT[n.cat].color}"></div>`).join('');

  const spots=NGOS.slice(0,3).map(n=>{const c=CAT[n.cat];
    return `<div class="spot" onclick="openNgo('${n.id}')"><div class="oa" style="background:${c.bg};color:${c.color};width:34px;height:34px;border-radius:9px;font-size:13px">${n.oi}</div>
      <div class="sb"><h3>${n.name}</h3><div class="ss">${n.city} · ${n.members} membri</div></div><i class="ti ti-chevron-right" style="color:var(--text-3)"></i></div>`;}).join('');

  const myEv=EVENTS.filter(e=>isReg(e.id));
  const myF=FUND.filter(f=>isSavedF(f.id));
  const actItems=myEv.length?myEv.map(e=>`<div class="row"><div class="datebox"><div class="d">${e.d}</div><div class="m">${e.m}</div></div><div class="rb"><h3>${e.title}</h3><div class="rs"><i class="ti ti-circle-check" style="color:var(--teal)"></i> Înscris · ${e.city}</div></div><button class="btn sm" onclick="go('events')">Vezi</button></div>`).join(''):'<div class="pm" style="color:var(--text-3);font-size:13px;padding:4px 0 2px">Încă nu te-ai înscris la nimic — explorează evenimentele și colaborările de mai jos.</div>';
  const savedLine=myF.length?`<div style="font-size:12px;color:var(--text-2);border-top:1px solid var(--border);padding-top:10px;margin-top:8px"><i class="ti ti-bookmark" style="color:var(--info);vertical-align:-2px"></i> ${myF.length} ${myF.length===1?'finanțare salvată':'finanțări salvate'} · <span class="seclink" style="margin:0" onclick="go('funding')">vezi</span></div>`:'';
  document.getElementById('view-home').innerHTML=`
    <div class="metrics">
      <div class="metric" onclick="go('map')"><div class="ml"><i class="ti ti-building-community" style="color:var(--info)"></i> ONG-uri active</div><div class="mv">${NGOS.length}</div><div class="md">în baza de date</div></div>
      <div class="metric"><div class="ml"><i class="ti ti-users" style="color:var(--coral)"></i> Voluntari</div><div class="mv">${PEOPLE.filter(p=>p.tag==='vol'||p.tag==='youth').length}</div><div class="md">persoane în rețea</div></div>
      <div class="metric" onclick="go('events')"><div class="ml"><i class="ti ti-calendar-event" style="color:var(--purple)"></i> Evenimente iunie</div><div class="mv">${EVENTS.filter(e=>e.m==='iun').length}</div><div class="md">evenimente înregistrate</div></div>
      <div class="metric" onclick="go('collabs')"><div class="ml"><i class="ti ti-puzzle" style="color:var(--teal)"></i> Colaborări deschise</div><div class="mv">${COLLABS.length}</div><div class="md">active acum</div></div>
    </div>
    <div class="home-grid">
      <div>
        <div class="sec"><h2><i class="ti ti-bookmark"></i> Activitatea mea</h2>${actItems}${savedLine}</div>
        <div class="sec"><h2><i class="ti ti-calendar-event"></i> Evenimente apropiate <span class="seclink" onclick="go('events')">Vezi toate <i class="ti ti-arrow-right" style="font-size:13px"></i></span></h2>${events3}</div>
        <div class="sec"><h2><i class="ti ti-flame"></i> Colaborări urgente <span class="seclink" onclick="go('collabs')">Vezi toate <i class="ti ti-arrow-right" style="font-size:13px"></i></span></h2>${urgent}</div>
      </div>
      <div>
        <div class="sec"><h2><i class="ti ti-map-2"></i> Harta județului</h2>
          <div class="minimap" onclick="go('map')">
            <svg viewBox="0 0 600 480" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="600" height="480" fill="#e7e0cf"/><path d="M40 250 L80 150 L150 110 L230 140 L300 100 L370 130 L450 95 L540 150 L560 230 L520 320 L430 360 L330 350 L250 380 L160 345 L90 300 Z" fill="#e1ead6" stroke="#b0bd90" stroke-width="3"/><path d="M48 254 L92 165 L126 212 L170 142 L212 214 L246 172 L280 254 Z" fill="#bcbfb0"/><path d="M170 142 l12 21 -24 0 z" fill="#f6f1e6"/></svg>
            ${dots}<div class="mover"><span><i class="ti ti-map-pin" style="font-size:12px;vertical-align:-2px"></i> ${NGOS.length} ONG-uri în Suceava — deschide harta</span></div>
          </div>
        </div>
        <div class="sec"><h2><i class="ti ti-star"></i> ONG-uri în prim-plan <span class="seclink" onclick="go('map')">Toate</span></h2>${spots}</div>
        <div class="sec" style="background:var(--info-bg);border-color:#bcd6e3">
          <h2 style="color:var(--info)"><i class="ti ti-bolt"></i> Pentru tine</h2>
          <p style="font-size:13px;color:var(--info);margin-bottom:12px">${myEv.length?`Ești înscris la ${myEv.length} ${myEv.length===1?'eveniment':'evenimente'}. `:''}Sunt ${COLLABS.filter(x=>x.type==='vol').length} acțiuni de voluntariat care caută oameni în Suceava.</p>
          <button class="btn" style="width:100%;justify-content:center;background:var(--info);color:#fff;border-color:var(--info)" onclick="go('collabs')">Vezi unde poți ajuta</button>
        </div>
      </div>
    </div>`;
}

/* EVENTS */
const EV_FILTERS=[['all','Toate'],['edu','Educație'],['env','Mediu'],['soc','Social'],['civ','Drepturi civice'],['online','Doar online'],['onsite','Fizic']];
function renderEvFilters(){document.getElementById('ev-filters').innerHTML=EV_FILTERS.map(([k,l])=>`<button class="chip ${evFilter===k?'on':''}" onclick="setEvFilter('${k}')">${l}</button>`).join('');}
function setEvFilter(k){evFilter=k;renderEvents();}
function renderEvents(){
  renderEvFilters();
  const q=(document.getElementById('q').value||'').toLowerCase();
  const items=EVENTS.filter(e=>{const ng=ngoById(e.ngo);if(q&&!(e.title+ng.name+e.city).toLowerCase().includes(q))return false;if(evFilter==='all')return true;if(evFilter==='online')return e.online;if(evFilter==='onsite')return !e.online;return e.cat===evFilter;});
  const list=document.getElementById('ev-list');
  if(!items.length){list.innerHTML='<div class="empty">Niciun eveniment nu se potrivește.</div>';return;}
  let html='',lastM='';
  items.forEach(e=>{
    if(e.m!==lastM){html+=`<div class="month-label">${new Date(e.start_at||Date.now()).toLocaleDateString('ro-RO',{month:'long',year:'numeric'})}</div>`;lastM=e.m;}
    const c=CAT[e.cat],ng=ngoById(e.ngo),pct=Math.round(e.spots/e.cap*100),left=e.cap-e.spots;
    html+=`<div class="ev"><div class="date"><div class="d">${e.d}</div><div class="m">${e.m}</div><div class="day">${e.day}</div></div>
      <div class="body"><div class="tags"><span class="tag ${c.cls}">${c.label}</span>${e.online?'<span class="tag t-on">Online</span>':''}</div>
        <h3>${e.title}</h3>
        <div class="meta"><span><i class="ti ti-clock"></i> ${e.time}</span><span><i class="ti ti-map-pin"></i> ${e.venue}, ${e.city}</span></div>
        <div class="foot"><div class="org link" onclick="openNgo('${ng.id}')"><div class="oa" style="background:${c.bg};color:${c.color}">${ng.oi}</div> ${ng.name}</div>
          <div class="spots"><div class="bar"><i style="width:${pct}%"></i></div> ${left} locuri</div></div></div>
      <div style="display:flex;align-items:center">${isReg(e.id)?`<button class="btn sm" style="color:var(--teal);border-color:var(--teal)" onclick="unregisterEvent(${e.id})"><i class="ti ti-check"></i> Înscris</button>`:`<button class="btn primary sm" onclick="openReg(${e.id})">Înscrie-te</button>`}</div></div>`;
  });
  list.innerHTML=html;
}

/* MAP */
const MAP_FILTERS=[['all','Toate'],['edu','Educație'],['env','Mediu'],['soc','Social'],['civ','Drepturi civice']];
function renderMapFilters(){document.getElementById('map-filters').innerHTML=MAP_FILTERS.map(([k,l])=>`<button class="chip ${mapFilter===k?'on':''}" onclick="setMapFilter('${k}')">${l}</button>`).join('');}
function setMapFilter(k){mapFilter=k;renderNgoList();renderPins();}
function mapMatch(n){const q=(document.getElementById('q').value||'').toLowerCase();if(q&&!(n.name+n.city).toLowerCase().includes(q))return false;return mapFilter==='all'||n.cat===mapFilter;}
function renderPins(){
  document.getElementById('map-pins').innerHTML=NGOS.filter(mapMatch).map(n=>{const c=CAT[n.cat];
    return `<div class="pin" id="pin-${n.id}" style="left:${n.x}%;top:${n.y}%" onmouseenter="hlCard('${n.id}',1)" onmouseleave="hlCard('${n.id}',0)" onclick="openNgo('${n.id}')">
      <div class="dot" style="background:${c.color}"><span>${n.oi}</span></div><div class="lbl">${n.city}</div></div>`;}).join('');
}
function renderNgoList(){
  renderMapFilters();
  const items=NGOS.filter(mapMatch);
  const el=document.getElementById('ng-list');
  if(!items.length){el.innerHTML='<div class="empty">Niciun ONG găsit.</div>';return;}
  el.innerHTML=items.map(n=>{const c=CAT[n.cat];
    return `<div class="ng-card" id="card-${n.id}" onmouseenter="hlPin('${n.id}',1)" onmouseleave="hlPin('${n.id}',0)" onclick="openNgo('${n.id}')">
      <div class="oa" style="background:${c.bg};color:${c.color};width:40px;height:40px;border-radius:9px;font-size:14px">${n.oi}</div>
      <div class="body"><h3>${n.name}</h3>
        <div class="sm"><i class="ti ti-map-pin"></i> ${n.city} · <span style="color:${c.color}">${c.label}</span></div>
        <div class="sm" style="margin-top:2px"><i class="ti ti-users"></i> ${n.members} membri · din ${n.founded}</div></div>
      <i class="ti ti-chevron-right chev"></i></div>`;}).join('');
}
function hlCard(id,on){const c=document.getElementById('card-'+id);if(c)c.classList.toggle('hl',!!on);}
function hlPin(id,on){const p=document.getElementById('pin-'+id);if(p)p.classList.toggle('active',!!on);}

/* COLLABS */
const COL_FILTERS=[['all','Toate'],['partner','Caut parteneri'],['vol','Caut voluntari'],['offer','Ofer ajutor'],['fund','Caut finanțare']];
function renderColFilters(){document.getElementById('col-filters').innerHTML=COL_FILTERS.map(([k,l])=>`<button class="chip ${colFilter===k?'on':''}" onclick="setColFilter('${k}')">${l}</button>`).join('');}
function setColFilter(k){colFilter=k;renderCollabs();}
function renderCollabs(){
  renderColFilters();
  const q=(document.getElementById('q').value||'').toLowerCase();
  const items=COLLABS.filter(x=>{const ng=ngoById(x.ngo);if(q&&!(x.title+ng.name+x.loc).toLowerCase().includes(q))return false;return colFilter==='all'||x.type===colFilter;});
  const grid=document.getElementById('col-grid');
  if(!items.length){grid.innerHTML='<div class="empty">Nicio colaborare nu se potrivește.</div>';return;}
  grid.innerHTML=items.map(x=>{const t=CTYPE[x.type],c=CAT[x.cat],ng=ngoById(x.ngo);
    return `<div class="col">
      <div class="top"><span class="ctype ${t.cls}"><i class="ti ${t.i}" style="font-size:13px"></i> ${t.l}</span><span class="tag ${c.cls}">${c.label}</span></div>
      <h3>${x.title}</h3>
      <p class="cdesc">${x.desc}</p>
      <div class="cmeta"><span><i class="ti ti-map-pin"></i> ${x.loc}</span><span class="${x.deadline.match(/^\d/)?'deadline':''}"><i class="ti ti-clock"></i> ${x.deadline}</span></div>
      <div class="cfoot"><div class="org link" onclick="openNgo('${ng.id}')"><div class="oa" style="background:${c.bg};color:${c.color}">${ng.oi}</div> ${ng.name}</div>
        <button class="btn primary sm" onclick="openRespond(${x.id})">Răspunde</button></div></div>`;}).join('');
}

/* PEOPLE */
let pplFilter='all';
const PPL_FILTERS=[['all','Toți'],['ong','ONG-uri'],['pol','Policymakeri'],['vol','Voluntari'],['youth','Tineri']];
function setPplFilter(k){pplFilter=k;renderPeople();}
function renderPeople(){
  const q=(document.getElementById('q').value||'').toLowerCase();
  const items=PEOPLE.filter(p=>{const ng=ngoById(p.ngo);if(q&&!(p.n+p.role+ng.name).toLowerCase().includes(q))return false;return pplFilter==='all'||p.tag===pplFilter;});
  const chips=PPL_FILTERS.map(([k,l])=>`<button class="chip ${pplFilter===k?'on':''}" onclick="setPplFilter('${k}')">${l}</button>`).join('');
  const cards=items.length?items.map(p=>{const r=ROLE[p.tag],ng=ngoById(p.ngo);
    return `<div class="pcard" onclick="openPerson('${p.id}')"><div class="pav" style="background:${r[2]};color:${r[1]}">${p.i}</div>
      <div class="pb"><h3>${p.n}</h3><div class="pr">${p.role}</div><div class="po">${ng.name}</div></div>
      <span class="ptag" style="background:${r[2]};color:${r[1]}">${r[0]}</span></div>`;}).join(''):'<div class="empty">Nicio persoană găsită.</div>';
  document.getElementById('view-people').innerHTML=`<div class="filters">${chips}</div><div class="ppl-grid">${cards}</div>`;
}
function openPerson(id){
  const p=PEOPLE.find(x=>x.id===id),r=ROLE[p.tag],ng=ngoById(p.ngo),c=CAT[ng.cat];
  const evs=EVENTS.filter(e=>ng.events.includes(e.id)).slice(0,3).map(e=>`<div class="proj"><div class="pt"><h3>${e.title}</h3><div class="pm">${e.d} ${e.m} · ${e.city}</div></div><button class="btn sm" onclick="openReg(${e.id})">Detalii</button></div>`).join('')||'<div class="pm" style="color:var(--text-3);font-size:13px">Nicio acțiune programată momentan.</div>';
  document.getElementById('view-person').innerHTML=`
    <a class="back" onclick="go('people')"><i class="ti ti-arrow-left"></i> Înapoi la oameni</a>
    <div class="ng-head"><div class="big" style="background:${r[2]};color:${r[1]};border-radius:50%">${p.i}</div>
      <div style="flex:1;min-width:200px"><h1>${p.n}</h1><div class="tagline">${p.role}</div>
        <div class="facts"><span><i class="ti ti-id-badge"></i> <span style="color:${r[1]}">${r[0]}</span></span><span><i class="ti ti-building-community"></i> ${ng.name}</span><span><i class="ti ti-map-pin"></i> ${ng.city}</span></div></div>
      <div class="ng-actions"><button class="btn primary"><i class="ti ti-mail"></i> Contactează</button></div></div>
    <div class="grid2"><div>
      <div class="sec"><h2><i class="ti ti-user"></i> Despre</h2><p class="bio">${p.bio}</p></div>
      <div class="sec"><h2><i class="ti ti-calendar-event"></i> Implicare recentă</h2>${evs}</div>
    </div><div>
      <div class="sec"><h2><i class="ti ti-building-community"></i> Organizație</h2>
        <div class="ng-card" onclick="openNgo('${ng.id}')"><div class="oa" style="background:${c.bg};color:${c.color};width:40px;height:40px;border-radius:9px;font-size:14px">${ng.oi}</div><div class="body"><h3>${ng.name}</h3><div class="sm"><i class="ti ti-map-pin"></i> ${ng.city} · <span style="color:${c.color}">${c.label}</span></div></div><i class="ti ti-chevron-right chev"></i></div>
      </div>
      <div class="sec"><h2><i class="ti ti-address-book"></i> Contact</h2>
        <div class="contact-row"><i class="ti ti-mail"></i> <a href="#">${p.email}</a></div></div>
    </div></div>`;
  go('person');
}

/* FUNDING */
let fundFilter='all';
const FUND_FILTERS=[['all','Toate'],['eu','Europene'],['local','Locale & naționale'],['privat','Private'],['premiu','Premii']];
function setFundFilter(k){fundFilter=k;renderFunding();}
function renderFunding(){
  const q=(document.getElementById('q').value||'').toLowerCase();
  const items=FUND.filter(f=>{if(q&&!(f.title+f.funder).toLowerCase().includes(q))return false;return fundFilter==='all'||f.type===fundFilter;});
  const chips=FUND_FILTERS.map(([k,l])=>`<button class="chip ${fundFilter===k?'on':''}" onclick="setFundFilter('${k}')">${l}</button>`).join('');
  const cards=items.length?items.map(f=>{const t=FTYPE[f.type];
    const tags=f.cats.map(cc=>`<span class="tag ${CAT[cc].cls}">${CAT[cc].label}</span>`).join('');
    return `<div class="fund"><div class="ftop"><span class="ftag ${t[1]}">${t[0]}</span>${f.status==='soon'?'<span class="fsoon">se închide curând</span>':''}</div>
      <h3>${f.title}</h3><div class="ffunder">${f.funder}</div>
      <div class="famount">${f.amount}</div>
      <div class="fdl"><i class="ti ti-calendar-due"></i> termen-limită: ${f.deadline}</div>
      <p class="fdesc">${f.desc}</p>
      <div class="fmeta">${tags}</div>
      <div class="ffoot">${isSavedF(f.id)?`<button class="btn" style="color:var(--info);border-color:var(--info)" onclick="toggleSavedF(${f.id})"><i class="ti ti-bookmark"></i> Salvat</button>`:`<button class="btn" onclick="toggleSavedF(${f.id})"><i class="ti ti-bookmark"></i> Salvează</button>`}<button class="btn primary" onclick="openFund(${f.id})">Aplică</button></div></div>`;}).join(''):'<div class="empty">Nicio finanțare găsită.</div>';
  document.getElementById('view-funding').innerHTML=`<div class="filters">${chips}</div><div class="fund-grid">${cards}</div>`;
}
function openFund(id){
  const f=FUND.find(x=>x.id===id),t=FTYPE[f.type];
  const tags=f.cats.map(cc=>`<span class="tag ${CAT[cc].cls}">${CAT[cc].label}</span>`).join('');
  document.getElementById('modal-content').innerHTML=`
    <div class="tags" style="margin-bottom:10px"><span class="ftag ${t[1]}">${t[0]}</span></div>
    <h2>${f.title}</h2><div class="org" style="margin-bottom:2px">${f.funder}</div>
    <div class="mmeta"><span><i class="ti ti-coin"></i> ${f.amount}</span><span><i class="ti ti-calendar-due"></i> termen-limită ${f.deadline}</span><span><i class="ti ti-tag"></i> ${f.cats.map(cc=>CAT[cc].label).join(', ')}</span></div>
    <p class="desc">${f.desc}</p>
    <div class="field" style="margin-top:14px"><label>Aplici în numele</label><select>${NGOS.map(n=>`<option>${n.name}</option>`).join('')}</select></div>
    <div class="field"><label>Sumă solicitată</label><input placeholder="ex. 25.000 lei"></div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">Anulează</button><button class="btn primary" onclick="saveF(${f.id});done('Aplicație începută!','Ți-am pregătit dosarul pentru <b>${f.title.replace(/'/g,'’')}</b>. L-am adăugat la finanțările tale urmărite.')">Trimite intenția</button></div>`;
  openModal();
}

/* NGO DETAIL */
function openNgo(id){
  const n=ngoById(id),c=CAT[n.cat];
  const people=n.people.map(p=>{const r=ROLE[p.t];return `<div class="person"><div class="oa" style="width:38px;height:38px;border-radius:50%;background:${r[2]};color:${r[1]};font-size:13px">${p.i}</div><div class="body"><h3>${p.n}</h3><div class="role">${p.r}</div></div><span class="ptag" style="background:${r[2]};color:${r[1]}">${r[0]}</span></div>`;}).join('');
  const projects=n.projects.map(p=>{const sc=p.s==='active'?'s-active':p.s==='plan'?'s-plan':'s-done';const sl=p.s==='active'?'în derulare':p.s==='plan'?'planificat':'încheiat';return `<div class="proj"><div class="pt"><h3>${p.t}</h3><div class="pm">${p.m}</div></div><span class="pstatus ${sc}">${sl}</span></div>`;}).join('');
  const myCol=COLLABS.filter(x=>x.ngo===id);
  const needs=myCol.length?myCol.map(x=>{const t=CTYPE[x.type];return `<div class="need" onclick="openRespond(${x.id})"><h3>${x.title}</h3><div class="nm"><i class="ti ${t.i}"></i> ${t.l} · ${x.loc} · ${x.deadline}</div></div>`;}).join(''):'<div class="pm" style="color:var(--text-3);font-size:13px">Nicio colaborare deschisă.</div>';
  const evs=EVENTS.filter(e=>n.events.includes(e.id)).map(e=>`<div class="proj"><div class="pt"><h3>${e.title}</h3><div class="pm">${e.d} ${e.m} · ${e.city}</div></div><button class="btn sm" onclick="openReg(${e.id})">Înscrie-te</button></div>`).join('')||'<div class="pm" style="color:var(--text-3);font-size:13px">Niciun eveniment programat.</div>';

  document.getElementById('view-ngo').innerHTML=`
    <a class="back" onclick="go('map')"><i class="ti ti-arrow-left"></i> Înapoi la hartă</a>
    <div class="ng-head"><div class="big" style="background:${c.bg};color:${c.color}">${n.oi}</div>
      <div style="flex:1;min-width:200px"><h1>${n.name}</h1><div class="tagline">${n.tagline}</div>
        <div class="facts"><span><i class="ti ti-map-pin"></i> ${n.city}, jud. Suceava</span><span><i class="ti ti-tag"></i> <span style="color:${c.color}">${c.label}</span></span><span><i class="ti ti-users"></i> ${n.members} membri</span><span><i class="ti ti-calendar"></i> înființată ${n.founded}</span></div></div>
      <div class="ng-actions"><button class="btn primary"><i class="ti ti-bell"></i> Urmărește</button><button class="btn"><i class="ti ti-mail"></i> Contact</button></div></div>
    <div class="grid2"><div>
      <div class="sec"><h2><i class="ti ti-users-group"></i> Oameni-cheie <span class="count">${n.people.length}</span></h2>${people}</div>
      <div class="sec"><h2><i class="ti ti-folder"></i> Proiecte <span class="count">${n.projects.length}</span></h2>${projects}</div>
      <div class="sec"><h2><i class="ti ti-calendar-event"></i> Evenimente viitoare</h2>${evs}</div>
    </div><div>
      <div class="sec"><h2><i class="ti ti-puzzle"></i> Nevoi & colaborări <span class="count">${myCol.length}</span></h2>${needs}</div>
      <div class="sec"><h2><i class="ti ti-address-book"></i> Contact</h2>
        <div class="contact-row"><i class="ti ti-world"></i> <a href="#">${n.web}</a></div>
        <div class="contact-row"><i class="ti ti-mail"></i> <a href="#">${n.email}</a></div>
        <div class="contact-row"><i class="ti ti-phone"></i> ${n.phone}</div></div>
    </div></div>`;
  go('ngo');
}

/* MODALS */
function openReg(id){
  const e=EVENTS.find(x=>x.id===id),c=CAT[e.cat],ng=ngoById(e.ngo);
  document.getElementById('modal-content').innerHTML=`
    <div class="tags" style="margin-bottom:10px"><span class="tag ${c.cls}">${c.label}</span>${e.online?'<span class="tag t-on">Online</span>':''}</div>
    <h2>${e.title}</h2>
    <div class="org"><div class="oa" style="background:${c.bg};color:${c.color}">${ng.oi}</div> Organizat de ${ng.name}</div>
    <div class="mmeta"><span><i class="ti ti-calendar"></i> ${e.d} ${e.m==='iun'?'iunie':'iulie'} 2026, ${e.day}</span><span><i class="ti ti-clock"></i> ${e.time}</span><span><i class="ti ti-map-pin"></i> ${e.venue}, ${e.city}</span><span><i class="ti ti-users"></i> ${e.cap-e.spots} din ${e.cap} locuri</span></div>
    <p class="desc">${e.desc}</p>
    <div class="field" style="margin-top:14px"><label>Nume complet</label><input id="reg-name" placeholder="Numele tău"></div>
    <div class="field"><label>Email</label><input id="reg-email" type="email" placeholder="email@exemplu.ro"></div>
    <div class="field"><label>Particip ca</label><select><option>Voluntar individual</option><option>Reprezentant ONG</option><option>Tânăr / elev / student</option></select></div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">Anulează</button><button class="btn primary" onclick="registerEvent(${e.id});refresh();done('Te-ai înscris!','Ai un loc rezervat la <b>${e.title.replace(/'/g,'’')}</b>. Ți-am trimis confirmarea pe email și am adăugat evenimentul în calendar.')">Confirmă înscrierea</button></div>`;
  openModal();
}
function openRespond(id){
  const x=COLLABS.find(c=>c.id===id),t=CTYPE[x.type],c=CAT[x.cat],ng=ngoById(x.ngo);
  document.getElementById('modal-content').innerHTML=`
    <div class="tags" style="margin-bottom:10px"><span class="ctype ${t.cls}"><i class="ti ${t.i}" style="font-size:13px"></i> ${t.l}</span><span class="tag ${c.cls}">${c.label}</span></div>
    <h2>${x.title}</h2>
    <div class="org"><div class="oa" style="background:${c.bg};color:${c.color}">${ng.oi}</div> ${ng.name}</div>
    <div class="mmeta"><span><i class="ti ti-map-pin"></i> ${x.loc}</span><span><i class="ti ti-clock"></i> ${x.deadline}</span></div>
    <p class="desc">${x.desc}</p>
    <div class="field" style="margin-top:14px"><label>Răspund ca</label><select><option>Voluntar individual</option><option>Reprezentant ONG</option><option>Finanțator / sponsor</option><option>Instituție publică</option></select></div>
    <div class="field"><label>Mesaj pentru ${ng.name}</label><textarea placeholder="Spune pe scurt cum poți contribui…">Salut! Aș vrea să mă implic în această colaborare.</textarea></div>
    <div class="modal-actions"><button class="btn" onclick="closeModal()">Anulează</button><button class="btn primary" onclick="done('Mesaj trimis!','${ng.name} a primit răspunsul tău la <b>${x.title.replace(/'/g,'’')}</b> și te poate contacta direct.')">Trimite răspunsul</button></div>`;
  openModal();
}
function done(title,msg){
  document.getElementById('modal-content').innerHTML=`<div class="success"><div class="ic"><i class="ti ti-check"></i></div><h2>${title}</h2><p class="desc" style="margin-top:8px">${msg}</p><button class="btn primary" style="width:100%;justify-content:center;margin-top:6px" onclick="closeModal()">Gata</button></div>`;
}
function openModal(){document.getElementById('overlay').classList.add('open');}
function closeModal(){document.getElementById('overlay').classList.remove('open');}
document.getElementById('overlay').addEventListener('click',e=>{if(e.target.id==='overlay')closeModal();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();closeSide();}});
function toggleSide(){document.querySelector('.side').classList.toggle('open');document.getElementById('scrim').classList.toggle('on');}
function closeSide(){document.querySelector('.side').classList.remove('open');document.getElementById('scrim').classList.remove('on');}

initApp();
