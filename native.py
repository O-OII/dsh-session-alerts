"""DSH taskbar badges: stdlib-only Windows helper; no registry/protocol/shortcut writes."""
import argparse
import ctypes as C
from ctypes import wintypes as W
import json
import os
from pathlib import Path
import queue
import sys
import threading
import time
import uuid


class GUID(C.Structure):
    _fields_ = [('Data1', C.c_uint32), ('Data2', C.c_uint16), ('Data3', C.c_uint16), ('Data4', C.c_ubyte * 8)]
    @classmethod
    def parse(cls, value):
        return cls.from_buffer_copy(uuid.UUID(value).bytes_le)


_locales = {language: json.loads((Path(__file__).resolve().parent / 'locale' / (language + '.json')).read_text(encoding='utf-8'))['native'] for language in ('en', 'zh')}


def native_message(language, key, **values):
    return _locales.get(language, _locales['en']).get(key, _locales['en'].get(key, key)).format(**values)


class Taskbar:
    def __init__(self, executable, assets, locale='en'):
        self.locale = locale if locale in _locales else 'en'
        self.executable = os.path.normcase(os.path.realpath(executable))
        self.assets = Path(assets).resolve()
        self.user = C.WinDLL('user32', use_last_error=True)
        self.kernel = C.WinDLL('kernel32', use_last_error=True)
        self.ole = C.OleDLL('ole32')
        self.user.GetForegroundWindow.restype = W.HWND
        self.user.IsWindow.argtypes = [W.HWND]
        self.user.IsWindowVisible.argtypes = [W.HWND]
        self.user.GetWindowThreadProcessId.argtypes = [W.HWND, C.POINTER(W.DWORD)]
        self.kernel.OpenProcess.argtypes = [W.DWORD, W.BOOL, W.DWORD]
        self.kernel.OpenProcess.restype = W.HANDLE
        self.kernel.QueryFullProcessImageNameW.argtypes = [W.HANDLE, W.DWORD, W.LPWSTR, C.POINTER(W.DWORD)]
        self.kernel.CloseHandle.argtypes = [W.HANDLE]
        self.user.LoadImageW.argtypes = [W.HINSTANCE, W.LPCWSTR, W.UINT, C.c_int, C.c_int, W.UINT]
        self.user.LoadImageW.restype = W.HANDLE
        self.user.DestroyIcon.argtypes = [W.HICON]
        self.user.FindWindowW.argtypes = [W.LPCWSTR, W.LPCWSTR]
        self.user.FindWindowW.restype = W.HWND
        self.enum_type = C.WINFUNCTYPE(W.BOOL, W.HWND, W.LPARAM)
        self.user.EnumWindows.argtypes = [self.enum_type, W.LPARAM]
        self.ole.CoInitializeEx.argtypes = [C.c_void_p, W.DWORD]
        self.ole.CoInitializeEx(None, 2)
        self.ole.CoCreateInstance.argtypes = [C.POINTER(GUID), C.c_void_p, W.DWORD, C.POINTER(GUID), C.POINTER(C.c_void_p)]
        self.obj = C.c_void_p()
        hr = self.ole.CoCreateInstance(C.byref(GUID.parse('56FDF344-FD6D-11D0-958A-006097C9A090')), None, 1, C.byref(GUID.parse('EA1AFB91-9E28-4B86-90E9-9E9F8A5EEFAF')), C.byref(self.obj))
        if hr < 0 or not self.obj:
            self.ole.CoUninitialize()
            raise OSError(native_message(self.locale, 'com', detail=f'CoCreateInstance ({hr:#x})'))
        table = C.cast(self.obj, C.POINTER(C.POINTER(C.c_void_p))).contents
        self._init = C.WINFUNCTYPE(C.c_long, C.c_void_p)(table[3])
        self._set = C.WINFUNCTYPE(C.c_long, C.c_void_p, W.HWND, W.HICON, W.LPCWSTR)(table[18])
        self._release = C.WINFUNCTYPE(W.ULONG, C.c_void_p)(table[2])
        hr = self._init(self.obj)
        if hr < 0:
            self._release(self.obj); self.ole.CoUninitialize()
            raise OSError(native_message(self.locale, 'com', detail=f'HrInit ({hr:#x})'))
        self.window = None
        self.last_count = 0

    def process_path(self, hwnd):
        pid = W.DWORD(); self.user.GetWindowThreadProcessId(hwnd, C.byref(pid))
        handle = self.kernel.OpenProcess(0x1000, False, pid.value)
        if not handle: return None
        try:
            text = C.create_unicode_buffer(32768); size = W.DWORD(len(text))
            if self.kernel.QueryFullProcessImageNameW(handle, 0, text, C.byref(size)):
                return os.path.normcase(os.path.realpath(text.value))
        finally:
            self.kernel.CloseHandle(handle)
        return None

    def windows(self):
        found = []
        @self.enum_type
        def callback(hwnd, _):
            if self.user.IsWindowVisible(hwnd) and self.process_path(hwnd) == self.executable:
                found.append(int(hwnd))  # Exact process path, never a title substring.
            return True
        self.user.EnumWindows(callback, 0)
        return found

    def focused(self):
        hwnd = self.user.GetForegroundWindow()
        return bool(hwnd and self.process_path(hwnd) == self.executable)

    def set_count(self, count):
        count = max(0, min(int(count), 999))
        self.last_count = count
        windows = self.windows()
        if len(windows) > 1:
            raise RuntimeError(native_message(getattr(self, 'locale', 'en'), 'ambiguous'))
        self.window = windows[0] if windows else None
        if self.window is None:
            return {'type': 'applied', 'count': count, 'hwnd': None, 'visible': False, 'reason': 'no-taskbar-window'}
        icon = None
        try:
            if count:
                name = str(count) if count < 100 else '99plus'
                icon = self.user.LoadImageW(None, str(self.assets / (name + '.ico')), 1, 32, 32, 0x10)
                if not icon: raise C.WinError(C.get_last_error())
            hr = self._set(self.obj, self.window, icon, native_message(getattr(self, 'locale', 'en'), 'attention', count=count) if count else '')
            if hr < 0: raise OSError(f'SetOverlayIcon failed: {hr:#x}')
            self.last_count = count
            return {'type': 'applied', 'count': count, 'hwnd': self.window, 'hresult': hr, 'visible': True}
        finally:
            if icon: self.user.DestroyIcon(icon)

    def topology(self):
        shell = self.user.FindWindowW('Shell_TrayWnd', None)
        shell_pid = W.DWORD()
        if shell: self.user.GetWindowThreadProcessId(shell, C.byref(shell_pid))
        return (int(shell or 0), shell_pid.value, tuple(self.windows()))

    def close(self):
        try:
            if self.window and self.user.IsWindow(self.window) and self.process_path(self.window) == self.executable:
                self._set(self.obj, self.window, None, '')
        finally:
            self._release(self.obj); self.ole.CoUninitialize()


def emit(event):
    print(json.dumps(event, ensure_ascii=True), flush=True)


def worker(taskbar):
    commands = queue.Queue()
    def read_input():
        try:
            for line in sys.stdin:
                if len(line) > 4096: continue
                try: commands.put(json.loads(line))
                except (ValueError, TypeError): pass
        finally: commands.put({'type': 'quit'})
    threading.Thread(target=read_input, daemon=True).start()
    previous_focus = taskbar.focused()
    previous_topology = taskbar.topology()
    topology_check = time.monotonic() + 2
    emit({'type': 'ready', 'focused': previous_focus, 'windows': taskbar.windows(), 'pid': os.getpid()})
    while True:
        try:
            command = commands.get(timeout=0.3)
        except queue.Empty:
            command = None
        if isinstance(command, dict):
            if command.get('type') == 'quit': break
            if command.get('type') == 'set':
                try:
                    count = int(command.get('count', 0))
                    # Focus suppresses alerts independently of parent event latency.
                    if taskbar.focused() and not command.get('preview', False): count = 0
                    emit(taskbar.set_count(count))
                except Exception as error: emit({'type': 'error', 'message': str(error)})
        focus = taskbar.focused()
        if focus != previous_focus:
            previous_focus = focus
            if focus and taskbar.last_count:
                try: emit(taskbar.set_count(0))
                except Exception as error: emit({'type': 'error', 'message': str(error)})
            # Clearing parent unread state must not depend on successful drawing.
            emit({'type': 'focus', 'focused': focus})
        if time.monotonic() >= topology_check:
            topology_check = time.monotonic() + 2
            topology = taskbar.topology()
            if topology != previous_topology:
                if taskbar.last_count:
                    try:
                        emit(taskbar.set_count(0 if focus else taskbar.last_count))
                        previous_topology = topology
                    except Exception as error:
                        # Keep the old topology so a transient Explorer failure retries.
                        emit({'type': 'error', 'message': str(error)})
                else:
                    previous_topology = topology


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--executable', required=True)
    parser.add_argument('--assets', default=str(Path(__file__).resolve().parent / 'assets' / 'badges'))
    parser.add_argument('--locale', choices=('en', 'zh'), default='en')
    parser.add_argument('--probe', type=int)
    parser.add_argument('--seconds', type=float, default=8)
    args = parser.parse_args()
    if sys.platform != 'win32':
        raise RuntimeError(native_message(args.locale, 'platform'))
    taskbar = Taskbar(args.executable, args.assets, args.locale)
    try:
        if args.probe is not None:
            emit(taskbar.set_count(args.probe)); time.sleep(min(30, max(0, args.seconds)))
        else: worker(taskbar)
    finally: taskbar.close()

if __name__ == '__main__':
    try: main()
    except Exception as error:
        emit({'type': 'fatal', 'message': str(error)}); sys.exit(1)
