"""Original geometric application mark; no external artwork or image dependency."""
from pathlib import Path
import struct,zlib
root=Path(__file__).resolve().parent.parent/'assets'
root.mkdir(exist_ok=True)
def png(n):
    rows=[]
    for y in range(n):
        row=bytearray()
        for x in range(n):
            u,v=x/n,y/n
            edge=(.18<u<.82 and (.18<v<.205 or .795<v<.82)) or (.18<v<.82 and (.18<u<.205 or .795<u<.82))
            lines=any(abs(v-(.32+k*.07+.08*(u-.5)))<.009 and .28<u<.72 for k in range(6))
            c=240 if edge or lines else 17
            row.extend([c,c,c,255])
        rows.append(b'\0'+row)
    def chunk(t,d): return struct.pack('>I',len(d))+t+d+struct.pack('>I',zlib.crc32(t+d)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',n,n,8,6,0,0,0))+chunk(b'IDAT',zlib.compress(b''.join(rows),9))+chunk(b'IEND',b'')
(root/'icon.png').write_bytes(png(512))
images=[(n,png(n)) for n in [16,32,48,64,128,256]]
header=struct.pack('<HHH',0,1,len(images));offset=6+16*len(images);entries=b'';data=b''
for n,p in images:
    entries+=struct.pack('<BBBBHHII',n%256,n%256,0,0,1,32,len(p),offset);data+=p;offset+=len(p)
(root/'icon.ico').write_bytes(header+entries+data)
iconset=root/'AppIcon.iconset';iconset.mkdir(exist_ok=True)
for n in [16,32,128,256,512]:
    for scale in [1,2]: (iconset/('icon_%dx%d%s.png'%(n,n,'@2x' if scale==2 else ''))).write_bytes(png(n*scale))
