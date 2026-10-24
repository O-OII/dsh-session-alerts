"""Native helper regression tests: fake Taskbar/Win32 methods, no real windows.

Run without bytecode writes:
  python -B -m unittest discover -s test -p test_native.py -v
"""
import io
import os
from pathlib import Path
import queue
import sys
import types
import unittest
from unittest.mock import Mock, patch
import uuid


NATIVE_PATH = Path(__file__).resolve().parent.parent / 'native.py'
EMPTY = object()


def load_native():
    # Executing definitions does not instantiate Taskbar. Avoid importing a
    # local module, so this suite creates no native.py __pycache__ files either.
    namespace = {'__name__': 'native_under_test', '__file__': str(NATIVE_PATH)}
    exec(compile(NATIVE_PATH.read_text(encoding='utf-8'), str(NATIVE_PATH), 'exec'), namespace)
    return namespace


class FakeTaskbar:
    def __init__(self, focused=False, last_count=0, topologies=None, fail_calls=()):
        self.is_focused = focused
        self.last_count = last_count
        self.topologies = list(topologies or [('stable',)])
        self.topology_index = 0
        self.fail_calls = set(fail_calls)
        self.set_calls = []
        self.closed = False

    def focused(self):
        return self.is_focused

    def windows(self):
        return [123]

    def topology(self):
        index = min(self.topology_index, len(self.topologies) - 1)
        self.topology_index += 1
        return self.topologies[index]

    def set_count(self, count):
        self.set_calls.append(count)
        self.last_count = count
        if len(self.set_calls) in self.fail_calls:
            raise OSError('transient Explorer not ready')
        return {'type': 'applied', 'count': count, 'visible': True, 'hwnd': 123}

    def close(self):
        self.closed = True


class NativeWorkerTests(unittest.TestCase):
    def run_scripted(self, taskbar, commands):
        namespace = load_native()
        events = []
        clock = types.SimpleNamespace(now=0)
        items = iter(commands)

        class ScriptedQueue:
            def put(self, item):
                raise AssertionError('Reader thread must stay inert in scripted tests')

            def get(self, timeout):
                clock.now += 1
                try:
                    item = next(items)
                except StopIteration:
                    raise AssertionError('Script did not terminate worker')
                if callable(item):
                    item = item()
                if item is EMPTY:
                    raise queue.Empty()
                return item

        class InertThread:
            def __init__(self, *args, **kwargs):
                pass

            def start(self):
                pass

        namespace['queue'] = types.SimpleNamespace(Queue=ScriptedQueue, Empty=queue.Empty)
        namespace['threading'] = types.SimpleNamespace(Thread=InertThread)
        namespace['time'] = types.SimpleNamespace(monotonic=lambda: clock.now)
        namespace['emit'] = events.append
        namespace['worker'](taskbar)
        return events

    def run_stdin(self, taskbar, text):
        namespace = load_native()
        events = []

        class EagerThread:
            def __init__(self, target, daemon):
                self.target = target

            def start(self):
                self.target()

        namespace['threading'] = types.SimpleNamespace(Thread=EagerThread)
        namespace['sys'] = types.SimpleNamespace(stdin=io.StringIO(text))
        namespace['time'] = types.SimpleNamespace(monotonic=lambda: 0)
        namespace['emit'] = events.append
        namespace['worker'](taskbar)
        return events

    def test_topology_recovery_retries_after_transient_overlay_failure(self):
        taskbar = FakeTaskbar(topologies=[('old',), ('new',), ('new',)], fail_calls={2})
        events = self.run_scripted(taskbar, [
            {'type': 'set', 'count': 1}, EMPTY, EMPTY, EMPTY,
            EMPTY, EMPTY, {'type': 'quit'},
        ])
        # set 1 initially; topology changes and fails; same topology retries
        # successfully; later stable checks do not redraw unnecessarily.
        self.assertEqual(taskbar.set_calls, [1, 1, 1])
        self.assertEqual([event['type'] for event in events], ['ready', 'applied', 'error', 'applied'])
        self.assertEqual(events[-1]['count'], 1)

    def test_focus_clear_failure_still_emits_focus_to_clear_parent_state(self):
        taskbar = FakeTaskbar(last_count=4, fail_calls={1})

        def focus_now():
            taskbar.is_focused = True
            return EMPTY

        events = self.run_scripted(taskbar, [focus_now, {'type': 'quit'}])
        self.assertEqual(taskbar.set_calls, [0])
        self.assertEqual([event['type'] for event in events], ['ready', 'error', 'focus'])
        self.assertEqual(events[-1], {'type': 'focus', 'focused': True})

    def test_foreground_suppresses_set_independent_of_parent_latency(self):
        taskbar = FakeTaskbar(focused=True)
        events = self.run_scripted(taskbar, [{'type': 'set', 'count': 7}, {'type': 'quit'}])
        self.assertEqual(taskbar.set_calls, [0])
        self.assertTrue(events[0]['focused'])
        self.assertEqual(events[-1]['count'], 0)

    def test_preview_is_explicit_opt_in_to_bypass_focus_for_a_probe(self):
        taskbar = FakeTaskbar(focused=True)
        self.run_scripted(taskbar, [{'type': 'set', 'count': 7, 'preview': True}, {'type': 'quit'}])
        self.assertEqual(taskbar.set_calls, [7])

    def test_background_transition_reports_focus_without_replaying_any_count(self):
        taskbar = FakeTaskbar(focused=True)

        def blur_now():
            taskbar.is_focused = False
            return EMPTY

        events = self.run_scripted(taskbar, [blur_now, {'type': 'quit'}])
        self.assertEqual(taskbar.set_calls, [])
        self.assertEqual(events[-1], {'type': 'focus', 'focused': False})

    def test_bad_count_reports_error_and_worker_processes_next_valid_command(self):
        taskbar = FakeTaskbar()
        events = self.run_scripted(taskbar, [
            {'type': 'set', 'count': 'not-a-number'}, {'type': 'set', 'count': 3}, {'type': 'quit'},
        ])
        self.assertEqual(taskbar.set_calls, [3])
        self.assertEqual([event['type'] for event in events], ['ready', 'error', 'applied'])

    def test_no_unread_count_does_not_draw_on_shell_topology_change(self):
        taskbar = FakeTaskbar(topologies=[('old',), ('new',)])
        events = self.run_scripted(taskbar, [EMPTY, EMPTY, EMPTY, EMPTY, {'type': 'quit'}])
        self.assertEqual(taskbar.set_calls, [])
        self.assertEqual([event['type'] for event in events], ['ready'])

    def test_stdin_eof_quits_worker_without_any_real_window_operation(self):
        taskbar = FakeTaskbar()
        events = self.run_stdin(taskbar, '')
        self.assertEqual(taskbar.set_calls, [])
        self.assertEqual([event['type'] for event in events], ['ready'])

    def test_stdin_valid_command_then_eof_applies_once_and_exits(self):
        taskbar = FakeTaskbar()
        events = self.run_stdin(taskbar, '{"type":"set","count":2}\n')
        self.assertEqual(taskbar.set_calls, [2])
        self.assertEqual([event['type'] for event in events], ['ready', 'applied'])

    def test_stdin_bad_json_oversized_and_non_object_messages_are_ignored(self):
        taskbar = FakeTaskbar()
        text = 'bad json\n' + ('x' * 5000) + '\n[]\n42\n{"type":"unknown"}\n{"type":"set","count":5}\n'
        events = self.run_stdin(taskbar, text)
        self.assertEqual(taskbar.set_calls, [5])
        self.assertEqual([event['type'] for event in events], ['ready', 'applied'])

    def test_stdin_explicit_quit_does_not_execute_later_queued_commands(self):
        taskbar = FakeTaskbar()
        self.run_stdin(taskbar, '{"type":"quit"}\n{"type":"set","count":99}\n')
        self.assertEqual(taskbar.set_calls, [])


class NativeTaskbarTests(unittest.TestCase):
    def fake_native(self, windows=(123,), result=0):
        namespace = load_native()
        taskbar = namespace['Taskbar'].__new__(namespace['Taskbar'])
        taskbar.executable = os.path.normcase(os.path.realpath('safe-dsh.exe'))
        taskbar.assets = Path('fake-assets')
        taskbar.obj = object()
        taskbar.window = None
        taskbar.last_count = 0
        taskbar.windows = Mock(return_value=list(windows))
        taskbar._set = Mock(return_value=result)
        taskbar._release = Mock()
        taskbar.user = types.SimpleNamespace(
            LoadImageW=Mock(return_value=456), DestroyIcon=Mock(), IsWindow=Mock(return_value=True),
        )
        taskbar.ole = types.SimpleNamespace(CoUninitialize=Mock())
        taskbar.process_path = Mock(return_value=taskbar.executable)
        return namespace, taskbar

    def test_guid_parse_matches_windows_little_endian_guid_bytes(self):
        namespace = load_native()
        value = 'EA1AFB91-9E28-4B86-90E9-9E9F8A5EEFAF'
        guid = namespace['GUID'].parse(value)
        self.assertEqual(bytes(guid), uuid.UUID(value).bytes_le)

    def test_exact_count_draws_icon_and_always_destroys_loaded_icon(self):
        _, taskbar = self.fake_native()
        result = taskbar.set_count(42)
        self.assertTrue(result['visible'])
        self.assertEqual(result['count'], 42)
        self.assertEqual(Path(taskbar.user.LoadImageW.call_args.args[1]).name, '42.ico')
        self.assertEqual(taskbar._set.call_args.args[1:3], (123, 456))
        taskbar.user.DestroyIcon.assert_called_once_with(456)

    def test_zero_clears_overlay_without_loading_or_destroying_an_icon(self):
        _, taskbar = self.fake_native()
        result = taskbar.set_count(0)
        self.assertEqual(result['count'], 0)
        self.assertEqual(taskbar._set.call_args.args[1:4], (123, None, ''))
        taskbar.user.LoadImageW.assert_not_called()
        taskbar.user.DestroyIcon.assert_not_called()

    def test_count_is_clamped_and_over_99_uses_99plus_asset(self):
        _, taskbar = self.fake_native()
        self.assertEqual(taskbar.set_count(-50)['count'], 0)
        self.assertEqual(taskbar.set_count(10000)['count'], 999)
        self.assertEqual(Path(taskbar.user.LoadImageW.call_args.args[1]).name, '99plus.ico')
        self.assertEqual(taskbar.last_count, 999)

    def test_no_visible_target_keeps_desired_count_without_calling_overlay(self):
        _, taskbar = self.fake_native(windows=())
        result = taskbar.set_count(4)
        self.assertFalse(result['visible'])
        self.assertEqual(result['reason'], 'no-taskbar-window')
        self.assertEqual(taskbar.last_count, 4)
        taskbar._set.assert_not_called()
        taskbar.user.LoadImageW.assert_not_called()

    def test_ambiguous_windows_refuse_overlay_and_keep_desired_count_for_retry(self):
        _, taskbar = self.fake_native(windows=(123, 456))
        with self.assertRaisesRegex(RuntimeError, 'Multiple DSH windows'):
            taskbar.set_count(9)
        self.assertEqual(taskbar.last_count, 9)
        taskbar._set.assert_not_called()
        taskbar.user.LoadImageW.assert_not_called()

    def test_failed_hresult_destroys_icon_and_exposes_error(self):
        _, taskbar = self.fake_native(result=-1)
        with self.assertRaisesRegex(OSError, 'SetOverlayIcon failed'):
            taskbar.set_count(7)
        taskbar.user.DestroyIcon.assert_called_once_with(456)
        self.assertEqual(taskbar.last_count, 7)

    def test_load_error_never_attempts_overlay_or_destroys_unloaded_icon(self):
        _, taskbar = self.fake_native()
        taskbar.user.LoadImageW.side_effect = OSError('fake icon load failure')
        with self.assertRaisesRegex(OSError, 'fake icon load failure'):
            taskbar.set_count(7)
        taskbar._set.assert_not_called()
        taskbar.user.DestroyIcon.assert_not_called()

    def test_close_revalidates_executable_before_clearing_existing_window(self):
        _, taskbar = self.fake_native()
        taskbar.window = 123
        taskbar.close()
        taskbar.process_path.assert_called_once_with(123)
        taskbar._set.assert_called_once_with(taskbar.obj, 123, None, '')
        taskbar._release.assert_called_once_with(taskbar.obj)
        taskbar.ole.CoUninitialize.assert_called_once()

    def test_close_does_not_clear_foreign_recycled_hwnd_but_releases_com(self):
        _, taskbar = self.fake_native()
        taskbar.window = 123
        taskbar.process_path.return_value = 'foreign.exe'
        taskbar.close()
        taskbar._set.assert_not_called()
        taskbar._release.assert_called_once_with(taskbar.obj)
        taskbar.ole.CoUninitialize.assert_called_once()

    def test_close_does_not_query_or_clear_destroyed_window(self):
        _, taskbar = self.fake_native()
        taskbar.window = 123
        taskbar.user.IsWindow.return_value = False
        taskbar.close()
        taskbar.process_path.assert_not_called()
        taskbar._set.assert_not_called()
        taskbar._release.assert_called_once_with(taskbar.obj)

    def test_close_releases_com_even_if_clearing_overlay_throws(self):
        _, taskbar = self.fake_native()
        taskbar.window = 123
        taskbar._set.side_effect = OSError('fake COM failure')
        with self.assertRaises(OSError):
            taskbar.close()
        taskbar._release.assert_called_once_with(taskbar.obj)
        taskbar.ole.CoUninitialize.assert_called_once()

    def test_window_filter_requires_visibility_exact_executable_never_title(self):
        namespace = load_native()
        taskbar = namespace['Taskbar'].__new__(namespace['Taskbar'])
        taskbar.executable = 'verified.exe'
        paths = {1: 'verified.exe', 2: 'foreign.exe', 3: 'verified.exe', 4: 'verified.exe'}
        titles = {1: 'main — DeepSeek Harness', 2: 'DeepSeek Harness', 3: 'DeepSeek Harness', 4: 'unrelated'}
        taskbar.enum_type = lambda function: function
        taskbar.process_path = Mock(side_effect=lambda hwnd: paths[hwnd])
        title_calls = []

        def text(hwnd, buffer, size):
            title_calls.append(hwnd)
            buffer.value = titles[hwnd]
            return len(titles[hwnd])

        def enumerate_windows(callback, data):
            for hwnd in paths:
                callback(hwnd, data)
            return True

        taskbar.user = types.SimpleNamespace(
            IsWindowVisible=lambda hwnd: hwnd != 3,
            GetWindowTextW=text,
            EnumWindows=enumerate_windows,
        )
        self.assertEqual(taskbar.windows(), [1, 4])
        self.assertEqual(title_calls, [])  # Same executable with unrelated title is still a candidate; ambiguity is refused.
        self.assertEqual([call.args[0] for call in taskbar.process_path.call_args_list], [1, 2, 4])

    def test_focus_uses_verified_process_not_title_or_nonzero_handle_alone(self):
        namespace = load_native()
        taskbar = namespace['Taskbar'].__new__(namespace['Taskbar'])
        taskbar.executable = 'verified.exe'
        taskbar.process_path = Mock(return_value='foreign.exe')
        taskbar.user = types.SimpleNamespace(GetForegroundWindow=Mock(return_value=123))
        self.assertFalse(taskbar.focused())
        taskbar.process_path.return_value = taskbar.executable
        self.assertTrue(taskbar.focused())
        taskbar.user.GetForegroundWindow.return_value = 0
        self.assertFalse(taskbar.focused())

    def test_process_query_failure_closes_handle_and_returns_none(self):
        namespace = load_native()
        taskbar = namespace['Taskbar'].__new__(namespace['Taskbar'])
        taskbar.user = types.SimpleNamespace(GetWindowThreadProcessId=lambda hwnd, ptr: setattr(ptr._obj, 'value', 17))
        taskbar.kernel = types.SimpleNamespace(
            OpenProcess=Mock(return_value=456), QueryFullProcessImageNameW=Mock(return_value=False), CloseHandle=Mock(),
        )
        self.assertIsNone(taskbar.process_path(123))
        taskbar.kernel.CloseHandle.assert_called_once_with(456)
        taskbar.kernel.CloseHandle.reset_mock()
        taskbar.kernel.OpenProcess.return_value = 0
        self.assertIsNone(taskbar.process_path(123))
        taskbar.kernel.CloseHandle.assert_not_called()

    def test_process_query_exception_still_closes_handle(self):
        namespace = load_native()
        taskbar = namespace['Taskbar'].__new__(namespace['Taskbar'])
        taskbar.user = types.SimpleNamespace(GetWindowThreadProcessId=lambda hwnd, ptr: setattr(ptr._obj, 'value', 17))
        taskbar.kernel = types.SimpleNamespace(
            OpenProcess=Mock(return_value=456),
            QueryFullProcessImageNameW=Mock(side_effect=OSError('fake query failure')), CloseHandle=Mock(),
        )
        with self.assertRaises(OSError):
            taskbar.process_path(123)
        taskbar.kernel.CloseHandle.assert_called_once_with(456)


class NativeMainTests(unittest.TestCase):
    def test_worker_failure_always_closes_taskbar(self):
        namespace = load_native()
        taskbar = FakeTaskbar()
        namespace['Taskbar'] = Mock(return_value=taskbar)
        namespace['worker'] = Mock(side_effect=RuntimeError('worker failure'))
        with patch.object(sys, 'platform', 'win32'), patch.object(sys, 'argv', ['native.py', '--executable', 'fake.exe']):
            with self.assertRaisesRegex(RuntimeError, 'worker failure'):
                namespace['main']()
        self.assertTrue(taskbar.closed)

    def test_probe_duration_is_bounded_and_cleanup_always_runs(self):
        namespace = load_native()
        taskbar = FakeTaskbar()
        namespace['Taskbar'] = Mock(return_value=taskbar)
        namespace['time'] = types.SimpleNamespace(sleep=Mock())
        events = []
        namespace['emit'] = events.append
        with patch.object(sys, 'platform', 'win32'), patch.object(sys, 'argv', ['native.py', '--executable', 'fake.exe', '--probe', '9', '--seconds', '100']):
            namespace['main']()
        self.assertEqual(taskbar.set_calls, [9])
        namespace['time'].sleep.assert_called_once_with(30)
        self.assertTrue(taskbar.closed)
        self.assertEqual(events[-1]['type'], 'applied')


class NativePortabilityTests(unittest.TestCase):
    def test_guid_is_always_16_bytes_including_linux_ctypes(self):
        namespace = load_native()
        self.assertEqual(namespace['C'].sizeof(namespace['GUID']), 16)

    def test_native_catalogs_have_matching_keys_and_english_fallback(self):
        namespace = load_native()
        catalogs = namespace['_locales']
        self.assertEqual(set(catalogs['en']), set(catalogs['zh']))
        self.assertEqual(namespace['native_message']('fr', 'ambiguous'), catalogs['en']['ambiguous'])
        self.assertIn('3 个主会话', namespace['native_message']('zh', 'attention', count=3))

    def test_native_source_has_no_app_id_or_window_title_mutation_or_lookup(self):
        source = NATIVE_PATH.read_text(encoding='utf-8')
        for forbidden in ('SetCurrentProcessExplicitAppUserModelID', 'GetWindowTextW', 'SetForegroundWindow', 'winreg'):
            self.assertNotIn(forbidden, source)

    def test_non_windows_main_refuses_before_constructing_taskbar(self):
        namespace = load_native()
        namespace['Taskbar'] = Mock()
        with patch.object(sys, 'platform', 'linux'), patch.object(sys, 'argv', ['native.py', '--executable', 'fake.exe']):
            with self.assertRaisesRegex(RuntimeError, 'requires Windows'):
                namespace['main']()
        namespace['Taskbar'].assert_not_called()


if __name__ == '__main__':
    unittest.main()
