"""Local bare-remotes exercise recovery without contacting or mutating GitHub."""
import json
import importlib.util
import contextlib
import io
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parent.parent
GENERATED = ['.github/upstream-state.json', 'src/core/main.js', 'src/extension/panel.js',
             'src/userscript/bootstrap.js', 'src/userscript/panel.js']
A = '/assets/index-A.js'
B = '/assets/index-B.js'


class BranchRecoveryTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.remote = self.root / 'remote.git'
        self.repo = self.root / 'repo'
        self.run_cmd(['git', 'init', '--bare', str(self.remote)], self.root)
        self.repo.mkdir()
        self.git('init', '-b', 'main')
        self.git('config', 'user.name', 'Fixture')
        self.git('config', 'user.email', 'fixture@example.invalid')
        self.git('remote', 'add', 'origin', str(self.remote))
        for rel in GENERATED:
            p = self.repo / rel
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text('{}\n' if rel.endswith('.json') else "const BUILDS = new Set([]);\n")
        (self.repo / 'ci').mkdir()
        shutil.copy(ROOT / 'ci/prepare_branch.py', self.repo / 'ci')
        shutil.copy(ROOT / 'ci/persist_state.sh', self.repo / 'ci')
        shutil.copy(ROOT / 'ci/check_upstream.py', self.repo / 'ci')
        shutil.copy(ROOT / 'ci/contract.json', self.repo / 'ci')
        self.state({'0.1.0': None})
        self.commit('base')
        self.git('push', '-u', 'origin', 'main')

    def run_cmd(self, args, cwd=None, **kwargs):
        return subprocess.run(args, cwd=cwd or self.repo, text=True,
                              stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True, **kwargs)

    def git(self, *args):
        return self.run_cmd(['git', *args]).stdout.strip()

    def commit(self, message):
        self.git('add', '.')
        self.git('commit', '-m', message)

    def state(self, versions):
        (self.repo / GENERATED[0]).write_text(json.dumps({'versions': versions}) + '\n')

    def prepare(self, items):
        env = dict(os.environ, NEW_OK=json.dumps(items))
        self.run_cmd(['python3', 'ci/prepare_branch.py'], env=env)

    def test_known_asset_reuse_refreshes_comment_without_adaptation(self):
        self.state({'0.33.0': A, '0.42.0': A})
        for rel in GENERATED[1:]:
            (self.repo / rel).write_text("// Known frontend builds: Kimi Web bundles shipped with kimi-code CLI 0.33.0–0.41.0.\nconst BUILDS = new Set(['/assets/index-A.js']);\n")
        spec = importlib.util.spec_from_file_location('fixture_upstream', self.repo / 'ci/check_upstream.py')
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with contextlib.redirect_stdout(io.StringIO()):
            module.refresh_comment()
        for rel in GENERATED[1:]:
            self.assertIn('0.33.0–0.42.0.', (self.repo / rel).read_text())
        (self.repo / GENERATED[0]).write_text('invalid JSON')
        err = io.StringIO()
        with contextlib.redirect_stderr(err):
            module.refresh_comment()
        self.assertIn('警告', err.getvalue())

    def test_new_branch_preserves_detection(self):
        self.state({'0.1.0': None, '0.2.0': A})
        self.prepare([{'asset': A, 'versions': ['0.2.0']}])
        self.assertEqual(self.git('branch', '--show-current'), 'bot/frontend-index-A')
        self.assertIn('0.2.0', json.loads((self.repo / GENERATED[0]).read_text())['versions'])

    def test_recovery_keeps_new_state_old_work_and_current_base_with_narrow_fetch(self):
        self.git('checkout', '-b', 'bot/frontend-index-A')
        self.state({'0.1.0': None, '0.2.0': A})
        (self.repo / 'manual.txt').write_text('existing branch work\n')
        self.commit('previous adaptation')
        self.git('push', 'origin', 'HEAD')
        self.git('checkout', 'main')
        self.git('branch', '-D', 'bot/frontend-index-A')
        self.git('update-ref', '-d', 'refs/remotes/origin/bot/frontend-index-A')
        self.git('config', 'remote.origin.fetch', '+refs/heads/main:refs/remotes/origin/main')
        (self.repo / 'current-base.txt').write_text('new main change\n')
        self.commit('base advanced')
        self.state({'0.1.0': None, '0.2.0': A, '0.2.1': A, '0.3.0': B})
        self.prepare([{'asset': A, 'versions': ['0.2.0', '0.2.1']}, {'asset': B, 'versions': ['0.3.0']}])
        self.assertEqual(json.loads((self.repo / GENERATED[0]).read_text())['versions']['0.3.0'], B)
        self.assertIn('0.2.1', json.loads((self.repo / GENERATED[0]).read_text())['versions'])
        self.assertTrue((self.repo / 'manual.txt').exists())
        self.assertTrue((self.repo / 'current-base.txt').exists())
        self.assertEqual(self.git('branch', '--show-current'), 'bot/frontend-index-A')

    def test_persist_commits_dirty_state_before_rebase_and_is_idempotent(self):
        self.state({'0.1.0': None, '0.2.0': A})
        (self.repo / GENERATED[1]).write_text('// refreshed version range\n')
        self.run_cmd(['bash', 'ci/persist_state.sh'])
        tip = self.git('rev-parse', 'HEAD')
        self.assertEqual(self.git('status', '--porcelain'), '')
        self.assertEqual(self.git('rev-parse', 'origin/main'), tip)
        self.run_cmd(['bash', 'ci/persist_state.sh'])
        self.assertEqual(self.git('rev-parse', 'HEAD'), tip)


if __name__ == '__main__':
    unittest.main()
