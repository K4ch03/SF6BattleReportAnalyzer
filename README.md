# Battle Notes — SF6 Battle Report Analyzer

自分専用のSF6対戦分析ビューア。PCで読み込んだMarkdownをスマホにも同期し、動画はPCのブラウザ内に保存します。

## できること

- `matches.md` / `player_profile.md` をまとめてドラッグ＆ドロップ
- ホームに「次の10試合」の最大3課題、強み、最近の試合を表示
- 試合検索・相手別フィルター・ラウンド分析・A〜F評価の色分け
- 元のMarkdownを全文表示。専用表示の対象外の見出しも失わない
- Google認証＋Supabaseによる自分だけのmd保存、スマホ同期
- 更新mdの差し替え確認、同時更新の競合検知、mdの書き出し
- IndexedDBへの動画保存、再訪時の復元、タイムスタンプから再生
- 同じ動画名を参照する複数試合で動画を共有
- 動画削除、保存領域の保護リクエスト、容量エラー表示
- スマホでは動画がなくても全文分析を閲覧可能

動画はサーバーへ送信しません。分析mdはログイン後にSupabaseへ保存します。Gitには実際の分析ログ・動画を含めていません。

## Vercelで公開する手順

### 1. Supabaseを準備

1. 自分のSupabaseアカウントで新しいプロジェクトを作成。
2. SQL Editorで `supabase/schema.sql` の内容を実行。
3. 以下を自分のGoogleアカウントのメールに置き換えて実行。

```sql
insert into public.owner_accounts(email)
values(lower('自分のGoogleメールアドレス'))
on conflict do nothing;
```

この許可リストはブラウザから書き換えられません。未登録のアカウントは分析データを読み書きできません。RLSで利用者本人のレコードのみ許可します。

### 2. Vercelへインポート

1. VercelのAdd New ProjectからこのGitHubリポジトリを選択。
2. Framework PresetはVite。Build Commandは `npm run build`、Output Directoryは `dist`。
3. Environment Variablesに次の2つを設定。

| 名前 | 値 |
|---|---|
| `VITE_SUPABASE_URL` | SupabaseプロジェクトのURL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabaseのpublishable key（旧anon keyも可） |

**service_role keyやsecret keyは絶対に設定しないでください。** 上の2つはブラウザへ渡す公開用接続情報です。データの保護はSQLのRLSと許可リストで行います。

4. Deployを実行し、本番URLを控える。

### 3. Googleログインを接続

1. Google Cloud ConsoleでOAuth同意画面を作成。テスト中なら自分をテストユーザーに追加。
2. OAuth Client IDを作成し、種類はWeb application。
3. Authorized redirect URIには、SupabaseのGoogleプロバイダー設定画面に表示されるCallback URL（通常 `https://PROJECT.supabase.co/auth/v1/callback`）を登録。
4. SupabaseのAuthentication → Providers → Googleを有効化し、GoogleのClient IDとClient Secretを設定。SecretをGitやVercelのVITE変数へ入れない。
5. SupabaseのAuthentication → URL Configurationで、Site URLにVercel本番URLを設定。Redirect URLsにも同じ本番URLを登録（必要なら末尾 `/` の形式も登録）。
6. 許可リストに登録したGoogleアカウントでアプリへログイン。

GoogleやSupabaseの画面名称は変更される場合があります。公式ガイド：
- https://supabase.com/docs/guides/auth/social-login/auth-google
- https://supabase.com/docs/guides/database/postgres/row-level-security

## 使い方

1. PCでGoogleログインし、分析の `matches.md` と `player_profile.md` を取り込む。
2. 試合一覧から試合を開き、「動画を追加」で対応動画を選ぶ。
3. 動画の保存後、分析中の時刻をクリックするとその位置から再生する。
4. スマホでは同じ本番URLを開き、同じGoogleアカウントでログインする。
5. 更新版のmdを取り込むと、その種類のログ全体を差し替える。追記済みの完全版を取り込むこと。動画は維持される。
6. 他端末の変更はページを開いた時・画面へ戻った時、または「保存・設定」の「最新の内容を取得」で反映。

プロフィールのみ／試合ログのみの取り込みも可能です。一度に同じ種類のログを複数指定した場合は保存せずエラーを表示します。編集UIはありません。

### Markdown形式

```markdown
# AKI 継続対戦分析ログ
- 動画：example.mp4
## Match 001
- 日付：2026-10-11
- 相手：マノン
- 結果：0–2で敗北
- 動画：example.mp4
- 現在の改善テーマ：待つ時間を増やす
### ラウンド分析
#### R1
| 時間 | 状況 | 評価 |
|---|---|---|
| 0:35 | 中距離 | C：改善候補 |
### 良かった行動
対空
### 改善候補
練習方法など
### 次の10試合
1. 「届かないなら一拍」：相手の動きを見る。
```

プロフィールは `# AKI Player Profile`、見出しは `## 現在の最重要課題` / `強み` / `改善中` / `改善済み` / `検証中の仮説` / `プレイ傾向` に対応。全文も必ず表示できます。

**異なる動画は固有のファイル名で記録してください。** 同じ動画名は同じ保存動画として扱います。長い累積ログには試合ごとの `- 動画：ファイル名.mp4` を記載するのが確実です。時刻は動画先頭からの `m:ss` または `h:mm:ss`。

## ローカル開発

Node.js 20.19以上（Node 22以降推奨）。

```bash
npm install
cp .env.example .env.local
npm run dev
npm test
npm run build
```

接続情報が未設定のときだけ「この端末で表示を試す」が表示されます。確認モードはクラウドへ接続せず、mdをlocalStorageへ保存します。確認モードの内容はGoogleアカウントへ自動移行しません。本番設定後はmdを再度取り込んでください。

## 保存に関する制約

- 動画は同じ端末・ブラウザ・サイトURLの保存領域に保存。別端末には同期されない。
- サイトデータを削除すると保存動画も消える。保存領域の保護リクエストはブラウザが拒否することもある。元動画は残すこと。
- VercelのプレビューURLと本番URLは別の保存領域。本番URLを固定して使う。
- ブラウザが対応していないコーデックの動画は再生できない。H.264/AACのMP4が無難。
- ログアウトしても動画の実体は端末に残るが、画面ではログインしたアカウントの動画だけを参照。
- mdは各ファイル5MB以内。動画はブラウザの空き容量に依存。
- Markdown内の危険なHTMLと外部画像は除去する。
- Supabaseプロジェクトの管理者はデータを管理できる。エンドツーエンド暗号化ではない。

## 構成

Vite / Vanilla JavaScript / Supabase Auth + PostgreSQL / IndexedDB / marked + DOMPurify。

`src/parser.js` に表示用解析、`src/storage.js` に動画保存、`supabase/schema.sql` に許可リスト・RLS・更新競合チェックがあります。

## 接続後の確認

- 登録済みGoogleアカウントでログインでき、未登録アカウントは拒否されること
- PCでmdを保存し、スマホで同じ内容が読めること
- 動画保存後に再読み込みしても再生でき、時刻リンクが動くこと
- 2端末で古い内容を上書きしようとすると競合が表示されること

Google/Supabaseの実プロジェクト設定がない環境では、上記の認証・端末間同期の実接続テストはできません。
