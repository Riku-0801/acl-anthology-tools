# Research & Design Decisions

---
**Purpose**: 発見フェーズの調査記録、アーキテクチャ検討の根拠を記録する。

---

## Summary

- **Feature**: `acl-anthology-chrome-extension`
- **Discovery Scope**: New Feature（グリーンフィールド）
- **Key Findings**:
  - ACL AnthologyのイベントページはシンプルなHTML構造であり、DOMセレクターによる論文情報抽出が確実に可能
  - Chrome Extension Manifest V3では`localStorage`は使用不可（Service WorkerからアクセスできないためService Worker非対応）。`chrome.storage.local`が唯一の適切な永続化手段
  - BibTeXは各論文詳細ページの`<div id="citeBibtex">`に埋め込まれており、一覧ページの`[bib]`リンク（`/paper-id.bib`形式）からも取得可能

---

## Research Log

### ACL Anthology イベントページのDOM構造

- **Context**: コンテンツスクリプトが論文情報をページから抽出するためにセレクターを確定する必要があった
- **Sources Consulted**: `https://aclanthology.org/events/acl-2024/`をWebFetchで直接調査
- **Findings**:
  - 論文エントリはボリュームセクション（`<h4 id="2024acl-long">`等）の下にグループ化
  - タイトル: `<strong><a href="/paper-id/">` — 太字リンク
  - 著者: `<a href="/people/author-slug/">` — カンマ区切りの名前リンク
  - PDFリンク: `[pdf]` テキストを持つ`<a>`タグ
  - BibTeXリンク: `[bib]` テキストを持つ`<a>`タグ（例: `/2024.acl-long.1.bib`）
  - アブストラクト: `abs` テキストの`<a>`タグでトグル、展開後に`<span class="abstract-full">`にテキスト
- **Implications**: コンテンツスクリプトはこれらのセレクターを用いて`PaperEntry`オブジェクトを構築できる。アブストラクトは一覧ページに存在することが多いが、折りたたまれているためDOM内に存在する

### ACL Anthology 論文詳細ページのDOM構造

- **Context**: 詳細ページでのBibTeX取得・アブストラクト取得・著者情報取得のためのセレクター確定
- **Sources Consulted**: `https://aclanthology.org/2024.acl-long.1/`をWebFetchで直接調査
- **Findings**:
  - タイトル: `<h2 id="title">` または `<h1>`
  - 著者: `<p class="lead">`内の`<a href="/people/...">`リンク群
  - アブストラクト: `<div class="acl-abstract"><span id="abstract-full">` または `<textarea id="paperAbstract">`
  - PDFリンク: `.btn`クラスを持つ`<a href="https://aclanthology.org/XXXX.pdf">`
  - BibTeX: `<div id="citeBibtex"><pre>...</pre>` — ページ内に全文埋め込み済み
- **Implications**: 詳細ページではBibTeXの非同期フェッチ不要。DOMから直接取得可能。著者スラッグ（`/people/taraka-rama/`形式）をキーとして著者キャッシュを実装できる

### Chrome Extension Manifest V3 アーキテクチャ

- **Context**: MV3の制約とベストプラクティスの確認
- **Sources Consulted**: Chrome Developers公式ドキュメント調査
- **Findings**:
  - Service Workerはイベント駆動型で永続的バックグラウンドページを持たない
  - `localStorage`はService WorkerのコンテキストでのWeb Storage APIに属しており利用不可
  - `chrome.storage.local`は全コンテキスト（Service Worker・コンテンツスクリプト・Popup）からアクセス可能
  - コンテンツスクリプトとService Worker間の通信は`chrome.runtime.sendMessage`/`onMessage`で実現
  - コンテンツスクリプトは各タブのページコンテキストで実行され、拡張機能コンテキストとは分離
- **Implications**: ストレージ設計はすべて`chrome.storage.local`ベースに統一。Service Workerへのフェッチ委譲でコンテンツスクリプトのCORS制約を回避できる

### BibTeX取得戦略

- **Context**: 一覧ページからBibTeXをコピーするため、リアルタイムでBibTeXデータを取得する方法を検討
- **Findings**:
  - 一覧ページの`[bib]`リンクは`/2024.acl-long.1.bib`形式のURLを持ち、プレーンテキストのBibTeXを返す
  - 詳細ページでは`<div id="citeBibtex"><pre>`にBibTeX全文が埋め込まれている
  - Service Workerを通じて`.bib` URLをフェッチすることでCORS制約を回避できる
- **Implications**: 一覧ページでは`[bib]`リンクのURLをService Worker経由でフェッチしてBibTeXを取得。詳細ページでは既存DOM要素から取得

### 著者情報取得戦略

- **Context**: 著者ホバーポップアップのデータソース設計
- **Findings**:
  - ACL Anthologyの著者ページ（`/people/author-slug/`）には当該著者の全論文一覧が含まれる
  - 著者スラッグはDOMのリンクhref属性から抽出可能（例: `/people/taraka-rama/` → スラッグ `taraka-rama`）
  - 著者ページHTMLをフェッチしてパースすることで最新論文を取得できる
- **Implications**: 著者ポップアップデータはService Workerが著者ページをフェッチ・パースして返す。セッションキャッシュ（`chrome.storage.session`）で短期間の重複フェッチを防ぐ

---

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| コンテンツスクリプト中心（採用） | 各ページタイプ専用のコンテンツスクリプトがDOM操作を担い、Service WorkerはFetch/Storage委譲のみ | シンプル、デバッグ容易、DOM操作は本来CSの責務 | コンテンツスクリプトが肥大化するリスク | Chrome拡張の標準パターンに準拠 |
| Service Worker中心 | ロジックをSWに集約し、CSはUIのみ担当 | ロジック一元化 | メッセージパッシングが複雑化、SWはDOM操作不可 | 不採用 |
| ShadowDOM Popup | 各機能をiframe/ShadowDOMのPopupUIとして実装 | ページスタイル分離 | 複雑なUI実装が必要 | 一部機能（abstractプレビュー）に限定採用 |

---

## Design Decisions

### Decision: `chrome.storage.local` を永続化手段として採用

- **Context**: MV3のService WorkerはlocalStorageにアクセス不可
- **Alternatives Considered**:
  1. `localStorage` — コンテンツスクリプトは使用可能だがService Workerから不可
  2. `chrome.storage.sync` — デバイス間同期だが容量制限が厳しい（8KB/アイテム、512アイテム）
  3. `chrome.storage.local` — 容量10MB、全コンテキストからアクセス可能
- **Selected Approach**: `chrome.storage.local` を採用
- **Rationale**: Service WorkerとPopupの両方からアクセスが必要なため
- **Trade-offs**: デバイス間同期なし（ローカルのみ）
- **Follow-up**: 10MB上限の監視（ブックマーク・既読記録の増加を想定）

### Decision: BibTeX取得をService Worker経由のFetchに統一

- **Context**: 一覧ページからBibTeXをコピーする際、コンテンツスクリプトは直接外部URLをfetchできる場合もあるが、CORSポリシーの変動リスクがある
- **Alternatives Considered**:
  1. コンテンツスクリプトから直接fetch — CORSリスクあり
  2. Service Worker経由のfetch — 拡張機能の権限でCORSを回避
- **Selected Approach**: Service Worker経由のfetchを採用
- **Rationale**: 拡張機能のfetchはCORS制約を受けない（`host_permissions`で許可済みの場合）
- **Trade-offs**: メッセージパッシングのオーバーヘッドが増加（許容範囲）

### Decision: イベントページ検索をクライアントサイドフィルタリングで実装

- **Context**: Requirement 5「イベントページでのリアルタイム検索」の実装方式
- **Alternatives Considered**:
  1. サーバーサイド検索（ACL Anthology APIへのクエリ） — APIが存在しないため不可
  2. クライアントサイドフィルタリング — 既存DOMを操作して表示/非表示を切り替え
- **Selected Approach**: クライアントサイドDOM操作によるフィルタリング
- **Rationale**: イベントページはすべての論文が初期レンダリング時にDOMに存在するため、表示/非表示の切り替えで実現可能
- **Trade-offs**: 大規模イベント（数百論文）での初期DOM読み込みコストが若干増加（許容範囲）

---

## Risks & Mitigations

- ACL AnthologyのDOM構造変更 → セレクターを定数ファイルに集約し変更を局所化。主要セレクターのIntegration Testで検出
- `chrome.storage.local`の10MB上限超過 → ブックマーク・既読記録の容量を起動時に確認し、上限接近時にユーザーに警告
- Service Workerのlifecycle（非アクティブ時の終了） → 各操作をイベント駆動で完結させる設計にし、長期処理を持たない
- アブストラクトがDOMに存在しない場合の非同期フェッチによるUXレイテンシー → フェッチ中はスケルトンUIを表示

---

## References

- [Chrome Extension Manifest V3 Overview](https://developer.chrome.com/docs/extensions/develop/migrate/what-is-mv3) — MV3アーキテクチャの公式説明
- [chrome.storage API](https://developer.chrome.com/docs/extensions/reference/api/storage) — ストレージAPIの仕様
- [Content Scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts) — コンテンツスクリプトの制約と通信パターン
- [ACL Anthology Events Page](https://aclanthology.org/events/acl-2024/) — 実際のDOM構造の確認元
