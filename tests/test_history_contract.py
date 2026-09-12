"""The downloaded bundle must satisfy the new API before it is allowlisted."""
import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location('upstream_contract', ROOT / 'ci/check_upstream.py')
upstream = importlib.util.module_from_spec(spec)
spec.loader.exec_module(upstream)


class HistoryContractTests(unittest.TestCase):
    BASE = '"3.5.39"\n' + '\n'.join(
        marker for values in upstream.CONTRACT['identifiers'].values() for marker in values)
    HW = '''const F=Symbol.for("v-fgt");
const C=defineComponent({__name:"HistoryWindow",props:{items:{},itemKey:{},enabled:{type:Boolean,default:!1}},setup(e){
return (ctx)=>e.enabled?nativeRender():(b(!0),N(F,{key:0},St(e.items,(item,index)=>slot(ctx.$slots,"default",{key:e.itemKey(item,index),item,index})),128))}});'''

    def check(self, code):
        return upstream.contract_check(self.BASE + '\n' + code)[0]

    def test_legacy_without_history_window_remains_supported(self):
        self.assertEqual(self.check(''), [])

    def test_disabled_keyed_slot_fragment_contract_is_supported(self):
        self.assertEqual(self.check(self.HW), [])
        self.assertEqual(self.check(self.HW.replace(',', ',\n').replace(':', ': ')), [])

    def test_each_required_prop_is_hard_failure_even_with_all_old_markers(self):
        for prop in ['items', 'itemKey', 'enabled']:
            with self.subTest(prop=prop):
                changed = self.HW.replace(prop + ':', 'renamed:', 1)
                self.assertIn('HistoryWindow:' + prop, self.check(changed))

    def test_missing_component_with_new_chat_props_is_rejected(self):
        self.assertIn('HistoryWindow:component', self.check('windowHistory renderAllHistory'))

    def test_changed_disabled_topology_is_rejected(self):
        self.assertIn('HistoryWindow:keyed-slot-fragment', self.check(self.HW.replace('N(F,', 'N("div",')))
        self.assertIn('HistoryWindow:keyed-slot-fragment', self.check(self.HW.replace('key:e.itemKey(', 'key:e.otherKey(')))

    def test_enabled_branch_is_required(self):
        self.assertIn('HistoryWindow:enabled-branch', self.check(self.HW.replace('e.enabled?', 'e.otherFlag?')))

    def test_unrelated_component_cannot_supply_missing_props(self):
        decoy = ',{__name:"Unrelated",props:{items:{},itemKey:{},enabled:{}},setup(){}}'
        self.assertIn('HistoryWindow:items', self.check(self.HW.replace('items:{}', 'entries:{}') + decoy))


if __name__ == '__main__':
    unittest.main()
