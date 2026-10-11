export const clean = (text = '') => text.replace(/\*\*/g, '').replace(/`/g, '').trim();
export function sections(md = '') {
  const result = []; let current = { title: '', level: 0, body: '' }; let fenced = false;
  for (const line of md.replace(/\r\n/g, '\n').split('\n')) {
    if (/^\s*```/.test(line)) fenced = !fenced;
    const h = !fenced && /^(#{1,6})\s+(.+)$/.exec(line);
    if (h) { result.push(current); current = { title: clean(h[2]), level: h[1].length, body: '' }; }
    else current.body += line + '\n';
  }
  result.push(current); return result;
}
export function section(md, pattern) {
  const ss = sections(md); const start = ss.findIndex(s => pattern.test(s.title));
  if (start < 0) return '';
  let output = ss[start].body;
  for (let i = start + 1; i < ss.length && ss[i].level > ss[start].level; i++) output += '#'.repeat(ss[i].level) + ' ' + ss[i].title + '\n' + ss[i].body;
  return output.trim();
}
export function field(md, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return clean(new RegExp('^\\s*[-*]\\s*' + escaped + '[：:]\\s*(.*)$', 'm').exec(md)?.[1] || '');
}
function videoFile(md) { return /([^\n：:]*?\.(?:mp4|webm|mov))/i.exec(md)?.[1]?.replace(/^[-*]\s*/, '').replace(/^[「"`]|[」"`]$/g, '').trim() || ''; }
const blockText = item => '#'.repeat(item.level)+' '+item.title+'\n'+item.body;
export function parseMatches(md = '') {
  const ss=sections(md);const result=[];let context=md.split(/^##\s+(?:Match\s|試合\s*\d)/m)[0],batch=0;
  const updated=/最終更新[：:]\s*([^\n]+)/.exec(md)?.[1]||'';
  for(let i=0;i<ss.length;i++){
    const h=ss[i];
    if(h.level===2 && /^動画情報/.test(h.title)){context=blockText(h);batch++;continue;}
    if(h.level!==2 || !/^(?:Match\s+\S+|試合\s*\d+)/i.test(h.title))continue;
    let j=i+1;while(j<ss.length && ss[j].level>2)j++;
    const body=h.body+ss.slice(i+1,j).map(blockText).join('');
    const children=sections(body);
    const roundBlocks=children.filter(x=>x.level===3&&/^R\d|^ラウンド\s*\d/.test(x.title)).map(x=>({title:x.title,body:section(body,new RegExp('^'+x.title.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'$'))}));
    const nested=section(body,/^ラウンド分析/);
    if(nested)for(const r of sections(nested).filter(x=>x.level===4))roundBlocks.push({title:r.title,body:r.body});
    const title=h.title;const rawVideo=field(body,'動画');
    result.push({id:title,title,body,batch,opponent:field(body,'相手')||field(context,'相手')||'相手未記載',result:field(body,'結果')||'結果未記載',date:field(body,'日付')||field(body,'分析日')||updated,
      theme:field(body,'現在の改善テーマ'),video:videoFile(rawVideo)||videoFile(context)||title,interval:field(body,'対戦区間')||(!videoFile(rawVideo)?rawVideo:''),
      issues:[...new Set(body.match(/AKI-\d{3}/g)||[])],roundBlocks,rounds:nested||roundBlocks.map(r=>'### '+r.title+'\n'+r.body).join(''),
      good:section(body,/良かった/),improve:section(body,/改善候補|改善点/),research:section(body,/^調査課題/),next:section(body,/次の10試合/),progress:section(body,/過去課題|進捗/),single:section(body,/単発/),extras:children.filter(x=>x.level===3&&/^(リソース管理|パターンの整理|実戦課題)/.test(x.title)).map(x=>({title:x.title,body:section(body,new RegExp('^'+x.title+'$'))}))});
    i=j-1;
  }
  // Video-level summaries are shared by the matches of that video, not appended to the last round.
  let group=0;
  for(let i=0;i<ss.length;i++){
    const h=ss[i];if(h.level===2&&/^動画情報/.test(h.title))group++;
    if(h.level!==2||! /^(今回のリソース判断|パターンの整理|今回の優先順位|次の10試合)/.test(h.title))continue;
    let j=i+1;while(j<ss.length&&ss[j].level>2)j++;
    const body=h.body+ss.slice(i+1,j).map(blockText).join('');
    for(const m of result.filter(m=>m.batch===group)){m.extras.push({title:h.title,body});if(/^次の10試合/.test(h.title))m.next=body;}
  }
  return result;
}
export function parseIssues(md=''){
  let kind='';const result=[];const ss=sections(md);
  for(let i=0;i<ss.length;i++){
    const h=ss[i];if(h.level===2)kind=h.title;
    const match=/^(AKI-\d{3})[：:]\s*(.*)/.exec(h.title);
    if(h.level!==3||!match)continue;
    let j=i+1;while(j<ss.length&&ss[j].level>3)j++;
    const body=h.body+ss.slice(i+1,j).map(blockText).join('');
    result.push({id:match[1],title:match[2],kind,status:field(clean(body),'状態'),body});
  }return result;
}
export function tasks(md) {
  return md.split('\n').filter(l => /^\s*(?:\d+[.)]|[-*])\s+/.test(l)).slice(0, 3).map(l => {
    const text = clean(l.replace(/^\s*(?:\d+[.)]|[-*])\s+/, ''));
    const quote = /「([^」]+)」[：:]?\s*(.*)/.exec(text);
    return { title: quote?.[1] || text.split(/[：:]/)[0], description: quote?.[2] || text.split(/[：:]/).slice(1).join('：') };
  });
}
export function classify(name, text) {
  if (/player[_ -]?profile/i.test(name) || /^#\s+AKI Player Profile/m.test(text)) return 'profile';
  if (/matches/i.test(name) || parseMatches(text).length) return 'matches';
  throw new Error(name + '：matches.md または player_profile.md を選んでください。');
}
export function seconds(timestamp) { return timestamp.split(':').reduce((a, b) => a * 60 + Number(b), 0); }

// Omit retired positive-action summaries from rendered reports, preserving source exports.
export function withoutGoodActions(md = '') {
  const result=[];let skipLevel=0;
  for(const item of sections(md)){
    if(skipLevel && item.level && item.level<=skipLevel)skipLevel=0;
    if(/^良かった(?:行動|ところ)$/.test(item.title)){skipLevel=item.level;continue;}
    if(!skipLevel)result.push((item.level?'#'.repeat(item.level)+' '+item.title+'\n':'')+item.body);
  }
  return result.join('');
}
