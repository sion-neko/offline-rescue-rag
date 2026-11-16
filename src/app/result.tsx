// 検索結果：資料の要点（原文）→ あわせて確認 → AI の短いまとめ（ボタンで作る）→ 関連する資料。
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getChunk, search, summarize, type SearchResult, type SummaryResult } from '../rag/rag';
import { log } from '../log';
import { useApp } from '../state/app';
import { GlossaryChips, GlossaryText } from '../ui/glossary';
import { BookIcon, ChevronIcon, PhoneIcon, SparkIcon } from '../ui/icons';
import { PressableCard, SectionLabel, TopBar } from '../ui/parts';
import { font, minTouch } from '../ui/theme';

type SummaryState =
  | { kind: 'idle' }
  | { kind: 'running'; text: string }
  | { kind: 'done'; result: SummaryResult }
  | { kind: 'error'; message: string };

export default function Result() {
  const { q } = useLocalSearchParams<{ q: string }>();
  // 検索ワードが変わったら中身ごと作り直す（前の結果や AI のまとめを持ち越さない）
  return <ResultBody key={q ?? ''} q={q ?? ''} />;
}

function ResultBody({ q }: { q: string }) {
  const { theme: t, engine, store, status, addRecent } = useApp();
  const [input, setInput] = useState(q);
  const [result, setResult] = useState<SearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<SummaryState>({ kind: 'idle' });

  useEffect(() => {
    if (!q || !status.searchReady) return;
    let cancelled = false;
    search(q, engine, store)
      .then((r) => {
        if (cancelled) return;
        addRecent(q);
        log(
          `検索「${q}」 embed=${r.timings.embedMs}ms search=${r.timings.searchMs}ms ` +
            r.hits.map((h) => `${h.chunk.title}:${h.score.toFixed(3)}`).join(', '),
        );
        setResult(r);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      cancelled = true;
    };
  }, [q, status.searchReady, engine, store, addRecent]);

  const runSummary = async () => {
    if (!result || !status.llmReady || summary.kind === 'running') return;
    setSummary({ kind: 'running', text: '' });
    try {
      const s = await summarize(result, engine, (text) => setSummary({ kind: 'running', text }));
      log(
        `まとめ gen=${s.timings.generateMs}ms tokens=${s.timings.tokens} ${s.timings.tokensPerSecond.toFixed(1)}tok/s ` +
          s.lines.map((l) => (l.citation ? l.citation.score.toFixed(2) : '出典なし')).join(','),
      );
      setSummary({ kind: 'done', result: s });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      log(`まとめエラー: ${message}`);
      setSummary({ kind: 'error', message });
    }
  };

  const submit = () => {
    const text = input.trim();
    if (text && text !== q) router.setParams({ q: text });
  };

  const openSection = (id: string, line?: number) =>
    router.push({ pathname: '/section/[id]', params: line == null ? { id } : { id, hl: String(line) } });

  // 用語の下線は、画面の中で同じ用語に 1 回だけ引く（描画のたびに作り直す）
  const used = new Set<string>();

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      <TopBar value={input} onChangeText={setInput} onSubmit={submit} />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!status.searchReady && !status.searchError && <Busy label="検索の準備中…" />}
        {status.searchReady && !result && !error && <Busy label="資料を検索中…" />}
        {(error || status.searchError) && (
          <Text style={[styles.body, { color: t.danger }]}>
            検索できませんでした。目次から資料を読めます。
          </Text>
        )}

        {result?.urgent && (
          <PressableCard
            onPress={() => router.push('/emergency')}
            accessibilityLabel="救助を呼ぶ画面を開く"
            testID="urgent-banner"
            style={[styles.wideButton, { backgroundColor: t.danger }]}
          >
            <PhoneIcon color={t.dangerText} />
            <Text style={[styles.wideButtonText, { color: t.dangerText, fontWeight: '700' }]}>救助を呼ぶ（110・119）</Text>
          </PressableCard>
        )}

        {result && !result.top && <NoHit question={result.question} />}

        {result?.top && (
          <>
            <View style={styles.block} testID="top-result">
              <SectionLabel>いちばん近い資料</SectionLabel>
              {result.weak && (
                <Text style={[styles.small, { color: t.textSub }]} testID="weak-note">
                  質問との関係が薄いかもしれません。違うときは、言葉を変えるか
                  <Text onPress={() => router.push('/contents')} style={{ color: t.accent, fontWeight: '700' }}>
                    {' 目次 '}
                  </Text>
                  から探せます。
                </Text>
              )}
              <View style={[styles.card, { backgroundColor: t.surfaceAlt }]}>
                <Pressable
                  onPress={() => openSection(result.top!.chunk.id)}
                  accessibilityRole="button"
                  accessibilityHint="資料のページを開く"
                  style={({ pressed }) => [styles.cardTitleRow, { opacity: pressed ? 0.6 : 1 }]}
                >
                  <Text style={[styles.cardTitle, { color: t.text }]} accessibilityRole="header">
                    {result.top.chunk.title}
                  </Text>
                  <ChevronIcon color={t.textMuted} />
                </Pressable>
                {result.top.chunk.sentences.map((s, i) => (
                  <View key={i} style={styles.point}>
                    <Text style={[styles.bullet, { color: t.accent }]}>・</Text>
                    <GlossaryText text={s} used={used} style={[styles.body, { color: t.text }]} />
                  </View>
                ))}
              </View>
              <GlossaryChips
                texts={[...result.top.chunk.sentences, ...result.extras.map((x) => x.chunk.sentences[x.lineIndex])]}
              />
            </View>

            {result.extras.length > 0 && (
              <View style={styles.block} testID="extras">
                <SectionLabel>あわせて確認</SectionLabel>
                {result.extras.map((x) => (
                  <View key={`${x.chunk.id}-${x.lineIndex}`} style={[styles.extra, { borderColor: t.border }]}>
                    <GlossaryText text={x.chunk.sentences[x.lineIndex]} used={used} style={[styles.body, { color: t.text }]} />
                    <Pressable
                      onPress={() => openSection(x.chunk.id, x.lineIndex)}
                      accessibilityRole="link"
                      style={({ pressed }) => [styles.extraSource, { opacity: pressed ? 0.5 : 1 }]}
                    >
                      <Text style={[styles.small, { color: t.accent }]}>{x.chunk.title}</Text>
                      <ChevronIcon size={12} color={t.accent} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

            <SummaryBlock
              state={summary}
              llmReady={status.llmReady}
              llmFailed={!!status.llmError}
              progress={status.progress}
              onRun={runSummary}
              onCite={openSection}
            />

            {result.top.chunk.related.length > 0 && (
              <View style={styles.block} testID="related">
                <SectionLabel>関連する資料</SectionLabel>
                <View style={[styles.list, { backgroundColor: t.surfaceAlt }]}>
                  {result.top.chunk.related.map((id, i) => {
                    const c = getChunk(id);
                    if (!c) return null;
                    return (
                      <Pressable
                        key={id}
                        onPress={() => openSection(id)}
                        accessibilityRole="button"
                        style={({ pressed }) => [
                          styles.listRow,
                          i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border },
                          { opacity: pressed ? 0.5 : 1 },
                        ]}
                      >
                        <Text style={[styles.listText, { color: t.text }]}>{c.title}</Text>
                        <ChevronIcon color={t.textMuted} />
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            )}

            <Text style={[styles.caption, { color: t.textMuted }]}>
              資料は検証用の仮データです。命に関わるときは、迷わず110番か119番へ。
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Busy({ label }: { label: string }) {
  const { theme: t } = useApp();
  return (
    <View style={styles.busy} testID="status-busy">
      <ActivityIndicator color={t.accent} />
      <Text style={[styles.body, { color: t.textSub }]}>{label}</Text>
    </View>
  );
}

function SummaryBlock({
  state,
  llmReady,
  llmFailed,
  progress,
  onRun,
  onCite,
}: {
  state: SummaryState;
  llmReady: boolean;
  llmFailed: boolean;
  progress: number;
  onRun: () => void;
  onCite: (id: string, line: number) => void;
}) {
  const { theme: t } = useApp();
  return (
    <View style={styles.block} testID="summary">
      {state.kind === 'idle' && llmReady && (
        <PressableCard
          onPress={onRun}
          accessibilityLabel="AIで短くまとめる"
          testID="summary-button"
          style={[styles.aiButton, { borderColor: t.border }]}
        >
          <SparkIcon color={t.accent} />
          <Text style={[styles.aiButtonText, { color: t.text }]}>AIで短くまとめる</Text>
        </PressableCard>
      )}
      {state.kind === 'idle' && !llmReady && (
        <View style={styles.aiWaiting} testID="summary-waiting">
          <SparkIcon color={t.textMuted} />
          <Text style={[styles.small, { color: t.textMuted }]}>
            {llmFailed
              ? 'AIのまとめは使えません。上の資料はそのまま読めます'
              : progress > 0 && progress < 1
                ? `AIのまとめを準備中（${Math.round(progress * 100)}%）`
                : 'AIのまとめを準備中'}
          </Text>
        </View>
      )}
      {state.kind !== 'idle' && (
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border, borderWidth: 1 }]}>
          <View style={styles.aiLabel}>
            <SparkIcon color={t.accent} />
            <Text style={[styles.aiLabelText, { color: t.accent }]}>
              {state.kind === 'running' ? 'AIのまとめ 作成中' : 'AIのまとめ'}
            </Text>
          </View>
          {state.kind === 'running' && (
            <Text style={[styles.body, { color: t.textSub }]}>{state.text || '資料を読んでいます…'}</Text>
          )}
          {state.kind === 'error' && (
            <Text style={[styles.body, { color: t.textSub }]}>AIのまとめを作れませんでした。上の資料はそのまま読めます。</Text>
          )}
          {state.kind === 'done' &&
            state.result.lines.map((l, i) => (
              <View key={i} style={styles.point}>
                <Text style={[styles.bullet, { color: t.accent }]}>・</Text>
                <Text style={[styles.body, { color: l.citation ? t.text : t.textMuted, flex: 1 }]}>
                  {l.text}
                  {'  '}
                  {l.citation ? (
                    <Text
                      onPress={() => onCite(l.citation!.chunk.id, l.citation!.lineIndex)}
                      accessibilityRole="link"
                      accessibilityLabel={`出典：${l.citation.chunk.title}`}
                      style={[styles.cite, { color: t.accent, backgroundColor: t.accentSoft }]}
                    >
                      {` ${l.citation.chunk.title} `}
                    </Text>
                  ) : (
                    <Text style={[styles.cite, { color: t.textMuted, backgroundColor: t.surfaceAlt }]}> 原文で確認できず </Text>
                  )}
                </Text>
              </View>
            ))}
          {state.kind === 'done' && (
            <Text style={[styles.caption, { color: t.textMuted }]}>
              AIは資料にないことを書くことがあります。行動の前に、上の原文を確かめてください。
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

function NoHit({ question }: { question: string }) {
  const { theme: t } = useApp();
  return (
    <View style={styles.block} testID="no-hit">
      <Text style={[styles.cardTitle, { color: t.text }]}>「{question}」に関係する内容は、資料に見つかりませんでした</Text>
      <Text style={[styles.body, { color: t.textSub }]}>言葉を変えて検索するか、目次から探せます。</Text>
      <PressableCard
        onPress={() => router.push('/contents')}
        accessibilityLabel="目次から探す"
        style={[styles.wideButton, { backgroundColor: t.surfaceAlt }]}
      >
        <BookIcon color={t.text} />
        <Text style={[styles.wideButtonText, { color: t.text }]}>目次から探す</Text>
      </PressableCard>
      <PressableCard
        onPress={() => router.push('/emergency')}
        accessibilityLabel="救助を呼ぶ"
        style={[styles.wideButton, { backgroundColor: t.danger }]}
      >
        <PhoneIcon color={t.dangerText} />
        <Text style={[styles.wideButtonText, { color: t.dangerText, fontWeight: '700' }]}>命に関わるなら、救助を呼ぶ</Text>
      </PressableCard>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 24, paddingBottom: 48, maxWidth: 640, width: '100%', alignSelf: 'center' },
  busy: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  block: { gap: 10 },
  card: { borderRadius: 16, padding: 16, gap: 10 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 32 },
  cardTitle: { fontSize: font.heading, fontWeight: '700', flexShrink: 1, lineHeight: 27 },
  point: { flexDirection: 'row', gap: 2 },
  bullet: { fontSize: font.body, lineHeight: 28, fontWeight: '700' },
  body: { fontSize: font.body, lineHeight: 28, flexShrink: 1 },
  small: { fontSize: font.small },
  caption: { fontSize: font.caption, lineHeight: 18 },
  extra: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 6 },
  extraSource: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', minHeight: 44 },
  aiButton: {
    minHeight: 52,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  aiButtonText: { fontSize: 16, fontWeight: '700' },
  aiWaiting: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  aiLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiLabelText: { fontSize: 13, fontWeight: '700' },
  cite: { fontSize: 12, fontWeight: '700' },
  list: { borderRadius: 14, overflow: 'hidden' },
  listRow: { minHeight: minTouch, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  listText: { fontSize: 16, flexShrink: 1 },
  wideButton: { minHeight: 54, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  wideButtonText: { fontSize: 16 },
});
