# Requirements Document

## Project Description (Input)

project-name: acl-anthology-tools, discripiton: ACL Anthologyを使いやすくするためのChrome拡張

## はじめに

ACL Anthology（aclanthology.org）は自然言語処理・計算言語学分野の研究論文デジタルアーカイブであり、研究者・学生が論文を検索・閲覧する際に広く利用されている。しかし、現在のウェブインターフェースでは日常的な研究作業において複数の摩擦点が存在する（BibTeX取得の手間、アブストラクト確認のためのページ遷移、既読管理手段の欠如など）。

本仕様書は Chrome拡張機能「acl-anthology-chrome-extension」の要件を定義する。本拡張機能は aclanthology.org ドメイン上でのみ動作し、ユーザーデータはブラウザのローカルストレージに保存する。外部サービスへの通信は行わない。

**対象ユーザー:** NLP研究者・大学院生・研究動向を追う実務エンジニア

## Requirements

### Requirement 1: BibTeX引用の即時コピー

**Objective:** As a researcher, I want to copy BibTeX citations directly from search result and paper listing pages, so that I can quickly build my reference list without navigating away from my current context.

#### Acceptance Criteria

1. When ユーザーが論文一覧ページ（検索結果・著者ページ・会議ページ）の論文エントリにカーソルを合わせる, the Chrome拡張機能 shall BibTeXコピーボタンをインラインで表示する
2. When ユーザーがBibTeXコピーボタンをクリックする, the Chrome拡張機能 shall 該当論文のBibTeXをクリップボードにコピーし「コピーしました」という視覚的フィードバックを表示する
3. If BibTeXデータの取得に失敗した場合, the Chrome拡張機能 shall エラーメッセージをボタン付近にインライン表示し論文ページへの手動リンクを提供する
4. When ユーザーが論文個別ページを表示している, the Chrome拡張機能 shall ページ上部にワンクリックBibTeXコピーボタンを常時表示する

---

### Requirement 2: アブストラクトのインラインプレビュー

**Objective:** As a researcher, I want to preview paper abstracts inline on listing pages without navigating to the paper's detail page, so that I can efficiently triage a large number of papers in a single reading session.

#### Acceptance Criteria

1. When ユーザーが論文一覧ページの論文タイトルにカーソルを合わせる, the Chrome拡張機能 shall アブストラクトテキストをポップアップまたはインライン展開で表示する
2. While アブストラクトプレビューが表示されている間, the Chrome拡張機能 shall プレビュー内からBibTeXコピー・PDF開く・ブックマーク追加の操作を実行できるアクションボタンを提供する
3. When ユーザーが`Escape`キーを押す, the Chrome拡張機能 shall アブストラクトプレビューを閉じる
4. If アブストラクトデータがページ内に存在しない場合, the Chrome拡張機能 shall 論文詳細ページから非同期取得して表示する
5. The Chrome拡張機能 shall アブストラクトプレビューの表示をオン/オフ切り替えられる設定を提供する

---

### Requirement 3: PDF・論文リソースへのクイックアクセス

**Objective:** As a researcher, I want immediate access to PDF links and other paper resources from any listing page, so that I can open papers directly without an intermediate navigation step.

#### Acceptance Criteria

1. When ユーザーが論文一覧ページを表示する, the Chrome拡張機能 shall 各論文エントリにPDF直接リンクボタンを表示する
2. When ユーザーがPDFボタンをクリックする, the Chrome拡張機能 shall 公式PDFリンクを新しいタブで開く
3. Where 論文にArXivバージョンが存在する場合, the Chrome拡張機能 shall ArXivリンクを追加のアクセスオプションとして表示する
4. If 論文にPDFリンクが存在しない場合, the Chrome拡張機能 shall PDFボタンをグレーアウト表示し代替リソース（ACL Anthologyページ等）へのリンクを表示する

---

### Requirement 4: 論文ブックマーク・後で読む管理

**Objective:** As a researcher, I want to save papers to a personal reading list and manage them within the extension, so that I can organize my research reading workflow without relying on external tools.

#### Acceptance Criteria

1. When ユーザーが論文一覧または論文詳細ページでブックマークボタンをクリックする, the Chrome拡張機能 shall 該当論文をlocalStorageに保存しボタン表示を「保存済み」状態に更新する
2. When ユーザーが拡張機能のポップアップを開く, the Chrome拡張機能 shall 保存済み論文のリストをタイトル・著者・保存日時とともに表示する
3. When ユーザーがブックマークリストから論文をクリックする, the Chrome拡張機能 shall ACL Anthologyの該当論文ページを新しいタブで開く
4. If ユーザーがすでにブックマーク済みの論文を再度ブックマークしようとする場合, the Chrome拡張機能 shall 削除の確認を行いユーザーが承認するとブックマークを解除する
5. The Chrome拡張機能 shall ブックマークリストをJSON形式でエクスポートする機能を提供する

---

### Requirement 5: イベントページでのリアルタイム論文検索・絞り込み

**Objective:** As a researcher, I want to filter papers on event pages (aclanthology.org/events/{event_name}/) by typing keywords, so that I can quickly find relevant papers within a conference or workshop without scrolling through hundreds of entries.

#### Acceptance Criteria

1. When ユーザーが`aclanthology.org/events/`配下のページを表示する, the Chrome拡張機能 shall 論文一覧の上部に検索バーを挿入する
2. When ユーザーが検索バーにテキストを入力する, the Chrome拡張機能 shall 入力のたびに論文一覧をリアルタイムで絞り込み、クエリにマッチしない論文エントリを非表示にする
3. The Chrome拡張機能 shall 検索対象としてタイトル・著者名・アブストラクトのテキストを使用する
4. While 検索クエリが入力されている間, the Chrome拡張機能 shall 絞り込み後の表示件数を検索バー付近に「N件 / 全M件」の形式で表示する
5. When ユーザーが検索バーを空にする, the Chrome拡張機能 shall すべての論文エントリを再表示する
6. If アブストラクトがページ内に存在しない論文エントリがある場合, the Chrome拡張機能 shall タイトルと著者名のみを検索対象として絞り込みを実行する

---

### Requirement 6: 著者・関連論文の探索支援

**Objective:** As a researcher, I want to quickly explore other papers by the same authors and related works from a paper's listing entry, so that I can discover relevant research without losing my navigation context.

#### Acceptance Criteria

1. When ユーザーが論文エントリの著者名にカーソルを合わせる, the Chrome拡張機能 shall その著者の最近の論文（最大5件）をポップアップで表示する
2. When ユーザーが著者ポップアップ内の「全著作を見る」リンクをクリックする, the Chrome拡張機能 shall ACL Anthologyの著者ページを新しいタブで開く
3. While 論文詳細ページを表示している間, the Chrome拡張機能 shall サイドパネルに共著者の情報と各共著者の代表論文を表示する
4. If 著者情報の取得に失敗した場合, the Chrome拡張機能 shall 「情報を取得できませんでした」と表示し著者ページへの直接リンクを提供する
5. The Chrome拡張機能 shall 同じ著者ポップアップが短時間に繰り返し表示される場合、取得済みデータをキャッシュして再利用する

---

### Requirement 7: 既読・未読トラッキング

**Objective:** As a researcher, I want to mark papers as read and track my reading progress, so that I can manage my literature review workflow and avoid re-reading papers I have already processed.

#### Acceptance Criteria

1. When ユーザーが論文エントリの既読マークボタンをクリックする, the Chrome拡張機能 shall 該当論文を既読としてlocalStorageに記録しエントリに視覚的なインジケーター（チェックマークや色変更）を表示する
2. While ユーザーがaclanthology.orgの論文一覧を閲覧している間, the Chrome拡張機能 shall 過去に既読としてマークした論文エントリを視覚的に区別して表示する
3. When ユーザーがACL Anthologyの論文個別ページを初めて訪問する, the Chrome拡張機能 shall 該当論文を「訪問済み」として自動的に記録する（明示的な既読マークとは区別する）
4. If ユーザーが既読論文のフィルタリングを要求する, the Chrome拡張機能 shall 論文一覧を「未読のみ表示」「既読のみ表示」「すべて表示」で切り替えられるフィルターを提供する
5. The Chrome拡張機能 shall 既読・訪問済みデータをCSV形式でエクスポートする機能を提供する
