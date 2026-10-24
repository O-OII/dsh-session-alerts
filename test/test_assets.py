"""Original ICO format/provenance regressions, no Windows calls or font dependency."""
from pathlib import Path
import struct
import unittest

ROOT = Path(__file__).resolve().parent.parent


class OriginalAssetTests(unittest.TestCase):
    def test_exactly_100_number_assets_with_five_valid_dib_entries(self):
        expected = {f'{number}.ico' for number in range(1, 100)} | {'99plus.ico'}
        folder = ROOT / 'assets' / 'badges'
        self.assertEqual({file.name for file in folder.iterdir()}, expected)
        for name in expected:
            data = (folder / name).read_bytes()
            self.assertEqual(struct.unpack_from('<HHH', data), (0, 1, 5))
            for index, size in enumerate((16, 24, 32, 48, 64)):
                width, height, colors, reserved, planes, bits, length, offset = struct.unpack_from('<BBBBHHII', data, 6 + index * 16)
                self.assertEqual((width, height, planes, bits), (size, size, 1, 32))
                self.assertLessEqual(offset + length, len(data))
                self.assertEqual(struct.unpack_from('<IiiHH', data, offset), (40, size, size * 2, 1, 32))

    def test_regeneration_is_deterministic_and_font_free(self):
        script = ROOT / 'tools' / 'generate-assets.py'
        source = script.read_text(encoding='utf-8')
        namespace = {'__name__': 'asset_generator_under_test', '__file__': str(script)}
        exec(compile(source, str(script), 'exec'), namespace)
        for label, filename in (('1', '1.ico'), ('99+', '99plus.ico')):
            self.assertEqual(namespace['icon'](label), (ROOT / 'assets' / 'badges' / filename).read_bytes())
        self.assertNotIn('from PIL', source)
        self.assertNotIn('truetype', source)


if __name__ == '__main__':
    unittest.main()
