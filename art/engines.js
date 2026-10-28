/* default_desktop engine 8: composition engines.
   Nine independent systems with their own logic decide where things go:
   modular division rules, free (no layout, v6-style layers and sectors),
   organic (packed circles / Voronoi), collage, flow (zones cut from a field),
   radial / spiral, series (contact sheet of variations), extreme crop and a
   glitch pass over a finished composition. A recipe stores the engine, its seed
   and the sources; shapes are recomputed for each aspect. Zones carry a shape
   (rect, poly, circle, sector, mask), a bounding box, a role and a behaviour. */
(() => {
  "use strict";
  const G=DesktopGrammar,TAU=Math.PI*2,PHI=(1+Math.sqrt(5))/2;
  const rand=G.rand,clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
  const pickW=(R,items)=>{let t=0;for(const [,w] of items)t+=w;let r=R(0,t);for(const [v,w] of items)if((r-=w)<0)return v;return items[items.length-1][0]};
  const pickA=R=>a=>a[Math.floor(R(0,a.length))];
  const shuffle=(R,a)=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.floor(R(0,i+1));[a[i],a[j]]=[a[j],a[i]]}return a};
  const rect=(x,y,w,h)=>({type:"rect",r:[x,y,w,h]});
  // Bounding boxes in normalized canvas coordinates; circles use height units.
  function bbox(s,A){
    if(s.type==="rect")return s.r.slice();
    if(s.type==="circle")return [s.c[0]-s.r/A,s.c[1]-s.r,2*s.r/A,2*s.r];
    if(s.type==="sector"){const pts=[];for(let k=0;k<=16;k++){const a=s.a0+(s.a1-s.a0)*k/16;pts.push([s.c[0]+Math.cos(a)*s.r1/A,s.c[1]+Math.sin(a)*s.r1],[s.c[0]+Math.cos(a)*s.r0/A,s.c[1]+Math.sin(a)*s.r0])}return bboxPts(pts)}
    if(s.type==="poly")return bboxPts(s.pts);
    if(s.type==="mask")return bboxPts(s.rings.flat());
    if(s.type==="multi")return bboxPts(s.rects.flatMap(r=>[[r[0],r[1]],[r[0]+r[2],r[1]+r[3]]]));
    return [0,0,1,1];
  }
  function bboxPts(p){let x0=1e9,y0=1e9,x1=-1e9,y1=-1e9;for(const [x,y] of p){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y)}return [x0,y0,Math.max(1e-3,x1-x0),Math.max(1e-3,y1-y0)]}
  const areaOf=(z,A)=>z.bbox[2]*A*z.bbox[3]*(z.shape.type==="circle"?Math.PI/4:z.shape.type==="sector"?.6:1);
  function box(R,A,tight=false){const m=tight?R(.03,.06):R(.05,.1),g=R(.012,.028);return {x:m/A,y:m,w:1-2*m/A,h:1-2*m,m,g}}
  const split=(r,f,horizontal,g,A)=>{const [x,y,w,h]=r;if(horizontal){const gx=g/A,a=w*f-gx/2;return [[x,y,a,h],[x+a+gx,y,w-a-gx,h]]}const a=h*f-g/2;return [[x,y,w,a],[x,y+a+g,w,h-a-g]]};
  const ROLES_SECONDARY=[["field",.26],["rhythm",.2],["void",.18],["echo",.1],["cell",.08],["overlay",.06],["frame",.04],["field",.08]];

  // ---------- engines: (R, A, recipe) -> zones ----------
  const ENGINES={
    // 1. Modular division by rules: splits snapped to modules, sub-grids,
    // frames and voids; the hero is the largest cell or a chosen one.
    modular(R,A){
      const b=box(R,A),pick=pickA(R),C=pick([6,8,12,12,16]),cells=[{r:[b.x,b.y,b.w,b.h]}],steps=Math.floor(R(3,8)),zones=[];
      for(let s=0;s<steps;s++){
        const order=cells.map((c,i)=>[c.r[2]*A*c.r[3],i]).sort((x,y)=>y[0]-x[0]),index=R()<.65?order[0][1]:order[Math.floor(R(0,order.length))][1],cell=cells[index],r=cell.r;
        const op=pickW(R,[["split",.6],["grid",.16],["inset",.1],["off",.07],["void",.07]]);
        if(op==="split"){const horizontal=R()<.8?r[2]*A>r[3]:r[2]*A<=r[3],steps2=Math.max(2,Math.round(C*(horizontal?r[2]/b.w:r[3]/b.h))),f=clamp(Math.round(pick([1/3,1/2,2/3,1/PHI,1-1/PHI,R(.2,.8)])*steps2)/steps2,1/steps2,1-1/steps2);
          cells.splice(index,1,...split(r,f,horizontal,b.g,A).map(q=>({r:q})))}
        else if(op==="grid"&&r[2]*A>.2&&r[3]>.2){const cols=Math.floor(R(2,5)),rows=Math.max(1,Math.round(cols*r[3]/(r[2]*A))),cw=(r[2]-(cols-1)*b.g/A)/cols,ch=(r[3]-(rows-1)*b.g)/rows;
          cells.splice(index,1);for(let j=0;j<rows;j++)for(let i=0;i<cols;i++)cells.push({r:[r[0]+i*(cw+b.g/A),r[1]+j*(ch+b.g),cw,ch],cell:true,index:j*cols+i})}
        else if(op==="inset"){const k=R(.08,.2);cell.r=[r[0]+r[2]*k,r[1]+r[3]*k,r[2]*(1-2*k),r[3]*(1-2*k)];cell.framed=true}
        else if(op==="off"){cell.r=[r[0]-R(0,.05)/A,r[1]-R(0,.05),r[2]+R(.03,.1)/A,r[3]+R(.03,.1)];cell.bleed=true}
        else cell.void=true;
      }
      const sorted=cells.map((c,i)=>[c.r[2]*A*c.r[3]*(c.void?0:1),i]).sort((x,y)=>y[0]-x[0]),hero=R()<.85?sorted[0][1]:sorted[Math.min(1,sorted.length-1)][1];
      cells.forEach((c,i)=>{if(i===hero)return;zones.push({shape:rect(...c.r),role:c.void?"void":c.cell?"cell":pickW(R,ROLES_SECONDARY),index:c.index||i,framed:c.framed})});
      zones.push({shape:rect(...cells[hero].r),role:"hero",bleed:!!cells[hero].bleed});
      if(R()<.3)zones.unshift({shape:{type:"multi",rects:[[b.x-b.m*.6/A,b.y-b.m*.6,b.w+b.m*1.2/A,b.m*.25],[b.x-b.m*.6/A,b.y+b.h+b.m*.35,b.w+b.m*1.2/A,b.m*.25]]},role:"frame"});
      if(R()<.22)zones.push({shape:{type:"circle",c:[R(.2,.8),R(.25,.75)],r:R(.08,.22)},role:"intrusion",bleed:false});
      return {box:b,zones};
    },
    // 2. No layout: one family on the whole canvas, or v6-style layers and
    // sectors (diptych, radial sectors, diagonal cut, aperture, bands, checker).
    free(R,A){
      const kind=pickW(R,[["single",.45],["sectors",.12],["diagonal",.1],["aperture",.11],["bands",.1],["checker",.06],["columns",.06]]),zones=[],full={full:true};
      zones.push({shape:rect(0,0,1,1),role:"hero",...full,bleed:true});
      if(kind==="sectors"){const n=Math.floor(R(6,16)),every=Math.floor(R(2,4)),c=[.5+R(-.15,.15),.5+R(-.15,.15)],rr=Math.hypot(A,1);for(let k=0;k<n;k+=every)zones.push({shape:{type:"sector",c,r0:0,r1:rr,a0:k/n*TAU,a1:(k+1)/n*TAU},role:"field",...full})}
      else if(kind==="diagonal"){const s=R(.3,.7),t=R(-.4,.4);zones.push({shape:{type:"poly",pts:[[s+t,0],[2,0],[2,1],[s-t,1]]},role:R()<.5?"field":"echo",...full})}
      else if(kind==="aperture"){zones.push({shape:{type:"circle",c:[.5+R(-.2,.2),.5+R(-.12,.12)],r:R(.22,.4)},role:R()<.6?"echo":"field",...full})}
      else if(kind==="bands"){const n=Math.floor(R(6,16)),rects=[];for(let k=0;k<n;k+=2)rects.push([0,k/n,1,1/n]);zones.push({shape:{type:"multi",rects},role:"field",...full})}
      else if(kind==="checker"){const n=Math.floor(R(4,9)),cols=Math.round(n*A),rects=[];for(let j=0;j<n;j++)for(let i=0;i<cols;i++)if((i+j)%2)rects.push([i/cols,j/n,1/cols,1/n]);zones.push({shape:{type:"multi",rects},role:"field",...full})}
      else if(kind==="columns"){const n=Math.floor(R(2,4));for(let k=1;k<n;k++)zones.push({shape:rect(k/n,0,1/n,1),role:"field",...full})}
      return {box:box(R,A),zones,kind};
    },
    // 3. Organic: packed circles of very different sizes, or Voronoi cells.
    organic(R,A){
      const zones=[],voronoi=R()<.45;
      if(voronoi){const n=Math.floor(R(4,10)),seeds=Array.from({length:n},()=>[R(.05,.95),R(.05,.95)]);
        const cell=i=>{let poly=[[0,0],[1,0],[1,1],[0,1]];for(let j=0;j<n;j++){if(j===i)continue;const [ax,ay]=seeds[i],[bx,by]=seeds[j],mx=(ax+bx)/2,my=(ay+by)/2,nx=(bx-ax)*A*A,ny=by-ay,keep=p=>(p[0]-mx)*nx+(p[1]-my)*ny<=0,out=[];
          for(let k=0;k<poly.length;k++){const p=poly[k],q=poly[(k+1)%poly.length],kp=keep(p),kq=keep(q);if(kp)out.push(p);if(kp!==kq){const t=((mx-p[0])*nx+(my-p[1])*ny)/((q[0]-p[0])*nx+(q[1]-p[1])*ny);out.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t])}}poly=out}return poly};
        const g=R(.004,.012),polys=seeds.map((_,i)=>cell(i)).map(p=>{const c=p.reduce((s,q)=>[s[0]+q[0]/p.length,s[1]+q[1]/p.length],[0,0]);return p.map(q=>[q[0]+(c[0]-q[0])*g*8,q[1]+(c[1]-q[1])*g*8])});
        const order=polys.map((p,i)=>[bboxPts(p)[2]*bboxPts(p)[3],i]).sort((x,y)=>y[0]-x[0]);
        order.forEach(([,i],k)=>zones.push({shape:{type:"poly",pts:polys[i]},role:k===0?"hero":pickW(R,[["field",.4],["void",.2],["rhythm",.15],["echo",.15],["overlay",.1]]),index:i}));
        zones.push(zones.splice(zones.findIndex(z=>z.role==="hero"),1)[0]);
      }else{const circles=[];for(let t=0;t<600&&circles.length<9;t++){const r=circles.length?R(.04,.22):R(.24,.42),x=R(-.05,1.05),y=R(-.05,1.05);if(circles.every(c=>Math.hypot((c[0]-x)*A,c[1]-y)>c[2]+r+.01))circles.push([x,y,r])}
        circles.forEach((c,k)=>zones.push({shape:{type:"circle",c:[c[0],c[1]],r:c[2]},role:k===0?"hero":pickW(R,[["field",.35],["rhythm",.15],["echo",.2],["void",.15],["cell",.15]]),index:k}));
        zones.push(zones.shift());
        if(R()<.4)zones.unshift({shape:rect(0,0,1,1),role:"overlay",full:true,bleed:true});}
      return {box:box(R,A),zones};
    },
    // 4. Collage: overlapping, rotated, torn pieces with scale jumps.
    collage(R,A){
      const zones=[],n=Math.floor(R(4,9));
      for(let k=0;k<n;k++){const big=k===0,w=big?R(.45,.8):R(.1,.4),h=w*A*R(.5,1.5)*(big?1:R(.6,1.4)),x=R(-.05,1.05-w),y=R(-.05,1.05-Math.min(.95,h)),a=R()<.5?0:R(-.12,.12),torn=R()<.4;
        const cx=x+w/2,cy=y+h/2,pts=[];const corners=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]];
        for(let e=0;e<4;e++){const p=corners[e],q=corners[(e+1)%4],steps=torn?14:1;for(let s=0;s<steps;s++){const t=s/steps,px=p[0]+(q[0]-p[0])*t,py=p[1]+(q[1]-p[1])*t,j=torn&&s?R(-.012,.012):0;const rx=px*A*Math.cos(a)-py*Math.sin(a),ry=px*A*Math.sin(a)+py*Math.cos(a);pts.push([cx+rx/A+j/A,cy+ry+j])}}
        zones.push({shape:{type:"poly",pts},role:big?"hero":pickW(R,[["field",.35],["echo",.2],["cell",.15],["rhythm",.15],["overlay",.15]]),opaque:true,index:k})}
      const hero=zones.shift();zones.splice(Math.floor(R(0,zones.length+1)),0,hero);
      return {box:box(R,A),zones};
    },
    // 5. Flow: no explicit zones; layers are cut out of a smooth field.
    flow(R,A){
      const seed=Math.floor(R(0,1e6)),sc=R(1.2,3.5),stripes=R()<.4,freq=R(4,14),f=(x,y)=>stripes?Math.sin((x*A*Math.cos(seed)+y*Math.sin(seed))*freq+G.fbm(x*sc,y*sc,seed)*3):G.fbm(x*sc*A,y*sc,seed);
      const levels=Math.floor(R(1,4)),zones=[{shape:rect(0,0,1,1),role:"hero",full:true,bleed:true}];
      for(let k=0;k<levels;k++){const level=stripes?R(-.2,.6):(k-(levels-1)/2)*R(.15,.3),rings=G.regions(f,A,70,level);if(rings.length)zones.push({shape:{type:"mask",rings},role:pickW(R,[["field",.5],["echo",.25],["overlay",.25]]),full:true})}
      return {box:box(R,A),zones};
    },
    // 6. Radial: a centre disc, rings of sectors, optionally a spiral offset.
    radial(R,A){
      const c=[.5+R(-.2,.2),.5+R(-.15,.15)],rings=Math.floor(R(2,5)),r0=R(.1,.22),dr=R(.07,.14),spiral=R()<.45,zones=[];
      for(let i=rings-1;i>=0;i--){const n=Math.floor(R(3,12)),off=spiral?i*R(.2,.6):R(0,TAU);for(let k=0;k<n;k++){if(R()<.25)continue;const a0=off+k/n*TAU,a1=a0+TAU/n*R(.7,.97);zones.push({shape:{type:"sector",c,r0:r0+i*dr,r1:r0+(i+1)*dr-.008,a0,a1},role:pickW(R,[["field",.4],["rhythm",.25],["echo",.2],["void",.15]]),index:i*16+k})}}
      if(R()<.4)zones.unshift({shape:rect(0,0,1,1),role:"overlay",full:true,bleed:true});
      zones.push({shape:{type:"circle",c,r:r0-.008},role:"hero"});
      return {box:box(R,A),zones,center:c};
    },
    // 7. Series: a contact sheet of variations, one cell can be enlarged.
    series(R,A){
      const b=box(R,A,true),cols=Math.floor(R(3,7)),rows=Math.max(2,Math.round(cols*b.h/(b.w*A)*R(.8,1.2))),cw=(b.w-(cols-1)*b.g/A)/cols,ch=(b.h-(rows-1)*b.g)/rows,zones=[];
      const big=R()<.5,hi=Math.floor(R(0,cols-1)),hj=Math.floor(R(0,rows-1));
      for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){if(big&&i>=hi&&i<hi+2&&j>=hj&&j<hj+2)continue;zones.push({shape:rect(b.x+i*(cw+b.g/A),b.y+j*(ch+b.g),cw,ch),role:R()<.08?"void":"cell",index:j*cols+i,mutation:[i/(cols-1||1),j/(rows-1||1)]})}
      if(big)zones.push({shape:rect(b.x+hi*(cw+b.g/A),b.y+hj*(ch+b.g),2*cw+b.g/A,2*ch+b.g),role:"hero"});
      else zones.push({shape:rect(b.x,b.y,cw,ch),role:"hero"}),zones.splice(zones.findIndex(z=>z.index===0),1);
      return {box:b,zones,mutations:true};
    },
    // 8. Extreme crop: the hero magnified past the edges, a small inset of the whole.
    crop(R,A){
      const b=box(R,A),w=R(.16,.26),zones=[{shape:rect(0,0,1,1),role:"hero",bleed:true,crop:{zoom:R(2.4,7),offset:[R(-.35,.35),R(-.35,.35)]}}];
      const corner=Math.floor(R(0,4)),h=w*A*R(.6,1),x=corner%2?b.x+b.w-w:b.x,y=corner<2?b.y:b.y+b.h-h;
      zones.push({shape:rect(x,y,w,h),role:"echo",opaque:true,framed:true,zoomOut:true});
      if(R()<.5)zones.push({shape:rect(b.x,corner<2?b.y+b.h-b.m*.3:b.y,b.w*R(.3,1),b.m*.3),role:"rhythm"});
      return {box:b,zones};
    },
    // 9. Glitch: another engine's composition, then a raster operator chain
    // over the finished image (datamosh layers, sorting, tears).
    glitch(R,A,recipe){
      const inner=pickW(R,[["modular",.3],["organic",.2],["collage",.2],["radial",.15],["free",.15]]),out=ENGINES[inner](R,A,recipe);
      const ops=shuffle(R,["mosh","sort","scanline","displace","channels","dct","feedback","interlace","smear","audio"]).slice(0,Math.floor(R(1,4)));
      return {...out,post:{chain:ops,seed:Math.floor(R(0,4294967296))>>>0,inner}};
    }
  };
  const WEIGHTS=[["modular",.15],["free",.13],["organic",.12],["collage",.11],["flow",.09],["radial",.1],["series",.08],["crop",.09],["glitch",.09]];

  // Role behaviours (all drawn from the seed and stored in the recipe).
  function behaviours(R){
    return {
      hero:{scale:R(.82,1.22),turn:pickW(R,[[0,.7],[Math.PI,.12],[Math.PI/2,.1],[R(-.15,.15),.08]]),mirror:R()<.18,invert:R()<.18,tile:R()<.08},
      field:{opacity:R(.35,.92),blend:pickW(R,[["source-over",.6],["multiply",.2],["screen",.1],["difference",.1]]),invert:R()<.25,accent:R()<.15},
      overlay:{opacity:R(.25,.6),blend:pickW(R,[["difference",.4],["multiply",.3],["screen",.3]])},
      echo:{zoom:R(1.8,4.5),offset:[R(-.3,.3),R(-.3,.3)],opacity:R(.5,1),mirror:R()<.4},
      cell:{ramp:pickW(R,[["seed",.45],["scale",.2],["turn",.15],["fade",.2]])},
      intrusion:{fill:R()<.5,accent:R()<.4,blend:pickW(R,[["source-over",.5],["multiply",.25],["difference",.25]])},
      void:{marks:R()<.45},
      chaos:R(0,1)
    };
  }
  function compose(seed,A,ctx){
    const R=rand(G.mix32(seed,0xe8a1e5)),pick=pickA(R),engine=ctx.engine||pickW(R,WEIGHTS),layoutSeed=Math.floor(R(0,4294967296))>>>0;
    const recent=ctx.recent||[],lastGroup=recent.length?ctx.groupOf(recent[recent.length-1]):null;
    const pool=ctx.families.filter(f=>!G.HEAVY.includes(f)&&!recent.slice(-3).includes(f)),plain=pool.filter(f=>!f.startsWith("glitch-")&&ctx.groupOf(f)!==lastGroup),glitchy=pool.filter(f=>f.startsWith("glitch-"));
    const s=()=>Math.floor(R(0,4294967296))>>>0;
    const program=aspect=>{const sd=s();return {kind:"program",seed:sd,program:G.synthesize(sd,aspect,{depth:R()<.5?"deep":"normal"})}};
    const hero=pickW(R,[["family",.45],["program",.33],["glitch",.22]]),heroSource=hero==="program"?program(A):{kind:"family",family:pick(hero==="glitch"?glitchy:plain),seed:s()};
    const texture=()=>pickW(R,[["t",.55],["p",.2],["g",.12],["d",.13]]);
    const field=Array.from({length:8},()=>{const k=texture();return k==="p"?program(1.4):k==="g"?{kind:"family",family:pick(glitchy),seed:s()}:k==="d"?{kind:"detail",zoom:R(2,4),offset:[R(-.3,.3),R(-.3,.3)]}:{kind:"family",family:pick(G.TEXTURES),seed:s()}});
    const rhythm=Array.from({length:6},()=>R()<.6?{kind:"euclid",seed:s(),style:pick(["bars","ticks","dots","blocks"])}:{kind:"series",family:pick(G.MOTIFS),seed:s(),count:Math.floor(R(3,7)),ramp:pick(["scale","turn","fade"])});
    const overlay=Array.from({length:3},()=>R()<.5?{kind:"family",family:pick(G.TEXTURES),seed:s()}:{kind:"family",family:pick(glitchy),seed:s()});
    const cell=heroSource.kind==="family"&&R()<.6?{kind:"variations",family:heroSource.family,seeds:Array.from({length:6},s)}:{kind:"family",family:pick(G.MOTIFS),seed:s()};
    return {version:2,engine,layoutSeed,aspect:A,sources:{hero:heroSource,field,rhythm,overlay,cell},behaviour:behaviours(R),marks:pickW(R,[["none",.4],["crop",.3],["ruler",.3]])};
  }
  function layout(recipe,A){
    const R=rand(recipe.layoutSeed),out=ENGINES[recipe.engine](R,A,recipe);
    out.zones=out.zones.map(z=>({...z,bbox:bbox(z.shape,A)}));
    return out;
  }
  window.DesktopEngines={names:WEIGHTS.map(w=>w[0]),weights:WEIGHTS,compose,layout,bbox};
})();
