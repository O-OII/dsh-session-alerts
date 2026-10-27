"""Rounded ICO format/transparency/provenance regressions. No Windows calls.

Pillow is a pinned DEVELOPMENT dependency of the offline artwork generator;
install tools/requirements-assets.txt to regenerate or run these asset tests.
"""
from pathlib import Path
import struct
import unittest
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SCRIPT = ROOT / 'tools' / 'generate-assets.py'
NAMESPACE = {'__name__': 'asset_generator_under_test', '__file__': str(SCRIPT)}
exec(compile(SCRIPT.read_text(encoding='utf-8'), str(SCRIPT), 'exec'), NAMESPACE)


def rgba(data, index):
    size = (16,24,32,48,64)[index]
    length, offset = struct.unpack_from('<II', data, 6 + index*16 + 8)
    pixels = data[offset+40:offset+40+size*size*4]
    return Image.frombytes('RGBA',(size,size),pixels,'raw','BGRA').transpose(Image.Transpose.FLIP_TOP_BOTTOM)


class RoundedAssetTests(unittest.TestCase):
    def test_exactly_100_assets_with_five_native_size_straight_alpha_dibs(self):
        expected={f'{number}.ico' for number in range(1,100)}|{'99plus.ico'}
        folder=ROOT/'assets'/'badges'
        self.assertEqual({file.name for file in folder.iterdir()},expected)
        for name in expected:
            data=(folder/name).read_bytes()
            self.assertEqual(struct.unpack_from('<HHH',data),(0,1,5))
            previous_end=86
            for index,size in enumerate((16,24,32,48,64)):
                width,height,colors,reserved,planes,bits,length,offset=struct.unpack_from('<BBBBHHII',data,6+index*16)
                self.assertEqual((width,height,colors,reserved,planes,bits),(size,size,0,0,1,32))
                self.assertEqual(offset,previous_end)
                self.assertEqual(length,40+size*size*4+((size+31)//32)*4*size)
                self.assertEqual(struct.unpack_from('<IiiHH',data,offset),(40,size,size*2,1,32))
                previous_end=offset+length
            self.assertEqual(previous_end,len(data))

    def test_original_cubic_paths_regenerate_all_representative_assets_deterministically(self):
        for label,name in [('1','1'),('5','5'),('12','12'),('88','88'),('99+','99plus')]:
            self.assertEqual(NAMESPACE['icon'](label),(ROOT/'assets'/'badges'/f'{name}.ico').read_bytes())
        source=SCRIPT.read_text(encoding='utf-8')
        self.assertIn("('C',",source)
        self.assertNotIn('truetype',source)
        self.assertNotIn('ImageFont',source)
        self.assertFalse(list((ROOT/'tools').rglob('*.ttf')))
        self.assertFalse(list((ROOT/'tools').rglob('*.otf')))

    def test_every_size_has_transparent_corners_antialiased_edges_and_white_numerals(self):
        for name in ('1','5','12','99plus'):
            data=(ROOT/'assets'/'badges'/f'{name}.ico').read_bytes()
            for index,size in enumerate((16,24,32,48,64)):
                with self.subTest(name=name,size=size):
                    image=rgba(data,index)
                    self.assertTrue(all(image.getpixel(xy)[3]==0 for xy in ((0,0),(0,size-1),(size-1,0),(size-1,size-1))))
                    pixels=list(image.get_flattened_data())
                    self.assertTrue(any(0<p[3]<255 for p in pixels))
                    self.assertTrue(any(p[3]==255 and min(p[:3])>235 for p in pixels))
                    self.assertTrue(any(p[3]==255 and max(p[:3])<50 for p in pixels))

    def test_real_32_and_64_to_16_reductions_keep_digit_contrast_and_transparent_corners(self):
        for name in ('1','5','12','99plus'):
            data=(ROOT/'assets'/'badges'/f'{name}.ico').read_bytes()
            for index in (2,4):
                reduced=rgba(data,index).resize((16,16),Image.Resampling.LANCZOS)
                self.assertEqual(reduced.getpixel((0,0))[3],0)
                white=sum(p[3]>180 and min(p[:3])>190 for p in reduced.get_flattened_data())
                dark=sum(p[3]>180 and max(p[:3])<70 for p in reduced.get_flattened_data())
                self.assertGreaterEqual(white,8,(name,index,'lost numeral strokes'))
                self.assertGreaterEqual(dark,35,(name,index,'lost dark counters/background'))

    def test_runtime_helper_does_not_gain_pillow_or_font_dependency(self):
        source=(ROOT/'native.py').read_text(encoding='utf-8')
        for forbidden in ('from PIL','import PIL','ImageFont','truetype'):
            self.assertNotIn(forbidden,source)


if __name__=='__main__':unittest.main()
