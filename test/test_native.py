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

    def test_foreground_never_suppresses_count_or_clears_on_focus(self):
        taskbar = FakeTaskbar(focused=True)
        taskbar.focused = Mock(side_effect=AssertionError('OS focus must never be consulted'))
        events = self.run_scripted(taskbar, [{'type': 'set', 'count': 7}, EMPTY, {'type': 'quit'}])
        self.assertEqual(taskbar.set_calls, [7])
        self.assertEqual([event['type'] for event in events], ['ready', 'applied'])
        self.assertNotIn('focused', events[0])

    def test_failed_set_retries_without_requiring_topology_change(self):
        taskbar = FakeTaskbar(fail_calls={1})
        events = self.run_scripted(taskbar, [{'type': 'set', 'count': 4}, EMPTY, EMPTY, {'type': 'quit'}])
        self.assertEqual(taskbar.set_calls, [4, 4])
        self.assertEqual([event['type'] for event in events], ['ready', 'error', 'applied'])

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
        taskbar.drawn_windows = set()
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
        self.assertEqual(taskbar._set.call_args.args[-1], 'DSH：42 个主会话待查看')
        for locale, expected in [('en', 'DSH: 42 main conversations need attention'), ('fr', 'DSH：42 个主会话待查看'), ('zh-CN', 'DSH：42 个主会话待查看')]:
            with self.subTest(locale=locale):
                taskbar.locale = locale
                taskbar.set_count(42)
                self.assertEqual(taskbar._set.call_args.args[-1], expected)

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

    def test_multiple_windows_receive_the_same_aggregate_overlay(self):
        _, taskbar = self.fake_native(windows=(123, 456))
        result = taskbar.set_count(9)
        self.assertEqual(result['windows'], [123, 456])
        self.assertEqual(taskbar.last_count, 9)
        self.assertEqual([call.args[1] for call in taskbar._set.call_args_list], [123, 456])
        taskbar.user.LoadImageW.assert_called_once()
        taskbar.user.DestroyIcon.assert_called_once_with(456)
        self.assertEqual(taskbar.drawn_windows, {123, 456})
        taskbar.windows.return_value = []
        taskbar.set_count(0)
        self.assertEqual(taskbar.drawn_windows, set())

    def test_failed_hresult_destroys_icon_and_exposes_error(self):
        _, taskbar = self.fake_native(result=-1)
        with self.assertRaisesRegex(OSError, 'SetOverlayIcon 设置覆盖图标失败'):
            taskbar.set_count(7)
        taskbar.user.DestroyIcon.assert_called_once_with(456)
        self.assertEqual(taskbar.last_count, 7)
        taskbar.locale = 'en'
        with self.assertRaisesRegex(OSError, 'SetOverlayIcon failed: 123: -0x1'):
            taskbar.set_count(7)

    def test_load_error_never_attempts_overlay_or_destroys_unloaded_icon(self):
        _, taskbar = self.fake_native()
        taskbar.user.LoadImageW.side_effect = OSError('fake icon load failure')
        with self.assertRaisesRegex(OSError, 'fake icon load failure'):
            taskbar.set_count(7)
        taskbar._set.assert_not_called()
        taskbar.user.DestroyIcon.assert_not_called()

    def test_close_revalidates_executable_before_clearing_existing_window(self):
        _, taskbar = self.fake_native()
        taskbar.drawn_windows = {123}
        taskbar.close()
        taskbar.process_path.assert_called_once_with(123)
        taskbar._set.assert_called_once_with(taskbar.obj, 123, None, '')
        taskbar._release.assert_called_once_with(taskbar.obj)
        taskbar.ole.CoUninitialize.assert_called_once()

    def test_close_does_not_clear_foreign_recycled_hwnd_but_releases_com(self):
        _, taskbar = self.fake_native()
        taskbar.drawn_windows = {123}
        taskbar.process_path.return_value = 'foreign.exe'
        taskbar.close()
        taskbar._set.assert_not_called()
        taskbar._release.assert_called_once_with(taskbar.obj)
        taskbar.ole.CoUninitialize.assert_called_once()

    def test_close_does_not_query_or_clear_destroyed_window(self):
        _, taskbar = self.fake_native()
        taskbar.drawn_windows = {123}
        taskbar.user.IsWindow.return_value = False
        taskbar.close()
        taskbar.process_path.assert_not_called()
        taskbar._set.assert_not_called()
        taskbar._release.assert_called_once_with(taskbar.obj)

    def test_close_releases_com_even_if_clearing_overlay_throws(self):
        _, taskbar = self.fake_native()
        taskbar.drawn_windows = {123}
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
        self.assertEqual(title_calls, [])  # Same executable with unrelated title is still a candidate; both windows receive the aggregate.
        self.assertEqual([call.args[0] for call in taskbar.process_path.call_args_list], [1, 2, 4])

    def test_native_has_no_foreground_or_preview_protocol(self):
        source = NATIVE_PATH.read_text(encoding='utf-8')
        for forbidden in ('GetForegroundWindow', 'previous_focus', "command.get('preview'"):
            self.assertNotIn(forbidden, source)

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

    def test_native_catalogs_have_matching_keys_and_chinese_fallback(self):
        namespace = load_native()
        catalogs = namespace['_locales']
        self.assertEqual(set(catalogs['en']), set(catalogs['zh']))
        self.assertEqual(namespace['native_message']('fr', 'platform'), catalogs['zh']['platform'])
        self.assertIn('3 个主会话', namespace['native_message']('zh', 'attention', count=3))

    def test_native_source_has_no_app_id_or_window_title_mutation_or_lookup(self):
        source = NATIVE_PATH.read_text(encoding='utf-8')
        for forbidden in ('SetCurrentProcessExplicitAppUserModelID', 'GetWindowTextW', 'SetForegroundWindow', 'winreg'):
            self.assertNotIn(forbidden, source)

    def test_non_windows_main_refuses_before_constructing_taskbar(self):
        namespace = load_native()
        namespace['Taskbar'] = Mock()
        with patch.object(sys, 'platform', 'linux'), patch.object(sys, 'argv', ['native.py', '--executable', 'fake.exe']):
            with self.assertRaisesRegex(RuntimeError, '需要带 Explorer 的 Windows'):
                namespace['main']()
        namespace['Taskbar'].assert_not_called()


class NativeLanguageTests(unittest.TestCase):
    def test_default_and_invalid_language_ignore_english_environment(self):
        language_of = load_native()['language_of']
        with patch.dict(os.environ, {'LANG': 'en_US.UTF-8'}, clear=True):
            self.assertEqual(language_of(), 'zh')
            for value in (None, '', 'fr', 'ja-JP', 'C.UTF-8', 'zh-CN', 'zh_TW'):
                with self.subTest(value=value):
                    self.assertEqual(language_of(value), 'zh')

    def test_explicit_english_variants_are_preserved(self):
        language_of = load_native()['language_of']
        for value in ('en', 'en-US', 'en_GB.UTF-8', 'en.UTF-8', 'EN'):
            with self.subTest(value=value):
                self.assertEqual(language_of(value, {'LANG': 'zh_CN.UTF-8'}), 'en')

    def test_explicit_auto_environment_priority_and_chinese_fallback(self):
        language_of = load_native()['language_of']
        for env, expected in [
            ({'LC_ALL': 'zh_CN.UTF-8', 'LC_MESSAGES': 'en', 'LANG': 'en'}, 'zh'),
            ({'LC_ALL': 'en_US.UTF-8', 'LC_MESSAGES': 'zh', 'LANG': 'zh'}, 'en'),
            ({'LC_ALL': '', 'LC_MESSAGES': 'en_GB.UTF-8', 'LANG': 'zh'}, 'en'),
            ({'LANG': 'en'}, 'en'), ({'LANG': 'zh_TW'}, 'zh'),
            ({'LC_ALL': 'fr', 'LANG': 'en'}, 'zh'), ({'LANG': 'C.UTF-8'}, 'zh'), ({}, 'zh'),
        ]:
            with self.subTest(env=env):
                self.assertEqual(language_of('auto', env), expected)

    def test_missing_native_translation_key_falls_back_to_chinese(self):
        namespace = load_native()
        for locale in (None, '', 'fr', 'en', 'zh'):
            self.assertEqual(namespace['native_message'](locale, 'missing-key'), 'missing-key')
        namespace['_locales']['en'].pop('attention')
        self.assertEqual(namespace['native_message']('en', 'attention', count=3), 'DSH：3 个主会话待查看')
        self.assertIn('requires Windows', namespace['native_message']('en', 'platform'))

    def test_taskbar_constructor_defaults_and_fallback_without_loading_win32(self):
        namespace = load_native()
        Taskbar = namespace['Taskbar']
        for locale, expected in [(None, 'zh'), ('fr', 'zh'), ('en', 'en'), ('zh-CN', 'zh'), ('auto', 'en')]:
            with self.subTest(locale=locale), patch.dict(os.environ, {'LANG': 'en'}, clear=True):
                taskbar = Taskbar.__new__(Taskbar)
                with patch.object(namespace['C'], 'WinDLL', create=True, side_effect=RuntimeError('fake DLL boundary')):
                    with self.assertRaisesRegex(RuntimeError, 'fake DLL boundary'):
                        if locale is None:
                            taskbar.__init__('fake.exe', '.')
                        else:
                            taskbar.__init__('fake.exe', '.', locale)
                self.assertEqual(taskbar.locale, expected)

    def test_main_normalizes_default_english_auto_and_unsupported_before_fake_taskbar(self):
        for args, env, expected in [
            ([], {'LANG': 'en'}, 'zh'), (['--locale', 'en'], {'LANG': 'zh'}, 'en'),
            (['--locale', 'auto'], {'LANG': 'en'}, 'en'), (['--locale', 'auto'], {}, 'zh'),
            (['--locale', 'auto'], {'LC_ALL': 'fr', 'LANG': 'en'}, 'zh'),
            (['--locale', 'fr'], {'LANG': 'en'}, 'zh'), (['--locale', ''], {'LANG': 'en'}, 'zh'),
        ]:
            with self.subTest(args=args, env=env):
                namespace = load_native()
                taskbar = FakeTaskbar()
                namespace['Taskbar'] = Mock(return_value=taskbar)
                namespace['worker'] = Mock()
                with patch.object(sys, 'platform', 'win32'), patch.object(sys, 'argv', ['native.py', '--executable', 'fake.exe'] + args), patch.dict(os.environ, env, clear=True):
                    namespace['main']()
                self.assertEqual(namespace['Taskbar'].call_args.args[-1], expected)
                self.assertTrue(taskbar.closed)

    def test_non_windows_diagnostic_preserves_explicit_english_and_auto(self):
        for args, env, message in [
            (['--locale', 'en'], {}, 'requires Windows'),
            (['--locale', 'auto'], {'LANG': 'en_US.UTF-8'}, 'requires Windows'),
            (['--locale', 'fr'], {'LANG': 'en'}, '需要带 Explorer 的 Windows'),
        ]:
            with self.subTest(args=args):
                namespace = load_native()
                namespace['Taskbar'] = Mock()
                with patch.object(sys, 'platform', 'linux'), patch.object(sys, 'argv', ['native.py', '--executable', 'fake.exe'] + args), patch.dict(os.environ, env, clear=True):
                    with self.assertRaisesRegex(RuntimeError, message):
                        namespace['main']()
                namespace['Taskbar'].assert_not_called()


if __name__ == '__main__':
    unittest.main()
