import './style.css';
import { createClient } from '@supabase/supabase-js';
import { parseMatches, parseIssues, section, tasks, classify, seconds, clean } from './parser.js';
import { markdown, timeLinks } from './markdown.js';
import { videoStore } from './storage.js';
const $ = s => document.querySelector(s);
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const url = import.meta.env.VITE_SUPABASE_URL, key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const configured = !!(url && key);
let client;
try { if(configured) client = createClient(url, key); } catch { /* shown in setup view */ }
let user, documents = {}, revision = 0, matches = [], page = 'home', selected, filter = '', opponent = '', local = false, busy = false, message = '', error = false, videoURL, videoKeys = [], videoGeneration = 0;
let noticeTimer;
const temporaryVideos = new Map();
const icons = {home:'◈', matches:'▤', profile:'◎', settings:'⚙'};
const names = {home:'ホーム',matches:'試合一覧',profile:'課題・プロフィール',settings:'保存・設定'};
const app = $('#app');
function flash(text, bad = false) {
  clearTimeout(noticeTimer); message = text; error = bad;
  const el = $('#notice'); if(el) { el.textContent=text; el.className='notice '+(bad?'error':''); el.hidden=false; }
  noticeTimer=setTimeout(()=>{message='';const notice=$('#notice');if(notice)notice.hidden=true;}, bad?8000:4500);
}
function guard(fn) { return async (...args) => { try { await fn(...args); } catch(e) { flash(e.message || '処理に失敗しました。', true); } }; }
function accessScreen(text = '') {
  app.innerHTML = `<main class="welcome"><div class="brand"><span class="brand-symbol">B<span> / </span>N</span><span>BATTLE NOTES<small>SF6 BATTLE REPORT ANALYZER</small></span></div><div class="welcome-content"><div class="eyebrow">YOUR NEXT ROUND STARTS HERE</div><h1>対戦の気づきを、<br><em>次の一勝へ。</em></h1><p>大切なのは、負けた理由よりも次の行動。<br>分析ログと動画を、自分だけの対戦ノートに。</p><div class="welcome-features"><span>01　改善テーマをひと目で</span><span>02　動画と分析を行き来</span><span>03　スマホでも振り返り</span></div>${client ? '<button id="login" class="primary">Googleでログイン <span>↗</span></button><p class="subtle">登録された自分のアカウントだけが利用できます。</p>' : '<div class="setup-note">初期設定が必要です。READMEの手順で同期とGoogleログインを接続してください。</div><button id="local" class="primary">この端末で表示を試す <span>→</span></button><p class="subtle">確認用モードです。mdのクラウド同期は行いません。</p>'}<p id="notice" class="notice error" ${text?'':'hidden'}>${esc(text)}</p></div><div class="welcome-art" aria-hidden="true"><span>REVIEW.</span><span>ADAPT.</span><span class="outline">WIN.</span><div class="art-line"></div><small>ONE ROUND AT A TIME.</small></div></main>`;
  if($('#login')) $('#login').onclick = guard(async()=>{ const {error}=await client.auth.signInWithOAuth({provider:'google',options:{redirectTo:location.origin}}); if(error) throw error; });
  if($('#local')) $('#local').onclick = guard(async()=>{local=true; user={id:'local',email:'この端末で確認中'}; documents=JSON.parse(localStorage.getItem('battle-notes-preview')||'{}'); matches=parseMatches(documents.matches); await keys(); render();});
}
async function keys(){ try{videoKeys=await videoStore('getAllKeys');}catch{videoKeys=[];} }
function videoKey(m){return user.id+':'+m.video;}
function hasVideo(m){return videoKeys.includes(videoKey(m)) || temporaryVideos.has(videoKey(m));}
function nav(){return `<nav aria-label="メインメニュー">${Object.keys(names).map(k=>`<button class="nav-item ${page===k?'active':''}" data-page="${k}"><span>${icons[k]}</span>${names[k]}</button>`).join('')}</nav>`;}
function render(){
  if(!user) return;
  if(videoURL){URL.revokeObjectURL(videoURL); videoURL=null;} videoGeneration++;
  app.innerHTML=`<aside class="sidebar"><a class="brand" href="#"><span class="brand-symbol">B<span>/</span>N</span><span>BATTLE<br>NOTES<small>SF6 ANALYZER</small></span></a>${nav()}<div class="sidebar-bottom"><div class="privacy-dot">PRIVATE WORKSPACE</div><p>記録を重ねて、<br>自分の勝ち方を見つける。</p><div class="account"><span class="avatar">${esc((user.email||'A')[0].toUpperCase())}</span><div><b>${local?'ローカル確認':'自分の対戦ノート'}</b><small>${esc(user.email)}</small></div></div></div></aside><div class="workspace ${page==='matches' && selected!=null ? 'match-detail-workspace' : ''}"><header><div class="breadcrumb">WORKSPACE <span>/</span> ${names[page]}</div><div class="header-actions"><span class="sync-state"><i></i>${local?'端末内のみ':'クラウド同期'}</span><button class="primary compact" id="import" ${busy?'disabled':''}>＋ mdを取り込む</button></div></header><main id="content">${view()}</main><footer>記録は判断の材料。評価は、次の対戦で確かめよう。</footer></div><input id="md-input" type="file" accept=".md,.markdown,text/markdown,text/plain" multiple hidden><input id="video-input" type="file" accept="video/*,.mp4,.webm,.mov" hidden><div id="notice" role="status" aria-live="polite" class="notice ${error?'error':''}" ${message?'':'hidden'}>${esc(message)}</div><div id="drop-overlay" hidden><div>分析ログを、ここへ。<small>matches.md / player_profile.md</small></div></div>`;
  document.querySelectorAll('[data-page]').forEach(b=>b.onclick=()=>{page=b.dataset.page;selected=null;render();window.scrollTo(0,0);});
  $('.brand').onclick=e=>{e.preventDefault();page='home';selected=null;render();};
  $('#import').onclick=()=>$('#md-input').click(); $('#md-input').onchange=guard(e=>importMD([...e.target.files]));
  document.querySelectorAll('[data-match]').forEach(b=>b.onclick=()=>{selected=Number(b.dataset.match);page='matches';render();window.scrollTo(0,0);});
  if($('#back')) $('#back').onclick=()=>{selected=null;render();};
  if($('#search')) $('#search').oninput=e=>{filter=e.target.value; refreshList();};
  if($('#opponent')) $('#opponent').onchange=e=>{opponent=e.target.value;refreshList();};
  document.querySelectorAll('[data-import]').forEach(b=>b.onclick=()=>$('#md-input').click());
  if($('#attach-video')) $('#attach-video').onclick=guard(pickVideo);
  $('#video-input').onchange=guard(e=>attachVideo(e.target.files[0]));
  if($('#delete-video')) $('#delete-video').onclick=guard(deleteVideo);
  if($('#logout')) $('#logout').onclick=guard(async()=>{if(client&&!local) await client.auth.signOut(); user=null;documents={};matches=[];if(videoURL)URL.revokeObjectURL(videoURL);videoGeneration++; accessScreen();});
  if($('#refresh')) $('#refresh').onclick=guard(async()=>{await fetchCloud();flash('最新の分析を読み込みました。');render();});
  document.querySelectorAll('[data-download]').forEach(b=>b.onclick=()=>download(b.dataset.download));
  if(page==='matches' && selected!=null) loadVideo();
  if(page==='settings') storageInfo();
  bindReportLinks();
}
function heading(kicker,title,sub){return `<div class="page-heading"><div class="eyebrow">${kicker}</div><h1>${title}</h1><p>${sub}</p></div>`;}
function empty(){return `<div class="empty-panel"><div class="empty-icon">▤</div><h2>最初の分析ログを取り込もう</h2><p>matches.md と player_profile.md をドラッグ＆ドロップ。<br>試合の振り返りと改善テーマを、自動で整理します。</p><button class="primary" data-import>mdファイルを選ぶ →</button><small>${local?'この確認モードでは端末内に保存します。':'分析は自分のアカウントに保存され、スマホにも同期されます。'}<br>動画は試合詳細から追加できます。</small></div>`;}
function taskCards(){const source=section(documents.profile||'',/^次の10試合/)||section(documents.profile||'',/^改善中$/)||matches.at(-1)?.next||'';const ts=tasks(source);return ts.length?`<div class="task-grid">${ts.map((t,i)=>`<article class="task-card"><div class="task-top"><span>FOCUS ${String(i+1).padStart(2,'0')}</span><span>↗</span></div><h3>${esc(t.title)}</h3><p>${esc(t.description)}</p></article>`).join('')}</div>`:`<div class="soft-empty">「次の10試合」またはプロフィールの「改善中」にある課題をここに表示します。</div>`;}
function matchCards(items=matches){return items.map(m=>{const i=matches.indexOf(m); return `<button class="match-card" data-match="${i}"><div class="match-no">${esc(m.title)}<small>${esc(m.date?.split('。')[0]||'日付未記載')}</small></div><div class="match-opponent"><span>AKI <small>vs</small> ${esc(m.opponent)}</span><small>${esc(m.theme||'試合の分析を開く')}</small></div><span class="result-badge">${esc(m.result)}</span><span class="video-indicator">${hasVideo(m)?'▸ 動画あり':'分析ログ'}</span><span class="arrow">↗</span></button>`;}).join('');}
function view(){
  if(page==='home')return heading('YOUR TRAINING DESK','次の一戦に、ひとつの気づき。','振り返りを、試合中に思い出せる行動へ。')+(!documents.matches&&!documents.profile?empty():`<section><div class="section-head"><h2>次の10試合で意識すること</h2><span class="pill">最大3つに集中</span></div>${taskCards()}</section><div class="dashboard-grid"><section><div class="section-head"><h2>最近の試合</h2><span class="count">${matches.length} MATCHES</span></div>${matches.length?matchCards(matches.slice(-4).reverse()):'<div class="soft-empty">試合ログはまだありません。</div>'}</section><section class="strength-panel"><div class="eyebrow">PRIORITIES</div><h2>現在の優先順位</h2><div class="markdown">${markdown(section(documents.profile||'',/^現在の優先順位$/)||section(documents.profile||'',/^現在の最重要課題$/)||'プロフィールを取り込むと、優先課題を表示します。')}</div></section></div>`);
  if(page==='matches'){
    if(selected!=null&&matches[selected])return detail(matches[selected]);
    return heading('MATCH ARCHIVE','対戦の記録','結果だけでなく、選択とその理由を振り返る。')+(matches.length?`<div class="filters"><input id="search" placeholder="相手・テーマ・キーワードを検索" aria-label="試合を検索" value="${esc(filter)}"><select id="opponent" aria-label="相手キャラ"><option value="">すべての相手</option>${[...new Set(matches.map(m=>m.opponent))].map(o=>`<option ${opponent===o?'selected':''}>${esc(o)}</option>`).join('')}</select></div><div id="match-list">${filtered()}</div>`:empty())+(documents.matches?`<details class="raw"><summary>元のMarkdownをすべて読む</summary><div class="markdown">${markdown(documents.matches)}</div></details>`:'');
  }
  if(page==='profile')return profileView();
  return heading('WORKSPACE SETTINGS','保存と同期','分析はクラウドへ。動画は、この端末に。')+`<div class="settings-grid"><section class="profile-panel"><h2>分析ログ</h2><p>${local?'確認用モード：この端末のブラウザ内だけに保存しています。':'同じGoogleアカウントでログインすると、PCとスマホで同じ分析を見られます。'}</p><div class="file-row"><span>matches.md</span><b>${documents.matches?'読み込み済み':'未登録'}</b></div><div class="file-row"><span>player_profile.md</span><b>${documents.profile?'読み込み済み':'未登録'}</b></div><p class="subtle">更新版のmdを取り込むと、同じ種類のログ全体を差し替えます。</p><div class="button-row">${!local?'<button id="refresh" class="secondary">最新の内容を取得</button>':''}${documents.matches?'<button class="secondary" data-download="matches">試合ログを書き出す</button>':''}${documents.profile?'<button class="secondary" data-download="profile">プロフィールを書き出す</button>':''}</div></section><section class="profile-panel"><h2>この端末の動画</h2><p>動画本体はコピーもアップロードもしません。選択した元ファイルへの参照情報だけを保存します。</p><div id="storage-info" class="storage-info">保存容量を確認中…</div><p class="subtle">再訪時にアクセス許可が必要になる場合があります。元動画の移動・削除後は再選択してください。非対応ブラウザでは開いている間だけ再生します。</p></section><section class="profile-panel wide"><h2>アカウント</h2><p>${esc(user.email)}</p><button id="logout" class="secondary">${local?'確認モードを終了':'ログアウト'}</button></section></div>`;
}
function filtered(){const list=matches.filter(m=>(!opponent||m.opponent===opponent)&&(!filter||(m.body+' '+m.title).toLowerCase().includes(filter.toLowerCase()))).reverse();return list.length?matchCards(list):'<div class="soft-empty">条件に合う試合はありません。</div>';}
function refreshList(){$('#match-list').innerHTML=filtered();document.querySelectorAll('[data-match]').forEach(b=>b.onclick=()=>{selected=Number(b.dataset.match);render();});}
function detail(m){return `<button id="back" class="back">← 試合一覧へ</button>${heading(esc(m.title),'AKI <span class="vs">vs</span> '+esc(m.opponent),'')}<div class="detail-meta"><span class="result-badge">${esc(m.result)}</span><span>${esc(m.date)}</span></div><div class="detail-layout"><aside class="video-panel"><div id="video-slot" class="video-slot"><span>▸</span><p>PCの元動画を直接再生</p><small>スマホでは分析だけでも振り返れます。</small></div><div class="video-actions"><button id="attach-video" class="secondary">${hasVideo(m)?'動画を差し替える':'＋ 動画を追加'}</button>${hasVideo(m)?'<button id="delete-video" class="text-button">動画の関連付けを解除</button>':''}</div><small class="video-note">${esc(m.video)}<br>動画はコピーせず、参照情報だけを保存します。</small><div class="legend"><b>評価の読み方</b>${[['A','良い選択'],['B','妥当な読み合い'],['C','改善候補'],['D','明確なミス'],['E','相手の好プレー'],['F','判定不能']].map(([g,t])=>`<span><i class="grade grade-${g}">${g}</i>${t}</span>`).join('')}</div></aside><div id="analysis-content" tabindex="0" role="region" aria-label="試合分析"><section class="detail-summary"><div class="eyebrow">NEXT ACTION</div><h2>関連課題</h2><div class="issue-chips">${m.issues.map(id=>`<button class="issue-link" data-issue="${id}">${id} ↗</button>`).join('')}</div><p>${esc(m.theme||m.interval||'')}</p><div class="markdown">${markdown(m.next)}</div><div class="damage-legend" aria-label="被ダメージ分類"><b>被ダメージ分類</b><span class="damage-label damage-improve">🟠 被ダメージ・改善候補</span><span class="damage-label damage-mixup">🟣 被ダメージ・読み合い</span><span class="damage-label damage-opponent">🔵 被ダメージ・相手の好対応</span><small>各ラベルは、その行の被ダメージについての評価です。</small></div></section>${[['改善候補・練習方法',m.improve,false],['調査課題',m.research,false],...m.roundBlocks.map(r=>[r.title,r.body,false]),...m.extras.filter(r=>!/^次の10試合/.test(r.title)).map(r=>['動画全体 · '+r.title,r.body,false]),['単発ミス',m.single,false],['過去課題の進捗',m.progress,false]].filter(x=>x[1]).map(([t,body,open])=>`<details class="analysis-section" ${open?'open':''}><summary>${t}</summary><div class="markdown">${markdown(body)}</div></details>`).join('')}<details class="raw"><summary>この試合のMarkdownをすべて読む</summary><div class="markdown">${markdown(m.body)}</div></details></div></div>`;}
function profileView(){
  if(!documents.profile)return heading('PLAYER PROFILE','課題・プロフィール','')+empty();
  const issues=parseIssues(documents.profile);
  const groups=['実戦課題','調査課題','解決済み課題'];
  const panels=['対象','最新動画のゲージ判断メモ','解決済み課題','現在の優先順位','課題一覧','恒常的な弱点・癖','読み合いの記録','双方の体力・ゲージによる評価','分析・更新ルール','現在の最重要課題','改善中','改善済み','検証中の仮説','プレイ傾向'];
  return heading('PLAYER PROFILE','課題を、次の行動へ。','実戦で意識することと、トレモで調べることを分けて管理。')+
    `<section><div class="section-head"><h2>次の10試合</h2></div>${taskCards()}</section>`+
    groups.map(kind=>{const list=issues.filter(x=>x.kind===kind);return list.length?`<section class="issue-group"><div class="section-head"><h2>${kind}</h2><span class="pill">${list.length}件</span></div>${list.map(x=>`<details class="analysis-section issue-card" id="issue-${x.id}"><summary><span class="issue-id">${x.id}</span> ${esc(x.title)} <span class="pill">${esc(x.status)}</span></summary><div class="markdown">${markdown(x.body)}</div></details>`).join('')}</section>`:'';}).join('')+
    panels.map(t=>{const body=section(documents.profile,new RegExp('^'+t+'$'));return body?`<details class="analysis-section"><summary>${t}</summary><div class="markdown">${markdown(body)}</div></details>`:'';}).join('')+
    `<details class="raw"><summary>Markdown全文</summary><div class="markdown">${markdown(documents.profile)}</div></details>`;
}
function bindReportLinks(){
  // IDs remain navigable from tables, prose and focus cards.
  const container=$('#content');const walker=document.createTreeWalker(container,NodeFilter.SHOW_TEXT);const nodes=[];
  while(walker.nextNode())if(!walker.currentNode.parentElement.closest('a,button,summary,code,pre'))nodes.push(walker.currentNode);
  for(const node of nodes){const text=node.textContent;const re=/AKI-\d{3}|Match\s+\d{3}/g;const hits=[...text.matchAll(re)];if(!hits.length)continue;const f=document.createDocumentFragment();let start=0;
    for(const h of hits){f.append(text.slice(start,h.index));const b=document.createElement('button');b.className='issue-link';b.textContent=h[0];if(h[0].startsWith('AKI'))b.dataset.issue=h[0];else b.dataset.reportMatch=h[0];f.append(b);start=h.index+h[0].length;}f.append(text.slice(start));node.replaceWith(f);
  }
  container.querySelectorAll('[data-issue]').forEach(b=>b.onclick=()=>{const id=b.dataset.issue;if(!parseIssues(documents.profile).some(x=>x.id===id)){flash('この課題の詳細はプロフィールにまだ登録されていません。');return;}page='profile';selected=null;render();const d=document.getElementById('issue-'+id);d.open=true;d.scrollIntoView({block:'start'});});
  container.querySelectorAll('[data-report-match]').forEach(b=>b.onclick=()=>{const index=matches.findIndex(m=>m.title===b.dataset.reportMatch);if(index<0)return;selected=index;page='matches';render();window.scrollTo(0,0);});
  container.querySelectorAll('a').forEach(a=>{const href=a.getAttribute('href');if(/^(?:\.\/)?(?:player_profile|matches)\.md(?:#.*)?$/.test(href||''))a.onclick=e=>{e.preventDefault();page=href.includes('player_profile')?'profile':'matches';selected=null;render();window.scrollTo(0,0);};});
}
async function fetchCloud(){const {data,error}=await client.from('battle_documents').select('documents,revision').eq('user_id',user.id).maybeSingle();if(error)throw error;documents=data?.documents||{};revision=data?.revision||0;matches=parseMatches(documents.matches);}
async function importMD(files){
  if(busy)return; const next={...documents};let count=0;const kinds=new Set();
  for(const file of files){if(!/\.(md|markdown)$/i.test(file.name))continue;if(file.size>5*1024*1024)throw new Error('mdファイルは1つ5MB以内で取り込んでください。');const text=await file.text();const kind=classify(file.name,text);if(kinds.has(kind))throw new Error('同じ種類のmdが複数あります。更新版を1つずつ選んでください。');if(!text.trim())throw new Error('空のmdは取り込めません。');kinds.add(kind);next[kind]=text;count++;}
  if(!count)throw new Error('matches.md / player_profile.md を選んでください。');
  const replacing=[...kinds].filter(k=>documents[k]);
  if(replacing.length&&!await confirmDialog('分析ログを更新しますか？','取り込んだ種類のログ全体を更新版に差し替えます。動画の保存はそのままです。','差し替える'))return;
  busy=true;flash('分析ログを保存しています…');$('#import').disabled=true;
  try{if(local)localStorage.setItem('battle-notes-preview',JSON.stringify(next));else{const {data,error}=await client.rpc('save_battle_documents',{p_documents:next,p_expected_revision:revision});if(error)throw new Error(/conflict/i.test(error.message)?'別の端末で更新されています。「保存・設定」で最新の内容を取得し、更新版を確認してから再度取り込んでください。':error.message);revision=Number(data);}
    documents=next;matches=parseMatches(documents.matches);selected=null;flash(`${count}ファイルを${local?'この端末に保存':'同期'}しました。`);render();
  }finally{busy=false;if($('#import'))$('#import').disabled=false;}
}
async function pickVideo(){
  if(!window.showOpenFilePicker){$('#video-input').click();return;}
  try{
    const [handle]=await window.showOpenFilePicker({multiple:false,types:[{description:'動画',accept:{'video/*':['.mp4','.webm','.mov']}}]});
    await attachVideo(await handle.getFile(),handle);
  }catch(e){if(e.name!=='AbortError')throw e;}
}
async function attachVideo(file, handle){
  if(!file)return;const m=matches[selected];if(!m)throw new Error('先に試合を開いてください。');
  if(!file.type.startsWith('video/')&&!/\.(mp4|webm|mov)$/i.test(file.name))throw new Error('動画ファイルを選んでください。');
  const k=videoKey(m);
  if(handle){await videoStore('put',k,{handle,name:file.name});temporaryVideos.delete(k);}
  else{await videoStore('delete',k);temporaryVideos.set(k,file);}
  await keys();render();
  flash(handle?'動画を関連付けました。次回は元ファイルから読み込みます。':'動画を開きました。コピーは保存しません。次回は再選択してください。');
}
async function loadVideo(requestAccess=false){
  const generation=videoGeneration;const m=matches[selected];
  try{
    const k=videoKey(m);let file=temporaryVideos.get(k);
    const record=file?null:await videoStore('get',k);
    if(generation!==videoGeneration)return;
    if(!file&&!record)return;
    if(record?.handle){
      let permission=await record.handle.queryPermission({mode:'read'});
      if(permission!=='granted'&&requestAccess)permission=await record.handle.requestPermission({mode:'read'});
      if(generation!==videoGeneration)return;
      if(permission!=='granted'){
        $('#video-slot').innerHTML='<p>元動画へのアクセス許可が必要です。</p><button id="allow-video" class="secondary">動画へのアクセスを許可</button>';
        $('#allow-video').onclick=guard(()=>loadVideo(true));return;
      }
      file=await record.handle.getFile();
    }
    if(generation!==videoGeneration||!file)return;
    if(videoURL)URL.revokeObjectURL(videoURL);
    videoURL=URL.createObjectURL(file);
    $('#video-slot').innerHTML='<video controls playsinline preload="metadata" id="player"></video>';
    const player=$('#player');player.src=videoURL;
    player.onerror=()=>flash('このブラウザでは動画を再生できません。H.264/AAC形式のMP4などに変換してください。',true);
    timeLinks($('#analysis-content'),timestamp=>{
      const target=seconds(timestamp);
      if(!Number.isFinite(player.duration)){flash('動画の読み込み後にもう一度時刻を選んでください。');return;}
      if(target>player.duration){flash('指定時刻が動画の長さを超えています。対応する動画を確認してください。',true);return;}
      player.currentTime=target;player.play().catch(()=>flash('動画の再生ボタンを押してください。'));
    });
  }catch(e){
    if(generation!==videoGeneration)return;
    $('#video-slot').innerHTML='<p>元動画を開けませんでした。「動画を差し替える」から再選択してください。</p>';
    flash('元動画の場所とアクセス許可を確認してください。',true);
  }
}
async function deleteVideo(){
  if(!await confirmDialog('動画の関連付けを解除しますか？','同じ動画を使う試合の関連付けも解除します。元の動画ファイルと分析ログは削除されません。','解除する'))return;
  const k=videoKey(matches[selected]);await videoStore('delete',k);temporaryVideos.delete(k);await keys();flash('動画の関連付けを解除しました。');render();
}
function confirmDialog(title,body,label){return new Promise(resolve=>{const d=document.createElement('dialog');d.innerHTML=`<h2>${esc(title)}</h2><p>${esc(body)}</p><div class="button-row"><button class="secondary" data-no>キャンセル</button><button class="primary" data-yes>${esc(label)}</button></div>`;document.body.append(d);const end=v=>{d.close();d.remove();resolve(v);};d.querySelector('[data-no]').onclick=()=>end(false);d.querySelector('[data-yes]').onclick=()=>end(true);d.oncancel=e=>{e.preventDefault();end(false);};d.showModal();});}
async function storageInfo(){const data=await navigator.storage?.estimate?.();if($('#storage-info'))$('#storage-info').textContent=data?`このサイトの使用量 ${((data.usage||0)/1024**3).toFixed(2)} GB / 保存上限 約${((data.quota||0)/1024**3).toFixed(1)} GB`:'保存容量を取得できませんでした。';}
function download(kind){const blob=new Blob([documents[kind]],{type:'text/markdown;charset=utf-8'});const link=document.createElement('a');const object=URL.createObjectURL(blob);link.href=object;link.download=kind==='profile'?'player_profile.md':'matches.md';link.click();setTimeout(()=>URL.revokeObjectURL(object),1000);}
let depth=0;
window.addEventListener('dragenter',e=>{if(!user||!e.dataTransfer.types.includes('Files'))return;e.preventDefault();depth++;$('#drop-overlay').hidden=false;});
window.addEventListener('dragover',e=>{if(user)e.preventDefault();});
window.addEventListener('dragleave',()=>{depth=Math.max(0,depth-1);if(!depth&&$('#drop-overlay'))$('#drop-overlay').hidden=true;});
window.addEventListener('drop',guard(async e=>{e.preventDefault();depth=0;if($('#drop-overlay'))$('#drop-overlay').hidden=true;if(!user)return;const files=[...e.dataTransfer.files];if(files.some(f=>f.type.startsWith('video/')||/\.(mp4|webm|mov)$/i.test(f.name))){if(files.length!==1||selected==null)throw new Error('動画は試合詳細を開いて、1つずつ追加してください。');const item=[...e.dataTransfer.items].find(i=>i.kind==='file');const handlePromise=item?.getAsFileSystemHandle?.();const handle=handlePromise?await handlePromise:null;await attachVideo(files[0],handle?.kind==='file'?handle:undefined);}else await importMD(files);}));
window.addEventListener('focus',guard(async()=>{if(user&&!local&&!busy){const prev=revision;await fetchCloud();if(revision!==prev){selected=null;render();flash('別の端末で更新された分析を読み込みました。');}}}));
async function enter(session){if(!session){user=null;accessScreen();return;}const {data,error}=await client.from('owner_accounts').select('email').limit(1);if(error||!data?.length){await client.auth.signOut();accessScreen(error?'同期先の初期設定を確認してください。':'このアカウントは利用者として登録されていません。');return;}user=session.user;await fetchCloud();await keys();render();}
if(client){client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'){user=null;documents={};matches=[];videoGeneration++;if(videoURL)URL.revokeObjectURL(videoURL);accessScreen();}else if(event==='INITIAL_SESSION'||event==='SIGNED_IN'){setTimeout(()=>enter(session).catch(e=>accessScreen(e.message)),0);}});}else accessScreen();
