from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import argparse, json, os
root = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--bind', default='127.0.0.1')
parser.add_argument('--port', type=int, default=58791)
args = parser.parse_args()
os.chdir(root.parent / "dist")
class Handler(SimpleHTTPRequestHandler):
 def translate_path(self, path):
  files = {'/fixture.html':'fixture.html','/via-fixture.html':'via-fixture.html',
   '/assets/index--0t1wzw_.js':'fixture-bundle.js',
   '/fixture-tests.js':'fixture-tests.js','/via-test-runner.js':'via-test-runner.js'}
  clean=path.split('?')[0]
  return str(root/files[clean]) if clean in files else super().translate_path(path)
 def end_headers(self):
  self.send_header('Cache-Control','no-store');super().end_headers()
 def do_POST(self):
  if self.path!='/results':self.send_error(404);return
  n=int(self.headers.get('Content-Length','0'))
  if n>50000:self.send_error(413);return
  data=json.loads(self.rfile.read(n))
  (root/'last-browser-result.json').write_text(json.dumps(data,ensure_ascii=False,indent=2))
  self.send_response(204);self.end_headers()
ThreadingHTTPServer((args.bind,args.port),Handler).serve_forever()
