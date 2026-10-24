import * as pdfjs from './pdf.mjs';
pdfjs.GlobalWorkerOptions.workerSrc = new URL('./pdf.worker.mjs', import.meta.url).href;
const $ = id => document.getElementById(id);
let busy = false, cancelled = false, worker = null, loadingTask = null, documentPdf = null, currentName = 'document', activePage = 0, pageCount = 0;
const showError = message => { $('error').textContent = message; $('error').hidden = false; };
function progress(message, percent, detail = '') { $('status').textContent = message; $('bar').value = percent; $('detail').textContent = detail; }
function controls(disabled) { busy = disabled; for (const id of ['pick','language','quality','new']) $(id).disabled = disabled; $('dropzone').setAttribute('aria-busy', String(disabled)); }
$('pick').onclick = () => $('file').click();
$('file').onchange = event => { const file = event.target.files[0]; if (file) processPdf(file); event.target.value = ''; };
for (const name of ['dragenter','dragover']) $('dropzone').addEventListener(name, event => { event.preventDefault(); if (!busy) $('dropzone').classList.add('drag'); });
for (const name of ['dragleave','drop']) $('dropzone').addEventListener(name, event => { event.preventDefault(); $('dropzone').classList.remove('drag'); });
$('dropzone').addEventListener('drop', event => { if (busy) return; const files = event.dataTransfer.files; if (files.length !== 1) return showError('PDFを1ファイルずつ追加してください。'); processPdf(files[0]); });
window.addEventListener('dragover', event => event.preventDefault()); window.addEventListener('drop', event => event.preventDefault());
$('help').onclick = () => $('guide').showModal(); $('close').onclick = () => $('guide').close();
$('new').onclick = () => { $('result').hidden = true; $('error').hidden = true; $('text').value = ''; $('pick').focus(); };
$('cancel').onclick = async () => { cancelled = true; $('cancel').disabled = true; progress('中止しています…', $('bar').value); if (worker) { const previous = worker; worker = null; await previous.terminate(); } if (loadingTask && !documentPdf) await loadingTask.destroy(); };
$('copy').onclick = async () => { try { await navigator.clipboard.writeText($('text').value); $('copy').textContent = 'コピーしました'; setTimeout(() => $('copy').textContent = 'コピー', 2000); } catch { showError('コピーできませんでした。テキストを選択してコピーしてください。'); } };
$('save').onclick = () => { const url = URL.createObjectURL(new Blob(['\ufeff' + $('text').value], {type:'text/plain;charset=utf-8'})); const link = document.createElement('a'); link.href = url; link.download = currentName + '.txt'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); };
async function processPdf(file) {
 if (busy) return;
 $('error').hidden = true;
 if (!/\.pdf$/i.test(file.name)) return showError('PDF形式のファイルを選択してください。');
 if (file.size > 50 * 1024 * 1024) return showError('ファイルサイズは50MB以下にしてください。');
 if (!file.size) return showError('空のファイルは読み取れません。');
 controls(true); cancelled = false; $('cancel').disabled = false; $('progress').hidden = false; $('result').hidden = true; $('text').value = ''; const parts = []; let scanned = 0, direct = 0; const high = $('quality').checked;
 currentName = file.name.replace(/\.pdf$/i, '');
 try {
  progress('PDFを開いています…', 0, file.name);
  const data = new Uint8Array(await file.arrayBuffer());
  if (cancelled) return;
  loadingTask = pdfjs.getDocument({ data, cMapUrl:'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/cmaps/', cMapPacked:true, standardFontDataUrl:'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/standard_fonts/' });
  loadingTask.onPassword = () => { loadingTask.destroy(); showError('パスワード付きPDFには対応していません。保護を解除したPDFを追加してください。'); };
  documentPdf = await loadingTask.promise; pageCount = documentPdf.numPages;
  if (pageCount > 100) throw new Error('100ページまでのPDFに対応しています。PDFを分割して追加してください。');
  for (let number = 1; number <= pageCount; number++) {
   if (cancelled) break; activePage = number;
   progress(`${number} / ${pageCount} ページを読み取り中`, (number - 1) / pageCount * 100, file.name);
   const page = await documentPdf.getPage(number); const content = await page.getTextContent(); if (cancelled) break;
   const text = content.items.map(item => item.str + (item.hasEOL ? '\n' : ' ')).join('').trim();
   let result = text;
   if (text.replace(/\s/g,'').length > 0) { direct++; }
   else {
    if (!worker) {
     progress('OCRモデルを準備しています…', (number - 1) / pageCount * 100, '初回は言語モデルのダウンロードに時間がかかります。');
     const createdWorker = await Tesseract.createWorker($('language').value, 1, { ...(high ? {langPath:'https://tessdata.projectnaptha.com/4.0.0_best'} : {}), logger: message => { if (cancelled) return; if (message.status === 'recognizing text') progress(`${activePage} / ${pageCount} ページをOCR中`, ((activePage - 1 + message.progress) / pageCount) * 100, `${Math.round(message.progress * 100)}% · ${file.name}`); }, errorHandler: () => {} });
     if (cancelled) { await createdWorker.terminate(); break; } worker = createdWorker;
     await worker.setParameters({preserve_interword_spaces:'1'});
    }
    const base = page.getViewport({scale:1}); const desired = high ? 3 : 2; const scale = Math.min(desired, 4096 / Math.max(base.width, base.height), Math.sqrt(16000000 / (base.width * base.height))); const viewport = page.getViewport({scale});
    const canvas = document.createElement('canvas'); canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
    await page.render({canvasContext:canvas.getContext('2d'),viewport,background:'#ffffff'}).promise;
    if (cancelled) { canvas.width = canvas.height = 0; break; }
    const recognized = await worker.recognize(canvas); result = recognized.data.text.trim(); scanned++; canvas.width = canvas.height = 0;
   }
   parts.push(`--- ${number}ページ ---\n${result || '（文字を検出できませんでした）'}`); page.cleanup();
  }
  if (!cancelled) { $('text').value = parts.join('\n\n'); $('summary').textContent = `${pageCount}ページ · 直接抽出 ${direct}ページ / OCR ${scanned}ページ`; $('result').hidden = false; }
 } catch (error) { if (!cancelled && $('error').hidden) { const known = /100ページ/.test(error.message); showError(known ? error.message : 'PDFを読み取れませんでした。ファイルの破損・保護、通信状況を確認して再度お試しください。'); } }
 finally { if (worker) { await worker.terminate().catch(() => {}); worker = null; } if (documentPdf) await documentPdf.destroy().catch(() => {}); documentPdf = null; loadingTask = null; $('progress').hidden = true; controls(false); if (cancelled) showError('読み取りを中止しました。別のPDFを追加できます。'); }
}
