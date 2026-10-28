const $ = id => document.getElementById(id);
let state, recording = false;
const selectors = new Map();
function installSelector(select) {
  const button = document.createElement('button');button.className='selector-face';button.type='button';button.setAttribute('role','combobox');button.setAttribute('aria-expanded','false');button.setAttribute('aria-label',select.id==='interval'?'Wallpaper interval':'Photo source');
  select.parentNode.appendChild(button);let menu;
  const sync=()=>{button.textContent=select.selectedOptions[0]?.textContent||'';};
  const close=()=>{menu?.remove();menu=null;button.setAttribute('aria-expanded','false');};
  const open=()=>{
    if(menu){close();return;}
    menu=document.createElement('div');menu.className='dropdown';menu.setAttribute('role','listbox');
    const rect=button.getBoundingClientRect();menu.style.left=rect.left+'px';menu.style.width=rect.width+'px';document.body.appendChild(menu);
    const maxHeight=Math.min(250,select.options.length*30+2);menu.style.top=(rect.bottom+maxHeight>innerHeight?Math.max(4,rect.top-maxHeight):rect.bottom)+'px';
    for(const option of select.options){const item=document.createElement('button');item.type='button';item.textContent=option.textContent;item.setAttribute('role','option');item.setAttribute('aria-selected',String(option.selected));item.onclick=()=>{select.value=option.value;sync();close();select.dispatchEvent(new Event('change'));button.focus();};menu.appendChild(item);}
    button.setAttribute('aria-expanded','true');(menu.querySelector('[aria-selected=true]')||menu.firstChild).focus();
  };
  button.onclick=open;button.onkeydown=e=>{if(['ArrowDown','ArrowUp','Enter',' '].includes(e.key)){e.preventDefault();open();}};
  document.addEventListener('pointerdown',e=>{if(menu&&!menu.contains(e.target)&&!button.contains(e.target))close();});
  document.addEventListener('keydown',e=>{if(!menu)return;if(e.key==='Escape'){e.preventDefault();close();button.focus();}else if(e.key==='Tab')close();else if(['ArrowDown','ArrowUp','Home','End'].includes(e.key)){e.preventDefault();const items=[...menu.children];let i=items.indexOf(document.activeElement);i=e.key==='Home'?0:e.key==='End'?items.length-1:(i+(e.key==='ArrowDown'?1:-1)+items.length)%items.length;items[i].focus();}});
  selectors.set(select.id,sync);sync();
}
for(const select of document.querySelectorAll('select'))installSelector(select);
function render(value) {
  state=value;const s=value.settings;
  $('interval').value=s.intervalMinutes;$('source').value=s.photoSource;$('buttons').checked=s.desktopButtons;$('button-state').textContent=s.desktopButtons?'ON':'OFF';
  if(value.platform==='darwin')$('source').options[0].textContent='SYSTEM PHOTOS';
  for(const sync of selectors.values())sync();
  if(!recording){$('shortcut').value=s.shortcut;$('shortcut').placeholder='RECORD';}
  $('photo-path').hidden=s.photoSource!=='folder';$('photo-path').textContent=s.photoFolder||'';$('photo-path').title=s.photoFolder||'';
  $('connect').hidden=value.platform!=='darwin'||s.photoSource!=='system'||value.photoAccess;
  $('save-path').textContent=s.saveFolder;$('choose-save').title=s.saveFolder;
  $('status').textContent=value.error||'';$('status').hidden=!value.error;
}
async function act(action){try{const value=await action();if(value)render(value);}catch(e){$('status').textContent=e.message;$('status').hidden=false;}}
const update=patch=>act(()=>wallpapers.update({...state.settings,...patch}));
$('interval').onchange=()=>update({intervalMinutes:Number($('interval').value)});
$('source').onchange=()=>update({photoSource:$('source').value});
$('buttons').onchange=()=>update({desktopButtons:$('buttons').checked});
$('choose-photo').onclick=()=>act(()=>wallpapers.choose('photo'));
$('choose-save').onclick=()=>act(()=>wallpapers.choose('save'));
$('connect').onclick=()=>act(()=>wallpapers.connectPhotos());
$('clear-shortcut').onclick=()=>{recording=false;update({shortcut:''});};
$('shortcut').onclick=()=>{recording=true;$('shortcut').value='';$('shortcut').placeholder='PRESS KEYS';};
$('shortcut').onblur=()=>{recording=false;if(state)$('shortcut').value=state.settings.shortcut;$('shortcut').placeholder='RECORD';};
$('shortcut').onkeydown=e=>{
  if(!recording)return;e.preventDefault();if(e.key==='Escape'){recording=false;render(state);return;}if(!e.ctrlKey&&!e.altKey&&!e.metaKey)return;
  const key=e.code.startsWith('Key')?e.code.slice(3):e.code.startsWith('Digit')?e.code.slice(5):/^F\d{1,2}$/.test(e.code)?e.code:e.code==='Space'?'Space':'';if(!key)return;
  recording=false;update({shortcut:[e.ctrlKey&&'Control',e.altKey&&'Alt',e.metaKey&&'Super',e.shiftKey&&'Shift',key].filter(Boolean).join('+')});
};
wallpapers.change(render);act(()=>wallpapers.state());
