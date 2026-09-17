import json
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parent.parent
VERSION=json.loads((ROOT/'project.json').read_text())['version']

class DistributionTests(unittest.TestCase):
 def test_metadata_and_script_versions_agree(self):
  meta=(ROOT/'dist/kimi-lazy.meta.js').read_text()
  script=(ROOT/'dist/kimi-lazy.user.js').read_text()
  self.assertTrue(script.startswith(meta))
  self.assertIn(f'// @version      {VERSION}\n',meta)
  self.assertIn('/releases/latest/download/kimi-lazy.user.js',meta)
 def test_checksums_cover_all_artifacts(self):
  sums=(ROOT/'dist/SHA256SUMS').read_text().splitlines()
  self.assertEqual(sorted(line.split('  ',1)[1] for line in sums),['kimi-lazy.meta.js','kimi-lazy.user.js'])
  import hashlib
  for line in sums:
   digest,name=line.split('  ',1)
   self.assertEqual(hashlib.sha256((ROOT/'dist'/name).read_bytes()).hexdigest(),digest)
