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
