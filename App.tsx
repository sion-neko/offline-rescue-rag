import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { createEngine } from './src/ai/engine';
import { createStore } from './src/rag/store';
import { answer, ragIndex, type AnswerResult } from './src/rag/rag';
import { getLogText, log, subscribeLog } from './src/log';

const engine = createEngine();
const store = createStore();

const QUICK_QUESTIONS = ['道に迷った', 'もうすぐ暗くなる', '寒くて震えが止まらない', '電波がない'];

type Phase =
  | { kind: 'loading'; label: string; ratio: number }
  | { kind: 'ready' }
  | { kind: 'answering' }
  | { kind: 'error'; message: string };

export default function App() {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading', label: '準備中', ratio: 0 });
  const [question, setQuestion] = useState('');
  const [streaming, setStreaming] = useState('');
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [loadMs, setLoadMs] = useState<number | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const started = useRef(false);

  useEffect(() => subscribeLog(setLogs), []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    (async () => {
      const t0 = Date.now();
      try {
        log(`engine=${engine.name} store=${store.name} chunks=${ragIndex.chunks.length}`);
        await store.init(ragIndex);
        log('検索の準備ができた');
        await engine.load(({ stage, ratio }) =>
          setPhase({
            kind: 'loading',
            label: stage === 'embed' ? '検索モデルを読み込み中' : '要約モデルを読み込み中',
            ratio,
          }),
        );
        const ms = Date.now() - t0;
        setLoadMs(ms);
        log(`モデル読み込み完了 ${ms}ms`);
        setPhase({ kind: 'ready' });
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        log(`読み込みエラー: ${message}`);
        setPhase({ kind: 'error', message });
      }
    })();
  }, []);

  const ask = async (q: string) => {
    const text = q.trim();
    if (!text || phase.kind !== 'ready') return;
    setQuestion(text);
    setPhase({ kind: 'answering' });
    setResult(null);
    setStreaming('');
    log(`質問: ${text}`);
    try {
      const r = await answer(text, engine, store, setStreaming);
      setResult(r);
      log(
        `回答 embed=${r.timings.embedMs}ms search=${r.timings.searchMs}ms gen=${r.timings.generateMs}ms ` +
          `tokens=${r.timings.tokens} ${r.timings.tokensPerSecond.toFixed(1)}tok/s ` +
          `hits=${r.hits.map((h) => `${h.chunk.title}:${h.score.toFixed(3)}`).join(', ')}`,
      );
      setPhase({ kind: 'ready' });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      log(`回答エラー: ${message}`);
      setPhase({ kind: 'error', message });
    }
  };

  const busy = phase.kind !== 'ready';
  const answerText = result?.text ?? streaming;

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>防災RAG（検証版）</Text>
          <Text style={styles.subtitle}>圏外でも使える、山の遭難時の手引き</Text>

          <StatusCard phase={phase} />

          <View style={styles.inputRow}>
            <TextInput
              testID="question-input"
              style={styles.input}
              value={question}
              onChangeText={setQuestion}
              placeholder="いま困っていることを入力"
              placeholderTextColor="#8a8f98"
              returnKeyType="send"
              onSubmitEditing={() => ask(question)}
              editable={!busy}
            />
            <Pressable
              testID="ask-button"
              accessibilityRole="button"
              onPress={() => ask(question)}
              disabled={busy || !question.trim()}
              style={({ pressed }) => [
                styles.askButton,
                (busy || !question.trim()) && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.askButtonText}>聞く</Text>
            </Pressable>
          </View>

          <View style={styles.chips}>
            {QUICK_QUESTIONS.map((q) => (
              <Pressable
                key={q}
                accessibilityRole="button"
                onPress={() => ask(q)}
                disabled={busy}
                style={({ pressed }) => [styles.chip, busy && styles.disabled, pressed && styles.pressed]}
              >
                <Text style={styles.chipText}>{q}</Text>
              </Pressable>
            ))}
          </View>

          {answerText ? (
            <View style={styles.card} testID="answer">
              <Text style={styles.cardLabel}>要約</Text>
              <Text style={styles.answer}>{answerText}</Text>
              {result && result.used.length > 0 && (
                <Text style={styles.caution}>
                  要約はAIが作ったものです。行動する前に、下のもとの資料も確かめてください。
                </Text>
              )}
            </View>
          ) : null}

          {result && result.used.length > 0 && (
            <View style={styles.sources}>
              <Text style={styles.sectionTitle}>もとの資料</Text>
              {result.used.map((h) => (
                <View key={h.chunk.id} style={styles.card}>
                  <Text style={styles.sourceTitle}>{h.chunk.title}</Text>
                  <Text style={styles.sourceText}>{h.chunk.text}</Text>
                </View>
              ))}
            </View>
          )}

          <Pressable
            onPress={() => setShowDebug((v) => !v)}
            accessibilityRole="button"
            style={styles.debugToggle}
          >
            <Text style={styles.debugToggleText}>{showDebug ? 'デバッグ情報を隠す' : 'デバッグ情報を表示'}</Text>
          </Pressable>

          {showDebug && (
            <View style={styles.debug} testID="debug">
              <Text style={styles.debugText}>エンジン: {engine.name}</Text>
              <Text style={styles.debugText}>検索: {store.name}</Text>
              <Text style={styles.debugText}>読み込み: {loadMs != null ? `${loadMs}ms` : '-'}</Text>
              {result && (
                <>
                  <Text style={styles.debugText}>
                    ベクトル化 {result.timings.embedMs}ms / 検索 {result.timings.searchMs}ms / 生成{' '}
                    {result.timings.generateMs}ms
                  </Text>
                  <Text style={styles.debugText}>
                    生成 {result.timings.tokens} トークン、{result.timings.tokensPerSecond.toFixed(1)} トークン/秒
                  </Text>
                  <Text style={styles.debugText}>
                    検索結果: {result.hits.map((h) => `${h.chunk.title}(${h.score.toFixed(3)})`).join('、')}
                  </Text>
                </>
              )}
              <Pressable
                accessibilityRole="button"
                onPress={() => Clipboard.setStringAsync(getLogText())}
                style={({ pressed }) => [styles.copyButton, pressed && styles.pressed]}
              >
                <Text style={styles.copyButtonText}>ログをコピー</Text>
              </Pressable>
              <Text style={styles.logText} selectable>
                {logs.join('\n')}
              </Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function StatusCard({ phase }: { phase: Phase }) {
  if (phase.kind === 'ready') return null;
  if (phase.kind === 'error') {
    return (
      <View style={[styles.status, styles.statusError]} testID="status-error">
        <Text style={styles.statusErrorText}>エラー: {phase.message}</Text>
      </View>
    );
  }
  const label = phase.kind === 'answering' ? '資料を探して要約しています' : phase.label;
  const pct = phase.kind === 'loading' ? ` ${Math.round(phase.ratio * 100)}%` : '';
  return (
    <View style={styles.status} testID="status-busy">
      <ActivityIndicator color="#2f5d50" />
      <Text style={styles.statusText}>
        {label}
        {pct}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f6f5f1' },
  container: { padding: 20, paddingBottom: 48, gap: 16 },
  title: { fontSize: 26, fontWeight: '700', color: '#1f2a24' },
  subtitle: { fontSize: 14, color: '#5b625e', marginTop: -8 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#e7efe9',
  },
  statusText: { fontSize: 15, color: '#2f5d50' },
  statusError: { backgroundColor: '#fbe9e7' },
  statusErrorText: { fontSize: 15, color: '#9b2c1f' },
  inputRow: { flexDirection: 'row', gap: 8 },
  input: {
    minWidth: 0,
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dcdcd6',
    fontSize: 16,
    color: '#1f2a24',
  },
  askButton: {
    minWidth: 72,
    minHeight: 48,
    borderRadius: 14,
    backgroundColor: '#2f5d50',
    alignItems: 'center',
    justifyContent: 'center',
  },
  askButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#dcdcd6',
  },
  chipText: { fontSize: 14, color: '#1f2a24' },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
  card: { padding: 16, borderRadius: 16, backgroundColor: '#fff', gap: 8 },
  cardLabel: { fontSize: 13, fontWeight: '700', color: '#2f5d50' },
  answer: { fontSize: 17, lineHeight: 27, color: '#1f2a24' },
  caution: { fontSize: 13, lineHeight: 19, color: '#7a5a12' },
  sources: { gap: 10 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#1f2a24' },
  sourceTitle: { fontSize: 15, fontWeight: '700', color: '#1f2a24' },
  sourceText: { fontSize: 15, lineHeight: 24, color: '#3a413d' },
  debugToggle: { alignSelf: 'flex-start', paddingVertical: 8 },
  debugToggleText: { fontSize: 13, color: '#5b625e', textDecorationLine: 'underline' },
  debug: { padding: 14, borderRadius: 14, backgroundColor: '#ecebe6', gap: 6 },
  debugText: { fontSize: 12, color: '#3a413d' },
  copyButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#fff',
    marginVertical: 4,
  },
  copyButtonText: { fontSize: 13, color: '#2f5d50', fontWeight: '700' },
  logText: { fontSize: 11, lineHeight: 16, color: '#3a413d', fontFamily: 'Courier' },
});
