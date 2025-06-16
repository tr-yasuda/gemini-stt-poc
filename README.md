# Gemini STT PoC

Google Gemini AIを使用した音声録音・書き起こしシステムのプルーフ・オブ・コンセプト（PoC）アプリケーションです。

## 🎯 概要

このアプリケーションは、音声を録音し、Google Gemini 2.0 Flash AIを使用して自動的に日本語の文字起こしを行う Web アプリケーションです。

### 主な機能

- **音声録音**: ブラウザのマイクを使用してリアルタイム音声録音
- **無音検出**: 設定可能な閾値と継続時間による自動セグメント分割
- **自動書き起こし**: Google Gemini APIを使用した高精度な日本語音声転写
- **録音管理**: 録音されたセグメントの再生、書き起こし、ダウンロード機能
- **リアルタイム音量監視**: 音量レベルの可視化と無音状態の検出

## 🚀 技術スタック

- **フロントエンド**: React 19 + TypeScript + Vite
- **AIサービス**: Google Gemini 2.0 Flash API
- **UIライブラリ**: shadcn/ui + Tailwind CSS
- **音声処理**: Web Audio API + MediaRecorder API
- **スタイリング**: Tailwind CSS v4
- **開発ツール**: Biome (Linter & Formatter)

## 📋 前提条件

- Node.js 18以上
- pnpm (推奨) または npm
- Google AI Studio API キー

## 🛠️ セットアップ

### 1. リポジトリのクローン

```bash
git clone <リポジトリURL>
cd gemini-stt-poc
```

### 2. 依存関係のインストール

```bash
pnpm install
# または
npm install
```

### 3. 環境変数の設定

`.env.example`をコピーして`.env`ファイルを作成し、Google AI Studio APIキーを設定してください。

```bash
cp .env.example .env
```

`.env`ファイルを編集：

```env
# Google Gemini API Key
# https://aistudio.google.com/app/apikey から取得してください
VITE_GOOGLE_API_KEY=your_actual_api_key_here
```

### 4. API キーの取得方法

1. [Google AI Studio](https://aistudio.google.com/app/apikey) にアクセス
2. Googleアカウントでログイン
3. 「Create API Key」をクリック
4. 生成されたAPIキーを`.env`ファイルに設定

## 🚀 実行方法

### 開発サーバーの起動

```bash
pnpm dev
# または
npm run dev
```

ブラウザで `http://localhost:5173` にアクセスしてアプリケーションを使用できます。

### その他のコマンド

```bash
# ビルド
pnpm build

# プレビュー
pnpm preview

# コードフォーマット
pnpm format

# Lint
pnpm lint
```

## 🎛️ 使用方法

### 基本的な使い方

1. **無音検出設定**:
   - 自動分割の有効/無効を切り替え
   - 音量閾値（0.1%〜10%）を調整
   - 無音継続時間（0.1秒〜10秒）を設定

2. **録音開始**:
   - 「録音開始」ボタンをクリック
   - ブラウザからマイクアクセス許可を求められたら「許可」をクリック

3. **自動機能**:
   - 無音検出が有効な場合、設定した条件で自動的にセグメント分割
   - 各セグメントは録音終了後、自動的に書き起こしが開始される

4. **録音管理**:
   - 各録音セグメントの再生、再書き起こし、ダウンロードが可能
   - 不要な録音は削除可能

### 設定項目の説明

- **音量閾値**: この値以下の音量を「無音」として検出
- **無音継続時間**: 指定した時間無音が続いた場合にセグメントを分割
- **自動分割**: 無音検出によるセグメント自動分割機能の有効/無効

## 🔧 カスタマイズ

### 書き起こし言語の変更

`src/hooks/useTranscription.ts`の34行目でプロンプトを変更できます：

```typescript
text: "Please transcribe the audio in English. Provide only the transcription text without any additional formatting or explanations.",
```

### 音声フォーマットの変更

`src/hooks/useAudioRecorder.ts`でレコーダーの設定を変更できます。

## 📝 アーキテクチャ

```
src/
├── components/          # UIコンポーネント
│   ├── ui/             # 再利用可能なUIコンポーネント
│   └── SpeechRecorder.tsx  # メインの録音コンポーネント
├── hooks/              # カスタムフック
│   ├── useAudioRecorder.ts     # 音声録音機能
│   ├── useTranscription.ts     # Gemini API書き起こし
│   ├── useVolumeMonitoring.ts  # 音量監視・無音検出
│   ├── useRecordingsList.ts    # 録音リスト管理
│   └── useAudioPlayer.ts       # 音声再生機能
├── types/              # TypeScript型定義
└── lib/                # ユーティリティ関数
```

## 🐛 トラブルシューティング

### よくある問題

1. **マイクアクセスエラー**
   - ブラウザの設定でマイクアクセスが許可されているか確認
   - HTTPSでアクセスしているか確認（localhostは除く）

2. **書き起こしエラー**
   - Google AI Studio API キーが正しく設定されているか確認
   - APIキーに十分なクレジットがあるか確認
   - ネットワーク接続を確認

3. **音声が録音されない**
   - マイクが正常に動作しているか確認
   - 他のアプリケーションがマイクを使用していないか確認

## 📄 ライセンス

このプロジェクトはMITライセンスの下で公開されています。
