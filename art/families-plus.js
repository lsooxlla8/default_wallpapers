/* Version 7 catalogue additions: plotter-style 3D (hidden-line removal,
   light-driven hatching instead of fills, slow camera) and FUI instrument
   graphics (radars, reticles, scales, diagrams). The FUI group draws no text
   and no digits: every mark is geometry. */
(() => {
  "use strict";
  const {register}=DesktopFamilies,TAU=Math.PI*2;
  const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
  const h2=(i,j,s)=>{let h=(Math.imul(i|0,0x27d4eb2d)^Math.imul(j|0,0x165667b1)^Math.imul(s|0,0x2c1b3c6d))|0;h=Math.imul(h^(h>>>15),0x85ebca6b);h=Math.imul(h^(h>>>13),0xc2b2ae35);return ((h^(h>>>16))>>>0)/4294967296};
  const vn=(x,y,s)=>{const i=Math.floor(x),j=Math.floor(y),fx=x-i,fy=y-j,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy),a=h2(i,j,s),b=h2(i+1,j,s),c=h2(i,j+1,s),d=h2(i+1,j+1,s);return (a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v)*2-1};
  const fbm=(x,y,s)=>vn(x,y,s)*.55+vn(x*2.1,y*2.1,s+9)*.28+vn(x*4.3,y*4.3,s+17)*.14;

  // ---------- 3D: camera, depth buffer, visible lines, hatching ----------
  function camera(yaw,pitch,dist,fov){
    const cy=Math.cos(yaw),sy=Math.sin(yaw),cp=Math.cos(pitch),sp=Math.sin(pitch);
    return ([x,y,z])=>{const X=x*cy-z*sy,Z0=x*sy+z*cy,Y=y*cp-Z0*sp,Z=y*sp+Z0*cp+dist,s=fov/Math.max(.05,Z);return [X*s,-Y*s,Z]};
  }
  // Projected physical coordinates are fitted once (at t=0) so a moving
  // camera never rescales the drawing.
  function fitter(points,A,margin=.09){
    let x0=1e9,x1=-1e9,y0=1e9,y1=-1e9;for(const [x,y] of points){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}
    const k=Math.min(A*(1-2*margin)/Math.max(1e-6,x1-x0),(1-2*margin)/Math.max(1e-6,y1-y0)),cx=(x0+x1)/2,cy=(y0+y1)/2;
    return ([x,y,z])=>[.5+(x-cx)*k/A,.5+(y-cy)*k,z];
  }
  function depthBuffer(tris,A,res){
    const W=Math.round(res*Math.sqrt(A)),H=Math.round(W/A),z=new Float32Array(W*H).fill(Infinity),id=new Int32Array(W*H).fill(-1);
    tris.forEach((t,index)=>{
      const p=t.map(([x,y,d])=>[x*W,y*H,d]),minX=Math.max(0,Math.floor(Math.min(p[0][0],p[1][0],p[2][0]))),maxX=Math.min(W-1,Math.ceil(Math.max(p[0][0],p[1][0],p[2][0]))),minY=Math.max(0,Math.floor(Math.min(p[0][1],p[1][1],p[2][1]))),maxY=Math.min(H-1,Math.ceil(Math.max(p[0][1],p[1][1],p[2][1])));
      const area=(p[1][0]-p[0][0])*(p[2][1]-p[0][1])-(p[2][0]-p[0][0])*(p[1][1]-p[0][1]);if(Math.abs(area)<1e-9)return;
      for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){const px=x+.5,py=y+.5;
        const w0=((p[1][0]-px)*(p[2][1]-py)-(p[2][0]-px)*(p[1][1]-py))/area,w1=((p[2][0]-px)*(p[0][1]-py)-(p[0][0]-px)*(p[2][1]-py))/area,w2=1-w0-w1;
        if(w0<-1e-6||w1<-1e-6||w2<-1e-6)continue;const d=w0*p[0][2]+w1*p[1][2]+w2*p[2][2],k=y*W+x;if(d<z[k]){z[k]=d;id[k]=index}}
    });
    let near=Infinity,far=-Infinity;for(const v of z)if(v<Infinity){near=Math.min(near,v);far=Math.max(far,v)}
    const eps=(far-near||1)*.012;
    return {W,H,z,id,visible(x,y,d){const i=Math.floor(x*W),j=Math.floor(y*H);if(i<0||j<0||i>=W||j>=H)return true;const c=z[j*W+i];if(c===Infinity)return true;let lo=c,hi=c;for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){const a=i+di,b=j+dj;if(a>=0&&b>=0&&a<W&&b<H){const v=z[b*W+a];if(v<Infinity){lo=Math.min(lo,v);hi=Math.max(hi,v)}}}return d<=c+eps+(hi-lo)*.6}};
  }
  // Lines are densified in screen space and cut where they pass behind the surface.
  function visibleRuns(polylines,project,buffer,step=.004){
    const out=[];
    for(const {points,color=1,weight=.0012} of polylines){
      let run=[];const push=()=>{if(run.length>1)out.push({points:run,color,weight});run=[]};
      for(let k=0;k<points.length;k++){
        const b=project(points[k]);
        if(k>0){const a=project(points[k-1]),n=Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/step));
          for(let s=1;s<=n;s++){const q=s/n,w=[points[k-1][0]+(points[k][0]-points[k-1][0])*q,points[k-1][1]+(points[k][1]-points[k-1][1])*q,points[k-1][2]+(points[k][2]-points[k-1][2])*q],pq=project(w);if(buffer.visible(pq[0],pq[1],pq[2]))run.push([pq[0],pq[1]]);else push()}}
        else if(buffer.visible(b[0],b[1],b[2]))run.push([b[0],b[1]]);
      }
      push();
    }
    return out;
  }
  // Hatching instead of fill: front-most triangle shade decides how many
  // hatch layers cross each region (darker = more layers).
  function hatchShade(buffer,shade,A,spacing,angle,levels){
    const out=[],rr=Math.hypot(A/2,.5);
    levels.forEach((level,k)=>{const a=angle+k*Math.PI/levels.length*1.3,c=Math.cos(a),s=Math.sin(a);
      for(let o=-rr;o<=rr;o+=spacing){let run=null;for(let u=-rr;u<=rr;u+=.004){const x=(c*u-s*o)/A+.5,y=s*u+c*o+.5,i=Math.floor(x*buffer.W),j=Math.floor(y*buffer.H);
        const inside=i>=0&&j>=0&&i<buffer.W&&j<buffer.H&&buffer.id[j*buffer.W+i]>=0&&shade[buffer.id[j*buffer.W+i]]<level+(h2(i,j,k)-.5)*.16;
        if(inside){if(run)run[1]=[x,y];else run=[[x,y],[x,y]]}else if(run){out.push({points:run,color:k===levels.length-1?2:1,weight:.0009});run=null}}
        if(run)out.push({points:run,color:1,weight:.0009})}});
    return out;
  }
  const sub=(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]],cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],norm=v=>{const l=Math.hypot(...v)||1;return v.map(x=>x/l)};
  const lambert=(t,light)=>{const n=norm(cross(sub(t[1],t[0]),sub(t[2],t[0])));return Math.abs(n[0]*light[0]+n[1]*light[1]+n[2]*light[2])};
  function gridMesh(nu,nv,at){const v=[];for(let j=0;j<=nv;j++)for(let i=0;i<=nu;i++)v.push(at(i/nu,j/nv));const tris=[];for(let j=0;j<nv;j++)for(let i=0;i<nu;i++){const a=j*(nu+1)+i,b=a+1,c=a+nu+1,d=c+1;tris.push([v[a],v[b],v[d]],[v[a],v[d],v[c]])}return {v,tris,row:(j)=>Array.from({length:nu+1},(_,i)=>v[j*(nu+1)+i]),col:(i)=>Array.from({length:nv+1},(_,j)=>v[j*(nu+1)+i])}}
  // A plotter scene: meshes occlude, polylines draw, optional hatching.
  function plotter(api,spec){
    const {A,dynamic}=api;let fit=null;
    dynamic(t=>{
      const cam=camera(spec.yaw+Math.sin(t*spec.speed)*spec.swing,spec.pitch,spec.dist,1),raw=p=>cam(p);
      if(!fit)fit=fitter(spec.tris.flatMap(tr=>tr.map(raw)),A,spec.margin??.09);
      const project=p=>fit(raw(p)),tris=spec.tris.map(tr=>tr.map(project)),buffer=depthBuffer(tris,A,spec.res||300);
      const lines=visibleRuns(typeof spec.lines==='function'?spec.lines(t):spec.lines,project,buffer);
      if(spec.hatch){const shade=spec.tris.map(tr=>lambert(tr,spec.light));lines.push(...hatchShade(buffer,shade,A,spec.hatch.spacing,spec.hatch.angle,spec.hatch.levels))}
      return lines;
    });
  }
  const light=R=>norm([R(-1,1),R(.4,1),R(-1,-.2)]);

  register("plotter","terrain-horizon",({R,A,dynamic})=>{
    // Floating horizon: rows are drawn near to far and only the parts above
    // everything already drawn survive. The terrain scrolls through the noise.
    const s=Math.floor(R(0,1e6)),rows=Math.floor(R(48,80)),amp=R(.12,.3),freq=R(1.2,2.6),pitch=R(.28,.55),bins=900;let fit=null;
    dynamic(t=>{
      const cam=camera(0,-pitch,2.6,1),pts=[],shift=t*.05;
      for(let r=0;r<rows;r++){const z=-1+2*r/(rows-1),row=[];for(let i=0;i<=140;i++){const x=-1.4+2.8*i/140,h=fbm(x*freq,(z+shift)*freq,s)*amp*2*(1-Math.abs(x)/1.6);row.push(cam([x,h,z]))}pts.push(row)}
      if(!fit)fit=fitter(pts.flat(),A,.08);
      const horizon=new Float32Array(bins).fill(Infinity),out=[];
      for(let r=0;r<rows;r++){let run=[];for(const p of pts[r]){const [x,y]=fit(p),b=Math.max(0,Math.min(bins-1,Math.floor(x*bins)));if(y<horizon[b]-.0005){run.push([x,y]);horizon[b]=y}else{if(run.length>1)out.push({points:run,color:r%11===0?2:1,weight:.0013});run=[]}}if(run.length>1)out.push({points:run,color:r%11===0?2:1,weight:.0013})}
      return out;
    });
  },{method:"heightfield rows with floating-horizon hidden-line removal",complexity:"complex",motionMode:"dynamic"});
  register("plotter","surface-grid",({R,A,dynamic})=>{
    const s=Math.floor(R(0,1e6)),f=R(1.2,3),a=R(.18,.35),mesh=gridMesh(44,44,(u,v)=>{const x=u*2-1,z=v*2-1;return [x,fbm(x*f,z*f,s)*a+Math.sin(x*3)*Math.cos(z*2.4)*a*.4,z]});
    plotter({A,dynamic},{tris:mesh.tris,lines:[...Array.from({length:45},(_,j)=>({points:mesh.row(j),color:j%9?1:2})),...Array.from({length:45},(_,i)=>({points:mesh.col(i)}))],yaw:R(0,TAU),pitch:R(.45,.8),dist:3.4,speed:.06,swing:.5});
  },{method:"wireframe surface with depth-buffer hidden-line removal",complexity:"complex",motionMode:"dynamic"});
  register("plotter","hatched-spheres",({R,A,dynamic})=>{
    const balls=Array.from({length:Math.floor(R(1,5))},(_,i)=>({c:i?[R(-1.2,1.2),R(-.5,.6),R(-.8,.8)]:[0,0,0],r:i?R(.25,.55):R(.6,.9)})),tris=[],lines=[];
    for(const b of balls){const m=gridMesh(40,26,(u,v)=>{const th=u*TAU,ph=v*Math.PI;return [b.c[0]+b.r*Math.sin(ph)*Math.cos(th),b.c[1]+b.r*Math.cos(ph),b.c[2]+b.r*Math.sin(ph)*Math.sin(th)]});tris.push(...m.tris);for(let j=3;j<26;j+=5)lines.push({points:m.row(j),weight:.0011})}
    plotter({A,dynamic},{tris,lines,light:light(R),hatch:{spacing:R(.006,.01),angle:R(0,Math.PI),levels:[.75,.5,.28]},yaw:R(0,TAU),pitch:R(.1,.5),dist:5,speed:.05,swing:.6,res:340});
  },{method:"UV spheres shaded by line hatching, occluded by a depth buffer",complexity:"complex",motionMode:"dynamic"});
  register("plotter","torus-knot",({R,A,dynamic,pick})=>{
    const [p,q]=pick([[2,3],[3,5],[2,5],[3,4]]),rad=R(.12,.2),center=t=>{const r=1+.4*Math.cos(q*t);return [r*Math.cos(p*t),.4*Math.sin(q*t),r*Math.sin(p*t)]};
    const N=260,M=12,frames=[];for(let i=0;i<=N;i++){const t=i/N*TAU,c=center(t),d=norm(sub(center(t+.001),c)),n=norm(cross(d,[0,1,0])),b=cross(d,n);frames.push([c,n,b])}
    const mesh=gridMesh(N,M,(u,v)=>{const [c,n,b]=frames[Math.round(u*N)],a=v*TAU;return [c[0]+(n[0]*Math.cos(a)+b[0]*Math.sin(a))*rad,c[1]+(n[1]*Math.cos(a)+b[1]*Math.sin(a))*rad,c[2]+(n[2]*Math.cos(a)+b[2]*Math.sin(a))*rad]});
    const lines=[0,3,6,9].map(v=>({points:mesh.row(v),color:v?1:2,weight:.0012}));for(let i=0;i<=N;i+=2)lines.push({points:mesh.col(i),color:i%26?1:2,weight:.001});
    plotter({A,dynamic},{tris:mesh.tris,lines,yaw:R(0,TAU),pitch:R(.3,1),dist:4.5,speed:.05,swing:.7,res:340});
  },{method:"torus-knot tube cross-sections with hidden-line removal",complexity:"complex",motionMode:"dynamic"});
  register("plotter","block-city",({R,A,dynamic})=>{
    const tris=[],lines=[],n=Math.floor(R(5,9)),s=Math.floor(R(0,1e6));
    const box=(x,z,w,d,h)=>{const P=[[x,0,z],[x+w,0,z],[x+w,0,z+d],[x,0,z+d],[x,h,z],[x+w,h,z],[x+w,h,z+d],[x,h,z+d]];
      [[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7],[4,5,6,7]].forEach(f=>tris.push([P[f[0]],P[f[1]],P[f[2]]],[P[f[0]],P[f[2]],P[f[3]]]));
      [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]].forEach(([a,b])=>lines.push({points:[P[a],P[b]],weight:.0012}))};
    for(let i=0;i<n;i++)for(let j=0;j<n;j++){if(h2(i,j,s)<.18)continue;const h=.15+Math.pow(h2(i+7,j,s),3)*1.6;box(-1+2*i/n,-1+2*j/n,2/n*.72,2/n*.72,h)}
    plotter({A,dynamic},{tris,lines,light:norm([.6,.8,-.3]),hatch:{spacing:R(.005,.009),angle:R(0,Math.PI),levels:[.62,.35]},yaw:R(.3,1.2),pitch:R(.5,.85),dist:4.2,speed:.04,swing:.4,res:360});
  },{method:"extruded blocks, orientation-driven hatching, hidden edges removed",complexity:"complex",motionMode:"dynamic"});
  register("plotter","ruled-hyperboloid",({R,A,dynamic})=>{
    const twist=R(.7,1.4),n=Math.floor(R(36,72)),a=R(.45,.8),mesh=gridMesh(48,16,(u,v)=>{const th=u*TAU,y=v*2-1,r=Math.hypot(a,y*a*Math.tan(twist/2)*1.1);return [r*Math.cos(th+Math.atan2(y*Math.tan(twist/2),1)),y,r*Math.sin(th+Math.atan2(y*Math.tan(twist/2),1))]});
    const lines=[];for(let k=0;k<n;k++){const th=k/n*TAU;for(const sgn of [1,-1])lines.push({points:[[a*Math.cos(th-sgn*twist)/Math.cos(twist),-1,a*Math.sin(th-sgn*twist)/Math.cos(twist)],[a*Math.cos(th+sgn*twist)/Math.cos(twist),1,a*Math.sin(th+sgn*twist)/Math.cos(twist)]],color:sgn<0&&k%6===0?2:1,weight:.001})}
    const surf=gridMesh(48,16,(u,v)=>{const th=u*TAU,y=v*2-1,r=a/Math.cos(twist)*Math.sqrt(Math.cos(twist)**2+(y*Math.sin(twist))**2);return [r*Math.cos(th),y,r*Math.sin(th)]});
    plotter({A,dynamic},{tris:surf.tris,lines,yaw:R(0,TAU),pitch:R(-.5,.5),dist:4,speed:.07,swing:.9});
  },{method:"two families of straight rulings on a hyperboloid of one sheet",complexity:"simple",motionMode:"dynamic"});
  register("plotter","stacked-slices",({R,A,dynamic})=>{
    const s=Math.floor(R(0,1e6)),layers=Math.floor(R(26,46)),radius=(th,y)=>.55+.25*fbm(Math.cos(th)*1.3+3,Math.sin(th)*1.3+y*1.4,s)+.15*Math.sin(y*2.4);
    const mesh=gridMesh(64,layers,(u,v)=>{const th=u*TAU,y=v*2-1,r=radius(th,y)*Math.sqrt(1-y*y*.82);return [r*Math.cos(th),y,r*Math.sin(th)]});
    const lines=Array.from({length:layers+1},(_,j)=>({points:mesh.row(j),color:j%8?1:2,weight:.0013}));
    plotter({A,dynamic},{tris:mesh.tris,lines,yaw:R(0,TAU),pitch:R(.25,.6),dist:3.8,speed:.05,swing:.8});
  },{method:"stacked horizontal sections of a noise solid, occluded",complexity:"complex",motionMode:"dynamic"});
  register("plotter","polyhedra",({R,A,dynamic})=>{
    const t=(1+Math.sqrt(5))/2,V=[[-1,t,0],[1,t,0],[-1,-t,0],[1,-t,0],[0,-1,t],[0,1,t],[0,-1,-t],[0,1,-t],[t,0,-1],[t,0,1],[-t,0,-1],[-t,0,1]].map(norm);
    const F=[[0,11,5],[0,5,1],[0,1,7],[0,7,10],[0,10,11],[1,5,9],[5,11,4],[11,10,2],[10,7,6],[7,1,8],[3,9,4],[3,4,2],[3,2,6],[3,6,8],[3,8,9],[4,9,5],[2,4,11],[6,2,10],[8,6,7],[9,8,1]];
    const tris=[],lines=[];for(let k=0;k<Math.floor(R(2,6));k++){const c=k?[R(-1.6,1.6),R(-.7,.7),R(-1,1)]:[0,0,0],r=k?R(.25,.6):R(.7,1),rot=R(0,TAU),cr=Math.cos(rot),sr=Math.sin(rot),P=V.map(([x,y,z])=>[c[0]+(x*cr-z*sr)*r,c[1]+y*r,c[2]+(x*sr+z*cr)*r]);
      F.forEach(f=>{tris.push(f.map(i=>P[i]));[[0,1],[1,2]].forEach(([a,b])=>lines.push({points:[P[f[a]],P[f[b]]],weight:.0013}))})}
    plotter({A,dynamic},{tris,lines,light:light(R),hatch:{spacing:R(.005,.009),angle:R(0,Math.PI),levels:[.8,.55,.3]},yaw:R(0,TAU),pitch:R(.2,.6),dist:6,speed:.05,swing:.8,res:360});
  },{method:"icosahedra with facet hatching by Lambert shade and hidden edges removed",complexity:"simple",motionMode:"dynamic"});
  register("plotter","contour-relief",({R,A,dynamic})=>{
    const s=Math.floor(R(0,1e6)),f=R(1,2.2),amp=R(.35,.6),N=56,H=(x,z)=>Math.max(-.05,fbm(x*f,z*f,s))*amp*(1-.35*(x*x+z*z));
    const mesh=gridMesh(N,N,(u,v)=>{const x=u*2-1,z=v*2-1;return [x,H(x,z),z]}),lines=[];
    const levels=Math.floor(R(10,18));for(let l=1;l<=levels;l++){const level=-.04+l/levels*amp*.7;
      for(let j=0;j<N;j++)for(let i=0;i<N;i++){const q=[[i,j],[i+1,j],[i+1,j+1],[i,j+1]].map(([a,b])=>{const x=a/N*2-1,z=b/N*2-1;return [x,H(x,z),z]}),cross=[];
        for(let e=0;e<4;e++){const a=q[e],b=q[(e+1)%4];if((a[1]<level)!==(b[1]<level)){const k=(level-a[1])/(b[1]-a[1]);cross.push([a[0]+(b[0]-a[0])*k,level,a[2]+(b[2]-a[2])*k])}}
        if(cross.length>=2)lines.push({points:[cross[0],cross[1]],color:l%5?1:2,weight:.0012})}}
    for(let j=0;j<=N;j+=N/4)lines.push({points:mesh.row(j),weight:.0008});
    plotter({A,dynamic},{tris:mesh.tris,lines,yaw:R(0,TAU),pitch:R(.55,.95),dist:3.3,speed:.05,swing:.5});
  },{method:"iso-height contours lifted onto a relief, hidden lines removed",complexity:"complex",motionMode:"dynamic"});
  register("plotter","lissajous-tube",({R,A,dynamic})=>{
    const a=Math.floor(R(1,5)),b=Math.floor(R(2,6)),c=Math.floor(R(1,4)),ph=R(0,TAU),curve=t=>[Math.sin(a*t+ph),Math.sin(b*t)*.8,Math.sin(c*t+ph*.5)];
    const N=320,rad=R(.04,.08),frames=[];for(let i=0;i<=N;i++){const t=i/N*TAU,p=curve(t),d=norm(sub(curve(t+.001),p)),n=norm(cross(d,[.3,1,.2])),bb=cross(d,n);frames.push([p,n,bb])}
    const mesh=gridMesh(N,8,(u,v)=>{const [p,n,bb]=frames[Math.round(u*N)],q=v*TAU;return [p[0]+(n[0]*Math.cos(q)+bb[0]*Math.sin(q))*rad,p[1]+(n[1]*Math.cos(q)+bb[1]*Math.sin(q))*rad,p[2]+(n[2]*Math.cos(q)+bb[2]*Math.sin(q))*rad]});
    const lines=[0,2,4,6].map(v=>({points:mesh.row(v),color:v===0?2:1,weight:.0012}));for(let i=0;i<=N;i+=4)lines.push({points:mesh.col(i),weight:.0008});
    plotter({A,dynamic},{tris:mesh.tris,lines,yaw:R(0,TAU),pitch:R(-.4,.6),dist:4,speed:.06,swing:.8,res:340});
  },{method:"3D Lissajous tube with self-occlusion",complexity:"simple",motionMode:"dynamic"});

  // ---------- FUI: instrument graphics without any text ----------
  const at=(cx,cy,r,a,A)=>[cx+Math.cos(a)*r/A,cy+Math.sin(a)*r];
  const arc=(cx,cy,r,a0,a1,A,n=64)=>Array.from({length:n+1},(_,i)=>at(cx,cy,r,a0+(a1-a0)*i/n,A));
  const spin=(points,cx,cy,angle,A)=>{const c=Math.cos(angle),s=Math.sin(angle);return points.map(([x,y])=>{const dx=(x-cx)*A,dy=y-cy;return [cx+(dx*c-dy*s)/A,cy+dx*s+dy*c]})};
  const turning=(stroke,cx,cy,omega,A)=>{const base=stroke.points;stroke.motionPoints=t=>spin(base,cx,cy,omega*t,A);return stroke};
  const bracket=(add,x,y,w,h,l,c=1)=>{for(const [px,py,sx,sy] of [[x,y,1,1],[x+w,y,-1,1],[x,y+h,1,-1],[x+w,y+h,-1,-1]])add([[px+sx*l*w,py],[px,py],[px,py+sy*l*h]],c,.0012)};
  const ticks=(add,cx,cy,r,len,n,A,c=1,every=0)=>{for(let k=0;k<n;k++){const a=k/n*TAU,l=every&&k%every===0?len*2:len;add([at(cx,cy,r,a,A),at(cx,cy,r-l,a,A)],every&&k%every===0?c:1,.0008)}};

  register("fui","radar-sweep",({R,A,add,dots})=>{
    const cx=R(.4,.6),cy=.5,r=R(.36,.44),rings=Math.floor(R(4,7));
    for(let i=1;i<=rings;i++)add(arc(cx,cy,r*i/rings,0,TAU,A,140),i===rings?1:1,i===rings?.0016:.0008,false,true);
    for(let k=0;k<12;k++)add([[cx,cy],at(cx,cy,r,k/12*TAU,A)],1,.0006);
    ticks(add,cx,cy,r,.012,120,A,2,10);
    for(let k=0;k<26;k++){const s=add([[cx,cy],at(cx,cy,r,-k*.018,A)],k?1:2,k?.0008:.002);s.opacity=Math.max(.06,1-k/26);turning(s,cx,cy,.35,A)}
    for(let i=0;i<Math.floor(R(5,14));i++){const a=R(0,TAU),d=R(.15,.95)*r,[x,y]=at(cx,cy,d,a,A),s=add(arc(x,y,.007,0,TAU,A,16),2,.0012,true,true);s.opacityAt=t=>{const sweep=((.35*t)%TAU+TAU)%TAU,lag=((sweep-a)%TAU+TAU)%TAU;return .15+.85*Math.exp(-lag*1.4)}}
    bracket(add,cx-r*1.12/A,cy-r*1.12,r*2.24/A,r*2.24,.12);
  },{method:"rotating radar sweep with decaying echoes",complexity:"simple",motionMode:"own"});
  register("fui","targeting-reticle",({R,A,add})=>{
    const cx=R(.42,.58),cy=R(.42,.58),r=R(.18,.3),gap=r*.18;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])add([[cx+dx*gap/A,cy+dy*gap],[cx+dx*r*1.5/A,cy+dy*r*1.5]],1,.0012);
    for(let ring=0;ring<4;ring++){const rr=r*(.45+ring*.28),segments=Math.floor(R(3,9)),dir=ring%2?-1:1,speed=R(.05,.18)*dir;
      for(let k=0;k<segments;k++){const a0=k/segments*TAU,a1=a0+TAU/segments*R(.35,.8);turning(add(arc(cx,cy,rr,a0,a1,A,40),ring===1&&k===0?2:1,ring===3?.003:.0014),cx,cy,speed,A)}}
    for(let k=0;k<3;k++){const a=k/3*TAU+R(0,.5),p=at(cx,cy,r*1.62,a,A),q=at(cx,cy,r*1.75,a-.05,A),w=at(cx,cy,r*1.75,a+.05,A);turning(add([p,q,w],2,0,true,true),cx,cy,-.08,A)}
    bracket(add,cx-r*2/A,cy-r*1.6,r*4/A,r*3.2,.08);
  },{method:"counter-rotating segmented reticle rings",complexity:"simple",motionMode:"own"});
  register("fui","tactical-grid",({R,A,add,dots})=>{
    const horizon=R(.3,.45),vp=R(.35,.65),lines=Math.floor(R(14,26));
    add([[0,horizon],[1,horizon]],2,.0012);
    for(let k=-lines;k<=lines;k++){add([[vp+k*.004,horizon],[vp+k*.12,1.05]],1,.0007)}
    for(let k=0;k<18;k++){const s=add([[0,0],[1,0]],1,.0007),depth=k/18;s.motionPoints=t=>{const u=(depth+t*.03)%1,y=horizon+(1-horizon)*u*u;return [[0,y],[1,y]]};s.points=s.motionPoints(0);s.opacityAt=t=>{const u=(depth+t*.03)%1;return .2+.8*u}}
    for(let i=0;i<Math.floor(R(4,9));i++){const x=R(.1,.9),y=R(horizon+.12,.92),s=.012;add([[x,y-s],[x+s/A,y],[x,y+s],[x-s/A,y]],i%3?1:2,.0013,i%3===0,true)}
    for(let i=0;i<5;i++){const x=R(.08,.8),w=R(.06,.16),y=R(.08,horizon-.06);add([[x,y],[x+w,y]],1,.0007);add([[x,y-.006],[x,y+.006]],1,.0007)}
    bracket(add,.04/A+.02,.05,1-.08/A-.04,.9,.05);
  },{method:"perspective floor grid with scrolling depth lines and markers",complexity:"simple",motionMode:"own"});
  register("fui","scale-bank",({R,A,add})=>{
    const n=Math.floor(R(4,9)),vertical=R()<.5;
    for(let i=0;i<n;i++){const u=.12+.76*i/(n-1||1),len=R(.5,.82),start=.5-len/2,minor=Math.floor(R(30,70)),major=Math.floor(R(4,8)),P=(a,b)=>vertical?[a,b]:[b,a];
      add([P(u,start),P(u,start+len)],1,.0012);
      for(let k=0;k<=minor;k++){const v=start+len*k/minor,l=k%major===0?.018:.008;add([P(u,v),P(u+(vertical?l/A:l),v)],1,.0008)}
      const pos=R(.1,.9),speed=R(.05,.15),phase=R(0,TAU),marker=t=>{const v=start+len*(.5+.45*Math.sin(t*speed+phase)*pos);const d=.012;return vertical?[[u-d*.4/A,v],[u-d*1.4/A,v-d*.6],[u-d*1.4/A,v+d*.6]]:[[v,u-d*.4],[v-d*.6/A,u-d*1.4],[v+d*.6/A,u-d*1.4]]};
      const s=add(marker(0),2,0,true,true);s.motionPoints=marker;
      const bar=t=>{const v=start+len*(.5+.45*Math.sin(t*speed+phase)*pos),w=.006;return vertical?[[u+.026/A,start],[u+(.026+w)/A,start],[u+(.026+w)/A,v],[u+.026/A,v]]:[[start,u+.026],[v,u+.026],[v,u+.026+w],[start,u+.026+w]]};
      const b=add(bar(0),1,0,true,true);b.motionPoints=bar;b.opacity=.55}
  },{method:"banks of graduated scales with moving indicators",complexity:"simple",motionMode:"own"});
  register("fui","polar-diagram",({R,A,add})=>{
    const cx=R(.4,.6),cy=.5,r=R(.3,.4),n=Math.floor(R(5,10)),rings=Math.floor(R(3,6));
    for(let i=1;i<=rings;i++)add(Array.from({length:n+1},(_,k)=>at(cx,cy,r*i/rings,k/n*TAU-Math.PI/2,A)),1,i===rings?.0014:.0007,false,true);
    for(let k=0;k<n;k++)add([[cx,cy],at(cx,cy,r,k/n*TAU-Math.PI/2,A)],1,.0007);
    for(let series=0;series<2;series++){const values=Array.from({length:n},()=>R(.25,.95)),phases=values.map(()=>R(0,TAU)),shape=t=>Array.from({length:n},(_,k)=>at(cx,cy,r*clamp(values[k]+.08*Math.sin(t*.4+phases[k]),.1,1),k/n*TAU-Math.PI/2,A));
      const s=add(shape(0),series?2:1,series?.0018:0,!series,true);s.motionPoints=shape;if(!series)s.opacity=.28;
      for(let k=0;k<n;k++){const d=add(arc(...shape(0)[k],.006,0,TAU,A,12),2,.001,false,true);d.motionPoints=t=>{const p=shape(t)[k];return arc(p[0],p[1],.006,0,TAU,A,12)}}}
  },{method:"radar chart rings, spokes and breathing data polygons",complexity:"simple",motionMode:"own"});
  register("fui","scope-panels",({R,A,add})=>{
    const cols=Math.floor(R(2,4)),rows=Math.floor(R(2,4)),m=.05,g=.025,w=(1-2*m/A-(cols-1)*g/A)/cols,h=(1-2*m-(rows-1)*g)/rows;
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const x=m/A+i*(w+g/A),y=m+j*(h+g);add([[x,y],[x+w,y],[x+w,y+h],[x,y+h]],1,.0012,false,true);
      for(let k=1;k<8;k++){const xx=x+w*k/8;for(let d=0;d<10;d++)add([[xx,y+h*(d+.3)/10],[xx,y+h*(d+.6)/10]],1,.0005)}
      for(let k=1;k<4;k++){const yy=y+h*k/4;for(let d=0;d<16;d++)add([[x+w*(d+.3)/16,yy],[x+w*(d+.6)/16,yy]],1,.0005)}
      const f1=R(1,6),f2=R(3,14),amp=R(.2,.42),trace=t=>Array.from({length:121},(_,k)=>{const u=k/120;return [x+w*u,y+h/2+h*amp*(Math.sin(u*TAU*f1+t*.8)*.7+Math.sin(u*TAU*f2-t*1.3)*.3)]});
      const s=add(trace(0),(i+j)%3?1:2,.0016);s.motionPoints=trace}
  },{method:"oscilloscope panels with dashed divisions and live traces",complexity:"simple",motionMode:"own"});
  register("fui","orbital-schematic",({R,A,add,dots})=>{
    const cx=R(.4,.6),cy=R(.42,.58),n=Math.floor(R(3,6));add(arc(cx,cy,.035,0,TAU,A,40),1,0,true,true);
    for(let i=0;i<n;i++){const a=.08+i*R(.06,.09),b=a*R(.35,.8),tilt=R(0,Math.PI),c=Math.cos(tilt),s=Math.sin(tilt),pt=u=>{const x=Math.cos(u)*a,y=Math.sin(u)*b;return [cx+(x*c-y*s)/A,cy+x*s+y*c]};
      if(i%2)for(let d=0;d<48;d++)add([pt(d/48*TAU),pt((d+.5)/48*TAU)],1,.0009);else add(Array.from({length:121},(_,k)=>pt(k/120*TAU)),1,.0009,false,true);
      const speed=R(.05,.2)*(R()<.5?-1:1),phase=R(0,TAU),dot=[...pt(phase),.008,i%2?2:1];dot.positionAt=t=>pt(phase+t*speed);dots.push(dot);
      const mark=add(arc(...pt(phase),.016,0,TAU,A,20),2,.0009,false,true);mark.motionPoints=t=>{const p=pt(phase+t*speed);return arc(p[0],p[1],.016,0,TAU,A,20)}}
    for(let k=0;k<3;k++){const a0=R(0,TAU);add(arc(cx,cy,R(.05,.07),a0,a0+R(.4,1.4),A,24),2,.0012)}
    bracket(add,cx-.42/A,cy-.42,.84/A,.84,.06);
  },{method:"orbit schematic with moving bodies and angle arcs",complexity:"simple",motionMode:"own"});
  register("fui","hex-status",({R,A,add})=>{
    const size=R(.025,.045),cols=Math.floor(A*.8/(size*1.75)),rows=Math.floor(.8/(size*1.5)),x0=.5-cols*size*1.75/2/A,y0=.5-rows*size*1.5/2,fill=R(.12,.3);
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const cx=x0+(i*size*1.75+(j%2)*size*.87)/A,cy=y0+j*size*1.5,hex=f=>Array.from({length:7},(_,k)=>at(cx,cy,size*f,k/6*TAU+Math.PI/6,A)),v=h2(i,j,cols*31+rows);
      if(v<.12)continue;const filled=v>1-fill;add(hex(.9),filled&&v>.95?2:1,.0009,filled,true);if(!filled&&v<.35)add(hex(.45),1,.0009,false,true);
      if(v>.97){const s=add(hex(.62),2,.0014,false,true);s.opacityAt=t=>.3+.7*(Math.sin(t*1.7+i+j)>0?1:0)}}
  },{method:"hexagonal status matrix with blinking cells",complexity:"simple",motionMode:"own"});
  register("fui","dial-array",({R,A,add})=>{
    const cols=Math.floor(R(2,5)),rows=Math.max(1,Math.round(cols/A*1.1)),r=Math.min(.42/rows,.42*A/cols)*.8;
    for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){const cx=(i+.5)/cols,cy=(j+.5)/rows,span=R(1.2,1.8)*Math.PI,a0=Math.PI/2+(TAU-span)/2;
      add(arc(cx,cy,r,a0,a0+span,A,60),1,.0013);for(let k=0;k<=20;k++){const a=a0+span*k/20,l=k%5?.08:.16;add([at(cx,cy,r,a,A),at(cx,cy,r*(1-l),a,A)],1,.0008)}
      const level=R(.2,.9);add(arc(cx,cy,r*1.08,a0,a0+span*level,A,40),2,.004);
      const speed=R(.05,.2),phase=R(0,TAU),needle=t=>{const a=a0+span*(.5+.42*Math.sin(t*speed+phase));return [at(cx,cy,-r*.12,a,A),at(cx,cy,r*.86,a,A)]};
      const s=add(needle(0),2,.0018);s.motionPoints=needle;add(arc(cx,cy,r*.06,0,TAU,A,16),1,0,true,true)}
  },{method:"arrays of dials with arc gauges and swinging needles",complexity:"simple",motionMode:"own"});
  register("fui","scan-topography",({R,A,add})=>{
    const cx=R(.4,.6),cy=.5,r=R(.32,.42),s=Math.floor(R(0,1e6)),N=70,field=(x,y)=>fbm(x*3,y*3,s);
    for(let l=-4;l<=4;l++){const level=l*.1;for(let j=0;j<N;j++)for(let i=0;i<N;i++){const q=[[i,j],[i+1,j],[i+1,j+1],[i,j+1]].map(([a,b])=>[a/N*2-1,b/N*2-1]),pts=[];
      for(let e=0;e<4;e++){const a=q[e],b=q[(e+1)%4],fa=field(...a),fb=field(...b);if((fa<level)!==(fb<level)){const k=(level-fa)/(fb-fa);pts.push([a[0]+(b[0]-a[0])*k,a[1]+(b[1]-a[1])*k])}}
      if(pts.length>=2&&Math.hypot(...pts[0])<.97&&Math.hypot(...pts[1])<.97)add(pts.slice(0,2).map(([x,y])=>[cx+x*r/A,cy+y*r]),l===0?2:1,.0009)}}
    add(arc(cx,cy,r,0,TAU,A,160),1,.0016,false,true);ticks(add,cx,cy,r*1.06,.01,90,A,2,15);
    const scan=t=>{const y=cy-r+((t*.06)%1)*2*r,w=Math.sqrt(Math.max(0,r*r-(y-cy)**2));return [[cx-w/A,y],[cx+w/A,y]]};const line=add(scan(0),2,.0022);line.motionPoints=scan;
    for(let k=0;k<4;k++){const [x,y]=at(cx,cy,R(.2,.8)*r,R(0,TAU),A),l=.015;add([[x-l/A,y],[x+l/A,y]],2,.0012);add([[x,y-l],[x,y+l]],2,.0012)}
  },{method:"circular contour map with scanning line and markers",complexity:"simple",motionMode:"own"});
})();
