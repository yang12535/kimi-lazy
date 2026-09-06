import io
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import zipfile

ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'scripts'))
from verify_crx import verify
VERSION=json.loads((ROOT/'project.json').read_text())['version']
CRX=ROOT/'dist'/f'kimi-lazy-{VERSION}.crx'

class DistributionTests(unittest.TestCase):
 def test_zip_has_runtime_files_only(self):
  with zipfile.ZipFile(ROOT/'dist'/f'kimi-lazy-{VERSION}-extension.zip') as z:
   self.assertEqual(set(z.namelist()),{'manifest.json','main.js','policy.js','panel.js'})
   self.assertEqual(json.loads(z.read('manifest.json'))['version'],VERSION)
   self.assertIsNone(z.testzip())
 def test_metadata_and_script_versions_agree(self):
  meta=(ROOT/'dist/kimi-lazy.meta.js').read_text()
  script=(ROOT/'dist/kimi-lazy.user.js').read_text()
  self.assertTrue(script.startswith(meta))
  self.assertIn(f'// @version      {VERSION}\n',meta)
  self.assertIn('/releases/latest/download/kimi-lazy.user.js',meta)
 @unittest.skipUnless(CRX.exists(),'signed CRX not built')
 def test_chrome_signature_and_id(self):
  report=verify(CRX)
  self.assertEqual(report['version'],VERSION)
  self.assertEqual(report['extension_id'],(ROOT/'dist/extension-id.txt').read_text().strip())
 @unittest.skipUnless(CRX.exists(),'signed CRX not built')
 def test_archive_tampering_is_rejected(self):
  data=bytearray(CRX.read_bytes());data[-1]^=1
  with tempfile.TemporaryDirectory() as temp:
   p=Path(temp)/'tampered.crx';p.write_bytes(data)
   with self.assertRaises(subprocess.CalledProcessError): verify(p)
