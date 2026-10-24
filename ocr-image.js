// Keep character strokes in an OCR-friendly range instead of blindly enlarging scans.
export function findTextScale(rows, width, height) {
 const bands = []; let start = -1;
 const minimumInk = Math.max(2, width * 0.0015);
 for (let y = 0; y <= height; y++) {
  if (y < height && rows[y] >= minimumInk) { if (start < 0) start = y; }
  else if (start >= 0) { const size = y - start; if (size >= 5) bands.push(size); start = -1; }
 }
 if (!bands.length || bands.some(size => size > height * 0.6)) return 1;
 bands.sort((a,b) => a-b); const typical = bands[Math.floor(bands.length / 2)];
 return typical > 52 ? Math.max(0.35, 40 / typical) : 1;
}
export function normalizeJapaneseSpacing(text) {
 // Remove segmentation spaces only between Japanese characters, preserving Latin words and line breaks.
 return text.replace(/([\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])[ \t]+(?=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])/gu, '$1').replace(/[ \t]+([。、！？])/g, '$1');
}
export function prepareOcrImage(source, { vertical = false } = {}) {
 const context = source.getContext('2d', {willReadFrequently:true});
 const pixels = context.getImageData(0,0,source.width,source.height);
 const histogram = new Uint32Array(256);
 for (let i=0;i<pixels.data.length;i+=4) {
  const gray = Math.round(pixels.data[i]*0.299 + pixels.data[i+1]*0.587 + pixels.data[i+2]*0.114);
  histogram[gray]++;
 }
 const count = source.width*source.height;
 let low=0, high=255, total=0;
 for(let i=0;i<256;i++){total+=histogram[i];if(total>=count*0.001){low=i;break;}}
 total=0;for(let i=255;i>=0;i--){total+=histogram[i];if(total>=count*0.001){high=i;break;}}
 const range=high-low;
 // Very small range is blank/noise. Leave it alone rather than amplifying it into text.
 const stretch=range>=12 && range<220;
 const threshold=range>=12 ? low+range*0.5 : 110;
 const rows = new Uint32Array(vertical ? source.width : source.height); let ink=0;
 for(let y=0;y<source.height;y++)for(let x=0;x<source.width;x++){
  const i=(y*source.width+x)*4;
  const gray=Math.round(pixels.data[i]*0.299+pixels.data[i+1]*0.587+pixels.data[i+2]*0.114);
  if(gray<threshold){rows[vertical ? x : y]++;ink++;}
  const value=stretch?Math.max(0,Math.min(255,Math.round((gray-low)*255/range))):gray;
  pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=value;pixels.data[i+3]=255;
 }
 // Analyze column widths for vertical text; do not infer character size from photographs.
 const ratio=ink/count;
 const scale=ratio>0.001 && ratio<0.25 ? findTextScale(rows,vertical ? source.height : source.width,vertical ? source.width : source.height) : 1;
 context.putImageData(pixels,0,0);
 const output=document.createElement('canvas');const border=16;
 output.width=Math.round(source.width*scale)+border*2;output.height=Math.round(source.height*scale)+border*2;
 const target=output.getContext('2d');target.fillStyle='#fff';target.fillRect(0,0,output.width,output.height);
 target.imageSmoothingEnabled=true;target.imageSmoothingQuality='high';
 target.drawImage(source,border,border,output.width-border*2,output.height-border*2);
 return output;
}
export function chooseRecognition(first, alternative) {
 if (!alternative.text.trim()) return first;
 if (!first.text.trim()) return alternative;
 const firstLength=first.text.replace(/\s/g,'').length, secondLength=alternative.text.replace(/\s/g,'').length;
 return alternative.confidence >= first.confidence+3 && secondLength>=firstLength*0.7 ? alternative : first;
}
