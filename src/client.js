export const CLIENT=String.raw`
(()=>{
 const $=(s,r=document)=>r.querySelector(s),$$=(s,r=document)=>[...r.querySelectorAll(s)];
 const toast=(m)=>{let t=$('#toast');if(!t){t=document.createElement('div');t.id='toast';t.className='toast';document.body.append(t)}t.textContent=m;t.classList.add('show');clearTimeout(window.__toast);window.__toast=setTimeout(()=>t.classList.remove('show'),1900)};
 window.cwToast=toast;
 const copy=async(v,label='متن')=>{try{await navigator.clipboard.writeText(v)}catch{const a=document.createElement('textarea');a.value=v;a.style.cssText='position:fixed;opacity:0';document.body.append(a);a.select();document.execCommand('copy');a.remove()}toast('✓ '+label+' کپی شد')};
 $$('[data-copy]').forEach(b=>b.addEventListener('click',()=>copy(b.dataset.copy,b.dataset.label||'لینک')));
 $$('form[data-confirm]').forEach(f=>f.addEventListener('submit',e=>{if(!confirm(f.dataset.confirm))e.preventDefault()}));
 const side=$('#sidebar'),overlay=$('#overlay');const close=()=>{side?.classList.remove('open');overlay?.classList.remove('open')};$('#menuButton')?.addEventListener('click',()=>{side?.classList.toggle('open');overlay?.classList.toggle('open')});overlay?.addEventListener('click',close);$$('#sidebar a').forEach(a=>a.addEventListener('click',close));
 $$('.qr[data-value]').forEach(qr=>{if(window.QRCode){try{const size=qr.classList.contains('host-qr')?148:196;new QRCode(qr,{text:qr.dataset.value,width:size,height:size,colorDark:'#03101c',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M})}catch(e){qr.textContent='QR در دسترس نیست'}}});
 const file=$('input[type=file]');file?.addEventListener('change',()=>{const x=$('[data-file-name]');if(x)x.textContent=file.files?.[0]?.name||'فایلی انتخاب نشده'});
})();
`;
