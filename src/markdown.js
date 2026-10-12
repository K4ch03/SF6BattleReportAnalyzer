import { withoutGoodActions, expandIssueIds } from './parser.js';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
marked.setOptions({ gfm: true, breaks: true });
export function markdown(text = '') {
  const safe = DOMPurify.sanitize(marked.parse(withoutGoodActions(text)), { USE_PROFILES: { html: true }, FORBID_TAGS: ['img','video','audio','iframe','style','input','form'], FORBID_ATTR: ['style'] });
  const root = document.createElement('div'); root.innerHTML = safe;
  root.querySelectorAll('a').forEach(a => { a.target = '_blank'; a.rel = 'noopener noreferrer'; });
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  while(walker.nextNode())if(!walker.currentNode.parentElement.closest('a,code,pre'))walker.currentNode.textContent=expandIssueIds(walker.currentNode.textContent);
  root.querySelectorAll('table').forEach(table => {
    table.querySelectorAll('tbody tr').forEach(tr=>{if(tr.cells[0]?.querySelector('strong') && /\d+:\d{2}/.test(tr.cells[0].textContent))tr.classList.add('highlight-scene');}); const labels=[...table.querySelectorAll('thead th')].map(th=>th.textContent); table.querySelectorAll('tbody tr').forEach(tr=>[...tr.children].forEach((td,i)=>{td.dataset.label=labels[i]||'';})); const wrap = document.createElement('div'); wrap.className = 'table-scroll'; table.replaceWith(wrap); wrap.append(table); });
  root.querySelectorAll('td').forEach(td => { const t = td.textContent.trim(); if (/^(A|B|C|D|E|F)([：／/。\s]|$)/.test(t)) td.dataset.grade = t[0]; });
  // Turn the damage label added below each scene timestamp into a compact badge.
  root.querySelectorAll('table tbody tr').forEach(tr => {
    const timeCell = tr.cells[0];
    if (!timeCell) return;
    const walker = document.createTreeWalker(timeCell, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) {
      const match = /([🟠🟣🔵])\s*(被ダメージ・(?:改善候補|読み合い|相手の好対応))/.exec(node.textContent);
      if (!match) continue;
      const badge = document.createElement('span');
      badge.className = 'damage-label ' + (match[2].includes('改善候補') ? 'damage-improve' : match[2].includes('読み合い') ? 'damage-mixup' : 'damage-opponent');
      badge.textContent = `${match[1]} ${match[2]}`;
      const fragment = document.createDocumentFragment();
      fragment.append(node.textContent.slice(0, match.index), badge, node.textContent.slice(match.index + match[0].length));
      node.replaceWith(fragment);
      tr.classList.add('has-damage-label');
      break;
    }
  });
  return root.innerHTML;
}
export function timeLinks(container, seek) {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT);
  const nodes = []; while(walker.nextNode()) if (!walker.currentNode.parentElement.closest('a,button,code,pre')) nodes.push(walker.currentNode);
  for (const node of nodes) {
    const regex = /\b(?:\d{1,2}:)?\d{1,3}:[0-5]\d\b/g;
    const matches = [...node.textContent.matchAll(regex)]; if (!matches.length) continue;
    const fragment = document.createDocumentFragment(); let offset = 0;
    for(const match of matches) { fragment.append(node.textContent.slice(offset, match.index)); const button = document.createElement('button'); button.className = 'time-link'; button.textContent = match[0]; button.title = match[0] + ' から再生'; button.onclick = () => seek(match[0]); fragment.append(button); offset = match.index + match[0].length; }
    fragment.append(node.textContent.slice(offset)); node.replaceWith(fragment);
  }
}
