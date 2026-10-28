/* default_desktop engine 8: experimental raster families.
   A rule is a source (a generative render, a photo from the user's library, or
   a procedural field) followed by a chain of pixel operators: datamoshing,
   pixel sorting, displacement, collage, an "audio" round trip (image → signal →
   EQ / comb / delay / bitcrush → image), FFT smearing, palette and DCT faults,
   scanline shifts and feedback. 112 rules are generated from a fixed master
   seed; every work draws its own parameters from its seed. Everything heavy runs
   once at generation; frames only draw the finished bitmap. */
(() => {
  "use strict";
  const TAU=Math.PI*2;
  const rand=seed=>{let a=seed>>>0;return (lo=0,hi=1)=>{a+=0x6D2B79F5;let t=a;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return lo+(hi-lo)*(((t^(t>>>14))>>>0)/4294967296)}};
  const clamp=(x,a=0,b=255)=>x<a?a:x>b?b:x;
  const hash=(i,j,s)=>{let h=(Math.imul(i|0,0x27d4eb2d)^Math.imul(j|0,0x165667b1)^Math.imul(s|0,0x2c1b3c6d))|0;h=Math.imul(h^(h>>>15),0x85ebca6b);h=Math.imul(h^(h>>>13),0xc2b2ae35);return ((h^(h>>>16))>>>0)/4294967296};
  const vnoise=(x,y,s)=>{const i=Math.floor(x),j=Math.floor(y),fx=x-i,fy=y-j,u=fx*fx*(3-2*fx),v=fy*fy*(3-2*fy),a=hash(i,j,s),b=hash(i+1,j,s),c=hash(i,j+1,s),d=hash(i+1,j+1,s);return (a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v)*2-1};
  const fbm=(x,y,s)=>vnoise(x,y,s)*.55+vnoise(x*2.1,y*2.1,s+7)*.3+vnoise(x*4.3,y*4.3,s+13)*.15;
  const lum=(d,i)=>.2126*d[i]+.7152*d[i+1]+.0722*d[i+2];
  const copy=img=>new ImageData(new Uint8ClampedArray(img.data),img.width,img.height);

  // ---------- pixel operators: (img, R, p) -> img ----------
  const OPS={
    sort(img,R,p){ // pixel sorting of spans inside a luminance interval
      const {width:w,height:h,data:d}=img,vertical=p.vertical,lo=p.lo,hi=p.hi,len=vertical?h:w,lines=vertical?w:h;
      for(let l=0;l<lines;l++){let k=0;while(k<len){
        const at=q=>vertical?(q*w+l)*4:(l*w+q)*4;let s=k;while(s<len){const v=lum(d,at(s));if(v>=lo&&v<=hi)break;s++}
        let e=s;while(e<len){const v=lum(d,at(e));if(v<lo||v>hi)break;e++}
        if(e-s>2){const px=[];for(let q=s;q<e;q++){const i=at(q);px.push([d[i],d[i+1],d[i+2],lum(d,i)])}px.sort((a,b)=>p.reverse?b[3]-a[3]:a[3]-b[3]);for(let q=s;q<e;q++){const i=at(q),c=px[q-s];d[i]=c[0];d[i+1]=c[1];d[i+2]=c[2]}}
        k=e+1}}
      return img;
    },
    mosh(img,R,p){ // block motion vectors applied over several P-frames
      const {width:w,height:h}=img,b=p.block,seed=Math.floor(R(0,1e6));let cur=copy(img);
      for(let f=0;f<p.frames;f++){const next=copy(cur),s=cur.data,t=next.data;
        for(let by=0;by<h;by+=b)for(let bx=0;bx<w;bx+=b){
          const a=fbm(bx/w*p.scale,by/h*p.scale+f*.3,seed)*TAU,m=p.strength*(.4+.6*hash(bx,by,seed+f));
          const dx=Math.round(Math.cos(a)*m),dy=Math.round(Math.sin(a)*m);if(hash(bx+3,by,seed)<p.keep)continue;
          for(let y=0;y<b&&by+y<h;y++)for(let x=0;x<b&&bx+x<w;x++){const sx=clamp(bx+x+dx,0,w-1),sy=clamp(by+y+dy,0,h-1),i=((by+y)*w+bx+x)*4,j=(sy*w+sx)*4;t[i]=s[j];t[i+1]=s[j+1];t[i+2]=s[j+2]}}
        cur=next}
      return cur;
    },
    displace(img,R,p){ // displacement by a noise or self-luminance map, with channel split
      const {width:w,height:h,data:d}=img,src=new Uint8ClampedArray(d),seed=Math.floor(R(0,1e6));
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,m=p.self?(lum(src,i)/255-.5)*2:fbm(x/w*p.scale,y/h*p.scale,seed);
        for(let c=0;c<3;c++){const off=m*p.amount*(1+(c-1)*p.split),sx=clamp(Math.round(x+(p.vertical?0:off)),0,w-1),sy=clamp(Math.round(y+(p.vertical?off:0)),0,h-1);d[i+c]=src[(sy*w+sx)*4+c]}}
      return img;
    },
    collage(img,R,p,ctx){ // strips, grid or torn masks from two sources
      const {width:w,height:h,data:d}=img,other=ctx.second(w,h),o=other.data,n=p.pieces;
      const cells=[];if(p.mode==="grid"){const cols=n,rows=Math.max(2,Math.round(n*h/w));for(let j=0;j<rows;j++)for(let i=0;i<cols;i++)cells.push([i*w/cols,j*h/rows,w/cols,h/rows])}
      else for(let i=0;i<n;i++)cells.push(p.mode==="rows"?[0,i*h/n,w,h/n]:[i*w/n,0,w/n,h]);
      const src=new Uint8ClampedArray(d),seed=Math.floor(R(0,1e6));
      cells.forEach((c,k)=>{const fromOther=hash(k,1,seed)<p.mix,shift=Math.round((hash(k,2,seed)-.5)*p.shift*w),flip=hash(k,3,seed)<.3;
        for(let y=Math.floor(c[1]);y<Math.min(h,c[1]+c[3]);y++)for(let x=Math.floor(c[0]);x<Math.min(w,c[0]+c[2]);x++){
          if(p.mode==="torn"&&Math.abs(fbm(x/w*9,y/h*9,seed+k))<.04)continue;
          const sx=flip?Math.floor(c[0]+c[2]-1-(x-c[0])):x,ssx=((sx+shift)%w+w)%w,i=(y*w+x)*4,j=(y*w+ssx)*4,S=fromOther?o:src;d[i]=S[j];d[i+1]=S[j+1];d[i+2]=S[j+2]}});
      return img;
    },
    audio(img,R,p){ // rows as a signal: EQ biquad, comb, echo, bitcrush, back to pixels
      const {width:w,height:h,data:d}=img,n=w*h,sig=new Float32Array(n*3);
      for(let i=0,k=0;i<n;i++)for(let c=0;c<3;c++)sig[k++]=d[i*4+c]/127.5-1;
      // biquad (RBJ cookbook): lowpass / highpass / peaking
      const f=p.freq,q=p.q,w0=TAU*f,cs=Math.cos(w0),sn=Math.sin(w0),alpha=sn/(2*q),A=Math.pow(10,p.gain/40);let b0,b1,b2,a0,a1,a2;
      if(p.eq==="low"){b0=(1-cs)/2;b1=1-cs;b2=(1-cs)/2;a0=1+alpha;a1=-2*cs;a2=1-alpha}
      else if(p.eq==="high"){b0=(1+cs)/2;b1=-(1+cs);b2=(1+cs)/2;a0=1+alpha;a1=-2*cs;a2=1-alpha}
      else{b0=1+alpha*A;b1=-2*cs;b2=1-alpha*A;a0=1+alpha/A;a1=-2*cs;a2=1-alpha/A}
      let x1=0,x2=0,y1=0,y2=0;for(let i=0;i<sig.length;i++){const x=sig[i],y=(b0*x+b1*x1+b2*x2-a1*y1-a2*y2)/a0;x2=x1;x1=x;y2=y1;y1=y;sig[i]=y}
      if(p.comb){const D=p.comb*3;for(let i=D;i<sig.length;i++)sig[i]=sig[i]*.6+sig[i-D]*p.feedback}
      if(p.echo){const D=p.echo*3*w;for(let i=sig.length-1;i>=D;i--)sig[i]+=sig[i-D]*.45}
      const levels=Math.pow(2,p.bits),hold=p.hold*3;
      for(let i=0;i<sig.length;i++){const v=hold>3&&i%hold>=3?sig[i-(i%hold)+(i%3)]:sig[i];sig[i]=Math.round(clamp(v,-1,1)*levels)/levels}
      for(let i=0,k=0;i<n;i++)for(let c=0;c<3;c++)d[i*4+c]=clamp((sig[k++]+1)*127.5);
      return img;
    },
    fft(img,R,p){ // per-row DFT: keep a band, rotate phase, inverse
      const {width:w,height:h,data:d}=img,N=Math.min(128,1<<Math.floor(Math.log2(w))),re=new Float32Array(N),im=new Float32Array(N),cos=new Float32Array(N),sin=new Float32Array(N);
      for(let k=0;k<N;k++){cos[k]=Math.cos(TAU*k/N);sin[k]=Math.sin(TAU*k/N)}
      for(let y=0;y<h;y+=p.step)for(let c=0;c<3;c++){
        for(let x=0;x<N;x++){re[x]=d[(y*w+Math.floor(x*w/N))*4+c];im[x]=0}
        const R2=new Float32Array(N),I2=new Float32Array(N);
        for(let k=0;k<N;k++){if(k>p.cut&&k<N-p.cut)continue;let sr=0,si=0;for(let x=0;x<N;x++){const a=(k*x)%N;sr+=re[x]*cos[a];si-=re[x]*sin[a]}const ph=p.phase*(k%7);R2[k]=sr*Math.cos(ph)-si*Math.sin(ph);I2[k]=sr*Math.sin(ph)+si*Math.cos(ph)}
        for(let x=0;x<N;x++){let s=0;for(let k=0;k<N;k++){if(k>p.cut&&k<N-p.cut)continue;const a=(k*x)%N;s+=R2[k]*cos[a]-I2[k]*sin[a]}const v=clamp(s/N);for(let yy=y;yy<Math.min(h,y+p.step);yy++)for(let xx=Math.floor(x*w/N);xx<Math.floor((x+1)*w/N);xx++)d[(yy*w+xx)*4+c]=v}}
      return img;
    },
    quantize(img,R,p){ // posterize with a deliberately wrong error-diffusion kernel
      const {width:w,height:h,data:d}=img,levels=p.levels,step=255/(levels-1),err=new Float32Array(w*h*3);
      for(let y=0;y<h;y++)for(let x=0;x<w;x++)for(let c=0;c<3;c++){const k=(y*w+x)*3+c,i=(y*w+x)*4+c,v=d[i]+err[k],q=Math.round(clamp(v)/step)*step,e=(v-q)*p.bleed;d[i]=q;
        if(x+1<w)err[k+3]+=e*p.right;if(y+1<h)err[k+w*3]+=e*(1-p.right);if(p.wrap&&x+2<w)err[k+6]-=e*.3}
      return img;
    },
    scanline(img,R,p){ // horizontal tears
      const {width:w,height:h,data:d}=img,src=new Uint8ClampedArray(d),seed=Math.floor(R(0,1e6));
      for(let y=0;y<h;y++){const band=Math.floor(y/p.band),on=hash(band,0,seed)<p.density;if(!on)continue;const off=Math.round((hash(band,1,seed)-.5)*2*p.amount*w*(p.wave?Math.sin(y*.05):1));
        for(let x=0;x<w;x++){const sx=((x+off)%w+w)%w,i=(y*w+x)*4,j=(y*w+sx)*4;d[i]=src[j];d[i+1]=src[j+1];d[i+2]=src[j+2]}}
      return img;
    },
    feedback(img,R,p){ // video feedback: zoom / rotate / blend, iterated
      const {width:w,height:h}=img;let cur=copy(img);const cx=w/2,cy=h/2;
      for(let it=0;it<p.iterations;it++){const s=cur.data,next=copy(cur),t=next.data,c=Math.cos(p.angle),sn=Math.sin(p.angle);
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){const dx=(x-cx)/p.zoom,dy=(y-cy)/p.zoom,sx=Math.round(cx+dx*c-dy*sn+p.drift),sy=Math.round(cy+dx*sn+dy*c);if(sx<0||sy<0||sx>=w||sy>=h)continue;
          const i=(y*w+x)*4,j=(sy*w+sx)*4;for(let k=0;k<3;k++)t[i+k]=p.mode==="max"?Math.max(t[i+k],s[j+k]*.97):t[i+k]*(1-p.mix)+s[j+k]*p.mix}
        cur=next}
      return cur;
    },
    channels(img,R,p){ // RGB offset / swap
      const {width:w,height:h,data:d}=img,src=new Uint8ClampedArray(d),order=p.order;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;for(let c=0;c<3;c++){const sx=clamp(x+p.dx*(c-1),0,w-1),sy=clamp(y+p.dy*(c-1),0,h-1);d[i+c]=src[(sy*w+sx)*4+order[c]]}}
      return img;
    },
    dct(img,R,p){ // 8×8 DCT (separable) with brutal quantization and dropped blocks
      const {width:w,height:h,data:d}=img,C=Array.from({length:8},(_,u)=>Array.from({length:8},(_,x)=>Math.cos((2*x+1)*u*Math.PI/16)*(u?Math.sqrt(2/8):Math.sqrt(1/8)))),seed=Math.floor(R(0,1e6));
      const blk=new Float32Array(64),tmp=new Float32Array(64),co=new Float32Array(64);
      for(let by=0;by+8<=h;by+=8)for(let bx=0;bx+8<=w;bx+=8)for(let c=0;c<3;c++){
        for(let y=0;y<8;y++)for(let x=0;x<8;x++)blk[y*8+x]=d[((by+y)*w+bx+x)*4+c]-128;
        for(let y=0;y<8;y++)for(let u=0;u<8;u++){let s=0;for(let x=0;x<8;x++)s+=C[u][x]*blk[y*8+x];tmp[y*8+u]=s}
        for(let v=0;v<8;v++)for(let u=0;u<8;u++){let s=0;for(let y=0;y<8;y++)s+=C[v][y]*tmp[y*8+u];const q=p.q*(1+u+v);co[v*8+u]=Math.round(s/q)*q}
        if(hash(bx,by,seed)<p.drop)for(let k=1;k<64;k++)co[k]=0;
        for(let v=0;v<8;v++)for(let x=0;x<8;x++){let s=0;for(let u=0;u<8;u++)s+=C[u][x]*co[v*8+u];tmp[v*8+x]=s}
        for(let y=0;y<8;y++)for(let x=0;x<8;x++){let s=0;for(let v=0;v<8;v++)s+=C[v][y]*tmp[v*8+x];d[((by+y)*w+bx+x)*4+c]=clamp(s+128)}}
      return img;
    },
    bitplane(img,R,p){ // one bit of luminance as the whole picture
      const {data:d}=img;for(let i=0;i<d.length;i+=4){const v=(Math.floor(lum(d,i))>>p.bit)&1?255:0;d[i]=d[i+1]=d[i+2]=v}return img;
    },
    smear(img,R,p){ // directional max / min streaks
      const {width:w,height:h,data:d}=img;
      for(let y=0;y<h;y++){let acc=[0,0,0];for(let x=0;x<w;x++){const xx=p.reverse?w-1-x:x,i=(y*w+xx)*4;for(let c=0;c<3;c++){acc[c]=p.max?Math.max(d[i+c],acc[c]*p.decay):Math.min(d[i+c],255-(255-acc[c])*p.decay);d[i+c]=acc[c]}}}
      return img;
    },
    edges(img,R,p){ // Sobel outline
      const {width:w,height:h,data:d}=img,src=new Uint8ClampedArray(d),L=(x,y)=>lum(src,(clamp(y,0,h-1)*w+clamp(x,0,w-1))*4);
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){const gx=L(x+1,y-1)+2*L(x+1,y)+L(x+1,y+1)-L(x-1,y-1)-2*L(x-1,y)-L(x-1,y+1),gy=L(x-1,y+1)+2*L(x,y+1)+L(x+1,y+1)-L(x-1,y-1)-2*L(x,y-1)-L(x+1,y-1),v=clamp(Math.hypot(gx,gy)*p.gain),i=(y*w+x)*4;d[i]=d[i+1]=d[i+2]=p.invert?255-v:v}
      return img;
    },
    mirror(img,R,p){ // kaleidoscopic fold
      const {width:w,height:h,data:d}=img;
      for(let y=0;y<h;y++)for(let x=0;x<w;x++){let sx=x,sy=y;if(p.x&&x>w/2)sx=w-1-x;if(p.y&&y>h/2)sy=h-1-y;if(sx!==x||sy!==y){const i=(y*w+x)*4,j=(sy*w+sx)*4;d[i]=d[j];d[i+1]=d[j+1];d[i+2]=d[j+2]}}
      return img;
    },
    interlace(img,R,p){ // alternate rows from a shifted copy
      const {width:w,height:h,data:d}=img,src=new Uint8ClampedArray(d);
      for(let y=0;y<h;y++){if(Math.floor(y/p.rows)%2)continue;for(let x=0;x<w;x++){const sx=clamp(x+p.shift,0,w-1),i=(y*w+x)*4,j=(clamp(y+p.dy,0,h-1)*w+sx)*4;d[i]=src[j];d[i+1]=src[j+1];d[i+2]=src[j+2]}}
      return img;
    }
  };
  const params={
    sort:R=>({vertical:R()<.5,lo:R(20,110),hi:R(150,250),reverse:R()<.4}),
    mosh:R=>({block:[8,16,16,24][Math.floor(R(0,4))],frames:Math.floor(R(2,6)),scale:R(1,4),strength:R(4,22),keep:R(.1,.5)}),
    displace:R=>({self:R()<.45,scale:R(1.5,6),amount:R(6,40),split:R(0,.6),vertical:R()<.35}),
    collage:R=>({mode:["rows","cols","grid","torn"][Math.floor(R(0,4))],pieces:Math.floor(R(3,12)),mix:R(.25,.7),shift:R(0,.4)}),
    audio:R=>({eq:["low","high","peak"][Math.floor(R(0,3))],freq:R(.002,.12),q:R(.4,6),gain:R(-12,18),comb:R()<.6?Math.floor(R(3,240)):0,feedback:R(.3,.75),echo:R()<.4?Math.floor(R(2,30)):0,bits:Math.floor(R(2,6)),hold:Math.floor(R(1,7))}),
    fft:R=>({cut:Math.floor(R(3,24)),phase:R(0,1.2),step:Math.floor(R(2,6))}),
    quantize:R=>({levels:Math.floor(R(2,6)),bleed:R(.6,1.6),right:R(.3,.9),wrap:R()<.4}),
    scanline:R=>({band:Math.floor(R(1,24)),density:R(.08,.45),amount:R(.02,.35),wave:R()<.3}),
    feedback:R=>({iterations:Math.floor(R(3,9)),zoom:R(1.01,1.09),angle:R(-.06,.06),drift:R(-3,3),mix:R(.3,.7),mode:R()<.4?"max":"mix"}),
    channels:R=>({dx:Math.floor(R(-12,12)),dy:Math.floor(R(-6,6)),order:[[0,1,2],[2,1,0],[1,0,2],[1,2,0]][Math.floor(R(0,4))]}),
    dct:R=>({q:R(6,40),drop:R(0,.35)}),
    bitplane:R=>({bit:Math.floor(R(2,7))}),
    smear:R=>({max:R()<.6,decay:R(.9,.995),reverse:R()<.5}),
    edges:R=>({gain:R(.6,2.2),invert:R()<.5}),
    mirror:R=>({x:R()<.7,y:R()<.5}),
    interlace:R=>({rows:Math.floor(R(1,6)),shift:Math.floor(R(-30,30)),dy:Math.floor(R(-4,4))})
  };
  const COST={fft:3,dct:3,mosh:2,feedback:2,sort:1.5,collage:1,audio:1,displace:1,quantize:1,scanline:.5,channels:.5,bitplane:.3,smear:.5,edges:.7,mirror:.3,interlace:.4};
  const SOURCES=["render","render","photo","photo","field","render-pair"],PRESENT=["full","full","tiles","slices","inset","pixel"];
  // The fixed catalogue: 112 distinct operator chains with a source and a
  // presentation, drawn from a master seed (no duplicate chains, bounded cost).
  const catalogue=(()=>{const R=rand(0x9e1a5e),names=Object.keys(OPS),out=[],seen=new Set();
    while(out.length<112){const n=Math.floor(R(2,5)),chain=[];let cost=0;
      for(let k=0;k<n;k++){let op=names[Math.floor(R(0,names.length))];if(chain.includes(op))continue;if(cost+COST[op]>5)continue;cost+=COST[op];chain.push(op)}
      if(chain.length<2)continue;const key=chain.join(">");if(seen.has(key))continue;seen.add(key);
      out.push({id:"glitch-"+String(out.length+1).padStart(3,"0")+"-"+chain.join("-"),chain,source:SOURCES[Math.floor(R(0,SOURCES.length))],present:PRESENT[Math.floor(R(0,PRESENT.length))],animated:R()<.45})}
    return out})();

  let renderer=null,photos=[];
  // Colour policy: grayscale / accent works are mapped onto the palette's ink
  // ramp; colour works keep the glitch's own colours, pulled towards the palette.
  function tone(img,palette,mode,R){
    const rgb=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16)),bg=rgb(palette[0]),ink=rgb(palette[1]),acc=rgb(palette[2]),d=img.data,accentAt=R(.86,.97);
    for(let i=0;i<d.length;i+=4){const t=lum(d,i)/255;
      if(mode==="color"){for(let c=0;c<3;c++)d[i+c]=d[i+c]*.75+(bg[c]*(1-t)+ink[c]*t)*.25;continue}
      const useAccent=mode==="accent"&&t>accentAt;for(let c=0;c<3;c++)d[i+c]=useAccent?acc[c]:bg[c]*(1-t)+ink[c]*t}
    return img;
  }
  function sourceImage(rule,R,ctx,w,h){
    const kind=rule.source==="photo"&&!ctx.photo()?"render":rule.source;
    const c=document.createElement("canvas");c.width=w;c.height=h;const g=c.getContext("2d",{willReadFrequently:true});
    if(kind==="photo"){const ph=ctx.photo(),s=Math.max(w/ph.width,h/ph.height);g.drawImage(ph.canvas,(w-ph.width*s)/2,(h-ph.height*s)/2,ph.width*s,ph.height*s)}
    else if(kind==="field"){const img=g.createImageData(w,h),seed=Math.floor(R(0,1e6)),sc=R(2,8);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const v=clamp((fbm(x/w*sc,y/h*sc,seed)*.5+.5)*255),i=(y*w+x)*4;img.data[i]=img.data[i+1]=img.data[i+2]=v;img.data[i+3]=255}g.putImageData(img,0,0)}
    else g.drawImage(renderer(ctx.pickFamily(R),Math.floor(R(0,4294967296))>>>0,w,h),0,0);
    if(kind==="render-pair"){g.globalCompositeOperation="difference";g.drawImage(renderer(ctx.pickFamily(R),Math.floor(R(0,4294967296))>>>0,w,h),0,0);g.globalCompositeOperation="source-over"}
    return {img:g.getImageData(0,0,w,h),kind};
  }
  // Build the bitmap for one work. The spec (rule id, seed, photo id) is all the
  // state needed to rebuild it.
  function build(spec,ctx){
    const rule=catalogue.find(r=>r.id===spec.rule);if(!rule)throw Error("Unknown experiment "+spec.rule);
    const R=rand(spec.seed),A=ctx.aspect,long=spec.size||560,w=Math.max(32,Math.round(A>=1?long:long*A)),h=Math.max(32,Math.round(A>=1?long/A:long));
    const {img:start,kind}=sourceImage(rule,R,ctx,w,h);let img=start;
    const second=(W,H)=>sourceImage({source:"render"},rand(spec.seed^0x5a5a),ctx,W,H).img;
    for(const op of rule.chain)img=OPS[op](img,R,params[op](R),{second});
    img=tone(img,ctx.palette,ctx.paletteMode,R);
    for(let i=3;i<img.data.length;i+=4)img.data[i]=255;
    const canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;canvas.getContext("2d").putImageData(img,0,0);
    return {canvas,present:rule.present,smooth:rule.present!=="pixel"&&!rule.chain.includes("dct")&&!rule.chain.includes("mosh"),sourceKind:kind,
      tiles:Math.floor(R(2,5)),slices:Math.floor(R(5,14)),sliceSeed:Math.floor(R(0,1e6))};
  }
  // Register the catalogue as families. Each family asks the engine (through
  // the raster hook) to build its bitmap; parameters come from the work seed.
  for(const rule of catalogue)DesktopFamilies.register("glitch",rule.id.replace(/^glitch-/,""),({R,raster})=>raster({rule:rule.id,seed:(Math.floor(R(0,4294967296))^Math.imul(catalogue.indexOf(rule)+1,0x9e3779b1))>>>0}),{method:"experimental raster rule: "+rule.source+" → "+rule.chain.join(" → ")+" ("+rule.present+")",complexity:"experimental",motionMode:rule.animated?"raster":"rigid"});
  // Apply a chain of operators to an existing canvas (used by the glitch
  // composition engine on a finished composition).
  function applyChain(source,chain,seed,palette,paletteMode,long=640){
    const A=source.width/source.height,w=Math.round(A>=1?long:long*A),h=Math.round(A>=1?long/A:long),c=document.createElement("canvas");c.width=w;c.height=h;
    const g=c.getContext("2d",{willReadFrequently:true});g.drawImage(source,0,0,w,h);let img=g.getImageData(0,0,w,h);const R=rand(seed);
    const second=(W,H)=>{const x=document.createElement("canvas");x.width=W;x.height=H;const xc=x.getContext("2d",{willReadFrequently:true});xc.translate(W,0);xc.scale(-1,1);xc.drawImage(source,0,0,W,H);return xc.getImageData(0,0,W,H)};
    for(const op of chain)img=OPS[op](img,R,params[op](R),{second});
    if(paletteMode!=="color")img=tone(img,palette,paletteMode,R);
    for(let i=3;i<img.data.length;i+=4)img.data[i]=255;g.putImageData(img,0,0);return c;
  }
  window.DesktopExperiments={catalogue,ops:Object.keys(OPS),build,applyChain,
    setRenderer(fn){renderer=fn},
    async setPhotos(list){
      const out=[];for(const item of list||[]){try{const im=new Image();im.src=item.url;await im.decode();const c=document.createElement("canvas"),s=Math.min(1,900/Math.max(im.naturalWidth,im.naturalHeight));c.width=Math.max(1,Math.round(im.naturalWidth*s));c.height=Math.max(1,Math.round(im.naturalHeight*s));c.getContext("2d").drawImage(im,0,0,c.width,c.height);out.push({id:String(item.id),canvas:c,width:c.width,height:c.height})}catch(e){}}
      photos=out;return photos.length},
    photos:()=>photos};
})();
