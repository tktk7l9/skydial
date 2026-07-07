# Skydial — Sun & Moon Tracker

太陽と月の位置・日の出日没・薄明・ゴールデンアワー・月齢を、
**3Dドーム / 地図 / AR** で確認できるクロスプラットフォームPWA。
Sun Surveyor / Sun Seeker のような機能を、洗練されたモバイルファーストUIと ja/en 両対応で。

<!-- スクリーンショット -->

## 機能

- **ダッシュボード**: 現在の太陽/月の方位・高度・月齢/輝面比、本日のタイムライン(薄明→日の出→ゴールデンアワー→…)、時刻一覧
- **3Dドーム**: 天球上の太陽軌跡(当日+夏至/冬至比較)と月軌跡
- **地図**: 太陽/月の方位・日の出/日没方向を地図上に光線表示(撮影ロケハン向き)
- **AR**: カメラ映像+端末の向きセンサーで実風景に太陽/月の軌道を重畳
- **日時スクラバー**: 任意の日時にスクラブして過去未来の空を確認。URLで共有可能
- 時刻連動の空グラデーション背景 / ダーク・ライトテーマ / 日本語・英語

## 技術構成

- Vanilla **Vite + TypeScript**(フレームワークなし)
- 天体計算は**依存ゼロの自前実装**(Meeus "Astronomical Algorithms" 準拠、NOAA/国立天文台こよみと突合テスト)
- Three.js(3Dドーム)/ Leaflet(地図)は**動的import** — 初期バンドルは数KB
- PWA: オフラインでも計算・ドーム・ARは全機能動作(地図タイルのみネット必須)
- 厳格CSP・Permissions-Policy(camera/geolocation=self)

## 開発

```bash
npm install
npm run dev        # 開発サーバー
npm test           # テスト
npm run coverage   # カバレッジ(純ロジック層100%ゲート)
npm run build      # tsc + vite build
```

## 品質指標

- lib層(astro/state/i18n/rays)カバレッジ 100% ゲート(CI)
- Lighthouse mobile 100/100/100/100 目標
- Mozilla Observatory A+ 目標

## 精度について

太陽位置 ~0.01°・月位置 ~0.3° の概算です。写真撮影・日照確認用途を想定しており、
航海・測量など高精度が必要な用途には使用しないでください。
