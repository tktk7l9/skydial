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

- `src/astro/**`・`src/state/**`・`src/i18n/**`・`src/views/map/rays.ts`・
  `src/views/ar/pose.ts`・`src/views/ar/projection.ts`・`src/sunsim/**` は
  カバレッジ100%ゲート(vitest.config.ts)。UI/Three/Leaflet層は対象外。
- 天体計算は fixture 突合(`src/astro/__fixtures__/ephemeris.ts`、出典コメント必須):
  NOAA Solar Calculator・国立天文台こよみ・USNO・JPL Horizons。許容誤差=太陽±1分/±0.1°、月±5分/±0.3°。
- 日射計算は pvlib-python 生成 fixture(`src/sunsim/__fixtures__/clearsky.ts`、生成スクリプト全文コミット必須)
  と0.1%以内で突合。物理不変量(冬至南面>夏至南面・北面窓の冬至直達≈0 等)もセットで。
- エッジを必ず含める: 極夜白夜(型 `RiseSetResult` で表現)・月の出/入りが無い日(null)・うるう年・日付変更線。

## 天体計算の出典

- 太陽: Meeus "Astronomical Algorithms" ch.25 低精度式(誤差~0.01°)。
- 月: Meeus ch.47 truncated(主要項・目標0.3°)+地心視差補正。月齢/輝面比は ch.48。朔望・夏至冬至は
  離角/黄経クロッシングの二分法ソルバー(`src/astro/phaseevents.ts`)。
- 座標変換・大気差(Bennett)は `src/astro/coords.ts`。方位規約は N=0°時計回り。

## 日射計算(sunsim/)の出典

- 晴天モデル: Ineichen–Perez (2002)。傾斜面: Hay–Davies。係数は pvlib-python(BSD-3-Clause)から移植、
  関数ヘッダに出典URL必須。新しい放射モデルの式を追加するときは一次出典または pvlib 参照実装から
  確認すること(係数を記憶や推測で書かない)。
- 幾何/遮蔽: `src/sunsim/geometry.ts` が唯一の三角形メッシュ生成元(表示用 `house3d.ts` と
  遮蔽計算 `shading.ts` の両方がここから作る)。ENU座標はドーム(`views/dome/`)と共通
  (+x東,+y上,−z北)。新しい屋根形状・障害物形状を追加する際もこの座標系を維持する。
- `HouseModel` は個人の実寸法を含む可能性がある。デフォルト値(`defaultHouse()`)は
  「典型例」に留め、実データをリポジトリにコミットしない(localStorage/URL共有のみ)。
- 室内可視化(`src/sunsim/interior.ts`): 窓の4隅を太陽方向に沿って床(y=0)へ投影し、建物footprint
  矩形(Sutherland–Hodgman)でクリップする純幾何。日陰(`directShadeFraction`)の適用は呼び出し側
  (`simulate.ts`/`house3d.ts`)の責務— interior.ts自体は遮蔽を知らない。建物全体を1部屋として扱う
  簡略化のため、奥の壁に先に当たるような低い光線は意図的に「床パッチなし」を返す(壁面パッチはv1スコープ外)。
  `house3d.ts` は屋根を半透明にして(壁は不透明)俯瞰角度から常にパッチが見えるようにしている
  — 新しい建物パーツ(内壁・複数階等)を追加する際もこの可視性を壊さないこと。

## コミット粒度

フェーズ単位(計算エンジン/画面/ビュー)でまとまったら commit。テストとセットで。
tsc green / test green / build green を保ってから commit する。

## 留意

- **public**(2026-07-08〜)。公開リポジトリなので個人情報・実データをコード/テストに入れない。
- 計算値は概算(航海・測量用途ではない)。日射計算も気象データなしの晴天モデル概算。UIにも脚注済み。
