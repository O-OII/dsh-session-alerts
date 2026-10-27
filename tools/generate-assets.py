"""Generate original rounded-vector numeric badges (no font files).

Development only: Pillow renders our cubic paths at 8x and downsamples with
LANCZOS. The Windows runtime helper still uses only Python's standard library.
Every ICO contains 16/24/32/48/64px straight-alpha, 32-bit BGRA DIB images.
"""
import argparse
from functools import lru_cache
from pathlib import Path
import struct
from PIL import Image, ImageDraw

SIZES = (16, 24, 32, 48, 64)
SUPERSAMPLE = 8
STROKE = 14.0
# Independently authored coordinates on a 64 x 100 design grid. M starts a
# stroke, L adds a line, C is a cubic Bezier. Rounded caps/joins are ours too.
PATHS = {
 '0': [('M',32,4),('C',9,4,5,22,5,50),('C',5,78,9,96,32,96),('C',55,96,59,78,59,50),('C',59,22,55,4,32,4)],
 '1': [('M',17,23),('L',35,5),('L',35,96)],
 '2': [('M',6,22),('C',13,-1,47,-2,57,18),('C',72,47,13,66,6,95),('L',58,95)],
 '3': [('M',7,9),('C',26,-2,57,0,57,24),('C',57,42,45,49,26,49),('M',26,49),('C',51,45,64,61,57,81),('C',49,102,22,104,6,90)],
 '4': [('M',48,96),('L',48,5),('L',5,66),('L',61,66)],
 '5': [('M',56,5),('L',10,5),('L',7,46),('C',26,35,56,41,58,65),('C',63,96,30,109,6,90)],
 '6': [('M',53,8),('C',29,-5,5,17,5,55),('C',3,107,62,109,59,66),('C',57,33,15,34,6,61)],
 '7': [('M',5,5),('L',60,5),('L',22,96)],
 '8': [('M',32,48),('C',6,45,0,5,32,4),('C',64,5,58,45,32,48),('C',-6,52,-2,98,32,97),('C',66,98,70,52,32,48)],
 '9': [('M',11,92),('C',35,105,59,83,59,45),('C',61,-7,2,-9,5,34),('C',7,67,49,66,58,39)],
 '+': [('M',32,24),('L',32,77),('M',7,50),('L',57,50)],
}

@lru_cache(maxsize=None)
def strokes(character):
    """Flatten our cubics deterministically; no third-party glyph outlines."""
    result, current = [], []
    for command in PATHS[character]:
        if command[0] == 'M':
            if current: result.append(current)
            current = [(command[1], command[2])]
        elif command[0] == 'L':
            current.append((command[1], command[2]))
        else:
            x0,y0 = current[-1]
            x1,y1,x2,y2,x3,y3 = command[1:]
            for index in range(1, 33):
                t=index/32; u=1-t
                current.append((u*u*u*x0+3*u*u*t*x1+3*u*t*t*x2+t*t*t*x3,
                                u*u*u*y0+3*u*u*t*y1+3*u*t*t*y2+t*t*t*y3))
    if current: result.append(current)
    return result


def render(label, size):
    """Independently rasterize each native size; never resize a cached large ICO."""
    if label not in {str(n) for n in range(1,100)} | {'99+'}: raise ValueError('Expected 1..99 or 99+')
    scale=SUPERSAMPLE
    canvas=Image.new('RGBA',(size*scale,size*scale))
    draw=ImageDraw.Draw(canvas)
    if len(label)==1:
        box=(size*.035,size*.035,size*.965,size*.965)
        radius=size*.465
        height=size*.65
    else:
        box=(size*.015,size*.105,size*.985,size*.895)
        radius=size*.395
        height=size*(.59 if len(label)==2 else .55)
    bounds=tuple(round(v*scale) for v in box)
    # A narrow neutral keyline keeps the dark silhouette visible on dark shells.
    draw.rounded_rectangle(bounds,radius=round(radius*scale),fill=(29,30,33,255),
                           outline=(191,194,199,255),width=max(1,round(size*.022*scale)))
    gap=13
    total_width=len(label)*64+(len(label)-1)*gap
    sy=height/100
    sx=min(sy,(size*.78)/(total_width+STROKE))
    # Optical centre uses actual stroke bounds, including the narrow '1'.
    geometry=[]
    for index,char in enumerate(label):
        for stroke in strokes(char):
            geometry.append([(x+index*(64+gap),y) for x,y in stroke])
    xs=[x for stroke in geometry for x,y in stroke]
    ys=[y for stroke in geometry for x,y in stroke]
    left=(size-(max(xs)-min(xs))*sx)/2-min(xs)*sx
    top=(size-(max(ys)-min(ys))*sy)/2-min(ys)*sy
    # Render on a separate transparent plane so x-compression remains coherent:
    # rounded ends are ellipses after fitting, not square joins or pixel recipes.
    width=max(1,round(STROKE*min(sx,sy)*scale))
    for stroke in geometry:
        points=[((left+x*sx)*scale,(top+y*sy)*scale) for x,y in stroke]
        draw.line(points,fill=(255,255,255,255),width=width,joint='curve')
        radius_cap=width/2
        for x,y in points:
            draw.ellipse((round(x-radius_cap),round(y-radius_cap),round(x+radius_cap),round(y+radius_cap)),fill=(255,255,255,255))
    return canvas.resize((size,size),Image.Resampling.LANCZOS)


def bitmap(label,size):
    image=render(label,size)
    pixels=image.transpose(Image.Transpose.FLIP_TOP_BOTTOM).tobytes('raw','BGRA')
    stride=((size+31)//32)*4
    mask=bytearray(stride*size)
    for row in range(size):
        for x in range(size):
            if pixels[(row*size+x)*4+3]==0: mask[row*stride+x//8]|=1<<(7-x%8)
    header=struct.pack('<IiiHHIIiiII',40,size,size*2,1,32,0,len(pixels),0,0,0,0)
    return header+pixels+mask


def icon(label):
    entries=[bitmap(label,size) for size in SIZES]
    offset=6+len(entries)*16
    directory=bytearray(struct.pack('<HHH',0,1,len(entries)))
    for size,data in zip(SIZES,entries):
        directory.extend(struct.pack('<BBBBHHII',size,size,0,0,1,32,len(data),offset));offset+=len(data)
    return directory+b''.join(entries)


def preview(path):
    """Developer comparison, NOT a Windows screenshot; actual 16px cells included."""
    labels=('1','5','12','99+')
    image=Image.new('RGB',(560,210),'#e8ebef');draw=ImageDraw.Draw(image)
    draw.text((12,8),'Original rounded vectors | not a Windows screenshot',fill='#20242b')
    for col,label in enumerate(labels):
        x=20+col*136
        draw.text((x,32),label,fill='#20242b')
        for row,(size,reduction) in enumerate(((64,False),(16,False),(32,True))):
            badge=render(label,size)
            if reduction:badge=badge.resize((16,16),Image.Resampling.LANCZOS)
            y=(53,132,170)[row]
            for shift,bg in ((0,'#ffffff'),(64,'#33363c')):
                draw.rectangle((x+shift-4,y-4,x+shift+badge.width+4,y+badge.height+4),fill=bg)
                image.paste(badge,(x+shift,y),badge)
    image.save(path)


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output',type=Path,default=Path(__file__).resolve().parents[1]/'assets'/'badges')
    parser.add_argument('--candidate',action='store_true',help='Generate only 1/5/12/99+ for manual comparison')
    parser.add_argument('--preview',type=Path)
    args=parser.parse_args();args.output.mkdir(parents=True,exist_ok=True)
    values=[1,5,12,'99plus'] if args.candidate else [*range(1,100),'99plus']
    for value in values:
        (args.output/f'{value}.ico').write_bytes(icon('99+' if value=='99plus' else str(value)))
    if args.preview:args.preview.parent.mkdir(parents=True,exist_ok=True);preview(args.preview)
    print(f'Generated {len(values)} original rounded-vector ICOs with 5 native sizes; no desktop operations.')

if __name__=='__main__':main()
