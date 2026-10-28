/* Original procedural systems grouped by the requested aesthetic directions.
   Each entry changes the construction/topology, not just a seed or palette. */
(() => {
  "use strict";
  const entries=[], algorithms={};
  const register=(group,name,draw,info={})=>{const id=group+"-"+name;entries.push({id,group,name,...info});algorithms[id]=draw;};
  function tools(api){
    const {R,pick,add,dots,TAU}=api,A=api.aspect;
    const line=(x1,y1,x2,y2,c=1,w=.001)=>add([[x1,y1],[x2,y2]],c,w);
    const rect=(x,y,w,h,c=1)=>add([[x,y],[x+w,y],[x+w,y+h],[x,y+h]],c,0,true,true);
    const circle=(x,y,r,c=1,w=.001,fill=false)=>add(Array.from({length:73},(_,i)=>[x+Math.cos(i/72*TAU)*r/A,y+Math.sin(i/72*TAU)*r]),c,w,fill,true);
    const curve=(fn,n=160,c=1,w=.001)=>add(Array.from({length:n+1},(_,i)=>fn(i/n)),c,w);
    const poly=(p,c=1,fill=false,w=.001)=>add(p,c,w,fill,true);
    const dot=(x,y,r=.002,c=1)=>dots.push([x,y,r,c]);
    const noise=(x,y=0)=>Math.sin(x*7.1+y*3.7)*.5+Math.cos(x*13.3-y*5.9)*.25+Math.sin(x*27.1+y*11.7)*.125;
    return {R,pick,add,dots,TAU,A,line,rect,circle,curve,poly,dot,noise,dynamic:api.dynamic||(()=>{}),raster:api.raster||(()=>{})};
  }

  // Shared mathematical kernels. Singles and typed hybrid programs call the
  // same functions; hybrid stages exchange state rather than rendered layers.
  function reactionField(R,opts={},A=1){
    const h=opts.h||64,w=opts.w||Math.max(24,Math.round(h*A)),size=w*h;let a=new Float32Array(size).fill(1),b=new Float32Array(size),na=new Float32Array(size),nb=new Float32Array(size);
    const [feed,kill]=R()<.5?[.0545,.062]:[.0367,.0649];
    for(let seed=0;seed<14;seed++){const cx=Math.floor(R(8,w-8)),cy=Math.floor(R(8,h-8));for(let y=-3;y<=3;y++)for(let x=-3;x<=3;x++)if(x*x+y*y<10)b[(cy+y)*w+cx+x]=1;}
    const clamp=x=>Math.max(0,Math.min(1,x));
    for(let step=0;step<(opts.steps||650);step++){
      na.set(a);nb.set(b);
      for(let y=1;y<h-1;y++)for(let x=1;x<w-1;x++){
        const i=y*w+x,aa=a[i],bb=b[i],reaction=aa*bb*bb;
        const la=-aa+.2*(a[i-1]+a[i+1]+a[i-w]+a[i+w])+.05*(a[i-w-1]+a[i-w+1]+a[i+w-1]+a[i+w+1]);
        const lb=-bb+.2*(b[i-1]+b[i+1]+b[i-w]+b[i+w])+.05*(b[i-w-1]+b[i-w+1]+b[i+w-1]+b[i+w+1]);
        na[i]=clamp(aa+la-reaction+feed*(1-aa));nb[i]=clamp(bb+.5*lb+reaction-(kill+feed)*bb);
      }
      [a,na]=[na,a];[b,nb]=[nb,b];
    }
    return {w,h,values:b,sample(x,y){const xx=clamp(x)*(w-1),yy=clamp(y)*(h-1),ix=Math.floor(xx),iy=Math.floor(yy),fx=xx-ix,fy=yy-iy;const at=(dx,dy)=>b[Math.min(h-1,iy+dy)*w+Math.min(w-1,ix+dx)];return ((1-fx)*at(0,0)+fx*at(1,0))*(1-fy)+((1-fx)*at(0,1)+fx*at(1,1))*fy}};
  }
  function binaryField(R,cols=80,rows=24){
    const mask=Math.floor(R(1,255)),bit=(x,y)=>(((x*17+y*31)^mask)&(1<<(((y%7)+7)%7)))?1:0;
    return {cols,rows,mask,bit,sample(x,y,t=0){return bit(Math.floor(x*cols),Math.floor(y*rows)+Math.floor(t*.5))}};
  }
  function radialField(R,A){
    const sources=Array.from({length:Math.floor(R(3,7))},()=>[R(.1,.9),R(.15,.85),R(.5,1),R(0,Math.PI*2)]),frequency=R(20,45);
    return {sample(x,y,t=0){let z=0;for(const [sx,sy,amp,phase]of sources){const d=Math.hypot((x-sx)*A,y-sy);z+=Math.sin(d*frequency-t*.55+phase)*amp/(1+d*5)}return z}};
  }
  function packedCircles(R,A){
    const circles=[];for(let i=0;i<1600&&circles.length<100;i++){const x=R(.1,.9),y=R(.12,.88),r=R(.012,.12);if(circles.every(c=>Math.hypot((x-c[0])*A,y-c[1])>r+c[2]+.006))circles.push([x,y,r])}return circles.sort((a,b)=>b[2]-a[2]);
  }
  function nearestGraph(points,neighbors=2,A=1){
    const edges=[],seen=new Set();points.forEach(([x,y],i)=>{const nearest=points.map((p,j)=>[Math.hypot((p[0]-x)*A,p[1]-y),j]).filter(a=>a[1]!==i).sort((a,b)=>a[0]-b[0]);for(let k=0;k<Math.min(neighbors,nearest.length);k++){const j=nearest[k][1],key=[Math.min(i,j),Math.max(i,j)].join(':');if(!seen.has(key)){edges.push([i,j]);seen.add(key)}}});return {points,edges};
  }
  function automatonGraph(R,field=null,w=75,h=38){
    const samples=field?Array.from({length:w},(_,x)=>field.sample(x/w,.5)):[],median=samples.length?samples.slice().sort((a,b)=>a-b)[Math.floor(w/2)]:0;let bits=Array.from({length:w},(_,x)=>field?(samples[x]>median?1:0):(R()<.5?1:0)),previous=new Map();if(bits.every(b=>b===bits[0]))bits=bits.map(()=>R()<.5?1:0);const points=[],edges=[];
    for(let y=0;y<h;y++){const current=new Map();bits.forEach((b,x)=>{if(b){const i=points.length;points.push([.04+x/w*.92,.04+y/h*.92]);current.set(x,i);if(previous.has(x-1))edges.push([previous.get(x-1),i]);if(previous.has(x+1)&&(!field||field.sample(x/w,y/h)>.2))edges.push([previous.get(x+1),i])}});previous=current;bits=bits.map((_,x)=>bits[(x+w-1)%w]^bits[(x+1)%w]);}return {points,edges};
  }
  function colonizationGraph(R,attractors=null,A=1){
    attractors=attractors?attractors.map(p=>p.slice(0,2)):Array.from({length:260},()=>{const a=R(0,Math.PI*2),r=Math.sqrt(R());return [.5+Math.cos(a)*r*.37,.4+Math.sin(a)*r*.32]});
    const nodes=[{x:.5,y:.94,parent:-1,depth:0}];for(let i=1;i<13;i++)nodes.push({x:.5,y:.94-i*.018,parent:i-1,depth:i});
    for(let step=0;step<75&&attractors.length&&nodes.length<1800;step++){
      const directions=new Map(),remaining=[];
      for(const p of attractors){let nearest=-1,best=.16**2;for(let i=0;i<nodes.length;i++){const n=nodes[i],d=((p[0]-n.x)*A)**2+(p[1]-n.y)**2;if(d<best){best=d;nearest=i}}if(best<.023**2)continue;remaining.push(p);if(nearest<0)continue;const n=nodes[nearest],dx=p[0]-n.x,dy=p[1]-n.y,l=Math.hypot(dx*A,dy)||1,v=directions.get(nearest)||[0,0];v[0]+=dx/l;v[1]+=dy/l;directions.set(nearest,v)}
      attractors=remaining;if(!directions.size)break;for(const [parent,v]of directions){const n=nodes[parent],l=Math.hypot(v[0]*A,v[1])||1;nodes.push({x:n.x+v[0]/l*.018,y:n.y+v[1]/l*.018,parent,depth:n.depth+1})}
    }
    return {nodes,points:nodes.map(n=>[n.x,n.y]),edges:nodes.flatMap((n,i)=>n.parent<0?[]:[[n.parent,i]])};
  }
  function relaxGraph(R,graph,passes=100,A=1){
    const rest=graph.points.map(p=>p.slice()),points=rest.map(p=>p.slice()),adj=points.map(()=>[]),lengths=new Map(),forces=Array.from({length:3},()=>[R(.2,.8),R(.2,.8),R(-.003,.003)]);
    for(const [a,b]of graph.edges){adj[a].push(b);adj[b].push(a);const d=Math.hypot((rest[a][0]-rest[b][0])*A,rest[a][1]-rest[b][1]);lengths.set(a+":"+b,d);lengths.set(b+":"+a,d)}
    for(let step=0;step<passes;step++){
      const next=points.map((n,i)=>{if(!adj[i].length)return n;let ax=(rest[i][0]-n[0])*.06,ay=(rest[i][1]-n[1])*.06;for(const j of adj[i]){const dx=points[j][0]-n[0],dy=points[j][1]-n[1],d=Math.hypot(dx*A,dy)||1,force=(d-lengths.get(i+":"+j))/d*.45/adj[i].length;ax+=dx*force;ay+=dy*force}for(const [cx,cy,strength]of forces){const dx=n[0]-cx,dy=n[1]-cy,d=dx*dx+dy*dy+.02;ax+=dx*strength/d;ay+=dy*strength/d}return [Math.max(.02,Math.min(.98,n[0]+ax)),Math.max(.02,Math.min(.98,n[1]+ay))]});points.forEach((p,i)=>{p[0]=next[i][0];p[1]=next[i][1]});
    }
    return {...graph,points,rest,at(t){const blend=.85+.15*Math.sin(t*.18);return points.map((p,i)=>[rest[i][0]+(p[0]-rest[i][0])*blend,rest[i][1]+(p[1]-rest[i][1])*blend])}};
  }
  function ribbonPoint(center,u,t,width,A){
    const side=u<.5?1:-1,q=u<.5?u*2:2-u*2,p=center(q,t),a=center(q-.0001,t),b=center(q+.0001,t),dx=(b[0]-a[0])*A,dy=b[1]-a[1],len=Math.hypot(dx,dy)||1;
    return [p[0]-side*dy/len*width/A,p[1]+side*dx/len*width];
  }
  function spectralPaths(R,field=null,count=48,samples=140){
    const f=R(1,4),noise=(x,y)=>Math.sin(x*7.1+y*3.7)*.5+Math.cos(x*13.3-y*5.9)*.25+Math.sin(x*27.1+y*11.7)*.125;
    return {paths:Array.from({length:count},(_,row)=>Array.from({length:samples+1},(_,j)=>{const x=j/samples;return [x,.5+(row-(count-1)/2)*.007+noise(x*f,row*.05)*.15*Math.sin(x*3.14)]})),at(t){return Array.from({length:count},(_,row)=>Array.from({length:samples+1},(_,j)=>{const x=.04+j/samples*.92,y=.06+row/(count-1)*.88,v=field?field.sample(x,y,t):noise(x*f,row*.05);return [x,y+v*.115*Math.sin(x*Math.PI)]}))}};
  }

  register("ikeda","binary-planes",({R,rect,A})=>{
    const cols=80,rows=24,field=binaryField(R,cols,rows);
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)if(field.bit(x,y))rect(x/cols,y/rows,.95/cols,.95/rows,(x+y)%43?1:2);
  });
  register("ikeda","barcode-horizons",({R,rect,A})=>{
    for(let band=0;band<5;band++){let x=0;while(x<1){let w=R(.001,.018);if(R()<.65)rect(x,.08+band*.18,w,R(.08,.14),band===3?2:1);x+=w+R(.001,.008);}}
  });
  register("ikeda","spectral-stacks",({R,line,A})=>{
    const f=R(3,12);for(let i=0;i<230;i++){let x=i/230,amp=Math.pow(Math.abs(Math.sin(x*f)*Math.cos(x*f*.37)),3)*.42;line(x,.5-amp,x,.5+amp,i%37?1:2,.0018);}
  });
  register("ikeda","quantized-stars",({R,dot,line,A})=>{
    const nodes=Array.from({length:160},()=>[Math.floor(R()*96)/96,Math.floor(R()*36)/36]);
    for(let i=0;i<nodes.length;i++){const [x,y]=nodes[i];dot(x,y,R(.001,.005),i%29?1:2);if(i%7===0)line(x,y,x+.018,y,1,.0006);}
  });
  register("ikeda","scan-combs",({line,rect,A})=>{
    for(let i=0;i<260;i++){let x=i/260;line(x,.15,x,.85,i%61?1:2,i%8?.0007:.002);}
    for(let i=0;i<7;i++)rect(.05,.2+i*.085,.9,.025,i%3?0:2);
  });
  register("ikeda","time-rails",({R,line,rect,A})=>{
    for(let row=0;row<12;row++){const y=.06+row*.075;line(.03,y,.97,y,1,.0006);for(let x=.03;x<.98;x+=.012){let h=R()<.18?.027:.01;line(x,y,x,y+h,1,.0008);}rect(R(.1,.8),y,.08,.014,row%5?1:2);}
  });
  register("ikeda","impulse-arrays",({R,line,A})=>{
    for(let row=0;row<21;row++){let points=[];for(let i=0;i<350;i++){let x=i/349,y=(row+.5)/21;if(R()<.035)y+=R(-.018,.018);points.push([x,y]);}for(let i=1;i<points.length;i++)line(...points[i-1],...points[i],row%8?1:2,.0007);}
  });
  register("ikeda","bit-curtains",({R,rect,A})=>{
    for(let col=0;col<110;col++){let offset=R();for(let j=0;j<18;j++){let y=(offset+j*.073)%1,h=R(.002,.04);if(R()<.5)rect(col/110,y,.004,h,col%31?1:2);}}
  });
  register("ikeda","density-matrix",({dot,A})=>{
    for(let y=0;y<65;y++)for(let x=0;x<115;x++){const d=Math.abs(Math.sin(x*.038)*Math.cos(y*.064));if(((x*13+y*7)%101)/101<d)dot(x/115,y/65,.0016,(x+y)%97?1:2);}
  });
  register("ikeda","orthogonal-cuts",({R,rect,line,A})=>{
    for(let i=0;i<25;i++){let y=i/25;rect(0,y,R(.15,.95),.022,i%9?1:2);}
    for(let i=0;i<60;i++){let x=i/60;line(x,0,x,1,0,R(.001,.008));}
  });

  register("devine","patch-topology",({R,line,circle,A})=>{
    const graph=nearestGraph(Array.from({length:42},()=>[R(.06,.94),R(.08,.92)]),2,A);
    graph.points.forEach(([x,y],i)=>circle(x,y,.009,i%9?1:2,.001));graph.edges.forEach(([a,b])=>line(...graph.points[a],...graph.points[b],1,.0007));
  });
  register("devine","granular-swarms",({R,dot,TAU,A})=>{
    const clusters=Array.from({length:8},()=>[R(.1,.9),R(.15,.85),R(.04,.2)]);
    for(let i=0;i<5000;i++){const c=clusters[i%clusters.length],a=R(0,TAU),r=Math.pow(R(),2)*c[2];dot(c[0]+Math.cos(a)*r/A,c[1]+Math.sin(a)*r,R(.0004,.0025),i%31?1:2);}
  });
  register("devine","circuit-terraces",({R,line,rect,A})=>{
    for(let i=0;i<75;i++){let x=R(),y=R(),w=R(.02,.17),h=R(.01,.09);line(x,y,x+w,y,1,.001);line(x+w,y,x+w,y+h,1,.001);rect(x+w-.003,y+h-.003,.006,.006,i%11?1:2);}
  });
  register("devine","spectrogram-folds",({R,curve,noise,A})=>{
    const state=spectralPaths(R,null,95,160);state.paths.forEach((p,i)=>curve(t=>p[Math.round(t*160)],160,i%17?1:2,.0008));
  });
  register("devine","resonance-shells",({R,curve,TAU,A})=>{
    let a=R(2,7),b=R(3,10);for(let k=0;k<60;k++)curve(t=>{let x=Math.sin(t*TAU*a+k*.013),y=Math.sin(t*TAU*b+k*.026);return [.5+x*(.15+k*.002),.5+y*(.22+k*.003)];},280,k%13?1:2,.0007);
  });
  register("devine","cable-bundles",({R,curve,A})=>{
    let poles=Array.from({length:6},()=>[R(.1,.9),R(.1,.9)]);
    for(let i=0;i<110;i++){let a=poles[i%6],b=poles[(i+3)%6],bend=R(-.3,.3);curve(t=>[(1-t)*a[0]+t*b[0]+Math.sin(t*Math.PI)*bend,.5*(a[1]+b[1])+(a[1]-b[1])*(.5-t)+Math.sin(t*Math.PI)*bend*.5],100,i%19?1:2,.0008);}
  });
  register("devine","signal-crystals",({R,poly,line,A})=>{
    const points=Array.from({length:85},()=>[R(.08,.92),R(.1,.9)]).sort((a,b)=>a[0]-b[0]);
    for(let i=0;i<points.length-2;i++){poly([points[i],points[i+1],points[i+2]],i%13?1:2,false,.001);if(i%5===0)line(...points[i],.5,.5,2,.0004);}
  });
  register("devine","particle-mesh",({R,line,dot,A})=>{
    let points=Array.from({length:160},()=>[R(),R()]);
    points.forEach((p,i)=>{dot(...p,.002,i%19?1:2);for(let j=i+1;j<points.length;j++)if(Math.hypot((p[0]-points[j][0])*A,p[1]-points[j][1])<.115)line(...p,...points[j],1,.0005);});
  });
  register("devine","feedback-labyrinth",({R,line,A})=>{
    const w=70,h=35;let x=Math.floor(R(0,w)),y=Math.floor(R(0,h)),seen=new Set();
    for(let i=0;i<2500;i++){const key=x+","+y;seen.add(key);let directions=[[1,0],[-1,0],[0,1],[0,-1]],valid=directions.filter(([dx,dy])=>x+dx>=0&&x+dx<w&&y+dy>=0&&y+dy<h&&!seen.has((x+dx)+","+(y+dy)));if(!valid.length){x=Math.floor(R(0,w));y=Math.floor(R(0,h));continue;}let [dx,dy]=valid[Math.floor(R(0,valid.length))];line(x/w,y/h,(x+dx)/w,(y+dy)/h,i%97?1:2,.0014);x+=dx;y+=dy;}
  });
  register("devine","scope-knots",({R,curve,TAU,A})=>{
    const p=Math.floor(R(2,7)),q=p+1;for(let k=0;k<16;k++)curve(t=>{let a=t*TAU,r=.25+.08*Math.cos(q*a);return [.5+r*Math.cos(p*a),.5+r*Math.sin(p*a)*1.4+Math.sin(q*a)*k*.001];},700,k%5?1:2,.001);
  });

  register("gjones","threshold-corridor",({rect,line,A})=>{
    for(let i=25;i>0;i--){let d=Math.pow(i/25,2),w=d*.98,h=d*.94;rect(.5-w/2,.5-h/2,w,h,i%2);}
    for(let i=0;i<24;i++)line(i/23,0,.5,.5,2,.0006);
  });
  register("gjones","ink-shock",({R,poly,TAU,A})=>{
    for(let k=0;k<20;k++){let r=.04+k*.022;poly(Array.from({length:150},(_,i)=>{let a=i/150*TAU,v=r*(.65+R()*.7);return [.5+Math.cos(a)*v,.5+Math.sin(a)*v*1.3];}),k%2,true);}
  });
  register("gjones","ruptured-grid",({curve,A})=>{
    for(let d=0;d<2;d++)for(let i=0;i<50;i++)curve(t=>{let a=i/49,b=t,shift=Math.exp(-Math.pow((t-.5)*9,2))*.18*Math.sign(a-.5);return d?[b,a+shift]:[a+shift,b];},140,i%11?1:2,.001);
  });
  register("gjones","halftone-whirlpool",({dot,TAU,A})=>{
    for(let y=0;y<60;y++)for(let x=0;x<105;x++){let dx=x/104-.5,dy=y/59-.5,a=Math.atan2(dy,dx*A),r=Math.hypot(dx*A,dy);let size=.001+Math.pow((Math.sin(a*7+r*32)+1)/2,2)*.009;dot(x/104,y/59,size,(x+y)%37?1:2);}
  });
  register("gjones","folded-checker",({rect,A})=>{
    for(let y=0;y<42;y++)for(let x=0;x<72;x++)if((x+y)%2===0){let xx=x/72+.045*Math.sin(y*.28),yy=y/42+.05*Math.sin(x*.16);rect(xx,yy,1/72,1/42,x%23?1:2);}
  });
  register("gjones","torn-silhouettes",({R,poly,A})=>{
    for(let k=0;k<7;k++){let top=R(.05,.65),p=[[0,1],[1,1]];for(let i=70;i>=0;i--)p.push([i/70,top+Math.sin(i*.13+k)*.12+R(-.045,.045)]);poly(p,k%3===0?2:k%2,true);}
  });
  register("gjones","seismic-blocks",({R,rect,A})=>{
    for(let i=0;i<80;i++){let x=i/80,y=.5+Math.sin(i*.09)*.22,h=R(.02,.32);rect(x,y-h/2,.009,h,i%17?1:2);}
    for(let i=0;i<12;i++)rect(0,i/12,1,.008,0);
  });
  register("gjones","solar-rims",({circle,line,A})=>{
    for(let i=0;i<100;i++)circle(.5,.5,.04+i*.006,i%13?1:2,.0008);
    for(let i=0;i<180;i++){let a=i/180*Math.PI*2;line(.5+Math.cos(a)*.22,.5+Math.sin(a)*.39,.5+Math.cos(a)*.5,.5+Math.sin(a)*.89,1,.001);}
  });
  register("gjones","negative-fractures",({R,rect,line,A})=>{
    rect(0,0,1,1,1);for(let k=0;k<80;k++){let x=R(),y=R();for(let i=0;i<8;i++){let nx=x+R(-.07,.07),ny=y+R(.03,.12);line(x,y,nx,ny,0,R(.003,.012));x=nx;y=ny;}}
  });
  register("gjones","wave-collision",({curve,TAU,A})=>{
    for(let i=0;i<100;i++)curve(x=>[x,.5+(i-50)*.008+Math.sin(x*TAU*6+i*.08)*.08*Math.sin(x*Math.PI)*Math.cos(i*.05)],220,i%19?1:2,.001);
  });

  register("ringnoord","industrial-scan",({R,line,rect,A})=>{
    for(let i=0;i<180;i++){let y=i/180;line(0,y,1,y,1,R(.0004,.002));if(i%7===0)rect(R(),y,R(.05,.4),.003,0);}
    rect(.17,.2,.09,.6,0);rect(.73,.08,.03,.84,2);
  });
  register("ringnoord","oxide-rubbing",({R,dot,noise,A})=>{
    for(let i=0;i<11000;i++){let x=R(),y=R(),v=noise(x*3,y*5);if(v>.07&&R()<v+.2)dot(x,y,R(.0005,.004),i%71?1:2);}
  });
  register("ringnoord","pressure-imprint",({R,curve,A})=>{
    for(let i=0;i<90;i++){let y=i/90;curve(x=>[x,y+Math.exp(-Math.pow((x-.5)*5,2))*Math.sin(y*18)*.13],160,i%23?1:2,R(.0006,.0025));}
  });
  register("ringnoord","crushed-moire",({R,curve,A})=>{
    let squeeze=R(.03,.1);for(let d=0;d<2;d++)for(let i=0;i<130;i++)curve(t=>[t,i/130+Math.tanh((t-.5)/squeeze)*.15*(d?1:-1)],180,d?2:1,.0007);
  });
  register("ringnoord","mirrored-machines",({R,add,rect,A})=>{
    const count=Math.floor(R(3,7)),height=R(.5,.8),gap=R(.015,.035),radius=R(.02,.055);
    const rounded=(x,y,w,h,r)=>{
      const centers=[[x+w-r,y+r],[x+w-r,y+h-r],[x+r,y+h-r],[x+r,y+r]],points=[];
      centers.forEach(([cx,cy],k)=>{for(let j=0;j<=14;j++){const a=-Math.PI/2+k*Math.PI/2+j/14*Math.PI/2;points.push([cx+Math.cos(a)*r,cy+Math.sin(a)*r*A])}});return points;
    };
    for(let k=0;k<count;k++){
      const width=R(.035,.07),x=.47-k*.067,y=.5-height/2+Math.abs(k-count/2)*.012;
      for(const sign of [-1,1]){
        const shape=t=>rounded(sign<0?x:.98-x-width,y,width,height-(k%2)*.04,radius*.4);
        const item=add(shape(0),k%4?1:2,0,true,true);item.motionPoints=t=>shape(t).map(([xx,yy])=>[xx+sign*Math.sin(t*.2)*gap*.4,yy]);
      }
    }
    rect(.465,.38,.07,.24,0);rect(.06,.49,.88,.012,0);
  });
  register("ringnoord","broken-radar",({R,add,TAU,A})=>{
    for(let i=1;i<75;i++){let a=R(0,TAU),span=R(.15,4),r=i*.009;add(Array.from({length:80},(_,j)=>[.5+Math.cos(a+j/79*span)*r/A,.5+Math.sin(a+j/79*span)*r]),i%17?1:2,.0012);}
  });
  register("ringnoord","monolith-slits",({R,rect,A})=>{
    for(let i=0;i<11;i++)rect(.04+i*.085,R(.05,.25),.06,R(.5,.8),i%5?1:2);
    for(let i=0;i<100;i++)rect(R(),R(),R(.01,.2),R(.001,.009),0);
  });
  register("ringnoord","angular-folds",({R,poly,A})=>{
    for(let i=0;i<34;i++){let x=i/34;poly([[x,0],[x+.017,0],[x+.17,1],[x+.12,1]],i%9?1:2,true);}
    poly([[0,.45],[1,.15],[1,.22],[0,.51]],0,true);
  });
  register("ringnoord","directional-grain",({R,line,noise,A})=>{
    for(let i=0;i<4500;i++){let x=R(),y=R(),a=noise(x*4,y*3),len=R(.002,.018);line(x,y,x+Math.cos(a)*len,y+Math.sin(a)*len,i%59?1:2,R(.0003,.001));}
  });
  register("ringnoord","occluded-rings",({circle,rect,A})=>{
    for(let i=0;i<90;i++)circle(.4,.5,.04+i*.008,i%29?1:2,.001);
    rect(.15,0,.18,1,0);rect(.6,0,.07,1,0);
  });

  register("aphex","phase-portraits",({R,curve,TAU,A})=>{
    let f=R(1.5,4);for(let i=0;i<38;i++)curve(t=>[.5+Math.sin(t*TAU*f+i*.03)*.38,.5+Math.cos(t*TAU*(f+.75))*Math.sin(t*TAU)*.4],600,i%11?1:2,.0008);
  });
  register("aphex","elastic-portals",({circle,A})=>{
    for(let i=1;i<80;i++){let t=i/80;circle(.5+.13*Math.sin(t*7),.5+.2*Math.cos(t*5),t*.65,i%19?1:2,.0011);}
  });
  register("aphex","metaball-contours",({R,curve,A})=>{
    let nodes=Array.from({length:5},()=>[R(.2,.8),R(.2,.8)]);
    for(let k=0;k<70;k++)curve(x=>{let y=.06+k*.013;for(let p of nodes){let dx=x-p[0],dy=y-p[1];y+=Math.exp(-(dx*dx*3+dy*dy)*35)*.01;}return [x,y];},200,k%13?1:2,.001);
  });
  register("aphex","unstable-symmetry",({R,line,TAU,A})=>{
    let petals=Math.floor(R(5,15));for(let i=0;i<500;i++){let a=i/500*TAU,r=.2+.12*Math.sin(a*petals),b=a+.3;line(.5+Math.cos(a)*r,.5+Math.sin(a)*r*1.5,.5+Math.cos(b)*r,.5+Math.sin(b)*r*1.5,i%53?1:2,.001);}
  });
  register("aphex","spirograph-memory",({R,curve,TAU,A})=>{
    let r=R(.1,.3),k=R(1.7,5);curve(t=>{let a=t*TAU*30;return [.5+.2*Math.cos(a)+r*Math.cos(k*a),.5+.3*Math.sin(a)-r*Math.sin(k*a)];},9000,1,.0008);
  });
  register("aphex","acid-filaments",({R,curve,TAU,A})=>{
    for(let i=0;i<80;i++){let a=R(.02,.07),f=R(3,11);curve(x=>[x,.5+Math.sin(x*TAU*f+i*.12)*a+(i-40)*.006],240,i%17?1:2,.0009);}
  });
  register("aphex","twisted-fans",({curve,TAU,A})=>{
    for(let i=0;i<170;i++){let a=i/170*TAU;curve(t=>{let r=t*.8,b=a+Math.sin(t*5)*.8;return [.5+Math.cos(b)*r/A,.5+Math.sin(b)*r];},90,i%29?1:2,.001);}
  });
  register("aphex","fluid-cutouts",({poly,TAU,A})=>{
    for(let k=20;k>0;k--){let r=k*.026;poly(Array.from({length:160},(_,i)=>{let a=i/160*TAU,rr=r*(1+.18*Math.sin(a*3+k*.15));return [.5+Math.cos(a)*rr/1.3,.5+Math.sin(a)*rr];}),k%7===0?2:k%2,true);}
  });
  register("aphex","contour-beads",({dot,TAU,A})=>{
    for(let ring=0;ring<55;ring++)for(let i=0;i<110;i++){let a=i/110*TAU,r=.03+ring*.012+Math.sin(a*7+ring*.13)*.016;dot(.5+Math.cos(a)*r/A,.5+Math.sin(a)*r,.001+(ring%5)*.0004,ring%17?1:2);}
  });
  register("aphex","wire-memory-map",({line,A})=>{
    for(let y=0;y<45;y++)for(let x=0;x<85;x++){let warp=(a,b)=>[a+.08*Math.sin(b*9)*Math.sin(a*6),b+.1*Math.cos(a*7)*Math.sin(b*5)];let a=warp(x/85,y/45),b=warp((x+1)/85,y/45);line(...a,...b,y%13?1:2,.0008);if(x%4===0)line(...a,...warp(x/85,(y+1)/45),1,.0007);}
  });

  register("autechre","recursive-solids",({line,A})=>{
    const cube=(x,y,s,d)=>{let p=[[x-s,y-s],[x+s,y-s],[x+s,y+s],[x-s,y+s]],q=p.map(([a,b])=>[a+s*.45,b-s*.6]);for(let i=0;i<4;i++){line(...p[i],...p[(i+1)%4],1,.001);line(...q[i],...q[(i+1)%4],1,.001);line(...p[i],...q[i],2,.0006);}if(d){cube(x-s*.5,y,s*.44,d-1);cube(x+s*.5,y,s*.44,d-1);}};
    cube(.5,.55,.28,4);
  });
  register("autechre","logic-folds",({poly,A})=>{
    for(let i=0;i<60;i++){let t=i/60;poly([[t,.06],[1-t,.35],[t,.65],[1-t,.94]],i%17?1:2,false,.0009);}
  });
  register("autechre","graph-automaton",({R,line,dot,A})=>{
    const graph=automatonGraph(R);graph.points.forEach(p=>dot(...p,.002,1));graph.edges.forEach(([a,b])=>line(...graph.points[a],...graph.points[b],2,.0006));
  });
  register("autechre","perspective-cells",({line,A})=>{
    for(let i=0;i<70;i++){let t=i/70,y=.12+Math.pow(t,2)*.85;line(0,y,1,y,1,.0008);}
    for(let i=0;i<100;i++)line(.5,.12,i/99,1,i%19?1:2,.0008);
  });
  register("autechre","constrained-walks",({R,line,A})=>{
    for(let k=0;k<10;k++){let x=.5,y=.5;for(let i=0;i<500;i++){let a=Math.floor(R(0,4))*Math.PI/2,nx=Math.max(.03,Math.min(.97,x+Math.cos(a)*.015)),ny=Math.max(.04,Math.min(.96,y+Math.sin(a)*.025));line(x,y,nx,ny,k%4?1:2,.001);x=nx;y=ny;}}
  });
  register("autechre","lattice-fractures",({R,line,A})=>{
    for(let y=0;y<35;y++)for(let x=0;x<60;x++){let xx=x/60,yy=y/35,shift=xx>.5?.06:0;line(xx,yy+shift,xx+1/60,yy+1/35+shift,(x+y)%23?1:2,.0008);if(R()<.35)line(xx,yy+shift,xx,yy+.06+shift,1,.001);}
  });
  register("autechre","rule-masks",({rect,A})=>{
    for(let y=0;y<64;y++)for(let x=0;x<112;x++)if(((x*y)^(x<<2)^(y<<1))%11<5)rect(x/112,y/64,1/112,1/64,(x^y)%47?1:2);
  });
  register("autechre","toroidal-mesh",({curve,TAU,A})=>{
    for(let i=0;i<48;i++){let a=i/48*TAU;curve(t=>{let b=t*TAU,r=.25+.11*Math.cos(b);return [.5+r*Math.cos(a+b*.15),.5+r*Math.sin(a+b*.15)*.8+.14*Math.sin(b)];},180,i%13?1:2,.0008);}
  });
  register("autechre","asynchronous-loops",({R,curve,TAU,A})=>{
    for(let i=0;i<35;i++){let a=R(1,4),b=R(1,4),shift=R(0,TAU);curve(t=>[.5+Math.sin(t*TAU*a+shift)*.43,.5+Math.sin(t*TAU*b)*.42],500,i%11?1:2,.0006);}
  });
  register("autechre","occluded-nodes",({R,line,rect,A})=>{
    let nodes=Array.from({length:28},()=>[R(.1,.9),R(.1,.9)]);nodes.forEach((p,i)=>{for(let j=i+1;j<nodes.length;j++)if((j-i)%3===0)line(...p,...nodes[j],1,.0005);});for(let i=0;i<9;i++)rect(R(.1,.8),R(.1,.8),R(.03,.15),R(.04,.2),0);
  });

  register("defaultaudio","connected-sections",({R,rect,A})=>{
    let edge=.4;for(let i=0;i<45;i++){let next=Math.max(.15,Math.min(.85,edge+R(-.055,.055)));rect(0,i/45,(edge+next)/2,1/45+.001,1);edge=next;}
  });
  register("defaultaudio","waveform-cuts",({R,rect,A})=>{
    let f=R(2,8);for(let i=0;i<260;i++){let a=Math.pow(Math.abs(Math.sin(i/260*f*6.28)*Math.sin(i*.017)),2)*.43;rect(i/260,.5-a,.004,2*a,i%37?1:2);}
  });
  register("defaultaudio","tidal-sections",({poly,A})=>{
    for(let k=20;k>=0;k--){let p=[[0,1],[1,1]];for(let i=160;i>=0;i--){let x=i/160;p.push([x,.05+k*.05+Math.sin(x*8+k*.18)*.08]);}poly(p,k%7===0?2:k%2,true);}
  });
  register("defaultaudio","lunar-masks",({circle,poly,A})=>{
    circle(.5,.5,.45,1,0,true);poly([[.5,0],[1,0],[1,1],[.35,1],[.48,.7],[.58,.4]],0,true);
    for(let i=0;i<45;i++)circle(.5,.5,.04+i*.009,i%17?0:2,.001);
  });
  register("defaultaudio","raster-compression",({R,line,A})=>{
    for(let i=0;i<150;i++){let t=i/149,y=.5+Math.sign(t-.5)*Math.pow(Math.abs(t-.5)*2,2.7)*.48;line(0,y,1,y,i%31?1:2,R(.0005,.0018));}
  });
  register("defaultaudio","pinched-bands",({poly,A})=>{
    for(let i=0;i<27;i++){let x=i/27;poly([[x,0],[x+.018,0],[.5+(x-.5)*.08,.5],[x+.018,1],[x,1],[.5+(x-.5)*.04,.5]],i%11?1:2,true);}
  });
  register("defaultaudio","cable-contours",({curve,A})=>{
    for(let i=0;i<80;i++)curve(t=>[.04+t*.92,.5+Math.tanh((t-.5)*8)*.22+(i-40)*.005+Math.sin(t*9)*.04],180,i%17?1:2,.001);
  });
  register("defaultaudio","signal-horizon",({R,line,rect,A})=>{
    rect(0,.52,1,.48,1);for(let i=0;i<200;i++){let x=i/200,h=Math.pow(R(),3)*.3;line(x,.52,x,.52-h,i%23?1:2,.0015);}for(let i=0;i<45;i++)line(0,.55+i*.01,1,.55+i*.01,0,.0008);
  });
  register("defaultaudio","hard-edge-gates",({R,rect,A})=>{
    for(let i=0;i<16;i++){let w=R(.025,.09),h=R(.25,.9);rect(i/16,.5-h/2,w,h,i%7?1:2);}rect(0,.46,1,.08,0);
  });
  register("defaultaudio","negative-volume",({poly,line,A})=>{
    poly([[.12,.18],[.7,.06],[.91,.76],[.35,.94]],1,true);
    poly([[.3,.3],[.63,.24],[.75,.64],[.42,.75]],0,true);
    for(let i=0;i<45;i++){let t=i/44;line(.12+t*.23,.18+t*.76,.7+t*.21,.06+t*.7,2,.0008);}
  });

  // Original constructions informed by the reference audit in docs/GENERATIVE_REFERENCES.md.
  // Motion is a pure function of phase, never a new random walk per frame.
  const morph=(add,fn,n=180,c=1,w=.0014,fill=false,closed=false)=>{
    const stroke=add(Array.from({length:n+1},(_,i)=>fn(i/n,0)),c,w,fill,closed);
    stroke.motionPoints=t=>Array.from({length:n+1},(_,i)=>fn(i/n,t));return stroke;
  };
  register("lieberman","linked-arcs",({R,add,TAU,A})=>{
    const count=Math.floor(R(5,10)),radii=Array.from({length:count},()=>R(.035,.11)),speed=R(.22,.48);
    const total=radii.reduce((a,b)=>a+b,0)*2;
    for(let row=0;row<34;row++)morph(add,(u,t)=>{
      const k=Math.min(count-1,Math.floor(u*count)),a=(u*count-k)*Math.PI;
      const x0=radii.slice(0,k).reduce((a,b)=>a+2*b,0)+radii[k];
      const sway=Math.sin(t*speed+k*.65)*.025;
      return [.12+(x0-Math.cos(a)*radii[k])/total*.76,.5+(row-17)*.006+(Math.sin(a)*radii[k]*(k%2?1:-1)+sway)*1.4];
    },count*48,row%11?1:2,.0011);
  });
  register("lieberman","blob-extrusions",({R,add,TAU,A})=>{
    const a=R(0,TAU),b=R(0,TAU),lobes=Math.floor(R(3,6)),depth=R(.12,.24);
    const blob=(u,t)=>{const v=u*TAU,r=.27+.043*Math.sin(lobes*v+t*.34+a)+.027*Math.cos((lobes+2)*v-t*.24+b);return [.5+Math.cos(v)*r/A,.48+Math.sin(v)*r]};
    // Back-to-front contours with coherent extrusion rather than independent jitter.
    for(let k=42;k>=0;k--)morph(add,(u,t)=>{const p=blob(u,t),d=k/42;return [p[0]+d*depth*.7,p[1]-d*depth]},220,k%13?1:2,.001);
    for(let k=0;k<72;k++)morph(add,(u,t)=>{const p=blob(k/72,t);return [p[0]+u*depth*.7,p[1]-u*depth]},20,k%17?1:2,.0008);
    morph(add,(u,t)=>blob(u,t),220,0,0,true,true);
    morph(add,(u,t)=>blob(u,t),220,1,.002,false,true);
  });
  register("lieberman","ribbon-calligraphy",({R,add,TAU,A})=>{
    const a=Math.floor(R(2,5)),b=a+1,shift=R(0,TAU),width=R(.015,.035);
    const center=(u,t)=>{const q=u*TAU;return [.5+Math.sin(q*a+t*.16+shift)*.32,.5+Math.sin(q*b-t*.11)*.32]};
    for(let band=5;band>=0;band--)morph(add,(u,t)=>ribbonPoint(center,u,t,(width+band*.008)*(1+.45*Math.sin((u<.5?u*2:2-u*2)*TAU*3+t*.2)),A),500,band%3===0?2:band%2,.001,true,true);
  });
  register("lieberman","circle-packing",({R,add,TAU,A})=>{
    const circles=packedCircles(R,A);circles.forEach(([x,y,r],i)=>{
      morph(add,(u,t)=>{const v=u*TAU,rr=r*(.9+.08*Math.sin(t*.42+i*.73));return [x+Math.cos(v)*rr/A,y+Math.sin(v)*rr]},80,i%13===0?2:1,.001,true,true);
      morph(add,(u,t)=>{const v=u*TAU,rr=r*(.46+.05*Math.sin(t*.42+i*.73));return [x+Math.cos(v)*rr/A,y+Math.sin(v)*rr]},80,0,.001,true,true);
    });
  });
  register("lieberman","arc-pendulums",({R,add,TAU,A})=>{
    const count=Math.floor(R(24,48)),swing=R(.15,.45),span=R(2.2,4.5);
    for(let k=0;k<count;k++)morph(add,(u,t)=>{const r=.03+k*.009,a=u*span+Math.sin(t*.38+k*.065)*swing;return [.5+Math.cos(a)*r/A,.47+Math.sin(a)*r]},120,k%12?1:2,.002);
  });
  register("lieberman","elastic-contours",({R,add,TAU,A})=>{
    const lobes=Math.floor(R(3,7)),a=R(0,TAU),b=R(0,TAU);
    for(let ring=0;ring<44;ring++)morph(add,(u,t)=>{
      const v=u*TAU,m=.5+.5*Math.sin(t*.3),r=(.035+ring*.009)*(1+.17*((1-m)*Math.sin(v*lobes+a)+m*Math.cos(v*(lobes+1)+b)));
      return [.5+Math.cos(v)*r/A,.5+Math.sin(v)*r];
    },220,ring%13?1:2,.0011,false,true);
  });
  register("lieberman","circle-lenses",({R,add,TAU,A})=>{
    const centers=Array.from({length:3},()=>[R(.25,.75),R(.25,.75),R(.05,.14)]);
    for(let k=0;k<65;k++)morph(add,(u,t)=>{
      const a=u*TAU,r=.03+k*.009;let x=.5+Math.cos(a)*r/A,y=.5+Math.sin(a)*r;
      for(let j=0;j<centers.length;j++){const c=centers[j],cx=c[0]+Math.sin(t*.18+j)*.04,cy=c[1]+Math.cos(t*.21+j)*.035,dx=(x-cx)*A,dy=y-cy,d=dx*dx+dy*dy,f=Math.exp(-d/(c[2]*c[2]))*.09;x+=dx*f/A;y+=dy*f;}
      return [x,y];
    },240,k%13?1:2,.001,false,true);
  });
  register("lieberman","woven-gestures",({R,add,TAU,A})=>{
    const count=Math.floor(R(16,28)),frequency=R(1.1,2),bend=R(.025,.065);
    const warp=(u,v,t)=>[.04+u*.92+Math.sin(v*TAU*frequency+t*.23)*Math.sin(u*Math.PI)*bend,.06+v*.88+Math.sin(u*TAU*frequency-t*.19)*Math.sin(v*Math.PI)*bend];
    // Both thread sets share the same warp. Their intersections therefore stay
    // at known (u,v) lattice coordinates, and alternating underpasses get gaps.
    for(let d=0;d<2;d++)for(let k=0;k<count;k++){
      const fixed=(k+.5)/count,gaps=[];
      for(let j=0;j<count;j++)if((j+k+d)%2===0)gaps.push((j+.5)/count);
      let from=0;
      for(const edge of [...gaps,1.01]){
        const to=Math.min(1,edge-.13/count),begin=from;
        if(to>begin)morph(add,(q,t)=>{const along=begin+q*(to-begin);return d?warp(fixed,along,t):warp(along,fixed,t)},18,d?2:1,.0024);
        from=edge+.13/count;
      }
    }
  });
  register("lieberman","folding-fans",({R,add,TAU,A})=>{
    const lobes=Math.floor(R(3,7)),spread=R(.2,.35),offset=R(0,TAU);
    for(let k=85;k>=0;k--)morph(add,(u,t)=>{
      const a=u*TAU,r=.16+Math.sin(a*lobes+offset+t*.24)*.055,d=k/85;
      return [.5+Math.cos(a)*r/A+d*spread*(.6+.3*Math.sin(a+t*.18)),.5+Math.sin(a)*r-d*spread*.65*Math.cos(a*.5+t*.16)];
    },240,k%17===0?2:k%5===0?0:1,.001,false,true);
  });
  register("lieberman","breathing-cells",({R,add,TAU,A})=>{
    const cols=Math.floor(R(7,13)),rows=Math.floor(R(4,8)),round=R(.15,.38),speed=R(.22,.5);
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)morph(add,(u,t)=>{
      const a=u*TAU,pulse=.78+.17*Math.sin(t*speed+x*.55+y*.72),c=Math.cos(a),s=Math.sin(a);
      const rx=Math.sign(c)*Math.pow(Math.abs(c),round),ry=Math.sign(s)*Math.pow(Math.abs(s),round);
      return [(x+.5+rx*.43*pulse)/cols,(y+.5+ry*.43*pulse)/rows];
    },100,(x+y)%17?1:2,.001,true,true);
  });

  // A short rule can make a quiet mark or an elaborate image. These ten retain
  // an intentionally small vocabulary; systems below use different machinery.
  register("rules","split-disc",({R,add,TAU,A})=>{
    const cut=R(-.17,.17),radius=R(.23,.43),turn=R(0,TAU);
    for(let side=0;side<2;side++){
      const shape=(t)=>Array.from({length:101},(_,i)=>{const a=turn+side*Math.PI+i/100*Math.PI;return [.5+Math.cos(a)*radius/A+(side?1:-1)*(cut+Math.sin(t*.24)*.015),.5+Math.sin(a)*radius]});
      const s=add(shape(0),side?2:1,0,true,true);s.motionPoints=shape;
    }
  },{method:"two semicircles and a variable gap",complexity:"simple"});
  register("rules","nested-rectangles",({R,add,A})=>{
    const count=Math.floor(R(5,19)),ratio=R(.74,.9),skew=R(-.13,.13);
    for(let i=0;i<count;i++){
      const shape=t=>{let w=.88*Math.pow(ratio,i),h=.82*Math.pow(ratio,i),cx=.5+Math.sin(t*.22+i*.2)*skew;return [[cx-w/2,.5-h/2],[cx+w/2,.5-h/2],[cx+w/2,.5+h/2],[cx-w/2,.5+h/2]]};
      const s=add(shape(0),i%6?1:2,R(.001,.004),false,true);s.motionPoints=shape;
    }
  },{method:"geometric progression of four corners",complexity:"simple"});
  register("rules","parallel-slits",({R,add,A})=>{
    const count=Math.floor(R(9,38)),amp=R(.05,.28),bias=R(.2,.7);
    for(let i=0;i<count;i++){
      const shape=t=>{const x=.04+i/(count-1)*.92,gap=bias+Math.sin(i*.18+t*.25)*amp;return [[x,.05],[x,gap-.025],[x+.006,gap-.025],[x+.006,.05]]};
      const a=add(shape(0),i%7?1:2,0,true,true);a.motionPoints=shape;
      const bottom=t=>{const p=shape(t),x=p[0][0],y=p[1][1]+.05;return [[x,y],[x,.95],[x+.006,.95],[x+.006,y]]};
      const b=add(bottom(0),1,0,true,true);b.motionPoints=bottom;
    }
  },{method:"parallel lines interrupted by one sine boundary",complexity:"simple"});
  register("rules","rotating-pairs",({R,add,A})=>{
    const distance=R(.08,.24),length=R(.3,.7),width=R(.018,.08),initial=R(0,3);
    for(let k=0;k<2;k++){
      const shape=t=>{const a=initial+t*.13*(k?1:-1),cx=.5+(k?1:-1)*distance;return [[-length/2,-width],[length/2,-width],[length/2,width],[-length/2,width]].map(([x,y])=>[cx+(x*Math.cos(a)-y*Math.sin(a))/A,.5+x*Math.sin(a)+y*Math.cos(a)])};
      const s=add(shape(0),k?2:1,0,true,true);s.motionPoints=shape;
    }
  },{method:"two rigid bars rotating in opposite directions",complexity:"simple"});
  register("rules","stripe-bend",({R,add,TAU,A})=>{
    const count=Math.floor(R(10,28)),frequency=R(.7,1.8),amp=R(.05,.22);
    for(let k=0;k<count;k++)morph(add,(u,t)=>{const side=u<.5?0:1,q=u<.5?u*2:2-u*2;return [q,(k+.2+side*.34)/count+Math.sin(q*TAU*frequency+t*.18)*amp]},160,k%9?1:2,0,true,true);
  },{method:"a sine curve and a parallel edge",complexity:"simple"});
  register("rules","truchet-arcs",({R,add,TAU,A})=>{
    const cols=Math.floor(R(7,14)),rows=Math.max(1,Math.round(cols/A)),flip=R()<.5;
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++){
      const bit=R()<.5,centers=bit?[[0,0],[1,1]]:[[1,0],[0,1]];
      centers.forEach(([cx,cy],k)=>{
        const start=cx===0?(cy===0?0:-Math.PI/2):(cy===0?Math.PI/2:Math.PI);
        morph(add,(u,t)=>{const r=.5+.025*Math.sin(t*.3+(x+y)*.2),a=start+u*Math.PI/2;const radius=r*Math.min(A/cols,1/rows);return [(x+cx)/cols+Math.cos(a)*radius/A,(y+cy)/rows+Math.sin(a)*radius]},40,((x+y+k)%13)?1:2,flip?.004:.002);
      });
    }
  },{method:"one of two quarter-circle tiles per cell",complexity:"simple"});
  register("rules","counterphase-dots",({R,add,TAU,A})=>{
    const cols=Math.floor(R(8,19)),rows=Math.max(1,Math.round(cols/A)),freq=R(.25,.75);
    for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)morph(add,(u,t)=>{const a=u*TAU,r=(.15+.24*(.5+.5*Math.sin(x*freq+y*.5+t*.4)))/rows;return [(x+.5)/cols+Math.cos(a)*r/A,(y+.5)/rows+Math.sin(a)*r]},40,(x+y)%11?1:2,0,true,true);
  },{method:"one phase-shifted circle per lattice point",complexity:"simple"});
  register("rules","radial-stamps",({R,add,TAU,A})=>{
    const count=Math.floor(R(3,16)),span=TAU/count*.48,r=R(.25,.43);
    for(let k=0;k<count;k++)morph(add,(u,t)=>{const a=k/count*TAU+(u<.5?u*2:2-u*2)*span+t*.08,rr=u<.5?r:r*.45;return [.5+Math.cos(a)*rr/A,.5+Math.sin(a)*rr]},80,k%5?1:2,0,true,true);
  },{method:"one annular wedge repeated around a center",complexity:"simple"});
  register("rules","broken-frames",({R,add,A})=>{
    const count=Math.floor(R(2,6)),tilt=R(-.6,.6);
    for(let k=0;k<count;k++){
      const w=.2+k*.13,h=.18+k*.1;
      const shape=t=>{const a=tilt+Math.sin(t*.15+k)*.1;return [[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2],[-w/2,0]].map(([x,y])=>[.5+(x*Math.cos(a)-y*Math.sin(a))/A,.5+x*Math.sin(a)+y*Math.cos(a)])};
      const s=add(shape(0),k%3?1:2,R(.008,.022));s.motionPoints=shape;
    }
  },{method:"open rectangles, three to five rigid transforms",complexity:"simple"});
  register("rules","one-wave",({R,add,TAU,A})=>{
    const frequency=R(.6,2.8),amplitude=R(.08,.32),thickness=R(.003,.045),layers=Math.floor(R(1,5));
    for(let k=0;k<layers;k++)morph(add,(u,t)=>[.06+u*.88,.5+Math.sin(u*TAU*frequency+t*.25+k*.06)*amplitude+(k-(layers-1)/2)*.024],260,k===layers-1?2:1,thickness);
  },{method:"one analytic wave, optionally repeated",complexity:"simple"});

  // These ten systems are computed once from a seeded state. Their phase-based
  // presentation never reruns random walks or an unbounded simulation per frame.
  register("systems","gray-scott",({R,rect,A})=>{
    const {w,h,values:b}=reactionField(R,{},A);
    for(let y=1;y<h-1;y++)for(let x=1;x<w-1;){const band=b[y*w+x]>.24?1:b[y*w+x]>.13?2:0;if(!band){x++;continue}let end=x+1;while(end<w-1&&(b[y*w+end]>.24?1:b[y*w+end]>.13?2:0)===band)end++;rect(.04+x/w*.92,.04+y/h*.92,(end-x)/w*.94,1/h*.94,band);x=end;}
  },{method:"Gray–Scott two-field reaction-diffusion, 650 integration steps",complexity:"complex",motionMode:"rigid"});
  register("systems","lloyd-cells",({R,poly,A})=>{
    const count=Math.floor(R(22,48));let sites=Array.from({length:count},()=>[R(.05,.95),R(.05,.95)]);
    for(let pass=0;pass<7;pass++){
      const sums=sites.map(()=>[0,0,0]);
      for(let yy=0;yy<32;yy++)for(let xx=0;xx<58;xx++){const x=(xx+.5)/58,y=(yy+.5)/32;let best=0,d=Infinity;sites.forEach((p,i)=>{const q=((x-p[0])*A)**2+(y-p[1])**2;if(q<d){d=q;best=i}});sums[best][0]+=x;sums[best][1]+=y;sums[best][2]++;}
      sites=sites.map((p,i)=>sums[i][2]?[sums[i][0]/sums[i][2],sums[i][1]/sums[i][2]]:p);
    }
    sites.forEach((site,index)=>{
      let shape=[[.04,.04],[.96,.04],[.96,.96],[.04,.96]];
      for(let j=0;j<sites.length&&shape.length;j++)if(j!==index){const other=sites[j],nx=(other[0]-site[0])*A**2,ny=other[1]-site[1],c=((other[0]**2-site[0]**2)*A**2+other[1]**2-site[1]**2)/2,out=[];
        for(let k=0;k<shape.length;k++){const a=shape[k],b=shape[(k+1)%shape.length],da=a[0]*nx+a[1]*ny-c,db=b[0]*nx+b[1]*ny-c;if(da<=0)out.push(a);if((da<0)!==(db<0)){const t=da/(da-db);out.push([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]);}}
        shape=out;
      }
      const inset=R(.78,.92);shape=shape.map(([x,y])=>[site[0]+(x-site[0])*inset,site[1]+(y-site[1])*inset]);if(shape.length){const s=poly(shape,index%9?1:2,true);s.motionPoints=t=>shape.map(([x,y])=>{const scale=1+Math.sin(t*.24+index*.4)*.025;return [site[0]+(x-site[0])*scale,site[1]+(y-site[1])*scale]});}
    });
  },{method:"centroidal Voronoi relaxation and half-plane clipping",complexity:"complex",motionMode:"own"});
  register("systems","space-colonization",({R,line,dot,A})=>{
    const {nodes}=colonizationGraph(R,null,A);
    nodes.forEach((n,i)=>{if(n.parent>=0){const p=nodes[n.parent];line(p.x,p.y,n.x,n.y,i%29?1:2,Math.max(.0007,.0045-n.depth*.000055));}if(i%11===0)dot(n.x,n.y,.004,2)});
  },{method:"attractor-driven branching with influence and kill radii",complexity:"complex",motionMode:"growth"});
  register("systems","diffusion-aggregation",({R,line,dot,TAU,A})=>{
    const w=176,h=100,grid=new Int32Array(w*h).fill(-1),points=[[88,50]],created=[];grid[50*w+88]=0;let radius=2;
    for(let particle=0;particle<680;particle++){
      let angle=R(0,TAU),x=Math.round(88+Math.cos(angle)*(radius+5)),y=Math.round(50+Math.sin(angle)*(radius+5));
      for(let walk=0;walk<1900;walk++){
        const direction=Math.floor(R(0,4));x+=direction===0?1:direction===1?-1:0;y+=direction===2?1:direction===3?-1:0;
        if(x<2||x>w-3||y<2||y>h-3||Math.hypot(x-88,y-50)>radius+18){angle=R(0,TAU);x=Math.round(88+Math.cos(angle)*(radius+5));y=Math.round(50+Math.sin(angle)*(radius+5));continue}
        let parent=-1;for(const [dx,dy] of [[-1,0],[1,0],[0,-1],[0,1]])if(grid[(y+dy)*w+x+dx]>=0){parent=grid[(y+dy)*w+x+dx];break}
        if(parent>=0&&grid[y*w+x]<0){grid[y*w+x]=points.length;const p=points[parent];points.push([x,y]);radius=Math.max(radius,Math.hypot(x-88,y-50));created.push(line(.5+(p[0]-88)/w*.92,.5+(p[1]-50)/h*.92,.5+(x-88)/w*.92,.5+(y-50)/h*.92,particle%23?1:2,.0018));break;}
      }
    }
    const minX=Math.min(...points.map(p=>p[0])),maxX=Math.max(...points.map(p=>p[0])),minY=Math.min(...points.map(p=>p[1])),maxY=Math.max(...points.map(p=>p[1])),cx=(minX+maxX)/2,cy=(minY+maxY)/2;
    const fit=Math.min(.8*A/Math.max(1,maxX-minX),.8/Math.max(1,maxY-minY));
    created.forEach(stroke=>{stroke.points=stroke.points.map(([x,y])=>{const px=(x-.5)/.92*w+88,py=(y-.5)/.92*h+50;return [.5+(px-cx)*fit/A,.5+(py-cy)*fit]})});
    points.forEach(([x,y],i)=>{if(i%4===0)dot(.5+(x-cx)*fit/A,.5+(y-cy)*fit,.0035,i%17?1:2)});
  },{method:"bounded Brownian random walkers attaching to a cluster",complexity:"complex",motionMode:"rigid"});
  register("systems","spring-lattice",({R,add,A})=>{
    const w=23,h=14,points=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++)points.push([.06+x/(w-1)*.88,.06+y/(h-1)*.88]);
    const edges=[];for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=y*w+x;if(x<w-1)edges.push([i,i+1]);if(y<h-1)edges.push([i,i+w])}
    const state=relaxGraph(R,{points,edges},130,A);
    for(let d=0;d<2;d++)for(let k=0;k<(d?w:h);k++){const ids=Array.from({length:d?h:w},(_,j)=>d?j*w+k:k*w+j),shape=t=>{const p=state.at(t);return ids.map(i=>p[i])};const s=add(shape(0),k%9?1:2,.0011);s.motionPoints=shape;}

  },{method:"coupled elastic nodes relaxed against three force centers",complexity:"complex",motionMode:"own"});
  register("systems","grammar-growth",({R,pick,add,A})=>{
    const rule=pick(["F[+F]F[-F]F","FF+[+F-F-F]-[-F+F+F]","F[+F][-F]F"]),angle=R(.25,.56);let word="F";
    for(let generation=0;generation<4;generation++)word=word.replace(/F/g,rule);
    let x=0,y=0,a=-Math.PI/2,stack=[],segments=[];
    for(const c of word){if(c==='F'){const nx=x+Math.cos(a),ny=y+Math.sin(a);segments.push([[x,y],[nx,ny],stack.length]);x=nx;y=ny;}else if(c==='+')a+=angle;else if(c==='-')a-=angle;else if(c==='[')stack.push([x,y,a]);else if(c===']')[x,y,a]=stack.pop();}
    const all=segments.flatMap(s=>s.slice(0,2)),minX=Math.min(...all.map(p=>p[0])),maxX=Math.max(...all.map(p=>p[0])),minY=Math.min(...all.map(p=>p[1])),maxY=Math.max(...all.map(p=>p[1]));
    segments.forEach((segment,i)=>{const points=segment.slice(0,2).map(([x,y])=>[.08+(x-minX)/(maxX-minX||1)*.84,.08+(y-minY)/(maxY-minY||1)*.84]);const s=add(points,i%31?1:2,Math.max(.0007,.003-segment[2]*.0004));s.opacityAt=t=>.25+.75*Math.max(0,Math.min(1,(.6+.4*Math.sin(t*.17))-i/segments.length+.35));});
  },{method:"four generations of bracketed L-system rewriting",complexity:"complex",motionMode:"opacity"});
  register("systems","adaptive-quadtree",({R,rect,line,A})=>{
    const centers=Array.from({length:3},()=>[R(.1,.9),R(.1,.9),R(.1,.3)]);
    const field=(x,y)=>centers.reduce((s,[cx,cy,r])=>s+Math.exp(-(((x-cx)*A)**2+(y-cy)**2)/(r*r)),0);
    const visit=(x,y,w,h,depth)=>{const density=field(x+w/2,y+h/2);if(depth<2||(depth<7&&R()<Math.min(.9,density*.6))){visit(x,y,w/2,h/2,depth+1);visit(x+w/2,y,w/2,h/2,depth+1);visit(x,y+h/2,w/2,h/2,depth+1);visit(x+w/2,y+h/2,w/2,h/2,depth+1);}else{const c=depth%5?1:2;if(R()<.45)rect(x+.002,y+.002,Math.max(.001,w-.004),Math.max(.001,h-.004),c);else{line(x,y,x+w,y,c,.001);line(x,y,x,y+h,c,.001);}}};visit(.04,.04,.92,.92,0);
  },{method:"density-adaptive recursive spatial subdivision",complexity:"complex",motionMode:"rigid"});
  register("systems","elementary-automaton",({R,pick,rect,A})=>{
    const w=160,h=90,rule=pick([30,90,110,150,182]);let row=Array.from({length:w},()=>R()<.025?1:0);row[Math.floor(w/2)]=1;
    for(let y=0;y<h;y++){
      for(let x=0;x<w;){if(!row[x]){x++;continue}let end=x+1;while(end<w&&row[end])end++;const shape=t=>{const yy=(y/h+t*.015)%1;return [[.04+x/w*.92,.04+yy*.92],[.04+end/w*.92,.04+yy*.92],[.04+end/w*.92,.04+(yy+1/h)*.92],[.04+x/w*.92,.04+(yy+1/h)*.92]]};const s=rect(.04+x/w*.92,.04+y/h*.92,(end-x)/w*.92,1/h*.93,y%13?1:2);const sx=x,ex=end;s.motionPoints=t=>{const yy=(y/h+t*.015)%1;return [[.04+sx/w*.92,.04+yy*.92],[.04+ex/w*.92,.04+yy*.92],[.04+ex/w*.92,.04+(yy+1/h)*.92],[.04+sx/w*.92,.04+(yy+1/h)*.92]]};x=end;}
      row=row.map((_,x)=>(rule>>((row[(x+w-1)%w]<<2)|(row[x]<<1)|row[(x+1)%w]))&1);
    }
  },{method:"elementary cellular automata with a seeded first row",complexity:"complex",motionMode:"own"});
  register("systems","implicit-contours",({R,line,A})=>{
    const sources=Array.from({length:5},()=>[R(.15,.85),R(.15,.85),R(.04,.14)]),w=112,h=64;
    const value=(x,y)=>sources.reduce((v,[cx,cy,r])=>v+Math.exp(-(((x-cx)*A)**2+(y-cy)**2)/(r*r)),0);
    const field=Array.from({length:(w+1)*(h+1)},(_,i)=>value((i%(w+1))/w,Math.floor(i/(w+1))/h));
    for(let level=.09;level<1.2;level+=.11)for(let y=0;y<h;y++)for(let x=0;x<w;x++){
      const p=[[x/w,y/h],[(x+1)/w,y/h],[(x+1)/w,(y+1)/h],[x/w,(y+1)/h]],v=[field[y*(w+1)+x],field[y*(w+1)+x+1],field[(y+1)*(w+1)+x+1],field[(y+1)*(w+1)+x]],cross=[];
      for(let edge=0;edge<4;edge++){const next=(edge+1)%4;if((v[edge]<level)!==(v[next]<level)){const t=(level-v[edge])/(v[next]-v[edge]);cross.push([p[edge][0]+(p[next][0]-p[edge][0])*t,p[edge][1]+(p[next][1]-p[edge][1])*t]);}}
      for(let i=1;i<cross.length;i+=2)line(...cross[i-1],...cross[i],Math.round(level*100)%3?1:2,.0015);
    }
  },{method:"implicit Gaussian field sampled with marching squares",complexity:"complex",motionMode:"rigid"});
  register("systems","huygens-field",({R,add,TAU,A})=>{
    const field=radialField(R,A),count=Math.floor(R(35,65));
    for(let row=0;row<count;row++)morph(add,(u,t)=>{const x=.04+u*.92,y=.06+row/(count-1)*.88;return [x,y+field.sample(x,y,t)*.025]},260,row%13?1:2,.0013);
  },{method:"superposition of radial waves from multiple coherent sources",complexity:"complex",motionMode:"own"});

  // Typed procedural programs: kernels consume upstream mathematical state.
  // Adapters are explicit and never counted as an additional family.
  const kernelRandom=seed=>{let a=seed>>>0;return (lo=0,hi=1)=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return lo+(hi-lo)*(((t^(t>>>14))>>>0)/4294967296)}};
  const kernels={};
  const kernel=(id,family,input,output,run)=>kernels[id]={id,family,input,output,run};
  kernel('ikeda.binary-field','ikeda-binary-planes','none','field',(R,_,p)=>binaryField(R,p.cols,p.rows));
  kernel('systems.reaction-field','systems-gray-scott','none','field',(R,_,p,A)=>reactionField(R,p,A));
  kernel('systems.wave-field','systems-huygens-field','none','field',(R,_,p,A)=>radialField(R,A));
  kernel('lieberman.packing','lieberman-circle-packing','none','points',(R,_,p,A)=>({points:packedCircles(R,A).map(p=>p.slice(0,2))}));
  kernel('adapter.field-points',null,'field','points',(R,field,p)=>{
    const points=[];for(let trial=0;trial<8000&&points.length<p.count;trial++){const x=R(.06,.94),y=R(.07,.88),v=field.sample(x,y);if(R()<Math.min(.95,.08+Math.abs(v)*p.gain))points.push([x,y])}return {points,field};
  });
  kernel('devine.spectral-paths','devine-spectrogram-folds','field','paths',(R,field,p)=>{
    const state=spectralPaths(R,field,p.count,p.samples);return {paths:state.at(0),at:t=>state.at(t)};
  });
  kernel('devine.nearest-topology','devine-patch-topology','points','graph',(R,input,p,A)=>nearestGraph(input.points,p.neighbors,A));
  kernel('autechre.xor-topology','autechre-graph-automaton','field?','graph',(R,field,p)=>automatonGraph(R,field,p.cols,p.rows));
  kernel('systems.elastic-graph','systems-spring-lattice','graph','graph',(R,input,p,A)=>relaxGraph(R,input,p.passes,A));
  kernel('systems.colonize','systems-space-colonization','points','graph',(R,input,p,A)=>{
    const graph=colonizationGraph(R,input.points,A);return {...graph,at(t){return graph.points.map(([x,y])=>[x+Math.sin(t*.27+y*4)*(1-y)*.008,y])}};
  });
  kernel('adapter.graph-paths',null,'graph','paths',(R,graph)=>{
    // Maximal chains preserve connectivity and branching; a ribbon is drawn
    // around each chain, not around an independently generated second picture.
    const adj=graph.points.map(()=>[]);graph.edges.forEach(([a,b],i)=>{adj[a].push([b,i]);adj[b].push([a,i])});const seen=new Set(),chains=[];
    const walk=(start,first,edge)=>{const ids=[start];let next=first,e=edge;while(!seen.has(e)){seen.add(e);ids.push(next);if(adj[next].length!==2)break;const pair=adj[next].find(p=>!seen.has(p[1]));if(!pair)break;next=pair[0];e=pair[1]}if(ids.length>1)chains.push(ids)};
    adj.forEach((edges,i)=>{if(edges.length!==2)edges.forEach(([j,e])=>walk(i,j,e))});graph.edges.forEach(([a,b],e)=>walk(a,b,e));
    const at=t=>{const points=graph.at?graph.at(t):graph.points;return chains.map(ids=>ids.map(i=>points[i]))};return {paths:at(0),at};
  });
  kernel('lieberman.normal-ribbons','lieberman-ribbon-calligraphy','paths','paths',(R,input,p,A)=>{
    const widths=input.paths.map(()=>R(p.width*.5,p.width)),cache={t:null,paths:null};
    const at=t=>{
      if(cache.t===t)return cache.paths;
      const source=input.at?input.at(t):input.paths;
      cache.t=t;cache.paths=source.map((path,i)=>{
        const center=(u,time)=>{const q=Math.max(0,Math.min(1,u))*(path.length-1),k=Math.min(path.length-2,Math.floor(q)),f=q-k;return [path[k][0]+(path[k+1][0]-path[k][0])*f,path[k][1]+(path[k+1][1]-path[k][1])*f]};
        const count=Math.min(180,Math.max(12,path.length*2));return Array.from({length:count+1},(_,j)=>ribbonPoint(center,j/count,t,widths[i]*(.82+.18*Math.sin(t*.23+i*.13)),A));
      });return cache.paths;
    };
    return {paths:at(0),at,filled:true};
  });
  const templates=['field-ribbons','field-topology-springs','field-arbor','packing-network','packing-arbor','automaton-ribbons','field-cables','automaton-springs'];
  function recipe(seed,aspect){
    const R=kernelRandom(seed^0x7f4a7c15),pick=a=>a[Math.floor(R(0,a.length))],program=pick(templates),nodes=[];
    const append=(kernel,input=null,params={})=>{const id='n'+nodes.length;nodes.push({id,kernel,seed:Math.floor(R(0,4294967296))>>>0,input,params});return id};
    const source=()=>{const id=pick(['ikeda.binary-field','systems.reaction-field','systems.wave-field']);return append(id,null,id==='ikeda.binary-field'?{cols:Math.floor(R(30,90)),rows:Math.floor(R(14,35))}:id==='systems.reaction-field'?{w:88,h:Math.max(24,Math.round(88/aspect)),steps:500}:{})};
    let out;
    if(program==='field-ribbons'){const f=source(),paths=append('devine.spectral-paths',f,{count:Math.floor(R(16,38)),samples:100});out=append('lieberman.normal-ribbons',paths,{width:R(.002,.006)})}
    if(program==='field-topology-springs'){const f=source(),graph=append('autechre.xor-topology',f,{cols:Math.floor(R(24,45)),rows:Math.floor(R(18,30))});out=append('systems.elastic-graph',graph,{passes:85})}
    if(program==='field-arbor'){const f=source(),points=append('adapter.field-points',f,{count:230,gain:2.8});out=append('systems.colonize',points)}
    if(program==='packing-network'){const points=append('lieberman.packing'),graph=append('devine.nearest-topology',points,{neighbors:Math.floor(R(2,4))});out=append('systems.elastic-graph',graph,{passes:85})}
    if(program==='packing-arbor'){const points=append('lieberman.packing');out=append('systems.colonize',points)}
    if(program==='automaton-ribbons'){const graph=append('autechre.xor-topology',null,{cols:Math.floor(R(24,38)),rows:Math.floor(R(16,25))}),paths=append('adapter.graph-paths',graph);out=append('lieberman.normal-ribbons',paths,{width:R(.0018,.0035)})}
    if(program==='field-cables'){const f=source(),points=append('adapter.field-points',f,{count:Math.floor(R(65,120)),gain:2.5});out=append('devine.nearest-topology',points,{neighbors:Math.floor(R(2,4))})}
    if(program==='automaton-springs'){const graph=append('autechre.xor-topology',null,{cols:Math.floor(R(24,45)),rows:Math.floor(R(18,30))});out=append('systems.elastic-graph',graph,{passes:85})}
    return {version:1,kind:'code',aspect,program,nodes,output:out};
  }
  function executeRecipe(program,api){
    if(program.version!==1||program.kind!=='code'||!Array.isArray(program.nodes)||program.nodes.length>6)throw Error('Unsupported hybrid program');
    const state=new Map(),ports=new Map(),ingredients=[];
    for(const node of program.nodes){
      const k=kernels[node.kernel];if(!k)throw Error('Unknown kernel '+node.kernel);const actual=node.input?ports.get(node.input):'none';
      if(k.input!==actual&&!(k.input.endsWith('?')&&(actual==='none'||actual===k.input.slice(0,-1))))throw Error('Hybrid port mismatch '+node.kernel+': '+actual);
      const value=k.run(kernelRandom(node.seed),node.input?state.get(node.input):null,node.params||{},api.aspect);state.set(node.id,value);ports.set(node.id,k.output);if(k.family&&!ingredients.includes(k.family))ingredients.push(k.family);
    }
    if(ingredients.length<2||ingredients.length>3)throw Error('A hybrid must use 2–3 distinct families');
    const result=state.get(program.output),type=ports.get(program.output),{add,dots}=api;
    if(!result||!['graph','paths'].includes(type))throw Error('Hybrid output is not geometry');
    let cachedT=null,cachedPoints;
    const pointsAt=t=>{if(cachedT!==t){cachedT=t;cachedPoints=result.at?result.at(t):result.points}return cachedPoints};
    if(type==='graph'){
      result.edges.forEach(([a,b],i)=>{const shape=t=>{const pts=pointsAt(t);return [pts[a],pts[b]]};const s=add(shape(0),i%19?1:2,.0018);s.motionPoints=shape});
      result.points.forEach(([x,y],i)=>{if(i%7===0){const dot=[x,y,.003,1];dot.positionAt=t=>pointsAt(t)[i];dots.push(dot)}});
    }else{
      result.paths.forEach((path,i)=>{const s=add(path,i%13?1:2,result.filled?.0005:.0011,!!result.filled,!!result.filled);if(result.at)s.motionPoints=t=>{if(cachedT!==t){cachedT=t;cachedPoints=result.at(t)}return cachedPoints[i]}});
    }
    return {ingredients,outputType:type,kernels:program.nodes.map(n=>({id:n.kernel,family:kernels[n.kernel].family,input:kernels[n.kernel].input,output:kernels[n.kernel].output}))};
  }

  window.DesktopFamilies={
    entries,
    hybrids:{recipe,execute:executeRecipe,table:kernels,kernels:Object.values(kernels).map(({id,family,input,output})=>({id,family,input,output})),programs:templates},
    register,
    build(id,api){const fn=algorithms[id];if(!fn)return false;fn(tools(api));return true;}
  };
})();
