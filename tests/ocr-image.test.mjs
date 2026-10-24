import test from 'node:test';
import assert from 'node:assert/strict';
import {findTextScale,normalizeJapaneseSpacing,chooseRecognition} from '../dist/ocr-image.js';
test('large character bands are reduced, photographs and ordinary text stay unchanged',()=>{
 const rows=new Uint32Array(400);for(let y=40;y<140;y++)rows[y]=70;
 assert.equal(findTextScale(rows,900,400),0.4);
 assert.equal(findTextScale(new Uint32Array(400).fill(80),900,400),1);
 const normal=new Uint32Array(400);for(let y=40;y<70;y++)normal[y]=70;
 assert.equal(findTextScale(normal,900,400),1);
});
test('Japanese segmentation spaces are removed without merging English words or lines',()=>{
 assert.equal(normalizeJapaneseSpacing('請求 書 合計 金額 1500 円\nPDF OCR test'), '請求書合計金額 1500 円\nPDF OCR test');
 assert.equal(normalizeJapaneseSpacing('日本 語\n文字 認識'),'日本語\n文字認識');
 assert.equal(normalizeJapaneseSpacing('文字 認識します 。'),'文字認識します。');
});
test('recognition fallback rejects empty or truncated high-confidence output',()=>{
 const first={text:'日本語の文字認識テスト',confidence:75};
 assert.equal(chooseRecognition(first,{text:'',confidence:99}),first);
 assert.equal(chooseRecognition(first,{text:'日本語',confidence:99}),first);
 const better={...first,confidence:85};assert.equal(chooseRecognition(first,better),better);
 assert.equal(chooseRecognition(first,{...first,confidence:76}),first);
});
