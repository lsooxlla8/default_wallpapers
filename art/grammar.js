/* default_desktop composition grammar (engine version 7).
   OKLCH palettes, typed program synthesis over shared kernels, macro layouts with
   zone roles, Euclidean rhythm geometry and the best-of-K critic metrics.
   Everything is a pure function of explicit seeds; recipes store every choice. */
(() => {
  "use strict";
  const TAU=Math.PI*2, PHI=(1+Math.sqrt(5))/2;
  const rand=seed=>{let a=seed>>>0;return (lo=0,hi=1)=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return lo+(hi-lo)*(((t^(t>>>14))>>>0)/4294967296)}};
  const mix32=(a,b)=>{let h=Math.imul((a>>>0)^0x9e3779b9,0x85ebca6b)^(b>>>0);h=Math.imul(h^(h>>>13),0xc2b2ae35);return (h^(h>>>16))>>>0};
  const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
  const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
  const weighted=(R,items)=>{let total=0;for(const [,w] of items)total+=w;let r=R(0,total);for(const [v,w] of items){if((r-=w)<0)return v}return items[items.length-1][0]};
  const picker=R=>a=>a[Math.floor(R(0,a.length))];
  const shuffle=(R,a)=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(R(0,i+1));[a[i],a[j]]=[a[j],a[i]]}return a};

  // ---------- colour: OKLab / OKLCH with WCAG contrast constraints ----------
  const toLinear=c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4, toGamma=c=>c<=.0031308?12.92*c:1.055*Math.pow(c,1/2.4)-.055;
  function labToLinear(L,a,b){
    const l=(L+.3963377774*a+.2158037573*b)**3,m=(L-.1055613458*a-.0638541728*b)**3,s=(L-.0894841775*a-1.2914855480*b)**3;
    return [4.0767416621*l-3.3077115913*m+.2309699292*s,-1.2684380046*l+2.6097574011*m-.3413193965*s,-.0041960863*l-.7034186147*m+1.7076147010*s];
  }
  const hex=rgb=>'#'+rgb.map(x=>Math.round(clamp(toGamma(clamp(x)))*255).toString(16).padStart(2,'0')).join('');
  // Out-of-gamut colours keep lightness and hue; only chroma is reduced.
  function oklch(L,C,h){
    const at=c=>labToLinear(L,c*Math.cos(h),c*Math.sin(h)),ok=v=>v.every(x=>x>=-1e-5&&x<=1+1e-5);
    if(ok(at(C)))return hex(at(C));
    let lo=0,hi=C;for(let i=0;i<20;i++){const m=(lo+hi)/2;if(ok(at(m)))lo=m;else hi=m}
    return hex(at(lo));
  }
  const grayHex=L=>{const v=Math.round(clamp(toGamma(clamp(L)**3))*255).toString(16).padStart(2,'0');return '#'+v+v+v};
  const luminance=c=>{const [r,g,b]=[1,3,5].map(i=>toLinear(parseInt(c.slice(i,i+2),16)/255));return .2126*r+.7152*g+.0722*b};
  const contrast=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05)};
  function reach(make,L,target,bg,direction){let c=make(L);for(let i=0;i<60&&contrast(c,bg)<target;i++){L=clamp(L+direction*.012);c=make(L)}return c}
  // mode keeps the per-direction probabilities chosen by the engine:
  // grayscale (exact neutral greys), accent (two greys + one OKLCH accent), colour.
  function palette(R,mode){
    const dark=R()<.56,dir=dark?1:-1;
    if(mode!=='color'){
      const bg=grayHex(dark?R(.13,.21):R(.915,.975)),ink=reach(grayHex,dark?R(.9,.97):R(.14,.22),9,bg,dir);
      if(mode==='grayscale')return [bg,ink,reach(grayHex,dark?R(.5,.6):R(.58,.68),2.8,bg,dir)];
      const h=R(0,TAU),C=R(.14,.22);
      return [bg,ink,reach(L=>oklch(L,C,h),dark?R(.62,.72):R(.55,.65),3.2,bg,dir)];
    }
    const hb=R(0,TAU),harmony=weighted(R,[[[Math.PI,Math.PI],1],[[Math.PI-.5,Math.PI+.5],1],[[.55,-.6],.8],[[TAU/3,-TAU/3],.8]]);
    const bg=dark?oklch(R(.16,.23),R(.025,.06),hb):oklch(R(.925,.965),R(.014,.035),hb);
    const ci=R(.04,.11),ca=R(.13,.21);
    const ink=reach(L=>oklch(L,ci,hb+harmony[0]),dark?R(.84,.92):R(.24,.34),7,bg,dir);
    const accent=reach(L=>oklch(L,ca,hb+harmony[1]),dark?R(.64,.74):R(.52,.62),3.2,bg,dir);
    return [bg,ink,accent];
  }
  // Material is decided once per work: stroke model, optional riso overprint and grain.
  function material(seed,paletteMode){
    const R=rand(mix32(seed,0x3a7e11));
    const stroke=weighted(R,[['uniform',.4],['taper',.36],['pressure',.24]]);
    const riso=paletteMode!=='grayscale'&&R()<.42?{dx:R(-.0016,.0016),dy:R(.0006,.0018)}:null;
    const grain=R()<.5?Math.round(R(.05,.12)*1000)/1000:0;
    return {version:1,stroke,taper:Math.round(R(.1,.3)*1000)/1000,riso,grain};
  }

  // ---------- fields ----------
  function hash2(i,j,s){let h=(Math.imul(i|0,0x27d4eb2d)^Math.imul(j|0,0x165667b1)^Math.imul(s|0,0x2c1b3c6d))|0;h=Math.imul(h^(h>>>15),0x85ebca6b);h=Math.imul(h^(h>>>13),0xc2b2ae35);return ((h^(h>>>16))>>>0)/4294967296}
  function vnoise(x,y,s){const i=Math.floor(x),j=Math.floor(y),fx=x-i,fy=y-j,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy),a=hash2(i,j,s),b=hash2(i+1,j,s),c=hash2(i,j+1,s),d=hash2(i+1,j+1,s);return (a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v)*2-1}
  function fbm(x,y,s,octaves=4,ridge=false){let v=0,a=.5,f=1;for(let o=0;o<octaves;o++){let n=vnoise(x*f,y*f,s+o*131);if(ridge)n=1-2*Math.abs(n);v+=a*n;f*=2.03;a*=.5}return v}
  // Normalised fields: median at 0 and the 10–90% range mapped to ±1, so every
  // consumer can threshold at 0 regardless of the upstream kernel's units.
  function normalize(f){
    if(f.normalized)return f;
    const values=[];for(let j=0;j<20;j++)for(let i=0;i<30;i++){const v=f.sample((i+.5)/30,(j+.5)/20,0);if(Number.isFinite(v))values.push(v)}
    values.sort((a,b)=>a-b);
    const mid=values[values.length>>1]||0,scale=((values[Math.floor(values.length*.9)]||1)-(values[Math.floor(values.length*.1)]||0))/2||1;
    return {normalized:true,sample:(x,y,t=0)=>{const v=(f.sample(x,y,t)-mid)/scale;return Number.isFinite(v)?v:0}};
  }
  // A bilinear grid cache makes chained transforms cheap for dense consumers.
  function cached(f,A,res=150){
    const gw=Math.max(16,Math.round(res*Math.sqrt(A))),gh=Math.max(12,Math.round(gw/A)),W=gw+1,val=new Float32Array(W*(gh+1));
    for(let j=0;j<=gh;j++)for(let i=0;i<=gw;i++)val[j*W+i]=f.sample(i/gw,j/gh,0);
    return {normalized:f.normalized,gw,gh,val,sample(x,y){const xx=clamp(x)*gw,yy=clamp(y)*gh,i=Math.min(gw-1,Math.floor(xx)),j=Math.min(gh-1,Math.floor(yy)),fx=xx-i,fy=yy-j,k=j*W+i;return (val[k]*(1-fx)+val[k+1]*fx)*(1-fy)+(val[k+W]*(1-fx)+val[k+W+1]*fx)*fy}};
  }
  const tri=u=>{const m=((u%2)+2)%2;return m<=1?m:2-m};
  const maps={
    square:([x,y])=>[x*x-y*y,2*x*y],
    inverse:([x,y])=>{const r=Math.max(.02,x*x+y*y);return [x/r,-y/r]},
    exp:([x,y])=>{const e=Math.exp(clamp(x,-6,6));return [e*Math.cos(y),e*Math.sin(y)]},
    log:([x,y])=>[Math.log(Math.max(1e-3,Math.hypot(x,y))),Math.atan2(y,x)],
    joukowski:([x,y])=>{const r=Math.max(.02,x*x+y*y);return [x+x/r,y-y/r]},
    mobius:([x,y],[ar,ai])=>{const nr=x-ar,ni=y-ai,dr=1-(ar*x+ai*y),di=-(ar*y-ai*x),d=Math.max(1e-3,dr*dr+di*di);return [(nr*dr+ni*di)/d,(ni*dr-nr*di)/d]}
  };
  const conformalNames=Object.keys(maps);
  const wallpaperGroups=[
    {name:'p2',lattice:'square',order:2,mirror:false},{name:'pmm',lattice:'square',order:2,mirror:true},
    {name:'p4',lattice:'square',order:4,mirror:false},{name:'p4m',lattice:'square',order:4,mirror:true},
    {name:'p3',lattice:'hex',order:3,mirror:false},{name:'p3m1',lattice:'hex',order:3,mirror:true},
    {name:'p6',lattice:'hex',order:6,mirror:false},{name:'p6m',lattice:'hex',order:6,mirror:true}
  ];
  // Lattice point + point-group fold: square lattice with D2/C4/D4, hexagonal
  // lattice with C3/D3/C6/D6 generate the eight listed wallpaper groups.
  function symmetryFold(px,py,g){
    let lx,ly;
    if(g.lattice==='square'){lx=px-Math.round(px);ly=py-Math.round(py)}
    else{
      const jf=py/(Math.sqrt(3)/2),i0=Math.floor(px-jf/2),j0=Math.floor(jf);let best=1e9;
      for(let dj=0;dj<2;dj++)for(let di=0;di<2;di++){const j=j0+dj,i=i0+di,cx=i+j/2,cy=j*Math.sqrt(3)/2,d=(px-cx)**2+(py-cy)**2;if(d<best){best=d;lx=px-cx;ly=py-cy}}
    }
    const sector=TAU/g.order,r=Math.hypot(lx,ly);let a=((Math.atan2(ly,lx)%sector)+sector)%sector;
    if(g.mirror&&a>sector/2)a=sector-a;
    return [r*Math.cos(a),r*Math.sin(a)];
  }
  function sdfShapes(R,A,count){
    const shapes=Array.from({length:count},()=>({kind:picker(R)(['circle','box','ring','capsule']),x:R(-.35,.35)*A,y:R(-.3,.3),r:R(.08,.3),w:R(.03,.09),a:R(0,Math.PI)}));
    return (px,py)=>{let d=1e9;for(const s of shapes){const dx=px-s.x,dy=py-s.y,c=Math.cos(s.a),sn=Math.sin(s.a),u=dx*c+dy*sn,v=-dx*sn+dy*c;let e;
      if(s.kind==='circle')e=Math.hypot(dx,dy)-s.r;else if(s.kind==='ring')e=Math.abs(Math.hypot(dx,dy)-s.r)-s.w;
      else if(s.kind==='box'){const qx=Math.abs(u)-s.r,qy=Math.abs(v)-s.r*.6;e=Math.hypot(Math.max(qx,0),Math.max(qy,0))+Math.min(Math.max(qx,qy),0)}
      else{const h=clamp(u,-s.r,s.r);e=Math.hypot(u-h,v)-s.w}
      d=Math.min(d,e)}return d};
  }
  // Iso-lines with edge-keyed chaining: each segment joins two cell edges, so
  // chains are recovered exactly instead of by coordinate rounding.
  function sampleGrid(f,A,res,pad){
    const gw=Math.max(12,Math.round(res*Math.sqrt(A))),gh=Math.max(10,Math.round(gw/A)),W=gw+1,val=new Float32Array(W*(gh+1));
    for(let j=0;j<=gh;j++)for(let i=0;i<=gw;i++)val[j*W+i]=pad&&(i===0||j===0||i===gw||j===gh)?-1e3:f.sample(i/gw,j/gh,0);
    return {gw,gh,val};
  }
  function isolines({gw,gh,val},level){
    const W=gw+1,HN=W*(gh+1),segs=[],adj=new Map(),link=(e,s)=>{const l=adj.get(e);if(l)l.push(s);else adj.set(e,[s])};
    for(let j=0;j<gh;j++)for(let i=0;i<gw;i++){
      const a=val[j*W+i],b=val[j*W+i+1],c=val[(j+1)*W+i+1],d=val[(j+1)*W+i],code=(a>level?8:0)|(b>level?4:0)|(c>level?2:0)|(d>level?1:0);
      if(code===0||code===15)continue;
      const top=j*W+i,bottom=(j+1)*W+i,left=HN+j*W+i,right=HN+j*W+i+1,center=(a+b+c+d)/4>level;
      const table={1:[[left,bottom]],2:[[bottom,right]],3:[[left,right]],4:[[top,right]],5:center?[[left,top],[bottom,right]]:[[left,bottom],[top,right]],6:[[top,bottom]],7:[[left,top]],8:[[left,top]],9:[[top,bottom]],10:center?[[left,bottom],[top,right]]:[[left,top],[bottom,right]],11:[[top,right]],12:[[left,right]],13:[[bottom,right]],14:[[left,bottom]]};
      for(const pair of table[code]){const s=segs.length;segs.push(pair);link(pair[0],s);link(pair[1],s)}
    }
    const point=e=>{if(e<HN){const i=e%W,j=(e/W)|0,va=val[e],vb=val[e+1],t=clamp((level-va)/(vb-va||1e-9));return [(i+t)/gw,j/gh]}
      const k=e-HN,i=k%W,j=(k/W)|0,va=val[k],vb=val[k+W],t=clamp((level-va)/(vb-va||1e-9));return [i/gw,(j+t)/gh]};
    const used=new Uint8Array(segs.length),lines=[];
    const follow=(s,from)=>{const edges=[from];let current=s,e=from;while(current>=0&&!used[current]){used[current]=1;const [p,q]=segs[current];e=p===e?q:p;edges.push(e);current=-1;for(const c of adj.get(e)||[])if(!used[c]){current=c;break}}return edges};
    for(const [e,l] of adj)if(l.length===1&&!used[l[0]]){const edges=follow(l[0],e);lines.push({points:edges.map(point),closed:false})}
    for(let s=0;s<segs.length;s++)if(!used[s]){const edges=follow(s,segs[s][0]);lines.push({points:edges.map(point),closed:edges[0]===edges[edges.length-1]})}
    return lines;
  }
  // Two-pass chamfer distance transform in physical units.
  function distanceField(lines,A,res,offset){
    const gw=Math.max(16,Math.round(res*Math.sqrt(A))),gh=Math.max(12,Math.round(gw/A)),d=new Float32Array(gw*gh).fill(1e9),cell=1/gh,diag=cell*Math.SQRT2;
    const mark=(x,y)=>{const i=Math.floor(x*gw),j=Math.floor(y*gh);if(i>=0&&j>=0&&i<gw&&j<gh)d[j*gw+i]=0};
    for(const line of lines){if(line.length===1)mark(...line[0]);for(let k=1;k<line.length;k++){const [ax,ay]=line[k-1],[bx,by]=line[k],n=Math.ceil(Math.hypot((bx-ax)*A,by-ay)/(cell*.5))+1;for(let s=0;s<=n;s++)mark(ax+(bx-ax)*s/n,ay+(by-ay)*s/n)}}
    for(let j=0;j<gh;j++)for(let i=0;i<gw;i++){const k=j*gw+i;let v=d[k];if(i)v=Math.min(v,d[k-1]+cell);if(j){v=Math.min(v,d[k-gw]+cell);if(i)v=Math.min(v,d[k-gw-1]+diag);if(i<gw-1)v=Math.min(v,d[k-gw+1]+diag)}d[k]=v}
    for(let j=gh-1;j>=0;j--)for(let i=gw-1;i>=0;i--){const k=j*gw+i;let v=d[k];if(i<gw-1)v=Math.min(v,d[k+1]+cell);if(j<gh-1){v=Math.min(v,d[k+gw]+cell);if(i<gw-1)v=Math.min(v,d[k+gw+1]+diag);if(i)v=Math.min(v,d[k+gw-1]+diag)}d[k]=v}
    return {sample(x,y){const xx=clamp(x*gw-.5,0,gw-1.001),yy=clamp(y*gh-.5,0,gh-1.001),i=Math.floor(xx),j=Math.floor(yy),fx=xx-i,fy=yy-j,k=j*gw+i,i1=Math.min(gw-1,i+1)-i,j1=Math.min(gh-1,j+1)-j;
      return offset-((d[k]*(1-fx)+d[k+i1]*fx)*(1-fy)+(d[k+j1*gw]*(1-fx)+d[k+j1*gw+i1]*fx)*fy)}};
  }
  const densify=(path,maxLen,A)=>{const out=[path[0]];for(let k=1;k<path.length;k++){const [ax,ay]=path[k-1],[bx,by]=path[k],n=Math.max(1,Math.ceil(Math.hypot((bx-ax)*A,by-ay)/maxLen));for(let s=1;s<=n;s++)out.push([ax+(bx-ax)*s/n,ay+(by-ay)*s/n])}return out};
  // Deterministic stride sampling keeps operators bounded on dense inputs.
  const capPaths=(paths,maxPaths,maxPoints)=>{let total=paths.reduce((n,p)=>n+p.length,0);const stride=Math.max(1,Math.ceil(paths.length/maxPaths),Math.ceil(total/maxPoints));return stride===1?paths:paths.filter((_,i)=>i%stride===0)};
  const fitPaths=(paths,A,margin=.06)=>{let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const p of paths)for(const [x,y] of p){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}const s=Math.min((A*(1-2*margin))/Math.max(1e-6,x1-x0),(1-2*margin)/Math.max(1e-6,y1-y0)),cx=(x0+x1)/2,cy=(y0+y1)/2;return paths.map(p=>p.map(([x,y])=>[.5+(x-cx)*s/A,.5+(y-cy)*s]))};

  // ---------- operator kernels (version 2 programs) ----------
  const ops={};
  const op=(id,input,output,run)=>ops[id]={id,family:null,input,output,run};
  op('field.noise','none','field',(R,_,p)=>{const s=Math.floor(R(0,1e6));return {sample:(x,y)=>fbm(x*p.scale*1.5,y*p.scale,s,p.octaves,p.ridge)}});
  op('field.sdf','none','field',(R,_,p,A)=>{const d=sdfShapes(R,A,p.count);return {sample:(x,y)=>-d((x-.5)*A,y-.5)}});
  op('field.warp','field','field',(R,f,p)=>{const s=Math.floor(R(0,1e6));return {sample:(x,y,t)=>f.sample(x+p.amount*fbm(x*p.scale,y*p.scale,s,3),y+p.amount*fbm(x*p.scale+5.2,y*p.scale+1.3,s+7,3),t)}});
  op('field.conformal','field','field',(R,f,p,A)=>{const map=maps[p.map];return {sample:(x,y,t)=>{const [u,v]=map([(x-.5)*A*p.zoom,(y-.5)*p.zoom],p.a);return f.sample(tri(u/(A*p.zoom)*1.6+.5),tri(v/p.zoom*1.6+.5),t)}}});
  op('field.symmetry','field','field',(R,f,p,A)=>{const c=Math.cos(p.angle),s=Math.sin(p.angle);return {sample:(x,y,t)=>{const px=(x-.5)*A/p.cell,py=(y-.5)/p.cell,[u,v]=symmetryFold(px*c-py*s,px*s+py*c,p);return f.sample(.5+u*p.cell*p.zoom/A,.5+v*p.cell*p.zoom,t)}}});
  op('field.csg','field','field',(R,f,p,A)=>{const n=normalize(f),shape=sdfShapes(R,A,p.count);return {sample:(x,y,t)=>{const a=-n.sample(x,y,t)*p.scale,b=shape((x-.5)*A,y-.5);let d;
    if(p.op==='union')d=Math.min(a,b);else if(p.op==='intersect')d=Math.max(a,b);else if(p.op==='subtract')d=Math.max(a,-b);else if(p.op==='xor')d=Math.max(Math.min(a,b),-Math.max(a,b));else{const h=clamp(.5+.5*(b-a)/.06);d=b*(1-h)+a*h-.06*h*(1-h)}
    return -d}}});
  op('field.contours','field','paths',(R,f,p,A)=>{const grid=sampleGrid(normalize(f),A,p.res,false),lines=[];for(let k=0;k<p.levels;k++){const level=p.levels===1?0:(k/(p.levels-1)-.5)*p.spread;for(const l of isolines(grid,level))if(l.points.length>2)lines.push(l)}
    return {paths:lines.map(l=>l.points),closed:lines.map(l=>l.closed),tones:lines.map((_,i)=>i%p.accent===0?2:1)}});
  op('field.threshold','field','paths',(R,f,p,A)=>{const rings=isolines(sampleGrid(normalize(f),A,p.res,true),p.level).filter(l=>l.points.length>3).map(l=>l.points);return {paths:[],rings}});
  op('field.hatch','field','paths',(R,f,p,A)=>{const n=cached(normalize(f),A,120),paths=[],tones=[],rr=Math.hypot(A/2,.5);
    for(let k=0;k<p.layers;k++){const ang=p.angle+k*p.turn,c=Math.cos(ang),s=Math.sin(ang),level=p.levels[k];
      for(let o=-rr;o<=rr;o+=p.spacing){let run=null;for(let u=-rr;u<=rr;u+=p.step){const px=c*u-s*o,py=s*u+c*o,x=px/A+.5,y=py+.5,inside=x>=0&&x<=1&&y>=0&&y<=1&&n.sample(x,y)>level;
        if(inside){if(run)run[1]=[x,y];else run=[[x,y],[x,y]]}else if(run){paths.push(run);tones.push(k===p.layers-1&&p.layers>1?2:1);run=null}}
        if(run){paths.push(run);tones.push(1)}}}
    return {paths,tones}});
  op('field.streamlines','field','paths',(R,f,p,A)=>{const n=cached(normalize(f),A,110),cellS=p.sep*.5,cols=Math.ceil(A/cellS)+1,rows=Math.ceil(1/cellS)+1,occ=new Int32Array(cols*rows).fill(-1),paths=[];
    const cellOf=(x,y)=>Math.floor(y/cellS)*cols+Math.floor(x*A/cellS);
    const free=(x,y,id)=>{const ci=Math.floor(x*A/cellS),cj=Math.floor(y/cellS);for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const i=ci+di,j=cj+dj;if(i<0||j<0||i>=cols||j>=rows)continue;const o=occ[j*cols+i];if(o!==-1&&o!==id)return false}return true};
    const step=p.sep*.4,seeds=[];for(let y=p.sep;y<1;y+=p.sep*1.6)for(let x=p.sep/A;x<1;x+=p.sep*1.6/A)seeds.push([x+R(-.3,.3)*p.sep/A,y+R(-.3,.3)*p.sep]);
    for(const [sx,sy] of shuffle(R,seeds)){if(paths.length>900)break;const id=paths.length;if(!free(sx,sy,id))continue;
      const trace=sign=>{const pts=[];let x=sx,y=sy;for(let i=0;i<p.steps;i++){const a=n.sample(x,y)*p.gain+p.theta;x+=Math.cos(a)*step*sign/A;y+=Math.sin(a)*step*sign;if(x<0||x>1||y<0||y>1||!free(x,y,id))break;pts.push([x,y])}return pts};
      const line=[...trace(-1).reverse(),[sx,sy],...trace(1)];if(line.length<8)continue;for(const [x,y] of line)occ[cellOf(clamp(x,0,.9999),clamp(y,0,.9999))]=id;paths.push(line)}
    return {paths,tones:paths.map((_,i)=>i%p.accent===0?2:1)}});
  op('field.stipple','field','dots',(R,f,p,A)=>{const n=cached(normalize(f),A,90),points=[];for(let i=0;i<p.count*6&&points.length<p.count;i++){const x=R(),y=R(),q=clamp(.5+n.sample(x,y)*p.gain*.5);if(R()<q**p.gamma)points.push([x,y,p.size*(.55+.9*q)])}return {points,stipple:true}});
  op('points.poisson','none','points',(R,_,p,A)=>{const r=p.radius,cs=r/Math.SQRT2,cols=Math.ceil(A/cs),rows=Math.ceil(1/cs),grid=new Int32Array(cols*rows).fill(-1),points=[];
    for(let i=0;i<9000&&points.length<420;i++){const x=R(.04,.96),y=R(.05,.95),ci=Math.floor(x*A/cs),cj=Math.floor(y/cs);let ok=true;for(let dj=-2;dj<=2&&ok;dj++)for(let di=-2;di<=2;di++){const a=ci+di,b=cj+dj;if(a<0||b<0||a>=cols||b>=rows)continue;const k=grid[b*cols+a];if(k>=0&&Math.hypot((points[k][0]-x)*A,points[k][1]-y)<r){ok=false;break}}
      if(ok){grid[cj*cols+ci]=points.length;points.push([x,y])}}return {points}});
  op('points.distance','points','field',(R,input,p,A)=>distanceField(input.points.map(q=>[q.slice(0,2)]),A,p.res,p.offset));
  op('graph.distance','graph','field',(R,g,p,A)=>distanceField(g.edges.map(([a,b])=>[g.points[a],g.points[b]]),A,p.res,p.offset));
  op('paths.distance','paths','field',(R,input,p,A)=>distanceField([...(input.paths||[]),...(input.rings||[])],A,p.res,p.offset));
  op('paths.points','paths','points',(R,input,p,A)=>{const all=[];for(const path of [...(input.paths||[]),...(input.rings||[])]){let carry=0;for(let k=1;k<path.length;k++){const [ax,ay]=path[k-1],[bx,by]=path[k],L=Math.hypot((bx-ax)*A,by-ay);carry+=L;if(carry>=p.spacing){carry=0;all.push([bx,by])}}}
    const stride=Math.max(1,Math.ceil(all.length/p.count));return {points:all.filter((_,i)=>i%stride===0)}});
  op('paths.offset','paths','paths',(R,input,p,A)=>{const source=capPaths([...(input.paths||[]),...(input.rings||[])],Math.floor(2400/(p.copies*2+1)),Math.floor(50000/(p.copies*2+1))),paths=[],tones=[];
    for(const raw of source){const path=densify(raw,.008,A);if(path.length<2)continue;const normals=path.map((q,i)=>{const a=path[Math.max(0,i-1)],b=path[Math.min(path.length-1,i+1)],dx=(b[0]-a[0])*A,dy=b[1]-a[1],l=Math.hypot(dx,dy)||1;return [-dy/l,dx/l]});
      paths.push(path);tones.push(1);for(let k=1;k<=p.copies;k++)for(const sign of [-1,1]){paths.push(path.map((q,i)=>[q[0]+normals[i][0]*k*p.distance*sign/A,q[1]+normals[i][1]*k*p.distance*sign]));tones.push(k===p.copies?2:1)}}
    return {paths,tones}});
  op('paths.clip','paths','paths',(R,input,p,A)=>{const shape=sdfShapes(rand(p.seedShift),A,p.mask==='shapes'?3:1),d=(x,y)=>p.mask==='diagonal'?((x-.5)*A*.6+(y-.5)*.8):p.mask==='box'?Math.max(Math.abs((x-.5)*A)-.3*A,Math.abs(y-.5)-.28):p.mask==='disc'?Math.hypot((x-.5)*A,y-.5)-.36:shape((x-.5)*A,y-.5);
    const inside=([x,y])=>{const v=p.mask==='bands'?Math.sin(d(x,y)*p.freq):p.mask==='ring'?.06-Math.abs(Math.hypot((x-.5)*A,y-.5)-.3):-d(x,y);return p.mode==='inside'?v>0:v<=0};
    const source=capPaths(input.paths||[],5000,60000),out=[],tones=[];
    source.forEach((raw,index)=>{const path=densify(raw,.012,A);let current=inside(path[0])?[path[0]]:null,prev=!!current;
      for(let k=1;k<path.length;k++){const b=path[k],now=inside(b);if(now!==prev){let lo=path[k-1],hi=b;for(let it=0;it<7;it++){const mid=[(lo[0]+hi[0])/2,(lo[1]+hi[1])/2];if(inside(mid)===prev)lo=mid;else hi=mid}
        if(prev){current.push(lo);if(current.length>1){out.push(current);tones.push(input.tones?.[index]||1)}current=null}else current=[hi]}
        if(now)current.push(b);prev=now}
      if(current&&current.length>1){out.push(current);tones.push(input.tones?.[index]||1)}});
    return {paths:out,tones}});
  op('paths.conformal','paths','paths',(R,input,p,A)=>{const map=maps[p.map],out=[];for(const raw of capPaths([...(input.paths||[]),...(input.rings||[])],3000,40000)){let current=[];for(const [x,y] of densify(raw,.01,A)){const w=map([(x-.5)*A*p.zoom,(y-.5)*p.zoom],p.a);if(!Number.isFinite(w[0])||Math.hypot(...w)>p.limit){if(current.length>1)out.push(current);current=[];continue}
      const last=current[current.length-1];if(last&&Math.hypot(w[0]-last[0],w[1]-last[1])>p.limit*.25){if(current.length>1)out.push(current);current=[]}current.push(w)}if(current.length>1)out.push(current)}
    return {paths:fitPaths(out.map(path=>path.map(([u,v])=>[u,v])),A).map(path=>path.map(([x,y])=>[x,y])),tones:out.map((_,i)=>i%11===0?2:1)}});
  op('paths.rosette','paths','paths',(R,input,p,A)=>{const copies=p.order*(p.mirror?2:1),source=capPaths(input.paths||[],Math.floor(2400/copies),Math.floor(60000/copies)),sector=TAU/p.order,cx=.5+p.center[0],cy=.5+p.center[1],out=[],tones=[];
    source.forEach((raw,index)=>{const folded=raw.map(([x,y])=>{const px=(x-cx)*A,py=y-cy,r=Math.hypot(px,py);let a=((Math.atan2(py,px)%sector)+sector)%sector;if(p.mirror&&a>sector/2)a=sector-a;return [r,a]});
      for(let k=0;k<p.order;k++)for(const flip of p.mirror?[1,-1]:[1]){out.push(folded.map(([r,a])=>[cx+r*Math.cos(flip*a+k*sector)/A,cy+r*Math.sin(flip*a+k*sector)]));tones.push(input.tones?.[index]||1)}});
    return {paths:out,tones}});
  // Engine 8 operators: iteration, domain changes and feedback inside programs.
  op('field.feedback','field','field',(R,f,p)=>{const s=Math.floor(R(0,1e6));return {sample:(x,y,t)=>{let u=x,v=y;for(let k=0;k<p.iterations;k++){const a=f.sample(u,v,t)*p.turn;u+=Math.cos(a)*p.step;v+=Math.sin(a)*p.step}return f.sample(u,v,t)+.3*fbm(u*3,v*3,s,2)}}});
  op('field.polar','field','field',(R,f,p,A)=>({sample:(x,y,t)=>{const dx=(x-.5)*A,dy=y-.5,r=Math.hypot(dx,dy),a=(Math.atan2(dy,dx)/TAU+1)%1;return f.sample(tri(a*p.wrap),tri(r*p.radial),t)}}));
  op('field.quantize','field','field',(R,f,p)=>{const n=normalize(f);return {normalized:true,sample:(x,y,t)=>Math.round(n.sample(x,y,t)*p.levels)/p.levels}});
  op('field.mix','field','field',(R,f,p,A)=>{const n=normalize(f),s=Math.floor(R(0,1e6)),other=(x,y)=>p.second==='rings'?Math.sin(Math.hypot((x-.5)*A,y-.5)*p.freq):p.second==='stripes'?Math.sin(((x-.5)*A*Math.cos(p.angle)+(y-.5)*Math.sin(p.angle))*p.freq):fbm(x*p.freq*.3,y*p.freq*.3,s);
    return {sample:(x,y,t)=>{const a=n.sample(x,y,t),b=other(x,y);return p.op==='mul'?a*b*2:p.op==='max'?Math.max(a,b):p.op==='min'?Math.min(a,b):p.op==='xor'?Math.sign(a)*Math.sign(b):a+b}}});
  op('paths.iterate','paths','paths',(R,input,p,A)=>{const source=capPaths(input.paths||[],Math.floor(1800/p.copies),Math.floor(40000/p.copies)),out=[],tones=[];
    for(let k=0;k<p.copies;k++){const s=Math.pow(p.scale,k),a=p.turn*k,c=Math.cos(a),sn=Math.sin(a);source.forEach((path,i)=>{out.push(path.map(([x,y])=>{const dx=(x-.5)*A*s,dy=(y-.5)*s;return [.5+p.shift[0]*k+(dx*c-dy*sn)/A,.5+p.shift[1]*k+dx*sn+dy*c]}));tones.push(k===p.copies-1?2:(input.tones?.[i]||1))})}
    return {paths:out,tones}});
  op('paths.jitter','paths','paths',(R,input,p,A)=>{const s=Math.floor(R(0,1e6)),paths=capPaths(input.paths||[],4000,60000).map(raw=>densify(raw,.01,A).map(([x,y],k)=>{const q=k%p.every===0?p.amount:p.amount*.2;return [x+fbm(x*9,y*9,s,2)*q/A,y+fbm(x*9+3,y*9,s+1,2)*q]}));return {paths,tones:input.tones}});
  // Aperiodic Penrose tilings by Robinson-triangle subdivision (P3 rhombs, P2 kites/darts).
  op('tiling.penrose','none','paths',(R,_,p,A)=>{const rad=Math.hypot(A/2,.5)*p.zoom,lerp=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];let tris=[];
    for(let i=0;i<10;i++){let b=[Math.cos((2*i-1)*Math.PI/10)*rad,Math.sin((2*i-1)*Math.PI/10)*rad],c=[Math.cos((2*i+1)*Math.PI/10)*rad,Math.sin((2*i+1)*Math.PI/10)*rad];if(i%2===0)[b,c]=[c,b];tris.push([0,[0,0],b,c])}
    for(let g=0;g<p.generations;g++){const next=[];for(const [col,a,b,c] of tris){
      if(p.kind==='p3'){if(col===0){const P=lerp(a,b,1/PHI);next.push([0,c,P,b],[1,P,c,a])}else{const Q=lerp(b,a,1/PHI),S=lerp(b,c,1/PHI);next.push([1,S,c,a],[1,Q,S,b],[0,S,Q,a])}}
      else if(col===0){const Q=lerp(a,b,1/PHI),S=lerp(b,c,1/PHI);next.push([1,S,Q,b],[0,Q,a,S],[0,c,a,S])}else{const P=lerp(c,a,1/PHI);next.push([1,b,P,a],[0,P,c,b])}}
      tris=next}
    const cr=Math.cos(p.rotation),sr=Math.sin(p.rotation),map=([x,y])=>[.5+(x*cr-y*sr)/A+p.center[0],.5+(x*sr+y*cr)+p.center[1]],paths=[],tones=[],fills=[];
    for(const [col,a,b,c] of tris){const q=[map(c),map(a),map(b)];if(q.every(([x,y])=>x<-.02||x>1.02||y<-.02||y>1.02))continue;
      if(p.fill&&col===1){paths.push([q[0],q[1],q[2]]);fills.push(true);tones.push(2)}else{paths.push(q);fills.push(false);tones.push(1)}}
    return {paths,tones,fills}});

  // ---------- program synthesis ----------
  const sizeOf=(R,lo,hi)=>Math.floor(R(lo,hi));
  const SPEC={
    'field.noise':['none','field',3,R=>({scale:R(1.5,5.5),octaves:sizeOf(R,2,5),ridge:R()<.35})],
    'field.sdf':['none','field',2,R=>({count:sizeOf(R,2,6)})],
    'ikeda.binary-field':['none','field',.8,R=>({cols:sizeOf(R,18,70),rows:sizeOf(R,10,30)})],
    'systems.reaction-field':['none','field',.9,(R,A)=>({w:60,h:Math.max(20,Math.round(60/A)),steps:300}),true],
    'systems.wave-field':['none','field',2,()=>({})],
    'lieberman.packing':['none','points',1,()=>({})],
    'points.poisson':['none','points',1,R=>({radius:R(.05,.09)})],
    'tiling.penrose':['none','paths',2.2,R=>({kind:R()<.6?'p3':'p2',generations:sizeOf(R,5,8),zoom:R(.55,1.5),rotation:R(0,TAU),center:[R(-.25,.25),R(-.2,.2)],fill:R()<.4})],
    'autechre.xor-topology':['field?','graph',.8,R=>({cols:sizeOf(R,22,44),rows:sizeOf(R,16,30)})],
    'field.warp':['field','field',3,R=>({amount:R(.04,.16),scale:R(1.5,5)})],
    'field.conformal':['field','field',2.4,(R,A,pick)=>({map:pick(conformalNames),zoom:R(1.2,3.2),a:[R(-.6,.6),R(-.6,.6)]})],
    'field.symmetry':['field','field',2.6,(R,A,pick)=>({...pick(wallpaperGroups),cell:R(.14,.36),zoom:R(.5,1.5),angle:R()<.6?0:R(0,TAU)})],
    'field.csg':['field','field',1.8,(R,A,pick)=>({op:pick(['union','intersect','subtract','xor','smooth']),count:sizeOf(R,1,4),scale:R(.05,.12)})],
    'field.contours':['field','paths',3,R=>({levels:sizeOf(R,1,10),spread:R(.5,1.7),res:sizeOf(R,90,150),accent:sizeOf(R,4,13)})],
    'field.threshold':['field','paths',2,R=>({level:R(-.35,.35),res:sizeOf(R,100,160)})],
    'field.hatch':['field','paths',2.5,(R,A,pick)=>({layers:sizeOf(R,1,4),angle:R(0,Math.PI),turn:pick([Math.PI/2,Math.PI/4,Math.PI/3]),spacing:R(.006,.015),step:.005,levels:[R(-.5,.15),R(-.05,.5),R(.3,.85)]})],
    'field.streamlines':['field','paths',2.5,R=>({sep:R(.014,.032),gain:R(1.5,4.5),theta:R(0,TAU),steps:sizeOf(R,60,190),accent:sizeOf(R,6,17)}),true],
    'field.stipple':['field','dots',1.1,R=>({count:sizeOf(R,1400,3600),gain:R(1,2.4),gamma:R(1,2.4),size:R(.0018,.0038)})],
    'devine.spectral-paths':['field','paths',.9,R=>({count:sizeOf(R,16,40),samples:100})],
    'adapter.field-points':['field','points',.8,R=>({count:sizeOf(R,80,230),gain:2.6})],
    'devine.nearest-topology':['points','graph',2,R=>({neighbors:sizeOf(R,2,4)})],
    'systems.colonize':['points','graph',1.4,()=>({}),true],
    'points.distance':['points','field',2,R=>({offset:R(.02,.07),res:110})],
    'systems.elastic-graph':['graph','graph',1.4,()=>({passes:85})],
    'adapter.graph-paths':['graph','paths',2,()=>({})],
    'graph.distance':['graph','field',1.5,R=>({offset:R(.012,.045),res:110})],
    'lieberman.normal-ribbons':['paths','paths',1.1,R=>({width:R(.002,.006)})],
    'paths.offset':['paths','paths',2,R=>({copies:sizeOf(R,1,5),distance:R(.004,.014)})],
    'paths.clip':['paths','paths',2.4,(R,A,pick)=>({mask:pick(['disc','box','bands','diagonal','ring','shapes']),mode:R()<.6?'inside':'outside',freq:R(12,40),seedShift:sizeOf(R,0,1e9)})],
    'paths.conformal':['paths','paths',1.3,(R,A,pick)=>({map:pick(conformalNames),zoom:R(.8,2.2),a:[R(-.6,.6),R(-.6,.6)],limit:6})],
    'paths.rosette':['paths','paths',1.4,(R,A,pick)=>({order:pick([3,4,5,6,8,12]),mirror:R()<.7,center:[R(-.06,.06),R(-.05,.05)]})],
    'paths.distance':['paths','field',2,R=>({offset:R(.01,.05),res:110})],
    'paths.points':['paths','points',.9,R=>({spacing:R(.02,.06),count:sizeOf(R,80,260)})],
    'field.feedback':['field','field',1.6,R=>({iterations:sizeOf(R,2,7),turn:R(1.5,6),step:R(.01,.04)})],
    'field.polar':['field','field',1.4,R=>({wrap:R(1,4),radial:R(1,3)})],
    'field.quantize':['field','field',1.2,R=>({levels:sizeOf(R,2,6)})],
    'field.mix':['field','field',1.8,(R,A,pick)=>({op:pick(['add','mul','max','min','xor']),second:pick(['rings','stripes','noise']),freq:R(8,40),angle:R(0,Math.PI)})],
    'paths.iterate':['paths','paths',1.5,(R,A,pick)=>({copies:sizeOf(R,3,9),scale:R(.72,.97),turn:R(-.4,.4),shift:[R(-.02,.02),R(-.02,.02)]})],
    'paths.jitter':['paths','paths',1,R=>({amount:R(.004,.02),every:sizeOf(R,1,6)})]
  };
  const accepts=(input,type)=>input===type||(input==='field?'&&(type==='field'||type==='none'));
  // opts.depth 'deep' allows longer graphs and a second round trip through a
  // field (paths → distance → field ops → geometry), i.e. feedback loops.
  function synthesize(seed,A,opts={}){
    const R=rand(mix32(seed,0x51ed27)),pick=picker(R),nodes=[],deep=opts.depth==='deep';let heavy=0,returns=0,fieldOps=0;
    const append=(kernel,input)=>{const s=SPEC[kernel],id='n'+nodes.length;nodes.push({id,kernel,seed:Math.floor(R(0,4294967296))>>>0,input,params:s[3](R,A,pick)});if(s[4])heavy++;return id};
    const sources=Object.keys(SPEC).filter(id=>SPEC[id][0]==='none'||SPEC[id][0]==='field?');
    let out=append(weighted(R,sources.map(id=>[id,SPEC[id][2]])),null),type=SPEC[nodes[0].kernel][1];
    const target=deep?sizeOf(R,4,8):sizeOf(R,2,6),maxNodes=deep?9:7;
    while(nodes.length<maxNodes){
      const finishing=nodes.length>=target;
      if(finishing&&type!=='field')break;
      const options=Object.keys(SPEC).filter(id=>{const [input,output,,,isHeavy]=SPEC[id];if(input==='none'||!accepts(input,type))return false;if(isHeavy&&heavy)return false;
        if(output==='field'&&type!=='field'&&(finishing||returns>=(deep?2:1)))return false;if(output==='field'&&type==='field'&&(finishing||fieldOps>=(deep?5:3)))return false;return true});
      if(!options.length)break;
      const kernel=weighted(R,options.map(id=>[id,SPEC[id][2]]));
      if(SPEC[kernel][1]==='field'&&type!=='field')returns++;if(SPEC[kernel][1]==='field'&&type==='field')fieldOps++;
      out=append(kernel,out);type=SPEC[kernel][1];
    }
    if(type==='field')out=append('field.contours',out),type='paths';
    return {version:2,kind:'code',aspect:A,nodes,output:out,style:{weight:Math.round(R(.0008,.0024)*1e5)/1e5,accentEvery:sizeOf(R,5,19)}};
  }
  function execute(program,api){
    if(program.version!==2||program.kind!=='code'||!Array.isArray(program.nodes)||program.nodes.length<2||program.nodes.length>10)throw Error('Unsupported program');
    const table={...DesktopFamilies.hybrids.table,...ops},state=new Map(),ports=new Map(),ingredients=[],A=api.aspect;
    for(const node of program.nodes){
      const k=table[node.kernel];if(!k)throw Error('Unknown kernel '+node.kernel);
      const actual=node.input?ports.get(node.input):'none';if(!accepts(k.input,actual))throw Error('Program port mismatch '+node.kernel+': '+actual);
      let input=node.input?state.get(node.input):null,params=node.params||{};
      if(node.kernel==='systems.reaction-field')params={...params,h:Math.max(20,Math.round((params.w||60)/A))};
      // Version 1 kernels expect raw ±1 fields; give them the normalised form.
      if(input&&ports.get(node.input)==='field'&&!ops[node.kernel])input=normalize(input);
      const started=performance.now(),value=k.run(rand(node.seed),input,params,A);if(api.timings)api.timings.push([node.kernel,performance.now()-started]);
      state.set(node.id,value);ports.set(node.id,k.output);if(k.family&&!ingredients.includes(k.family))ingredients.push(k.family);
    }
    const result=state.get(program.output),type=ports.get(program.output),{add,dots}=api,style=program.style||{weight:.0014,accentEvery:13};
    if(!result)throw Error('Program produced nothing');
    let count=0;
    if(type==='graph'){
      let cachedT=null,cachedPoints;const pointsAt=t=>{if(cachedT!==t){cachedT=t;cachedPoints=result.at?result.at(t):result.points}return cachedPoints};
      result.edges.forEach(([a,b],i)=>{const shape=t=>{const pts=pointsAt(t);return [pts[a],pts[b]]};const s=add(shape(0),i%style.accentEvery?1:2,style.weight*1.2);if(result.at)s.motionPoints=shape;count++});
      result.points.forEach(([x,y],i)=>{if(i%7===0){const dot=[x,y,.003,1];if(result.at)dot.positionAt=t=>pointsAt(t)[i];dots.push(dot)}});
    }else if(type==='points'||type==='dots'){
      result.points.forEach(([x,y,r],i)=>{dots.push([x,y,r||.003,i%(style.accentEvery*7)===0?2:1,true]);count++});
    }else if(type==='paths'){
      if(result.rings?.length){const s=add([].concat(...result.rings),1,0,true,true);s.rings=result.rings;count++}
      const paths=result.at?result.at(0):result.paths;
      paths.forEach((path,i)=>{if(path.length<2)return;const fill=result.filled||!!result.fills?.[i],closed=fill||!!result.closed?.[i];
        const s=add(path,result.tones?.[i]||(i%style.accentEvery?1:2),fill?.0005:style.weight,fill,closed);
        if(result.at)s.motionPoints=t=>result.at(t)[i];count++});
    }else throw Error('Program output is not geometry');
    if(!count)throw Error('Program produced no geometry');
    return {ingredients,outputType:type,animatedOutput:!!result.at,kernels:program.nodes.map(n=>({id:n.kernel,family:table[n.kernel].family,input:table[n.kernel].input,output:table[n.kernel].output}))};
  }

  // ---------- macro layout ----------
  const HEAVY=new Set(['attractor','systems-gray-scott','systems-diffusion-aggregation']);
  const TEXTURES=['currents','contours','woven','lattice','ikeda-density-matrix','ikeda-bit-curtains','ikeda-binary-planes','ikeda-time-rails','ikeda-scan-combs','ikeda-spectral-stacks','ringnoord-directional-grain','autechre-constrained-walks','gjones-folded-checker','rules-counterphase-dots','rules-truchet-arcs','devine-granular-swarms','ringnoord-oxide-rubbing','defaultaudio-raster-compression','systems-elementary-automaton','autechre-rule-masks','devine-spectrogram-folds','systems-huygens-field','ikeda-impulse-arrays','fui-hex-status','fui-scope-panels','fui-scale-bank'];
  const MOTIFS=['rules-rotating-pairs','rules-broken-frames','rules-nested-rectangles','rules-split-disc','rules-radial-stamps','rules-one-wave','rules-parallel-slits','defaultaudio-hard-edge-gates','defaultaudio-negative-volume','ringnoord-mirrored-machines','ringnoord-angular-folds','gjones-torn-silhouettes','rules-stripe-bend','gjones-ink-shock','aphex-fluid-cutouts','lieberman-ribbon-calligraphy','defaultaudio-tidal-sections','cutouts','aphex-spirograph-memory','lieberman-breathing-cells','ringnoord-occluded-rings','fui-dial-array','fui-polar-diagram','fui-targeting-reticle','fui-radar-sweep','plotter-polyhedra','plotter-ruled-hyperboloid'];
  function box(R,A){const m=R(.055,.1),g=R(.014,.028);return {x:m/A,y:m,w:1-2*m/A,h:1-2*m,m,g}}
  // Split a rect along x or y at fraction f, leaving a physical gutter.
  function split(rect,f,horizontal,g,A){const [x,y,w,h]=rect;if(horizontal){const gx=g/A,a=w*f-gx/2;return [[x,y,a,h],[x+a+gx,y,w-a-gx,h]]}const a=h*f-g/2;return [[x,y,w,a],[x,y+a+g,w,h-a-g]]}
  const area=(r,A)=>r[2]*A*r[3];
  const snap=(f,steps)=>clamp(Math.round(f*steps)/steps,1/steps,1-1/steps);
  // Layout parameters come from the seed; rectangles are recomputed for each
  // aspect, so a stored recipe adapts without changing zone count or order.
  function layout(L,A){
    const R=rand(L.seed),pick=picker(R),b=box(R,A),C=12,content=[b.x,b.y,b.w,b.h],zones=[];
    const rows=Math.max(4,Math.round(C*b.h/(b.w*A)));
    if(L.kind==='asymmetric'){
      const left=R()<.5,cols=pick([7,8,8,9]),[a,c]=split(content,(left?cols:C-cols)/C,true,b.g,A),hero=left?a:c,side=left?c:a;
      const ratios=pick([[1,2,3],[2,1,2],[3,1,2],[1,1,3],[2,3,1]]),sum=ratios.reduce((x,y)=>x+y,0);let rest=side,used=0;const cells=[];
      for(let i=0;i<2;i++){const [top,bottom]=split(rest,snap(ratios[i]/(sum-used),rows),false,b.g,A);cells.push(top);rest=bottom;used+=ratios[i]}cells.push(rest);
      const roles=shuffle(R,['rhythm','field','void']);cells.forEach((r,i)=>zones.push({rect:r,role:roles[i]}));zones.push({rect:hero,role:'hero'});
    }else if(L.kind==='recursive'){
      // The first cut reserves a dominant hero cell; later cuts divide the rest.
      const first=R()<.82?content[2]*A>content[3]:content[2]*A<=content[3],heroFirst=R()<.5,f0=snap(pick([.62,2/3,1/PHI,.7]),first?C:rows);
      const [p,q]=split(content,heroFirst?f0:1-f0,first,b.g,A),heroCell=heroFirst?p:q;let cells=[heroFirst?q:p];const n=sizeOf(R,2,5);
      for(let s=0;s<n;s++){const sorted=cells.map((r,i)=>[area(r,A),i]).sort((x,y)=>y[0]-x[0]),index=R()<.7?sorted[0][1]:sorted[Math.floor(R(0,sorted.length))][1],r=cells[index],horizontal=R()<.82?r[2]*A>r[3]:r[2]*A<=r[3];
        const f=snap(pick([1/3,1/2,2/3,1/PHI,1-1/PHI]),horizontal?Math.max(2,Math.round(C*r[2]/b.w)):Math.max(2,Math.round(rows*r[3]/b.h)));cells.splice(index,1,...split(r,f,horizontal,b.g,A))}
      const roles=shuffle(R,['void','field','rhythm','void','field','rhythm']).slice(0,cells.length);
      if(!roles.includes('void'))roles[roles.length-1]='void';
      cells.forEach((r,k)=>zones.push({rect:r,role:roles[k]}));zones.push({rect:heroCell,role:'hero'});
    }else if(L.kind==='grid'){
      const cols=pick([3,4,4,5]),gr=Math.max(2,Math.round(cols*b.h/(b.w*A))),cw=(b.w-(cols-1)*b.g/A)/cols,ch=(b.h-(gr-1)*b.g)/gr,hc=Math.floor(R()*(cols-1)),hr=Math.floor(R()*(gr-1)),voidChance=R(.15,.45),salt=Math.floor(R(0,1e6));
      for(let j=0;j<gr;j++)for(let i=0;i<cols;i++){if(i>=hc&&i<hc+2&&j>=hr&&j<hr+2)continue;zones.push({rect:[b.x+i*(cw+b.g/A),b.y+j*(ch+b.g),cw,ch],role:hash2(i,j,salt)<voidChance?'void':'cell',index:j*cols+i})}
      zones.push({rect:[b.x+hc*(cw+b.g/A),b.y+hr*(ch+b.g),2*cw+b.g/A,2*ch+b.g],role:'hero'});
    }else if(L.kind==='bands'){
      const horizontal=A>=1?R()<.75:R()<.25,n=sizeOf(R,3,6),weights=Array.from({length:n},()=>pick([1,1,2,3])),heroIndex=Math.floor(R(0,n));weights[heroIndex]=Math.max(...weights)+2;
      let rest=content,left=weights.reduce((x,y)=>x+y,0);const cells=[];
      for(let i=0;i<n-1;i++){const [a,c]=split(rest,weights[i]/left,!horizontal,b.g,A);cells.push(a);rest=c;left-=weights[i]}cells.push(rest);
      const roles=shuffle(R,['rhythm','field','void','rhythm','void']);let k=0;
      cells.forEach((r,i)=>{if(i!==heroIndex)zones.push({rect:r,role:roles[k++%roles.length]})});zones.push({rect:cells[heroIndex],role:'hero'});
    }else{ // bleed: a cropped hero with an opaque panel and a margin rhythm strip
      const corner=Math.floor(R(0,4)),pw=b.w*pick([3,4,4,5])/C,ph=b.h*pick([2,3,3])/rows,px=corner%2?b.x+b.w-pw:b.x,py=corner<2?b.y:b.y+b.h-ph;
      zones.push({rect:[0,0,1,1],role:'hero',bleed:true});
      zones.push({rect:[px,py,pw,ph],role:R()<.5?'field':'rhythm',panel:true});
      const strip=b.m*.34,sy=corner<2?1-b.m*.5-strip/2:b.m*.5-strip/2;
      zones.push({rect:[b.x,sy,b.w*pick([.5,.66,1]),strip],role:'rhythm',margin:true});
    }
    return {box:b,zones};
  }
  function compose(seed,A,ctx){
    const R=rand(mix32(seed,0xc0ffee)),pick=picker(R);
    const kind=weighted(R,[['asymmetric',.22],['recursive',.22],['grid',.15],['bands',.15],['bleed',.26]]);
    const L={kind,seed:Math.floor(R(0,4294967296))>>>0};
    const recent=ctx.recent||[],lastGroup=recent.length?ctx.groupOf(recent[recent.length-1]):null;
    const heroPool=ctx.families.filter(f=>!HEAVY.has(f)&&!recent.slice(-3).includes(f)&&ctx.groupOf(f)!==lastGroup);
    const sourceSeed=()=>Math.floor(R(0,4294967296))>>>0;
    const heroZone=layout(L,A).zones.find(z=>z.role==='hero'),heroAspect=heroZone.bleed?A:heroZone.rect[2]*A/heroZone.rect[3];
    const program=(aspect)=>{const seed=sourceSeed();return {kind:'program',seed,program:synthesize(seed,aspect)}};
    const hero=R()<.42?program(heroAspect):{kind:'family',family:pick(heroPool),seed:sourceSeed()};
    const texture=()=>R()<.25?program(1.4):{kind:'family',family:pick(TEXTURES.filter(f=>f!==hero.family)),seed:sourceSeed()};
    const rhythm=()=>R()<.58?{kind:'euclid',seed:sourceSeed(),style:pick(['bars','ticks','dots','blocks'])}:{kind:'series',family:pick(MOTIFS),seed:sourceSeed(),count:sizeOf(R,3,7),ramp:pick(['scale','turn','fade'])};
    // Coherence: secondary zones often quote the hero (a magnified detail, or
    // variations of the same family in grid cells) instead of a new source.
    const detail=()=>({kind:'detail',zoom:Math.round(R(2.2,3.8)*100)/100,offset:[Math.round(R(-.28,.28)*1e3)/1e3,Math.round(R(-.28,.28)*1e3)/1e3]});
    const field=[R()<.38?detail():texture(),texture()];
    const cell=hero.kind==='family'&&R()<.6?{kind:'variations',family:hero.family,seeds:[sourceSeed(),sourceSeed(),sourceSeed()]}:{kind:'family',family:pick(MOTIFS),seed:sourceSeed()};
    const roles={hero,field,rhythm:[rhythm(),rhythm(),rhythm()],cell};
    return {version:1,layout:L,aspect:A,sources:roles,
      heroScale:kind==='bleed'?Math.round(R(1.15,1.5)*1e3)/1e3:Math.round(R(.86,1)*1e3)/1e3,
      heroOffset:kind==='bleed'?[Math.round(R(-.16,.16)*1e3)/1e3,Math.round(R(-.14,.14)*1e3)/1e3]:[0,0],
      invertHero:kind!=='bleed'&&R()<.22,invertField:R()<.3,fieldOpacity:Math.round(R(.5,.9)*100)/100,
      marks:weighted(R,[['none',.35],['crop',.35],['ruler',.3]])};
  }
  // Euclidean rhythms (evenly distributed pulses) as zone geometry.
  const euclid=(k,n,rot)=>Array.from({length:n},(_,i)=>((i+rot)*k)%n<k);
  function rhythmGeometry(src,zoneAspect,add){
    const R=rand(src.seed),horizontal=zoneAspect>=1,len=horizontal?zoneAspect:1/zoneAspect,n=Math.max(6,Math.min(64,Math.round(len*R(5,10)))),k=Math.max(1,Math.round(n*R(.3,.62))),pulse=euclid(k,n,Math.floor(R(0,n))),accent=euclid(Math.max(1,Math.round(k*R(.2,.45))),n,Math.floor(R(0,n)));
    const at=(u,v)=>horizontal?[u,v]:[v,u];
    for(let i=0;i<n;i++){if(!pulse[i])continue;const u0=i/n,u1=(i+.62)/n,c=accent[i]?2:1;
      if(src.style==='bars'){const h=accent[i]?1:R(.45,.85);add([at(u0,1-h),at(u1,1-h),at(u1,1),at(u0,1)],c,0,true,true)}
      else if(src.style==='ticks'){const h=accent[i]?1:i%4===0?.6:.3;add([at((u0+u1)/2,1-h),at((u0+u1)/2,1)],c,.006)}
      else if(src.style==='blocks'){const rowsN=accent[i]?3:1+Math.floor(R(0,2));for(let r=0;r<rowsN;r++)add([at(u0,1-(r+1)/3+.04),at(u1,1-(r+1)/3+.04),at(u1,1-r/3),at(u0,1-r/3)],c,0,true,true)}
      else{const cu=(u0+u1)/2,rad=(u1-u0)*.45;add(Array.from({length:25},(_,j)=>{const a=j/24*TAU;return at(cu+Math.cos(a)*rad,.5+Math.sin(a)*rad*(horizontal?zoneAspect:1/zoneAspect))}),c,0,true,true)}}
  }

  // ---------- critic ----------
  const bell=(x,mu,s)=>Math.exp(-(((x-mu)/s)**2));
  function metrics(data,w,h,background){
    const bg=[1,3,5].map(i=>parseInt(background.slice(i,i+2),16)),lum=new Float32Array(w*h),hist=new Float32Array(32);let ink=0,sx=0,sy=0,mass=0;
    for(let i=0,p=0;i<w*h;i++,p+=4){const l=(.2126*data[p]+.7152*data[p+1]+.0722*data[p+2])/255;lum[i]=l;hist[Math.min(31,Math.floor(l*32))]++;
      const d=(Math.abs(data[p]-bg[0])+Math.abs(data[p+1]-bg[1])+Math.abs(data[p+2]-bg[2]))/765;if(d>.12){ink++;const x=i%w,y=(i/w)|0;sx+=x*d;sy+=y*d;mass+=d}}
    let entropy=0;for(const c of hist)if(c){const q=c/(w*h);entropy-=q*Math.log2(q)}entropy/=5;
    let edges=0;for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){const i=y*w+x;if(Math.abs(lum[i+1]-lum[i-1])+Math.abs(lum[i+w]-lum[i-w])>.3)edges++}
    const bx=8,by=5,blocks=new Float32Array(bx*by);
    for(let i=0;i<w*h;i++){const l=lum[i],x=i%w,y=(i/w)|0,d=Math.abs(l-(.2126*bg[0]+.7152*bg[1]+.0722*bg[2])/255);if(d>.12)blocks[Math.min(by-1,Math.floor(y*by/h))*bx+Math.min(bx-1,Math.floor(x*bx/w))]+=1/(w*h/(bx*by))}
    const meanB=blocks.reduce((a,b)=>a+b,0)/blocks.length,silhouette=Math.sqrt(blocks.reduce((a,b)=>a+(b-meanB)**2,0)/blocks.length),voids=blocks.filter(b=>b<.03).length/blocks.length;
    const sorted=Array.from(lum).sort((a,b)=>a-b),contrastRange=sorted[Math.floor(sorted.length*.98)]-sorted[Math.floor(sorted.length*.02)];
    const coverage=ink/(w*h),cx=mass?sx/mass/w-.5:0,cy=mass?sy/mass/h-.5:0,offCenter=Math.hypot(cx,cy);
    const m={coverage,entropy,edges:edges/(w*h),balance:offCenter,silhouette,voids,contrast:contrastRange};
    m.score=1.2*bell(coverage,.24,.2)+.6*entropy+.8*bell(m.edges,.1,.12)+.6*bell(offCenter,.08,.14)+1.1*Math.min(1,silhouette/.38)+.6*bell(voids,.28,.24)+.5*Math.min(1,contrastRange/.6)-(coverage<.015||coverage>.85?2:0);
    for(const k in m)m[k]=Math.round(m[k]*1000)/1000;
    return m;
  }

  // Closed regions where a field is above a level (even-odd rings), used by
  // composition engines that cut zones out of a field instead of a grid.
  const regions=(sample,A,res,level)=>isolines(sampleGrid({sample},A,res,true),level).filter(l=>l.points.length>3).map(l=>l.points);
  window.DesktopGrammar={version:1,regions,fbm,rand,mix32,palette,material,contrast,synthesize,execute,ops:Object.keys(ops),spec:SPEC,wallpaperGroups:wallpaperGroups.map(g=>g.name),conformal:conformalNames,
    layout,compose,rhythmGeometry,metrics,TEXTURES,MOTIFS,HEAVY:[...HEAVY]};
})();
