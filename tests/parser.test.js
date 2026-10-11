import test from 'node:test';
import assert from 'node:assert/strict';
import {parseMatches,section,tasks,classify,seconds} from '../src/parser.js';
const fixture=`# 分析ログ
- 動画：test.mp4
## Match 001
- 相手：マノン
- 結果：0–2で敗北
- 動画：上記動画 0:00～1:31
### ラウンド分析
#### R1：敗北
| 時間 | 評価 |
|---|---|
| 0:35 | C |
### 次の10試合
1. 「届かないなら一拍」：相手の動きを見る。
## Match 002
- 相手：リュウ
- 結果：勝利
### 良かった行動
対空
`;
test('splits multi-match logs and preserves nested round sections',()=>{const a=parseMatches(fixture);assert.equal(a.length,2);assert.equal(a[0].opponent,'マノン');assert.equal(a[0].video,'test.mp4');assert.match(a[0].rounds,/#### R1/);assert.doesNotMatch(a[0].rounds,/次の10試合/);assert.equal(a[1].good,'対空');});
test('does not parse fake match headings in fenced code',()=>assert.equal(parseMatches('```\n## Match fake\n```\n'+fixture).length,2));
test('profile child headings remain with their parent section',()=>assert.match(section('# Profile\n## 現在の最重要課題\n### 1. 待つ\n- 内容：観察\n## 強み\n対空',/^現在の最重要課題$/),/### 1. 待つ/));
test('extracts actionable phrases with a maximum of three',()=>{const t=tasks('1. 「待つ」：一拍\n2. 「見る」：観察\n3. 「守る」：ガード\n4. 「四つ目」');assert.equal(t.length,3);assert.deepEqual(t[0],{title:'待つ',description:'一拍'});});
test('file classification and invalid names',()=>{assert.equal(classify('matches(1).md',fixture),'matches');assert.equal(classify('renamed.md','# AKI Player Profile'),'profile');assert.throws(()=>classify('unrelated.md','hello'));});
test('timestamps support minutes and hours',()=>{assert.equal(seconds('3:19'),199);assert.equal(seconds('1:02:03'),3723);});

import { withoutGoodActions } from '../src/parser.js';
test('retired good-action section is omitted including nested content', () => {
  const source='## Match 001\n### **良かった行動**\n旧内容\n#### 詳細\n詳細内容\n### 改善候補\n残す\n';
  const output=withoutGoodActions(source);
  assert.ok(!output.includes('旧内容'));
  assert.ok(!output.includes('詳細内容'));
  assert.ok(output.includes('改善候補'));
  assert.ok(output.includes('残す'));
});

import { parseIssues } from '../src/parser.js';
test('video contexts and shared summaries do not leak between matches',()=>{
 const md=`# Log
## 動画情報
- 動画：first.mp4
- 相手：マノン
## Match 001
- 結果：敗北
### ラウンド分析
#### R1：敗北
old round
## 動画情報：second.mp4
- 相手：リュウ
## Match 002
- 対戦区間：約0:00～1:00
### R1：勝利
new round
## Match 003
### R1：敗北
third round
## 今回のリソース判断
shared resources
## 次の10試合
1. 待つ
`;
 const m=parseMatches(md);
 assert.equal(m[0].video,'first.mp4');assert.equal(m[1].video,'second.mp4');
 assert.equal(m[1].opponent,'リュウ');assert.equal(m[1].roundBlocks.length,1);
 assert.ok(!m[0].body.includes('second.mp4'));assert.ok(!m[2].rounds.includes('shared resources'));
 assert.equal(m[0].extras.length,0);assert.equal(m[1].extras.length,2);assert.equal(m[2].extras.length,2);
});
test('issue details preserve bold metadata and research separation',()=>{
 const p=`## 実戦課題
### AKI-003：DI警戒
- **状態：** 実戦で確認中
- **行動：** 待つ
## 調査課題
### AKI-007：追撃
- **状態：** 未調査
`;
 const issues=parseIssues(p);assert.equal(issues.length,2);assert.equal(issues[0].status,'実戦で確認中');assert.equal(issues[1].kind,'調査課題');
});
