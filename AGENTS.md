# このリポジトリについて（AI/Claude向け）

太陽と月の位置・出入り・薄明を追うクロスプラットフォームPWA「Skydial」。
Sun Surveyor / Sun Seeker の代替を、洗練されたモバイルファーストUIで。ja/en 両対応。

## 開発規約

- **Vanilla Vite + TypeScript**。フレームワーク不使用。UIはDOM直組み(`src/ui/`)。
- **重いライブラリは動的import**: Three.js(ドーム)と Leaflet(地図)は各タブ初回表示時にロード。
  初期バンドルはダッシュボード+天体計算のみ(数KB gzip目標)。`vite build` の出力で確認する。
- **厳格CSP前提**(vercel.json)。inline script/style禁止。外部リソースは地図タイル(img-src)のみ。
- **Permissions-Policy は camera/geolocation/センサー = self**。テンプレ由来の全拒否に戻さないこと(AR/GPSが黙って死ぬ)。

## テスト方針(lib 100%)

- `src/astro/**`・`src/state/**`・`src/i18n/**`・`src/views/map/rays.ts` は
  カバレッジ100%ゲート(vitest.config.ts)。UI/Three/Leaflet層は対象外。
- 天体計算は fixture 突合(`src/astro/__fixtures__/ephemeris.ts`、出典コメント必須):
  NOAA Solar Calculator・国立天文台こよみ。許容誤差=太陽±1分/±0.1°、月±5分/±0.3°。
- エッジを必ず含める: 極夜白夜(型 `RiseSetResult` で表現)・月の出/入りが無い日(null)・うるう年・日付変更線。

## 天体計算の出典

- 太陽: Meeus "Astronomical Algorithms" ch.25 低精度式(誤差~0.01°)。
- 月: Meeus ch.47 truncated(主要項・目標0.3°)+地心視差補正。月齢/輝面比は ch.48。
- 座標変換・大気差(Bennett)は `src/astro/coords.ts`。方位規約は N=0°時計回り。

## コミット粒度

フェーズ単位(計算エンジン/画面/ビュー)でまとまったら commit。テストとセットで。
tsc green / test green / build green を保ってから commit する。

## 留意

- private 開始。public化は publish-check 経由のみ。
- 個人情報・実データをコード/テストに入れない。
- 計算値は概算(航海・測量用途ではない)。UIにも脚注済み。
