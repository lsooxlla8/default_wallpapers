/* default_desktop procedural sketch grammar. Every scene is built in normalized
   coordinates once; rendering consumes no random numbers and no canvas size. */
(() => {
  "use strict";
  const VERSION = 8; let CW=Number(globalThis.DEFAULT_DESKTOP_WIDTH)||480, CH=Number(globalThis.DEFAULT_DESKTOP_HEIGHT)||270;
  const SAVED=globalThis.DEFAULT_DESKTOP_SKETCH||null;
  const families = ["currents","interference","contours","woven","orbits","cliffs",
                    "ribbons","lattice","attractor","vortex","cutouts","growth",...DesktopFamilies.entries.map(x=>x.id)];
  const palettes = [
    ["#050505","#eeeeee","#777777"], ["#eeeeee","#0b0b0b","#888888"],
    ["#171717","#dddddd","#666666"], ["#d6d6d6","#121212","#777777"]
  ];
  const chromaticPalettes=[
    ["#070d21","#ff735d","#5ed4ed"],["#f0e4cf","#2155ad","#e94867"],
    ["#102323","#e9c54b","#fd795f"],["#eadfea","#6c3e9e","#ed7c43"],
    ["#0a0b12","#96e1d6","#d2a1ff"],["#eeedde","#d33e32","#3e746d"],
    ["#192147","#ffc8af","#8ecfd2"],["#eddcb9","#854269","#34878a"]
  ];
  const ACCENT_PROBABILITY=.15, accents=["#ff3b30","#5375ff","#b2c934","#db7838"];
  const isGray=color=>/^#[0-9a-f]{6}$/i.test(color)&&color.slice(1,3)===color.slice(3,5)&&color.slice(3,5)===color.slice(5,7);
  const TAU = Math.PI*2;
  let density=1;
  let canvas, p5ref, scene, phase = 0, visible = true, last = 0, renderEMA=0, frameCounter=0, targetFPS=20, loadedAt=0, grainLayer=null, grainTile=null;
  const G=globalThis.DesktopGrammar;
  const colorChanceOf=group=>({glitch:.12,plotter:.12,fui:.2,ikeda:.03,gjones:.03,defaultaudio:.03,lieberman:.35,rules:.3,systems:.2,aphex:.3,devine:.2,autechre:.15,ringnoord:.15,core:.25}[group]??.3);
  const modeOf=palette=>palette.every(isGray)?"grayscale":isGray(palette[0])&&isGray(palette[1])?"accent":"color";
  const validPalette=p=>Array.isArray(p)&&p.length===3&&p.every(c=>/^#[0-9a-f]{6}$/i.test(c));
  // Version 6 records keep their stored look: no material unless one was saved.
  const materialOf=(record,seed,mode)=>"material" in record?record.material:record.version===6?null:G.material(seed,mode);
  const send = value => {
    if (!SAVED&&window.webkit?.messageHandlers?.desktop) window.webkit.messageHandlers.desktop.postMessage(value);
    else window.dispatchEvent(new CustomEvent("desktop-art", {detail:value}));
  };
  // Pin the context's readback policy before p5 requests it. In WebKit this
  // avoids backend-dependent antialias changes on identical Path2D commands.
  function stableCanvas(width,height){
    const element=document.createElement('canvas');element.width=width;element.height=height;
    element.getContext('2d',{willReadFrequently:true});return element;
  }
  function rng(seed) {
    let a=seed>>>0;
    return () => { a+=0x6D2B79F5; let t=a; t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return ((t^(t>>>14))>>>0)/4294967296; };
  }
  function build(record) {
    const A=record.compositionAspect||CW/CH;
    const choice=rng((record.seed>>>0)^0x9e3779b9);
    const choose=a=>a[Math.floor(choice()*a.length)];
    const groupOf=id=>DesktopFamilies.entries.find(x=>x.id===id)?.group||"core";
    const lastGroup=record.recent?.length?groupOf(record.recent[record.recent.length-1]):null;
    const family=families.includes(record.family)?record.family:choose(families.filter(f=>!(record.recent||[]).slice(-3).includes(f)&&groupOf(f)!==lastGroup));
    const animated=typeof record.animated==="boolean"?record.animated:choice()<0.5;
    const group=groupOf(family);
    const colorChance=colorChanceOf(group);
    const paletteChoice=choice();
    // Version 7 palettes are generated in OKLCH with contrast constraints; the
    // grayscale / accent / colour probabilities per direction are unchanged.
    let palette=validPalette(record.palette)?record.palette.slice():G.palette(G.rand(G.mix32(record.seed,0xc0101)),paletteChoice<colorChance?"color":paletteChoice<colorChance+ACCENT_PROBABILITY?"accent":"grayscale");
    const paletteMode=modeOf(palette);
    // Geometry has its own PRNG: restoring explicit metadata must not shift
    // its random sequence by skipping the family/palette/motion choices.
    const random=rng(record.seed), R=(a=0,b=1)=>a+(b-a)*random();
    const pick=a=>a[Math.floor(R(0,a.length))];
    const strokes=[], dots=[];
    const add=(points,color=1,weight=.0015,fill=false,closed=false)=>{const stroke={points,color,weight,fill,closed,offset:R(0,TAU)};strokes.push(stroke);return stroke;};
    const n=(x,y)=>Math.sin(x*2.9+y*1.7+record.seed*.00001)*.5+Math.sin(x*5.1-y*3.4)*.25+Math.cos(x*11.7+y*7.9)*.125;
    const frequency=R(1.3,5), bend=R(.02,.18), turns=R(1,5);
    const descriptor=DesktopFamilies.entries.find(x=>x.id===family);
    const hybrid=record.mix?.kind==="code"?(record.mix.version===2?G.execute:DesktopFamilies.hybrids.execute)(record.mix,{R,pick,add,dots,TAU,aspect:A}):null;
    // Dynamic families (plotter 3D) return whole line sets per camera time.
    let dynamic=null,rasterSpec=null,raster=null,photo=record.photo||null;
    const extended=hybrid||DesktopFamilies.build(family,{R,pick,add,dots,TAU,aspect:A,dynamic:f=>{dynamic=f},raster:spec=>{rasterSpec=spec}});
    if(dynamic)for(const l of dynamic(0))add(l.points,l.color??1,l.weight??.0012,!!l.fill,!!l.closed);
    // Experimental raster families: the bitmap is built once here. A photo is
    // taken from the pool the host supplied; its id is kept in the record.
    if(rasterSpec){
      const pool=DesktopExperiments.photos(),chosen=photo?pool.find(p=>p.id===photo):pool.length?pool[Math.floor(rng(G.mix32(record.seed,0xf070))()*pool.length)]:null;
      if(!photo&&chosen)photo=chosen.id;
      const sources=families.filter(f=>!f.startsWith("glitch-")&&!G.HEAVY.includes(f));
      raster=DesktopExperiments.build({...rasterSpec,size:record.rasterSize||560},{aspect:A,palette,paletteMode,photo:()=>chosen,pickFamily:Rr=>sources[Math.floor(Rr(0,sources.length))]});
      add([[0,0],[1,1]],0,0);
    }
    if(extended){} else if(family==="currents"){
      for(let i=0;i<150;i++){
        let x=R(-.1,1.1),y=R(-.1,1.1),points=[];
        for(let j=0;j<80;j++){points.push([x,y]);const a=n(x*frequency,y*frequency)*turns+R(-.025,.025);x+=Math.cos(a)*.007/A;y+=Math.sin(a)*.007;}
        add(points,i%11===0?2:1,R(.0006,.0022));
      }
    } else if(family==="interference"){
      const centers=[[R(.2,.45),R(.25,.75)],[R(.55,.8),R(.25,.75)]];
      centers.forEach((c,k)=>{for(let i=1;i<92;i++){let points=[];for(let j=0;j<=110;j++){let a=j/110*TAU,r=i*.0085;points.push([c[0]+Math.cos(a)*r/A,c[1]+Math.sin(a)*r*(1+bend*Math.cos(a*3))]);}add(points,k?2:1,.0009,false,true);}});
    } else if(family==="contours"){
      for(let i=0;i<100;i++){let points=[];for(let j=0;j<=140;j++){let x=j/140;let y=-.12+i*.013+n(x*frequency,i*.023)*bend;points.push([x,y]);}add(points,i%17===0?2:1,i%17===0?.002:.0008);}
    } else if(family==="woven"){
      for(let direction=0;direction<2;direction++)for(let i=0;i<56;i++){
        let points=[];for(let j=0;j<=100;j++){let a=j/100,b=(i+.5)/56+Math.sin(a*TAU*frequency+i*.24)*bend*.23;points.push(direction?[b,a]:[a,b]);}
        add(points,direction?2:1,R(.001,.003));
      }
    } else if(family==="orbits"){
      const cx=R(.35,.65),cy=R(.35,.65);
      for(let i=0;i<50;i++){let points=[],angle=i*.09,rx=.03+i*.011,ry=rx*R(.2,.7);for(let j=0;j<=110;j++){let a=j/110*TAU,x=Math.cos(a)*rx,y=Math.sin(a)*ry;points.push([cx+(x*Math.cos(angle)-y*Math.sin(angle))/A,cy+x*Math.sin(angle)+y*Math.cos(angle)]);}add(points,i%7?1:2,.0013,false,true);}
      for(let i=0;i<500;i++)dots.push([cx+R(-.018,.018)/A,cy+R(-.018,.018),R(.001,.004),1]);
    } else if(family==="cliffs"){
      for(let i=0;i<38;i++){let points=[[0,1],[1,1]];for(let j=100;j>=0;j--){let x=j/100;points.push([x,.03+i*.028+n(x*frequency,i*.07)*bend]);}add(points,i%5===0?2:(i%2?0:1),.0004,true,true);}
    } else if(family==="ribbons"){
      for(let i=0;i<10;i++){let points=[];for(let j=0;j<=160;j++){let x=j/160;points.push([x,.04+i*.103+Math.sin(x*TAU*frequency+i*.35)*bend]);}add(points,i%3?1:2,R(.012,.042));}
    } else if(family==="lattice"){
      const warp=(x,y)=>{const dx=(x-.5)*A,dy=y-.5,r=Math.hypot(dx,dy),a=Math.atan2(dy,dx)+Math.exp(-r*4)*turns;return [.5+r*Math.cos(a)/A,.5+r*Math.sin(a)];};
      for(let d=0;d<2;d++)for(let i=0;i<=38;i++){let points=[];for(let j=0;j<=120;j++){let x=i/38,y=j/120;points.push(warp(d?y:x,d?x:y));}add(points,d?1:2,.0011);}
    } else if(family==="attractor"){
      const coefficients=pick([[-1.4,1.6,1,.7],[-1.7,1.8,-.9,-.4],[1.7,1.7,.6,1.2],[-1.3,-1.3,-1.8,-1.9]]).map(x=>x+R(-.06,.06));
      const [a,b,c,d]=coefficients;
      let x=.1,y=.1,points=[];
      for(let i=0;i<24000;i++){let nx=Math.sin(a*y)+c*Math.cos(a*x),ny=Math.sin(b*x)+d*Math.cos(b*y);x=nx;y=ny;if(i>120)points.push([.5+x*.16/A,.5+y*.16]);if(points.length===300){add(points,strokes.length%9?1:2,.0005);points=[];}}
    } else if(family==="vortex"){
      for(let i=0;i<180;i++){let points=[],a=i/180*TAU;for(let j=0;j<100;j++){let r=.015+j*.007,t=a+r*turns;points.push([.5+Math.cos(t)*r/A,.5+Math.sin(t)*r]);}add(points,i%8?1:2,i%8?.0009:.0028);}
    } else if(family==="cutouts"){
      const cx=R(.35,.65),cy=R(.35,.65),lobes=Math.floor(R(3,9));
      for(let i=22;i>0;i--){let points=[];for(let j=0;j<=180;j++){let a=j/180*TAU,r=i*.025*(1+.18*Math.sin(a*lobes)+.12*Math.cos(a*3+.8));points.push([cx+Math.cos(a)*r/A,cy+Math.sin(a)*r]);}add(points,i%4===0?2:i%2,0,true,true);}
    } else if(family==="growth"){
      const branch=(x,y,a,len,depth)=>{if(depth<0)return;let ex=x+Math.cos(a)*len/A,ey=y+Math.sin(a)*len;add([[x,y],[ex,ey]],depth<2?2:1,.0005+depth*.0005);const split=R(.18,.65);branch(ex,ey,a-split,len*R(.6,.8),depth-1);branch(ex,ey,a+split,len*R(.6,.8),depth-1);};
      for(let i=0;i<5;i++)branch(.1+i*.2,1, -Math.PI/2+R(-.2,.2),R(.13,.22),7);
    }
    const texture=R()<.5?0:600;
    if(family==="attractor")for(const stroke of strokes)stroke.opacity=.08;
    for(let i=0;i<texture;i++)dots.push([R(),R(),R(.0002,.001),R()<.8?1:2,true]);
    const program=record.mix?.version===2;
    return {dynamic,raster,photo,version:VERSION,compositionAspect:A,seed:record.seed>>>0,material:materialOf(record,record.seed>>>0,paletteMode),family:hybrid?hybrid.ingredients[0]||"program":family,group:hybrid?"hybrid":descriptor?.group||"core",animated,palette,paletteMode,strokes,dots,mix:hybrid?{...record.mix,ingredients:hybrid.ingredients,provenance:hybrid.kernels}:null,
      algorithm:hybrid?(program?record.mix.nodes.map(n=>n.kernel).join(" → "):record.mix.program):descriptor?.method||"seeded parametric geometry",systemComplexity:hybrid?(program?"synthesized":"hybrid"):descriptor?.complexity||"parametric",
      motionMode:hybrid?(program&&!hybrid.animatedOutput?(strokes.reduce((n,s)=>n+s.points.length,0)>20000?"rigid":"field"):"own"):descriptor?.motionMode||"field",
      angle:hybrid?0:family.startsWith("ikeda-")?0:family.startsWith("lieberman-")?R(-.08,.08):pick([0,0,-.12,.12,Math.PI]),
      scale:hybrid?.92:family.startsWith("lieberman-")?R(.84,.96):R(.88,1.12),center:[R(.46,.54),R(.46,.54)],
      harmonic:Math.floor(R(2,7)),motion:R(.008,.025),speed:R(.18,.42)};
  }
  // Coordinates stay normalized; all geometric motion is phase-addressable.
  // These are composition grammars, not a common wobble applied to every style.
  function pointAt(s,x,y,t,index){
    const strength=s.motion,slow=t*s.speed;
    if(s.motionMode==="rigid")return [x+Math.sin(slow)*.008,y+Math.cos(slow*.7)*.012];
    if(s.motionMode==="own"||s.motionMode==="opacity")return [x,y];
    if(s.motionMode==="growth")return [x+Math.sin(slow+y*4)*(1-y)*.008,y];
    if(s.group==='ikeda')return [x, y+Math.sin(Math.floor(slow*2)*.7+Math.floor(x*32))*.003];
    if(s.group==='devine'){const a=Math.sin(x*9+y*5+slow)*Math.cos(y*7-slow*.63);return [x+Math.cos(a*3)*strength*.55,y+Math.sin(a*3)*strength];}
    if(s.group==='gjones'){const band=Math.floor(y*18),gate=Math.sin(band*7+Math.floor(slow*3));return [x+(gate>.65?Math.sin(slow+band)*strength*2:0),y];}
    if(s.group==='ringnoord'){const squeeze=.8+.2*Math.cos(slow*.7);return [.5+(x-.5)*squeeze,y+Math.tanh((x-.5+Math.sin(slow)*.07)*9)*Math.sin(slow*.6)*strength*2];}
    if(s.group==='aphex'){const dx=(x-.5)*s.compositionAspect,dy=y-.5,r=Math.hypot(dx,dy),a=Math.atan2(dy,dx)+Math.exp(-r*3)*Math.sin(slow)*.22;return [.5+Math.cos(a)*r/s.compositionAspect,.5+Math.sin(a)*r];}
    if(s.group==='autechre'){const hinge=(index%7-3)*.009*Math.sin(slow*(1+(index%3)*.13));return [x+(y-.5)*hinge,y+(x-.5)*Math.sin(slow*.73+index%5)*strength];}
    if(s.group==='defaultaudio')return [x,y+Math.sin(x*Math.PI*2*s.harmonic+slow)*Math.sin(Math.PI*x)*strength*2];
    return [x+Math.sin(y*7+slow)*strength*.4,y+Math.cos(x*7-slow)*strength*.65];
  }
  function strokePath(stroke,s,t,index){
    const path=new Path2D();
    if(stroke.rings){
      for(const ring of stroke.rings){for(let j=0;j<ring.length;j++){let [x,y]=ring[j];if(s.animated)[x,y]=pointAt(s,x,y,t,index);if(j)path.lineTo(x,y);else path.moveTo(x,y)}path.closePath()}
      return path;
    }
    const points=s.animated&&stroke.motionPoints?stroke.motionPoints(t):stroke.points;
    for(let j=0;j<points.length;j++){
      let [x,y]=points[j];
      if(s.animated&&!stroke.motionPoints)[x,y]=pointAt(s,x,y,t,index);
      if(j)path.lineTo(x,y);else path.moveTo(x,y);
    }
    if(stroke.closed)path.closePath();return path;
  }
  // Stroke model: variable width with tapered ends, built once as a filled
  // outline in physical units (normals use the domain aspect).
  function taperOutline(points,A,width,mat,offset){
    const n=points.length,lengths=[0];
    for(let i=1;i<n;i++)lengths.push(lengths[i-1]+Math.hypot((points[i][0]-points[i-1][0])*A,points[i][1]-points[i-1][1]));
    const total=lengths[n-1]||1,e=Math.max(.04,mat.taper||.2),left=[],right=[];
    for(let i=0;i<n;i++){
      const u=lengths[i]/total,a=points[Math.max(0,i-1)],b=points[Math.min(n-1,i+1)],dx=(b[0]-a[0])*A,dy=b[1]-a[1],l=Math.hypot(dx,dy)||1;
      const ends=Math.min(1,u/e,(1-u)/e),profile=.16+.84*ends*ends*(3-2*ends),pressure=mat.stroke==="pressure"?.62+.38*Math.sin(u*TAU*1.7+offset):1;
      const half=width*.62*profile*pressure,nx=-dy/l*half/A,ny=dx/l*half;
      left.push([points[i][0]+nx,points[i][1]+ny]);right.push([points[i][0]-nx,points[i][1]-ny]);
    }
    const path=new Path2D();left.forEach(([x,y],i)=>i?path.lineTo(x,y):path.moveTo(x,y));for(let i=n-1;i>=0;i--)path.lineTo(...right[i]);path.closePath();return path;
  }
  const lightOf=hex=>{const [r,g,b]=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));return .2126*r+.7152*g+.0722*b>110};
  // Raster works draw one finished bitmap into the unit square (after the
  // scene transform). Motion only shifts slices of it: no pixel work per frame.
  function drawRaster(ctx,s,t,alpha){
    const r=s.raster,img=r.canvas,moving=s.animated&&s.motionMode==="raster";
    ctx.save();ctx.globalAlpha=alpha;ctx.imageSmoothingEnabled=r.smooth;
    if(r.present==="tiles"){const n=r.tiles;for(let j=0;j<n;j++)for(let i=0;i<n;i++){ctx.save();ctx.translate((i+(i%2))/n,(j+(j%2))/n);ctx.scale(i%2?-1:1,j%2?-1:1);ctx.drawImage(img,0,0,1/n,1/n);ctx.restore()}}
    else if(r.present==="slices"||moving){const n=r.present==="slices"?r.slices:12,h=img.height/n;
      for(let k=0;k<n;k++){const seed=Math.sin(k*12.9898+r.sliceSeed)*43758.5453,f=seed-Math.floor(seed),off=(r.present==="slices"?(f-.5)*.12:0)+(moving?Math.sin(t*.7+k*1.3)*.012*(f>.6?1:0):0);
        ctx.drawImage(img,0,k*h,img.width,h,off,k/n,1,1/n+.001)}}
    else if(r.present==="inset"){ctx.drawImage(img,.12,.12,.76,.76);ctx.lineWidth=.0015;ctx.strokeStyle=s.palette[1];ctx.strokeRect(.12,.12,.76,.76)}
    else ctx.drawImage(img,0,0,1,1);
    ctx.restore();
  }
  // Source renders for experimental rules: a generative family drawn in ink on
  // black at the requested size; the rule tones it with the work's palette.
  function sourceRender(family,seed,w,h){
    const sc=build({version:VERSION,seed,family,animated:false,palette:["#000000","#ffffff","#8a8a8a"],material:null,compositionAspect:w/h,mix:null});
    const g=p5ref.createGraphics(w,h,stableCanvas(w,h));g.pixelDensity(1);renderSingle(g,w,h,0,sc);const c=g.canvas;g.remove();return c;
  }
  function renderSingle(g,width,height,t,s,layer=null,rect=null,opts=null){
    const pal=s.palette,mat=opts?.material??s.material??null,unit=opts?.unit||0;
    if(s.paletteMode==="color"&&!s.colorRamp)s.colorRamp=Array.from({length:23},(_,i)=>blendHex(pal[1],pal[2],i/22));
    if(s.lightBg===undefined)s.lightBg=lightOf(pal[0]);
    g.push();g.resetMatrix();if(!layer)g.background(pal[0]);
    // Geometry is constructed for this domain. Every viewport edge maps to
    // its own edge: no canonical composition, cover crop or letterboxing.
    const A=s.compositionAspect,rw=rect?rect[2]:width,rh=rect?rect[3]:height;
    if(rect){g.translate(rect[0],rect[1]);g.scale(rw,rh)}else g.scale(width,height);
    if(layer){const [tx,ty,scale,angle,mirror]=layer.transform;g.translate(.5+tx,.5+ty);g.scale(1/A,1);g.rotate(angle);g.scale(A,1);g.scale(mirror?-scale:scale,scale);g.translate(-.5,-.5);}
    // Rotate in physical units so a circle stays circular at this aspect.
    g.translate(s.center[0],s.center[1]);g.scale(1/A,1);g.rotate(s.angle);g.scale(A,1);g.scale(s.scale);g.translate(-.5,-.5);
    g.strokeCap(g.ROUND);g.strokeJoin(g.ROUND);
    if(s.raster){drawRaster(g.drawingContext,s,t,layer?.opacity??1);g.pop();return}
    // Zones keep a consistent physical hairline; version 6 scenes keep .0012.
    const weightScale=(unit?Math.sqrt(unit):1)*(opts?.emphasis||1),minWidth=unit?.0009*unit:.0012,alpha=layer?.opacity??1;
    if(mat&&mat.stroke!=="uniform"&&s.taperOK===undefined)s.taperOK=!(s.animated&&s.motionMode!=="rigid")&&s.strokes.reduce((n,k)=>n+(k.fill?0:k.points.length),0)<=60000;
    const taper=mat&&mat.stroke!=="uniform"&&s.taperOK;
    // A moving 3D camera re-solves hidden lines at a quantized rate.
    let list=s.strokes;
    if(s.animated&&s.dynamic){const key=Math.round(t*4)/4;if(s.dynamicKey!==key){s.dynamicKey=key;s.dynamicStrokes=s.dynamic(key).map(l=>({points:l.points,color:l.color??1,weight:l.weight??.0012,fill:!!l.fill,closed:!!l.closed,offset:0}))}list=s.dynamicStrokes}
    const frozen=list!==s.strokes;
    for(let i=0;i<list.length;i++){
      const stroke=list[i],ctx=g.drawingContext;
      if(!stroke.path)stroke.path=strokePath(stroke,{...s,animated:false},0,i);
      let path=stroke.path;
      // Quantized Ikeda fields only change at their clock edge. A rigid system
      // reuses geometry and moves the context rather than rebuilding each point.
      if(s.animated&&s.motionMode!=="rigid"&&!frozen){
        const key=s.group==="ikeda"?Math.floor(t*s.speed*2):t;
        if(stroke.pathPhase!==key){stroke.animatedPath=strokePath(stroke,s,t,i);stroke.pathPhase=key}
        path=stroke.animatedPath;
      }
      ctx.save();if(s.animated&&s.motionMode==="rigid")ctx.translate(Math.sin(t*s.speed)*.008,Math.cos(t*s.speed*.7)*.012);
      const lineWidth=Math.max(stroke.weight*weightScale,minWidth);ctx.lineWidth=lineWidth;
      ctx.globalAlpha=alpha*(stroke.opacity??1)*(s.animated&&stroke.opacityAt?stroke.opacityAt(t):stroke.opacityAt?stroke.opacityAt(0):1);
      let color=stroke.color===2&&s.paletteMode==="accent"&&i%17!==0?"#888888":pal[stroke.color];
      if(s.paletteMode==="color"&&stroke.color!==0&&["lieberman","aphex","devine"].includes(s.group))color=s.colorRamp[i%23];
      // Riso overprint: the second ink sits slightly off register and multiplies
      // (light paper) or screens (dark ground) over the first.
      if(mat?.riso&&stroke.color===2){ctx.translate(mat.riso.dx*height/rw,mat.riso.dy*height/rh);ctx.globalCompositeOperation=s.lightBg?"multiply":"screen"}
      ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineCap="round";ctx.lineJoin="round";
      if(stroke.fill)ctx.fill(path,stroke.rings?"evenodd":"nonzero");
      else if(taper&&!frozen&&!stroke.closed&&stroke.points.length>=3&&stroke.points.length<=2400&&(stroke.opacity??1)>.5&&!stroke.motionPoints){
        if(stroke.taperWidth!==lineWidth){stroke.taperPath=taperOutline(stroke.points,A,lineWidth,mat,stroke.offset||0);stroke.taperWidth=lineWidth}
        ctx.fill(stroke.taperPath);
      }else ctx.stroke(path);
      ctx.restore();
    }
    // Dots are batched into one path per colour; static dots are cached.
    const ctx=g.drawingContext,animatedDots=s.animated;
    let batches=!animatedDots||!s.dots.some(d=>!d[4])?s.dotBatches:null;
    if(!batches){
      batches=new Map();
      for(let i=0;i<s.dots.length;i++){
        const dot=s.dots[i];let [x,y,r,c,grain]=dot;
        if(animatedDots&&dot.positionAt)[x,y]=dot.positionAt(t);else if(animatedDots&&!grain)[x,y]=pointAt(s,x,y,t,i);
        const d=(grain?r:Math.max(r,.0045))/2,color=c===2&&s.paletteMode==="accent"&&i%23!==0?"#888888":pal[c];
        let path=batches.get(color);if(!path)batches.set(color,path=new Path2D());
        path.moveTo(x+d/A,y);path.ellipse(x,y,d/A,d,0,0,TAU);
      }
      if(!animatedDots||!s.dots.some(d=>!d[4]))s.dotBatches=batches;
    }
    ctx.save();ctx.globalAlpha=alpha;for(const [color,path] of batches){ctx.fillStyle=color;ctx.fill(path)}ctx.restore();
    g.pop();
  }
  const visualStrategies=["diptych","triptych","aperture","interlaced-bands","checker-weave","offset-windows","radial-sectors","diagonal-cut","ink-interference"];
  function visualRecipe(seed,firstFamily,aspect){
    const random=rng(seed^0x136adf71),R=(a=0,b=1)=>a+(b-a)*random(),pick=a=>a[Math.floor(R(0,a.length))];
    const strategy=pick(visualStrategies),count=strategy==="triptych"?3:R()<.35?3:2,used=[firstFamily];
    // A dense simulation can be the substrate; additional ingredients are
    // bounded geometries rather than another expensive simulation pass.
    const pool=families.filter(f=>!f.startsWith('systems-')&&!f.includes('impulse-arrays')&&!f.includes('density-matrix')&&!f.includes('attractor'));
    while(used.length<count)used.push(pick(pool.filter(f=>!used.includes(f))));
    return {version:1,kind:"visual",aspect,strategy,params:{bands:Math.floor(R(6,13)),columns:Math.floor(R(5,10)),split:R(.36,.64)},ingredients:used,
      layers:used.map((family,i)=>({family,seed:Math.floor(R(0,4294967296))>>>0,transform:[R(-.025,.025),R(-.025,.025),R(.88,1.07),R()<.2?Math.PI:0],blend:strategy==="ink-interference"&&i?"difference":"source-over",opacity:strategy==="ink-interference"&&i?.65:1}))};
  }
  function mixAtAspect(mix,aspect){
    if(!mix)return null;
    if(mix.aspect===aspect)return mix;
    return {...mix,aspect,...(mix.kind==='code'?{nodes:mix.nodes.map(node=>node.kernel==='systems.reaction-field'?{...node,params:{...node.params,h:Math.max(24,Math.round((node.params.w||88)/aspect))}}:node)}:{})};
  }
  const swap=p=>[p[1],p[0],p[2]];
  function geometryScene(A,palette,fn){
    const strokes=[],dots=[],add=(points,color=1,weight=.0015,fill=false,closed=false)=>{const stroke={points,color,weight,fill,closed,offset:0};strokes.push(stroke);return stroke};
    fn(add,dots);
    return {version:VERSION,compositionAspect:A,palette,paletteMode:modeOf(palette),strokes,dots,animated:false,motionMode:"rigid",group:"rules",family:"grammar",center:[.5,.5],angle:0,scale:1,harmonic:3,motion:.01,speed:.3};
  }
  function zoneScene(source,aspect,palette,animated,material){
    if(source.kind==="euclid")return geometryScene(aspect,palette,add=>G.rhythmGeometry(source,aspect,add));
    const s=build({version:VERSION,seed:source.seed,family:source.family||null,animated,palette,material,compositionAspect:aspect,photo:source.photo,mix:source.kind==="program"?source.program:null});
    if(s.photo&&!source.photo)source.photo=s.photo;
    s.center=[.5,.5];s.angle=0;s.scale=1;return s;
  }
  // Micro scale: crop marks or a module ruler around the content box, and a
  // registration mark inside some voids. Hairlines only.
  function marksScene(recipe,lay,A,palette){
    const b=lay.box;
    return geometryScene(A,palette,add=>{
      const len=b.m*.32,gap=b.m*.12;
      if(recipe.marks==="crop")for(const [x,y,sx,sy] of [[b.x,b.y,-1,-1],[b.x+b.w,b.y,1,-1],[b.x,b.y+b.h,-1,1],[b.x+b.w,b.y+b.h,1,1]]){add([[x+sx*gap/A,y],[x+sx*(gap+len)/A,y]],1,.0007);add([[x,y+sy*gap],[x,y+sy*(gap+len)]],1,.0007)}
      if(recipe.marks==="ruler"){const n=Math.round(b.h/(b.w/12)*A/1)||8,x=b.x-b.m*.35/A;for(let i=0;i<=n;i++){const y=b.y+b.h*i/n,l=(i%4===0?b.m*.22:b.m*.1)/A;add([[x-l,y],[x,y]],i%4===0?2:1,.0007)}}
      lay.zones.forEach((z,i)=>{if(z.role!=="void"||(i*7+recipe.layout.seed)%5>1)return;const [x,y,w,h]=z.rect,cx=x+w*((recipe.layout.seed>>4)%2?.12:.88),cy=y+h*.12,r=Math.min(w*A,h)*.035;
        add([[cx-r/A,cy],[cx+r/A,cy]],1,.0007);add([[cx,cy-r],[cx,cy+r]],1,.0007);add(Array.from({length:33},(_,k)=>[cx+Math.cos(k/32*TAU)*r*.55/A,cy+Math.sin(k/32*TAU)*r*.55]),1,.0007,false,true)});
    });
  }
  // A composition is a macro layout whose zones carry roles. Each zone holds a
  // scene built for that zone's own aspect; only the hero may move.
  // Engine 8 compositions: zones of any shape from one of nine engines, each
  // role with its own behaviour (see engines.js). Recipes keep every choice.
  function compositionScene2(record){
    const recipe=record.composition,A=record.compositionAspect,seed=record.seed>>>0,B=recipe.behaviour,S=recipe.sources,heroSource=S.hero;
    const heroGroup=heroSource.kind==="family"?(DesktopFamilies.entries.find(x=>x.id===heroSource.family)?.group||"core"):"systems";
    const c=rng(G.mix32(seed,0xb0b))(),chance=colorChanceOf(heroGroup);
    const palette=validPalette(record.palette)?record.palette.slice():G.palette(G.rand(G.mix32(seed,0xc0101)),c<chance?"color":c<chance+ACCENT_PROBABILITY?"accent":"grayscale");
    const paletteMode=modeOf(palette),material=materialOf(record,seed,paletteMode),lay=DesktopEngines.layout(recipe,A),post=lay.post||null,animated=!!record.animated&&!post;
    const accentInk=[palette[0],palette[2],palette[1]],zones=[],counters={field:0,rhythm:0,overlay:0};let heroScene=null,cellScenes=null;
    const jitter=(k,i)=>((Math.imul(i+1,2654435761)^k)>>>0)/4294967296;
    lay.zones.forEach((z,i)=>{
      const b=z.bbox,aspect=z.full||z.bleed?A:b[2]*A/b[3],zone={role:z.role,shape:z.shape,bbox:b,bleed:!!z.bleed,full:!!z.full,unit:z.full||z.bleed?1:1/b[3]};
      if(z.opaque)zone.fill=palette[0];
      if(z.framed)zone.outline=palette[1];
      if(z.role==="hero"){
        const h=B.hero,invert=h.invert&&!z.bleed&&!z.full;
        heroScene=zone.scene=zoneScene(heroSource,aspect,invert?swap(palette):palette,animated,material);
        zone.transform=z.crop?[z.crop.offset[0],z.crop.offset[1],z.crop.zoom,0]:[0,0,z.full||z.bleed?Math.max(1,h.scale):h.scale,h.turn,h.mirror];
        zone.emphasis=1.3;if(invert)zone.fill=palette[1];
      }else if(z.role==="field"){
        const f=B.field,src=S.field[counters.field++%S.field.length],invert=f.invert&&jitter(1,i)<.5,pal=invert?swap(palette):f.accent&&jitter(2,i)<.5?accentInk:palette;
        if(src.kind==="detail"){zone.scene=zoneScene(heroSource,aspect,pal,false,material);zone.transform=[src.offset[0],src.offset[1],src.zoom,0]}
        else zone.scene=zoneScene(src,aspect,pal,false,material);
        zone.opacity=z.opaque?1:Math.min(1,f.opacity*(.8+.4*jitter(3,i)));if(!z.opaque&&f.blend!=="source-over"&&jitter(4,i)<.6)zone.blend=f.blend;if(invert)zone.fill=palette[1];
      }else if(z.role==="overlay"){
        const src=S.overlay[counters.overlay++%S.overlay.length];zone.scene=zoneScene(src,aspect,palette,false,material);zone.blend=B.overlay.blend;zone.opacity=B.overlay.opacity;
      }else if(z.role==="echo"){
        const e=B.echo;zone.scene=zoneScene(heroSource,aspect,palette,false,material);
        zone.transform=z.zoomOut?[0,0,.9,0]:[e.offset[0],e.offset[1],e.zoom,0,e.mirror];zone.opacity=z.zoomOut?1:e.opacity;
      }else if(z.role==="rhythm"||z.role==="frame"){
        const src=z.role==="frame"?{kind:"euclid",seed:recipe.layoutSeed^0x77,style:"ticks"}:S.rhythm[counters.rhythm++%S.rhythm.length];
        if(src.kind==="series"){const horizontal=aspect>=1,n=src.count,cellAspect=horizontal?aspect/n:aspect*n;zone.scene=zoneScene(src,cellAspect,palette,false,material);
          zone.items=Array.from({length:n},(_,k)=>{const u=n>1?k/(n-1):1;return {rect:horizontal?[k/n,0,1/n,1]:[0,k/n,1,1/n],unit:zone.unit*(horizontal?1:n),transform:[0,0,src.ramp==="scale"?.45+.5*u:.9,src.ramp==="turn"&&Math.abs(cellAspect-1)<.35?u*Math.PI/2:0],opacity:src.ramp==="fade"?.25+.75*u:1}})}
        else zone.scene=zoneScene(src,aspect,palette,false,material);
      }else if(z.role==="cell"){
        const cell=S.cell,v=jitter(5,z.index??i);
        if(cell.kind==="variations"){cellScenes=cellScenes||cell.seeds.map(sd=>zoneScene({kind:"family",family:cell.family,seed:sd},aspect,palette,false,material));zone.scene=cellScenes[(z.index??i)%cellScenes.length]}
        else{cellScenes=cellScenes||[zoneScene(cell,aspect,palette,false,material)];zone.scene=cellScenes[0]}
        const m=z.mutation;zone.transform=m?[0,0,.55+.4*m[0],B.cell.ramp==="turn"?m[1]*Math.PI:0]:[0,0,.55+.3*v,Math.abs(aspect-1)<.3?Math.floor(v*4)*Math.PI/2:0];zone.opacity=B.cell.ramp==="fade"&&m?.3+.7*m[1]:.85;
      }else if(z.role==="intrusion"){
        const it=B.intrusion;zone.fill=it.accent&&paletteMode!=="grayscale"?palette[2]:palette[1];if(!it.fill){zone.fill=null;zone.outline=palette[1]}zone.blend=it.blend;
      }
      zones.push(zone);
    });
    if(!heroScene)throw Error("Composition without hero");
    if(recipe.marks!=="none")zones.splice(zones.findIndex(z=>z.role==="hero"),0,{role:"marks",rect:[0,0,1,1],bbox:[0,0,1,1],bleed:true,unit:1,scene:marksScene({marks:recipe.marks,layout:{seed:recipe.layoutSeed}},{box:lay.box,zones:lay.zones.map(z=>({...z,rect:z.bbox}))},A,palette)});
    const heroIndex=zones.findIndex(z=>z.role==="hero"),scenes=[...new Set(zones.map(z=>z.scene).filter(Boolean))];
    return {version:VERSION,kind:"composition",compositionAspect:A,seed,palette,paletteMode,material,animated,zones,heroIndex,post,
      family:heroScene.family,group:heroSource.kind==="family"?heroGroup:"program",algorithm:recipe.engine+(post?"("+post.inner+")":"")+" / "+heroScene.algorithm,systemComplexity:"composition",motionMode:heroScene.motionMode,
      strokes:scenes.flatMap(x=>x.strokes),dots:scenes.flatMap(x=>x.dots),hero:heroScene,composition:recipe,critic:record.critic||null,mix:null};
  }
  function compositionScene(record){
    const recipe=record.composition,A=record.compositionAspect,seed=record.seed>>>0;
    if(recipe?.version===2)return compositionScene2(record);
    if(recipe?.version!==1||!recipe.layout||!recipe.sources?.hero)throw Error("Unsupported composition recipe");
    const heroSource=recipe.sources.hero,heroGroup=heroSource.kind==="family"?(DesktopFamilies.entries.find(x=>x.id===heroSource.family)?.group||"core"):"systems";
    const choice=rng(G.mix32(seed,0xb0b)),c=choice(),chance=colorChanceOf(heroGroup);
    const palette=validPalette(record.palette)?record.palette.slice():G.palette(G.rand(G.mix32(seed,0xc0101)),c<chance?"color":c<chance+ACCENT_PROBABILITY?"accent":"grayscale");
    const paletteMode=modeOf(palette),material=materialOf(record,seed,paletteMode),animated=!!record.animated;
    const lay=G.layout(recipe.layout,A),zones=[];let field=0,rhythm=0,cellScene=null,heroScene=null;
    for(const z of lay.zones){
      const [x,y,w,h]=z.rect,aspect=w*A/h,zone={role:z.role,rect:z.rect,bbox:z.rect,bleed:!!z.bleed,unit:z.bleed?1:1/h};
      if(z.role==="hero"){
        const invert=recipe.invertHero&&!z.bleed;
        heroScene=zone.scene=zoneScene(heroSource,z.bleed?A:aspect,invert?swap(palette):palette,animated,material);
        zone.transform=[recipe.heroOffset[0],recipe.heroOffset[1],recipe.heroScale,0];zone.emphasis=1.35;if(invert)zone.fill=palette[1];
      }else if(z.role==="field"){
        const invert=recipe.invertField&&field===0,source=recipe.sources.field[field++%recipe.sources.field.length];
        if(source.kind==="detail"){zone.scene=zoneScene(heroSource,aspect,invert?swap(palette):palette,false,material);zone.transform=[source.offset[0],source.offset[1],source.zoom,0]}
        else zone.scene=zoneScene(source,aspect,invert?swap(palette):palette,false,material);
        zone.opacity=z.panel||source.kind==="detail"?1:recipe.fieldOpacity;
        if(invert)zone.fill=palette[1];else if(z.panel)zone.fill=palette[0];
      }else if(z.role==="rhythm"){
        const source=recipe.sources.rhythm[rhythm++%recipe.sources.rhythm.length];
        if(z.panel)zone.fill=palette[0];
        if(source.kind==="series"){
          const horizontal=aspect>=1,n=source.count,cellAspect=horizontal?aspect/n:aspect*n;
          zone.scene=zoneScene(source,cellAspect,palette,false,material);
          zone.items=Array.from({length:n},(_,i)=>{const u=n>1?i/(n-1):1;return {rect:horizontal?[i/n,0,1/n,1]:[0,i/n,1,1/n],unit:zone.unit*(horizontal?1:n),
            transform:[0,0,source.ramp==="scale"?.45+.5*u:.9,source.ramp==="turn"&&Math.abs(cellAspect-1)<.35?u*Math.PI/2:0],opacity:source.ramp==="fade"?.25+.75*u:1}});
        }else zone.scene=zoneScene(source,aspect,palette,false,material);
      }else if(z.role==="cell"){
        const cell=recipe.sources.cell,v=((z.index*2654435761)>>>0)/4294967296;
        if(cell.kind==="variations"){cellScene=cellScene||cell.seeds.map(seed=>zoneScene({kind:"family",family:cell.family,seed},aspect,palette,false,material));zone.scene=cellScene[z.index%cellScene.length];zone.transform=[0,0,.78,0]}
        else{cellScene=cellScene||zoneScene(cell,aspect,palette,false,material);zone.scene=cellScene;zone.transform=[0,0,.5+.26*v,Math.abs(aspect-1)<.3?Math.floor(v*4)*Math.PI/2:0]}
        zone.opacity=.82;
      }
      zones.push(zone);
    }
    zones.splice(zones.findIndex(z=>z.role==="hero"),0,{role:"marks",rect:[0,0,1,1],bleed:true,unit:1,scene:marksScene(recipe,lay,A,palette)});
    const heroIndex=zones.findIndex(z=>z.role==="hero"),scenes=[...new Set(zones.map(z=>z.scene).filter(Boolean))];
    const family=heroScene.family,group=heroSource.kind==="family"?heroGroup:"program";
    return {version:VERSION,kind:"composition",compositionAspect:A,seed,palette,paletteMode,material,animated,zones,heroIndex,family,group,
      algorithm:recipe.layout.kind+" / "+heroScene.algorithm,systemComplexity:"composition",motionMode:heroScene.motionMode,
      strokes:scenes.flatMap(s=>s.strokes),dots:scenes.flatMap(s=>s.dots),hero:heroScene,composition:recipe,critic:record.critic||null,mix:null};
  }
  // Zone outline in canvas pixels (ox, oy shift into a sub-layer's space).
  function shapePath(z,W,H,ox=0,oy=0){
    const p=new Path2D(),sh=z.shape||{type:"rect",r:z.rect},X=x=>x*W-ox,Y=y=>y*H-oy;
    if(sh.type==="rect")p.rect(X(sh.r[0]),Y(sh.r[1]),sh.r[2]*W,sh.r[3]*H);
    else if(sh.type==="multi")for(const r of sh.rects)p.rect(X(r[0]),Y(r[1]),r[2]*W,r[3]*H);
    else if(sh.type==="circle")p.ellipse(X(sh.c[0]),Y(sh.c[1]),sh.r*H,sh.r*H,0,0,TAU);
    else if(sh.type==="sector"){p.moveTo(X(sh.c[0])+Math.cos(sh.a0)*sh.r1*H,Y(sh.c[1])+Math.sin(sh.a0)*sh.r1*H);p.arc(X(sh.c[0]),Y(sh.c[1]),sh.r1*H,sh.a0,sh.a1);if(sh.r0>0)p.arc(X(sh.c[0]),Y(sh.c[1]),sh.r0*H,sh.a1,sh.a0,true);else p.lineTo(X(sh.c[0]),Y(sh.c[1]));p.closePath()}
    else if(sh.type==="poly"){sh.pts.forEach(([x,y],k)=>k?p.lineTo(X(x),Y(y)):p.moveTo(X(x),Y(y)));p.closePath()}
    else if(sh.type==="mask")for(const ring of sh.rings){ring.forEach(([x,y],k)=>k?p.lineTo(X(x),Y(y)):p.moveTo(X(x),Y(y)));p.closePath()}
    return p;
  }
  function renderZone(g,W,H,t,s,z,ox=0,oy=0){
    const ctx=g.drawingContext,b=z.bbox||z.rect,px=[b[0]*W-ox,b[1]*H-oy,b[2]*W,b[3]*H],rule=z.shape?.type==="mask"?"evenodd":"nonzero";
    g.push();g.resetMatrix();ctx.save();
    const path=shapePath(z,W,H,ox,oy);
    if(!z.bleed)ctx.clip(path,rule);
    if(z.blend)ctx.globalCompositeOperation=z.blend;
    if(z.fill){ctx.fillStyle=z.fill;if(z.bleed)ctx.fillRect(-ox,-oy,W,H);else ctx.fill(path,rule)}
    const sceneRect=z.full?[-ox,-oy,W,H]:px,opts={unit:z.unit,material:s.material,emphasis:z.emphasis||1};
    if(z.items)for(const item of z.items)renderSingle(g,W,H,t,z.scene,{transform:item.transform,opacity:item.opacity},[sceneRect[0]+item.rect[0]*sceneRect[2],sceneRect[1]+item.rect[1]*sceneRect[3],item.rect[2]*sceneRect[2],item.rect[3]*sceneRect[3]],{...opts,unit:item.unit});
    else if(z.scene)renderSingle(g,W,H,t,z.scene,{transform:z.transform||[0,0,1,0],opacity:z.opacity??1},sceneRect,opts);
    if(z.outline){ctx.globalCompositeOperation="source-over";ctx.globalAlpha=1;ctx.lineWidth=1;ctx.strokeStyle=z.outline;ctx.stroke(path)}
    ctx.restore();g.pop();
  }
  function disposeCache(s){if(s?.live){s.live.hero?.remove();s.live.above?.remove();s.live=null}}
  const pin=(el,left,top,width,height,z)=>{for(const [k,v] of Object.entries({position:"fixed",left:left+"px",top:top+"px",width:width+"px",height:height+"px","z-index":String(z),"pointer-events":"none",display:"block"}))el.style.setProperty(k,v,"important")};
  function placeLive(s){
    if(!s?.live)return;const r=canvas.elt.getBoundingClientRect(),[x,y,w,h]=s.live.rect;
    pin(s.live.hero.canvas,r.left+x*r.width,r.top+y*r.height,w*r.width,h*r.height,1);
    if(s.live.above)pin(s.live.above.canvas,r.left,r.top,r.width,r.height,2);
  }
  // A moving composition is split into DOM layers: the main canvas holds the
  // static zones (drawn once), the hero gets its own half-resolution canvas
  // over its rectangle, and zones above it sit in a static top layer. Only the
  // small hero layer changes per frame, so the compositor and the window blur
  // above it redo far less work.
  function renderComposition(g,W,H,t,s){
    if(s.post){
      // Glitch engine: the finished composition passes through a raster chain
      // once per output size; afterwards it is a single bitmap blit.
      const key=W+"x"+H;s.postCache=s.postCache||{};
      if(!s.postCache[key]){const tmp=p5ref.createGraphics(W,H,stableCanvas(W,H));tmp.pixelDensity(1);tmp.background(s.palette[0]);for(const z of s.zones)renderZone(tmp,W,H,t,s,z);
        s.postCache[key]=DesktopExperiments.applyChain(tmp.canvas,s.post.chain,s.post.seed,s.palette,s.paletteMode,Math.min(1100,Math.max(W,H)));tmp.remove()}
      const ctx=g.drawingContext;g.push();g.resetMatrix();ctx.save();ctx.imageSmoothingEnabled=false;ctx.drawImage(s.postCache[key],0,0,W,H);ctx.restore();g.pop();return}
    if(!(g===p5ref&&s.animated)){g.push();g.resetMatrix();g.background(s.palette[0]);g.pop();for(const z of s.zones)renderZone(g,W,H,t,s,z);return}
    const key=W+"x"+H+"@"+density,hero=s.zones[s.heroIndex];
    if(s.live?.key!==key){
      disposeCache(s);
      g.push();g.resetMatrix();g.background(s.palette[0]);g.pop();
      for(let i=0;i<s.heroIndex;i++)renderZone(g,W,H,t,s,s.zones[i]);
      applyGrain(g,W,s);
      let above=null;
      if(s.heroIndex<s.zones.length-1){above=p5ref.createGraphics(W,H);above.pixelDensity(density);above.clear();for(let i=s.heroIndex+1;i<s.zones.length;i++)renderZone(above,W,H,t,s,s.zones[i])}
      const rect=hero.bleed||hero.full?[0,0,1,1]:(hero.bbox||hero.rect),hw=Math.max(1,Math.ceil(rect[2]*W)),hh=Math.max(1,Math.ceil(rect[3]*H));
      const layer=p5ref.createGraphics(hw,hh);layer.pixelDensity(density*.5);
      s.live={key,hero:layer,above,rect,hw,hh};placeLive(s);
    }
    const {hero:layer,rect}=s.live;
    layer.clear();renderZone(layer,W,H,t,s,hero,rect[0]*W,rect[1]*H);
  }
  // Best-of-K: candidate compositions from the same seed are rendered small
  // and scored; K adapts to measured generation time (4..8, ~0.9 s budget).
  const CRITIC={min:4,max:8,budget:900,width:176,temperature:.35};
  function scoreScene(s,A){
    const sw=CRITIC.width,sh=Math.max(1,Math.round(sw/A)),g=p5ref.createGraphics(sw,sh,stableCanvas(sw,sh));g.pixelDensity(1);
    try{render(g,sw,sh,0,s);return G.metrics(g.drawingContext.getImageData(0,0,sw,sh).data,sw,sh,s.palette[0])}finally{g.remove()}
  }
  function criticScene(record,A){
    const seed=record.seed>>>0,started=performance.now(),candidates=[],ctx={families:families.filter(f=>!G.HEAVY.includes(f)),groupOf:id=>DesktopFamilies.entries.find(x=>x.id===id)?.group||"core",recent:record.recent||[]};
    const animated=typeof record.animated==="boolean"?record.animated:rng(G.mix32(seed,0xa11))()<.5;
    const pool=[];let best=null;
    for(let i=0;i<CRITIC.max;i++){
      const t0=performance.now();
      try{
        const composition=DesktopEngines.compose(G.mix32(seed,i+1),A,ctx),s=compositionScene({seed,animated,compositionAspect:A,composition,...(validPalette(record.palette)?{palette:record.palette}:{})});
        const m=scoreScene(s,A);candidates.push({i,score:m.score,ms:Math.round(performance.now()-t0)});
        pool.push({s,m,i});
      }catch(e){candidates.push({i,error:String(e.message||e).slice(0,90),ms:Math.round(performance.now()-t0)})}
      const elapsed=performance.now()-started;
      if(i+1>=CRITIC.min&&pool.length&&elapsed+elapsed/(i+1)>CRITIC.budget)break;
    }
    // A little chaos: softmax over scores instead of always the top one.
    if(pool.length){const top=Math.max(...pool.map(c=>c.m.score)),w=pool.map(c=>Math.exp((c.m.score-top)/CRITIC.temperature)),sum=w.reduce((a,b)=>a+b,0);
      let r=rng(G.mix32(seed,0x50f7))()*sum,k=0;for(;k<pool.length-1;k++){r-=w[k];if(r<0)break}best=pool[k]}
    if(!best)throw Error("No valid composition candidate");
    best.s.critic={version:2,temperature:CRITIC.temperature,k:candidates.length,budgetMs:CRITIC.budget,elapsedMs:Math.round(performance.now()-started),chosen:best.i,candidates,metrics:best.m};
    return best.s;
  }
  function buildComposition(record){
    const A=record.compositionAspect||CW/CH;
    if(record.composition)return compositionScene({...record,compositionAspect:A});
    let mix=mixAtAspect(record.mix,A);
    if(mix?.kind==='code')return build({...record,mix});
    if(mix?.kind!=='visual')return record.family||record.version===6?build(record):criticScene(record,A);
    if(mix.version!==1||!visualStrategies.includes(mix.strategy)||!Array.isArray(mix.layers)||mix.layers.length<2||mix.layers.length>3||new Set(mix.layers.map(x=>x.family)).size!==mix.layers.length)throw Error('Unsupported visual recipe');
    const base=build({...record,family:mix.layers[0].family,seed:mix.layers[0].seed,mix:null});
    const layerScenes=mix.layers.map(layer=>build({...record,seed:layer.seed,family:layer.family,animated:base.animated,palette:base.palette,mix:null}));
    return {...base,seed:record.seed>>>0,mix,layers:layerScenes,group:'composite',algorithm:mix.strategy,systemComplexity:'composite',strokes:layerScenes.flatMap(s=>s.strokes),dots:layerScenes.flatMap(s=>s.dots)};
  }
  function render(g,width,height,t,s=scene){
    if(!s)return;
    if(s.zones){renderComposition(g,width,height,t,s);return}
    if(!s.layers){renderSingle(g,width,height,t,s);return}
    const mix=s.mix,count=s.layers.length,A=s.compositionAspect;
    g.push();g.resetMatrix();g.background(s.palette[0]);g.pop();
    for(let index=0;index<count;index++){
      g.push();g.resetMatrix();const ctx=g.drawingContext;ctx.save();ctx.scale(width,height);ctx.beginPath();
      const strategy=mix.strategy,split=mix.params.split;
      if(strategy==='diptych'||strategy==='triptych')ctx.rect(index/count+.004,0,1/count-.008,1);
      else if(strategy==='interlaced-bands'){for(let row=index;row<mix.params.bands;row+=count)ctx.rect(0,row/mix.params.bands+.002,1,1/mix.params.bands-.004)}
      else if(strategy==='checker-weave'){const cols=Math.max(1,Math.round(mix.params.columns*A));for(let y=0;y<mix.params.columns;y++)for(let x=0;x<cols;x++)if((x+y)%count===index)ctx.rect(x/cols,y/mix.params.columns,1/cols-.002,1/mix.params.columns-.003)}
      else if(strategy==='radial-sectors'){for(let wedge=index;wedge<12;wedge+=count){const a=wedge/12*Math.PI*2,b=(wedge+.97)/12*Math.PI*2;ctx.moveTo(.5,.5);ctx.ellipse(.5,.5,Math.hypot(A/2,.5)*1.02/A,Math.hypot(A/2,.5)*1.02,0,a,b);ctx.lineTo(.5,.5)}}
      else if(strategy==='diagonal-cut'){if(count===3){ctx.moveTo(index/3-.5,0);ctx.lineTo((index+1)/3-.5,0);ctx.lineTo((index+1)/3+.5,1);ctx.lineTo(index/3+.5,1)}else{ctx.moveTo(index?split-.5:-2,0);ctx.lineTo(index?2:split-.5,0);ctx.lineTo(index?2:split+.5,1);ctx.lineTo(index?split+.5:-2,1)}ctx.closePath()}
      else if(strategy==='aperture'&&index>0)ctx.ellipse(.5+(index-1)*.13,.5,.36/(index*.25+.75)/A,.36/(index*.25+.75),0,0,Math.PI*2);
      else if(strategy==='offset-windows'&&index>0)ctx.rect(.14+index*.12,.1+index*.13,.66-index*.08,.67-index*.08);
      else ctx.rect(0,0,1,1);
      ctx.clip();ctx.setTransform(g.pixelDensity(),0,0,g.pixelDensity(),0,0);
      // Masks and geometry share the actual screen domain.
      if(mix.strategy!=='ink-interference'){ctx.fillStyle=s.palette[0];ctx.fillRect(0,0,width,height)}
      ctx.globalCompositeOperation=mix.layers[index].blend;
      renderSingle(g,width,height,t,s.layers[index],mix.layers[index]);ctx.restore();g.pop();
    }
  }

  function blendHex(a,b,t){
    return "#"+[1,3,5].map(i=>Math.round(parseInt(a.slice(i,i+2),16)*(1-t)+parseInt(b.slice(i,i+2),16)*t).toString(16).padStart(2,"0")).join("");
  }
  function setBudget(){
    if(!scene)return;
    const moving=scene.hero||scene,points=moving.strokes.reduce((n,s)=>n+s.points.length,0);
    const wallpaper=CW*CH*density*density>700000;
    // Slow motion reads fine at 10 fps; every frame also makes WindowServer re-blur the panels above.
    targetFPS=moving.dynamic?4:moving.group==="ikeda"?5:moving.strokes.length>1500||points>15000?5:wallpaper?8:24;
    renderEMA=0;frameCounter=0;p5ref.frameRate(targetFPS);
  }
  function metadata(){return {version:VERSION,seed:scene.seed,family:scene.family,group:scene.group,animated:scene.animated,palette:scene.palette,paletteMode:scene.paletteMode,algorithm:scene.algorithm,systemComplexity:scene.systemComplexity,phase,aspect:[CW,CH],compositionAspect:scene.compositionAspect,viewport:[CW,CH],pixelDensity:density,renderSize:[canvas.elt.width,canvas.elt.height],material:scene.material??null,...(scene.photo?{photo:scene.photo}:{}),...(scene.mix?{mix:scene.mix}:{}),...(scene.composition?{composition:scene.composition,critic:scene.critic}:{})};}
  // Soft dramaturgy: motion never stops (WebKit throttles timers in the
  // desktop-level window, so timed rests used to stretch into long freezes);
  // speed breathes between 35% and 100% instead.
  function drama(tau){
    const period=40+(scene.seed%29),u=(tau%period)/period;
    return .35+.65*(.5-.5*Math.cos(u*TAU));
  }
  function grainPattern(){
    if(grainTile)return grainTile;
    const c=document.createElement("canvas");c.width=c.height=128;const x=c.getContext("2d"),img=x.createImageData(128,128),random=rng(0x6a17);
    for(let i=0;i<img.data.length;i+=4){const v=128+(random()-.5)*150+(random()<.012?(random()-.5)*220:0);img.data[i]=img.data[i+1]=img.data[i+2]=Math.max(0,Math.min(255,v));img.data[i+3]=255}
    x.putImageData(img,0,0);return grainTile=c;
  }
  // Grain is a static, compositor-blended overlay: it costs nothing per frame.
  function updateOverlays(){
    // A blended overlay above a moving canvas makes the compositor re-blend the
    // whole screen every frame; animated scenes bake grain into their cache.
    const amount=scene?.animated?0:scene?.material?.grain||0;
    if(!amount){if(grainLayer)grainLayer.style.display="none";return}
    if(!grainLayer){grainLayer=document.createElement("div");grainLayer.style.cssText="position:fixed;pointer-events:none;z-index:1;mix-blend-mode:soft-light;background-size:128px 128px";grainLayer.style.backgroundImage="url("+grainPattern().toDataURL()+")";document.body.appendChild(grainLayer)}
    const r=canvas.elt.getBoundingClientRect();Object.assign(grainLayer.style,{display:"block",left:r.left+"px",top:r.top+"px",width:r.width+"px",height:r.height+"px",opacity:String(Math.min(.32,amount*2.6))});
  }
  // Material coordinates belong to the work, independent of the host window.
  // The production renderer uses a 480 px reference viewport.
  function applyGrain(g,width,s){
    const amount=s.material?.grain||0;if(!amount)return;
    const ctx=g.drawingContext,pattern=ctx.createPattern(grainPattern(),"repeat"),scale=Math.max(1,width/480);
    pattern.setTransform(new DOMMatrix().scale(scale));ctx.save();ctx.setTransform(g.pixelDensity(),0,0,g.pixelDensity(),0,0);ctx.globalAlpha=Math.min(.32,amount*2.6);ctx.globalCompositeOperation="soft-light";ctx.fillStyle=pattern;ctx.fillRect(0,0,width,g.height);ctx.restore();
  }
  function valid(candidate){
    return (candidate.strokes.length||candidate.dots.length)&&!candidate.strokes.some(s=>s.points.some(p=>p.some(x=>!Number.isFinite(x))))&&!candidate.dots.some(p=>p.slice(0,4).some(x=>!Number.isFinite(x)));
  }
  function load(record){
    const previous=scene;
    let candidate,quality;
    for(let attempt=0;attempt<4;attempt++){
      candidate=buildComposition({...record,compositionAspect:CW/CH,seed:((record.seed>>>0)+attempt*2654435761)>>>0});
      if(!valid(candidate)){candidate=null;continue;}
      const sw=Math.max(1,Math.round(360*Math.min(1,CW/CH))),sh=Math.max(1,Math.round(sw/(CW/CH))),area=sw*sh;
      const sample=p5ref.createGraphics(sw,sh,stableCanvas(sw,sh));sample.pixelDensity(1);render(sample,sw,sh,0,candidate);
      const pixels=sample.drawingContext.getImageData(0,0,sw,sh).data;
      const background=candidate.palette[0],rgb=[1,3,5].map(i=>parseInt(background.slice(i,i+2),16));
      let different=0,energy=0;
      for(let i=0;i<pixels.length;i+=4){const delta=Math.abs(pixels[i]-rgb[0])+Math.abs(pixels[i+1]-rgb[1])+Math.abs(pixels[i+2]-rgb[2]);energy+=delta;if(delta>75)different++;}
      sample.remove();
      quality={energy,different,strokes:candidate.strokes.length,dots:candidate.dots.length};
      // Subpixel dots and thin lines remain valid: count their integrated
      // contrast rather than requiring every sample to cross a hard threshold.
      if(energy>area*.12&&different<area*.975)break;
      disposeCache(candidate);candidate=null;
    }
    if(!candidate)throw Error("Composition rejected "+JSON.stringify(quality));
    disposeCache(previous);
    scene=candidate;phase=Number.isFinite(record.phase)?record.phase:0;last=performance.now();loadedAt=last;
    render(p5ref,CW,CH,phase);setBudget();updateOverlays();
    if(scene.animated&&visible)p5ref.loop();else p5ref.noLoop();
    send({kind:"sketch",...metadata()});return metadata();
  }
  window.Art={
    families,load,get isReady(){return !!scene;},
    setVisible(value){visible=!!value;last=performance.now();if(scene?.animated&&visible)p5ref.loop();else p5ref.noLoop();},
    metadata,
    inspect(){return scene?{kind:scene.zones?"composition":scene.layers?"visual":"single",zones:scene.zones?.map(z=>({role:z.role,shape:z.shape?.type||"rect",rect:(z.rect||z.bbox).map(v=>Math.round(v*1000)/1000),family:z.scene?.family||null,algorithm:z.scene?.algorithm||null,strokes:z.scene?.strokes.length||0})),critic:scene.critic||null,material:scene.material||null,strokes:scene.strokes.length,points:scene.strokes.reduce((n,s)=>n+s.points.length,0),dots:scene.dots.length,targetFPS}:null},
    resize(width,height,pixelDensity=density){
      const record=scene?metadata():null,oldAspect=scene?.compositionAspect;
      const nextW=Math.max(1,Math.round(Number(width)||1)),nextH=Math.max(1,Math.round(Number(height)||1));
      const nextDensity=Number.isFinite(pixelDensity)&&pixelDensity>0?pixelDensity:1;
      // Native screen synchronization also runs after sketch messages. A
      // no-op must neither post another message nor reset the frame budget.
      if(CW===nextW&&CH===nextH&&density===nextDensity)return [CW,CH];
      CW=nextW;CH=nextH;density=nextDensity;
      p5ref.pixelDensity(density);p5ref.resizeCanvas(CW,CH,true);
      if(record&&Math.abs(oldAspect-CW/CH)>1e-12)load({...record,compositionAspect:CW/CH});
      else if(scene){disposeCache(scene);render(p5ref,CW,CH,phase);setBudget();updateOverlays();send({kind:"sketch",...metadata()});}
      return [CW,CH];
    },
    seek(value){phase=Math.max(0,Number(value)||0);render(p5ref,CW,CH,phase);return metadata();},
    exportSketch(){if(scene)send({kind:"exportSketch",state:metadata()});},
    preview(){return canvas.elt.toDataURL("image/png");},
    // A still for the desktop: animated works are sampled at several phases
    // and the best-scoring frame (critic metrics) is kept.
    stillFrame(width,height){
      visible=false;p5ref.noLoop();
      if(scene.animated){let best=null;for(const t of [0,2.5,5,8.5,13,19,27,38]){const A=scene.compositionAspect,sw=176,sh=Math.max(1,Math.round(sw/A)),g=p5ref.createGraphics(sw,sh,stableCanvas(sw,sh));g.pixelDensity(1);render(g,sw,sh,t,scene);const m=G.metrics(g.drawingContext.getImageData(0,0,sw,sh).data,sw,sh,scene.palette[0]);g.remove();if(!best||m.score>best.score)best={t,score:m.score}}phase=best.t}
      return {phase,png:this.renderAt(width,height)};
    },
    renderAt(width,height=Math.round(width/scene.compositionAspect)){
      width=Math.max(1,Math.round(width));height=Math.max(1,Math.round(height));
      // Explicit output dimensions form another mathematical domain, not a
      // stretched screenshot. Matching aspect retains the existing geometry.
      const s=Math.abs(width/height-scene.compositionAspect)>1e-12?buildComposition({...metadata(),compositionAspect:width/height}):scene;
      const g=p5ref.createGraphics(width,height,stableCanvas(width,height));g.pixelDensity(1);
      try {render(g,width,height,phase,s);applyGrain(g,width,s);return g.canvas.toDataURL("image/png");}
      finally {g.remove();if(s!==scene)disposeCache(s);}
    }

  };
  new p5(p=>{
    p5ref=p;
    p.setup=()=>{DesktopExperiments.setRenderer(sourceRender);density=Number(globalThis.DEFAULT_DESKTOP_DENSITY)||(SAVED?1:window.devicePixelRatio||1);p.pixelDensity(density);canvas=p.createCanvas(CW,CH);p.frameRate(30);p.noLoop();send({kind:"ready"});if(SAVED||!window.webkit?.messageHandlers?.desktop)load(SAVED||{seed:23711,recent:[]});window.addEventListener("resize",()=>{updateOverlays();placeLive(scene)});};
    p.draw=()=>{
      const now=performance.now();let envelope=1;
      if(scene?.animated&&visible){envelope=drama((now-loadedAt)/1000);phase+=Math.min(.35,(now-last)/1000)*envelope}
      last=now;
      const started=performance.now();render(p,CW,CH,phase);
      const elapsed=performance.now()-started;renderEMA=renderEMA?renderEMA*.92+elapsed*.08:elapsed;
      // A visible wallpaper remains alive; expensive scenes reduce their rate.
      // This is a CPU-side budget, not a claim about GPU compositor time.
      if(++frameCounter%48===0){const budget=CW*CH*density*density>700000?.22:.4;p.frameRate(Math.min(targetFPS,Math.max(4,1000*budget/Math.max(1,renderEMA))))}
    };
  });
})();
