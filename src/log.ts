// アプリ内のデバッグログ。画面に表示し、「ログをコピー」で貼り付けられるようにする。
type Listener = (lines: string[]) => void;
const lines: string[] = [];
const listeners = new Set<Listener>();

export function log(message: string) {
  const time = new Date().toISOString().slice(11, 23);
  lines.push(`${time} ${message}`);
  if (lines.length > 300) lines.shift();
  console.log(message);
  listeners.forEach((l) => l([...lines]));
}

export function subscribeLog(listener: Listener) {
  listeners.add(listener);
  listener([...lines]);
  return () => {
    listeners.delete(listener);
  };
}

export function getLogText() {
  return lines.join('\n');
}
