"""Guard the standalone entrypoints against a partial frontend whitelist update."""
import re
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parent.parent
TARGETS = ['src/core/main.js', 'src/extension/panel.js',
           'src/userscript/bootstrap.js', 'src/userscript/panel.js']


class WhitelistTests(unittest.TestCase):
    def test_all_standalone_entrypoints_allow_the_same_builds(self):
        expected = None
        for rel in TARGETS:
            with self.subTest(file=rel):
                match = re.search(r'BUILDS\s*=\s*new\s+Set\s*\(\s*\[([^\]]*)\]', (ROOT / rel).read_text())
                self.assertIsNotNone(match)
                assets = re.findall(r"'(/assets/index-[\w-]+\.js)'", match.group(1))
                self.assertTrue(assets)
                self.assertEqual(len(assets), len(set(assets)), 'duplicate build')
                if expected is None:
                    expected = set(assets)
                self.assertEqual(set(assets), expected)


if __name__ == '__main__':
    unittest.main()
