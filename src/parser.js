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
export function parseMatches(md = '') {
  const lines = md.replace(/\r\n/g, '\n').split('\n'); const starts = [];
  let fenced = false;
  lines.forEach((l, i) => { if (/^\s*```/.test(l)) fenced = !fenced; if (!fenced && /^##\s+(?:Match\s+\S+|試合\s*\d+)/i.test(l)) starts.push(i); });
  const globalVideo = videoFile(lines.slice(0, starts[0] ?? lines.length).join('\n'));
  return starts.map((start, n) => {
    const body = lines.slice(start + 1, starts[n + 1] ?? lines.length).join('\n');
    const title = clean(lines[start].replace(/^##\s+/, ''));
    const rawVideo = field(body, '動画');
    return { id: title, title, body, opponent: field(body, '相手') || '相手未記載', result: field(body, '結果') || '結果未記載', date: field(body, '日付'), theme: field(body, '現在の改善テーマ'), video: videoFile(rawVideo) || globalVideo || title,
      rounds: section(body, /ラウンド分析/), good: section(body, /良かった/), improve: section(body, /改善候補|改善点/), next: section(body, /次の10試合/), progress: section(body, /過去課題|進捗/), single: section(body, /単発/)};
  });
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
