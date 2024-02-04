import path from 'node:path';
import { performance } from 'node:perf_hooks';
import fg from 'fast-glob';
import fs from 'fs-extra';
import sharp from 'sharp';
import prettyBytes from 'pretty-bytes';

/**
 * Options
 * @see https://sharp.pixelplumbing.com/api-output
 *
 * Note: コメントアウトの()はデフォルト値です。値は配列で一度に複数生成する処理にしてます。
 */
const parameters = {
  jpg: {
    // quality: [80], // 画質 (1-100の整数) (80)
    // progressive: false, // プログレッシブスキャンを使用するかどうか (false)
    // chromaSubsampling: ["'4:2:0'"], // クロマサブサンプリングの設定 ('4:4:4'に設定するとクロマサブサンプリングを防ぎます。それ以外はデフォルトで '4:2:0' クロマサブサンプリング) ('4:2:0')
    // optimiseCoding: [true], // Huffmanコーディングテーブルを最適化するかどうか (true)
    // optimizeCoding: true, // optimiseCodingの代替スペリング (true)
    // mozjpeg: false, // mozjpegのデフォルト設定を使用するかどうか (false)
    // trellisQuantisation: false, // mozjpegデフォルト設定と等価 { trellisQuantisation: true, overshootDeringing: true, optimiseScans: true, quantisationTable: 3 } (false)
    // trellisQuantisation: false, // trellis quantisationを適用するかどうか (false)
    // overshootDeringing: false, // overshoot deringingを適用するかどうか (false)
    // optimiseScans: false, // プログレッシブスキャンを最適化するかどうか (プログレッシブスキャンを強制的に有効にします) (false)
    // optimizeScans: false, // optimiseScansの代替スペリング (false)
    // quantisationTable: 0, // 量子化テーブルを使用する (0-8の整数) (0)
    // quantizationTable: 0, // quantisationTableの代替スペリング (0)
    // force: true, // JPEG出力を強制するかどうか（それ以外の場合は入力形式を使用しようとします） (true)
  },
  png: {
    // progressive: [false], // プログレッシブスキャンを使用するかどうか (false)
    // compressionLevel: [6], // zlib圧縮レベル (0が最速・最大、9が最遅・最小) (6)
    // adaptiveFiltering: [false], // アダプティブローフィルタリングを使用するかどうか (false)
    // palette: [false], // パレットベースの画像に減色し、アルファ透明度をサポートするかどうか (false)
    // quality: [100], // クオリティに必要な最小限の色数を使用し、パレットをtrueに設定 (100)
    // effort: [7], // CPUの努力度合い（1が最速、10が最遅）、パレットをtrueに設定 (7)
    // colours: [256], // パレットの最大エントリ数、パレットをtrueに設定 (256)
    // colors: [256], // coloursの代替スペリング、パレットをtrueに設定 (256)
    // dither: [1.0], // Floyd-Steinberg誤差拡散のレベル、パレットをtrueに設定 (1.0)
    // force: [true], // PNG出力を強制するかどうか（それ以外の場合は入力形式を使用しようとします） (true)
  },
  webp: {
    quality: [80], // 品質1(最も悪い) と100(最も良い) の間 (80)
    // alphaQuality: [30, 50, 70, 90], // アルファレイヤーの品質 (0-100の整数) (100)
    // lossless: [true], // ロスレス圧縮モードを使用するかどうか (false)
    // nearLossless: [true], // 近似ロスレス圧縮モードを使用するかどうか (false)
    // smartSubsample: [true], // 高品質クロマサブサンプリングを使用するかどうか (false)
    // preset: ["'default'"], // 前処理/フィルタリングのための名前付きプリセット ('default')
    // effort: [0, 1, 2, 3, 5, 6], // CPUの努力度合い（0が最速、6が最遅） (4)
    // loop: [0], // アニメーションの繰り返し回数 (0は無限アニメーション) (0)
    // delay: [0], // アニメーションフレーム間の遅延（ミリ秒単位）または遅延の配列 (0)
    // minSize: [false], // ファイルサイズを最小化するためにアニメーションキーフレームの使用を防ぐかどうか (遅い) (false)
    // mixed: [false], // 損失および非損失アニメーションフレームの混在を許可するかどうか (遅い) (false)
    // force: [true], // WebP出力を強制するかどうか (true)
  },
  avif: {
    quality: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100], // 品質1(最も悪い) と100(最も良い) の間 (50)
    // effort: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], // エンコード速度。0（速度優先、圧縮率は低い）、9（速度遅い、圧縮率は高め）（4）
    // quality: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100], // 品質1(最も悪い) と100(最も良い) の間 (50)
    // lossless: [true], // 可逆圧縮モード (false)
    // effort: [0, 1, 2, 3, 5, 6, 7, 8, 9], // エンコード速度。0（速度優先、圧縮率は低い）、9（速度遅い、圧縮率は高め）（4）
    // chromaSubsampling: ['4:2:0', '4:4:4'], // エンコード方法。4:2:0は解像度低減、4:4:4はクロマ解像度が維持されます ('4:2:0')
  }
}

const report = {jpg: {}, png: {}, webp: {}, avif: {}};
const inputs = './images/*.{jpg,jpeg,png,gif,webp}';
const distDir = './dist';

/**
 * imageMin
 */
const imageMin = async (file) => {
  const fileExtName = path.extname(file);
  const fileName = path.basename(file, fileExtName);

  for (const ext in parameters) {
    report[ext][fileName] = {};
    for (let [option, values] of Object.entries(parameters[ext])) {
      values.map(async (val) => {
        // console.log({[ext]: {[option]: val}});
        const paramName = Array.isArray(val) ? val.join(',') : val;
        const outputName = `${fileName}-${option}-${paramName}`;

        // ----------------------------------
        // Sharp
        const src = sharp(file);
        const img = path.join(distDir, `${outputName}.${ext}`);
        const start = performance.now();

        // jpg or png
        if(['jpg', 'png'].includes(ext)) {
          await src.toFormat(ext, {[option]: val}).toFile(img);
        }

        // WebP
        if(ext === 'webp') {
          await src.webp({[option]: val}).toFile(img);
        }

        // AVIF
        if(ext === 'avif') {
          await src.avif({[option]: val}).toFile(img);
        }

        const end = performance.now();
        const { size } = fs.statSync(img);
        report[ext][fileName][option + val] = {
          size: prettyBytes(size),
          time: `${Number(((end - start) / 1000 % 60).toFixed(2))} s`,
        };
        console.log(`Create -> ${outputName}.${ext}`)
      })
    }
  }
};

/**
 * Init
 */
const init = async () => {
  if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  const files = fg.sync(inputs);
  await Promise.all(files.map(imageMin));
};

init();

process.on('exit', () => {
  const json = JSON.stringify(report, null);
  fs.writeFileSync(`${distDir}/report.json`, json, 'utf8');
});