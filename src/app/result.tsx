// 検索結果：資料の要点（原文）→ あわせて確認 → AI の短いまとめ（ボタンで作る）→ 関連する資料。
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { getChunk, search, summarize, type ExtraLine, type SearchResult, type SummaryResult } from '../rag/rag';
import { log } from '../log';
import { useApp } from '../state/app';
import { situations } from '../data/situations';
import { GlossaryChips, GlossaryText } from '../ui/glossary';
import { BookIcon, ChevronIcon, PhoneIcon, SparkIcon } from '../ui/icons';
import { PressableCard, SectionLabel, TopBar } from '../ui/parts';
import { font, minTouch } from '../ui/theme';

type SummaryState =
  | { kind: 'idle' }
  | { kind: 'running' }
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
        if (r.top) addRecent(q);
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

  // 検索結果が出て AI の準備ができたら、自動で要点を選ばせる（その間も下の原文は読める）
  // 1 つの検索結果につき 1 回だけ動かす（画面は検索ワードごとに作り直すので、この画面の間だけ覚えておけばよい）
  const summaryStarted = useRef(false);
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );
  useEffect(() => {
    if (!result?.top || !status.llmReady || summaryStarted.current) return;
    summaryStarted.current = true;
    setSummary({ kind: 'running' });
    summarize(result, engine)
      .then((s) => {
        log(
          `要点 gen=${s.timings.generateMs}ms tokens=${s.timings.tokens} ${s.timings.tokensPerSecond.toFixed(1)}tok/s ` +
            `picks=${s.picks.map((p) => p.score.toFixed(2)).join(',')} dropped=${s.dropped}`,
        );
        if (mounted.current) setSummary({ kind: 'done', result: s });
      })
      .catch((e) => {
        const message = e instanceof Error ? e.message : String(e);
        log(`要点エラー: ${message}`);
        if (mounted.current) setSummary({ kind: 'error', message });
      });
  }, [result, status.llmReady, engine]);

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
            <SummaryBlock
              state={summary}
              llmReady={status.llmReady}
              llmFailed={!!status.llmError}
              progress={status.progress}
              onCite={openSection}
            />

            <View style={styles.block} testID="top-result">
              <SectionLabel>いちばん近い資料（原文）</SectionLabel>
              {result.weak && (
                <Text style={[styles.body, { color: t.textSub }]} testID="weak-note">
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
                texts={[
                  result.top.chunk.title,
                  ...result.top.chunk.sentences,
                  ...result.extras.map((x) => x.chunk.sentences[x.lineIndex]),
                ]}
              />
            </View>

            {result.extras.length > 0 && (
              <View style={styles.block} testID="extras">
                <SectionLabel>あわせて確認</SectionLabel>
                {groupExtras(result.extras).map((g) => (
                  <View key={g.chunk.id} style={[styles.extra, { borderColor: t.border }]}>
                    {g.lines.map((i) => (
                      <View key={i} style={styles.point}>
                        <Text style={[styles.bullet, { color: t.accent }]}>・</Text>
                        <GlossaryText text={g.chunk.sentences[i]} used={used} style={[styles.body, { color: t.text }]} />
                      </View>
                    ))}
                    <Pressable
                      onPress={() => openSection(g.chunk.id, g.lines[0])}
                      accessibilityRole="link"
                      style={({ pressed }) => [styles.extraSource, { opacity: pressed ? 0.5 : 1 }]}
                    >
                      <Text style={[styles.small, { color: t.accent }]}>{g.chunk.title}</Text>
                      <ChevronIcon size={12} color={t.accent} />
                    </Pressable>
                  </View>
                ))}
              </View>
            )}

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

            <Text style={[styles.caption, { color: t.textSub }]}>
              資料は検証用の仮データです。命に関わるときは、迷わず110番か119番へ。
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

/** 「あわせて確認」の行を資料ごとにまとめる（資料の中の順に並べる） */
function groupExtras(extras: ExtraLine[]) {
  const groups: { chunk: ExtraLine['chunk']; lines: number[] }[] = [];
  for (const x of extras) {
    let g = groups.find((y) => y.chunk.id === x.chunk.id);
    if (!g) groups.push((g = { chunk: x.chunk, lines: [] }));
    g.lines.push(x.lineIndex);
  }
  groups.forEach((g) => g.lines.sort((a, b) => a - b));
  return groups;
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
  onCite,
}: {
  state: SummaryState;
  llmReady: boolean;
  llmFailed: boolean;
  progress: number;
  onCite: (id: string, line: number) => void;
}) {
  const { theme: t } = useApp();
  if (llmFailed && state.kind === 'idle') return null;
  return (
    <View style={[styles.card, styles.aiCard, { borderColor: t.accent }]} testID="summary">
      <View style={styles.aiLabel}>
        <SparkIcon color={t.accent} />
        <Text style={[styles.aiLabelText, { color: t.accent }]} accessibilityRole="header">
          AIが選んだ要点
        </Text>
      </View>
      {state.kind === 'idle' && (
        <Text style={[styles.small, { color: t.textSub }]} testID="summary-waiting">
          {!llmReady && progress > 0 && progress < 1
            ? `AIを準備中（${Math.round(progress * 100)}%）。下の原文は先に読めます`
            : 'AIを準備中。下の原文は先に読めます'}
        </Text>
      )}
      {state.kind === 'running' && (
        <View style={styles.aiWaiting}>
          <ActivityIndicator color={t.accent} />
          <Text style={[styles.small, { color: t.textSub, flex: 1 }]}>
            資料から選んでいます。下の原文は先に読めます
          </Text>
        </View>
      )}
      {state.kind === 'error' && (
        <Text style={[styles.small, { color: t.textSub }]}>AIが要点を選べませんでした。下の原文を見てください。</Text>
      )}
      {state.kind === 'done' && state.result.picks.length === 0 && (
        <Text style={[styles.small, { color: t.textSub }]}>AIが選べる行がありませんでした。下の原文を見てください。</Text>
      )}
      {state.kind === 'done' &&
        state.result.picks.map((p) => (
          <View key={`${p.chunk.id}-${p.lineIndex}`} style={styles.point}>
            <Text style={[styles.bullet, { color: t.accent }]}>・</Text>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={[styles.body, { color: t.text, fontWeight: '600' }]}>{p.chunk.sentences[p.lineIndex]}</Text>
              <Pressable
                onPress={() => onCite(p.chunk.id, p.lineIndex)}
                accessibilityRole="link"
                accessibilityLabel={`出典：${p.chunk.title}`}
                style={({ pressed }) => [styles.citeChip, { backgroundColor: t.accentSoft, opacity: pressed ? 0.6 : 1 }]}
              >
                <Text style={[styles.cite, { color: t.accent }]} numberOfLines={1}>
                  出典：{p.chunk.title}
                </Text>
                <ChevronIcon size={12} color={t.accent} />
              </Pressable>
            </View>
          </View>
        ))}
      {state.kind === 'done' && state.result.picks.length > 0 && (
        <Text style={[styles.small, { color: t.textSub }]}>
          資料の文をそのまま選んでいます。選び漏れがあるので、下の原文も見てください。
        </Text>
      )}
    </View>
  );
}

function NoHit({ question }: { question: string }) {
  const { theme: t } = useApp();
  return (
    <View style={styles.block} testID="no-hit">
      <Text style={[styles.cardTitle, { color: t.text }]}>「{question}」に関係する内容は、資料に見つかりませんでした</Text>
      <Text style={[styles.body, { color: t.text }]}>まず立ち止まって、落ち着く。命に関わるなら110番。</Text>
      <Text style={[styles.small, { color: t.textMuted }]}>近い状況を選ぶか、言葉を変えて検索できます。</Text>
      <View style={styles.situations}>
        {situations.map((s) => (
          <PressableCard
            key={s.label}
            onPress={() => router.replace({ pathname: '/result', params: { q: s.query } })}
            accessibilityLabel={s.label}
            style={[styles.situation, { backgroundColor: t.accentSoft }]}
          >
            <s.Icon size={20} color={t.accent} />
            <Text style={[styles.situationText, { color: t.text }]}>{s.label}</Text>
          </PressableCard>
        ))}
      </View>
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
  caption: { fontSize: font.caption, lineHeight: 21 },
  extra: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 6 },
  extraSource: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', minHeight: 44 },
  aiWaiting: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 44 },
  aiLabel: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  aiCard: { borderWidth: 1.5 },
  aiLabelText: { fontSize: 15, fontWeight: '700' },
  cite: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  citeChip: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 36, paddingHorizontal: 10, borderRadius: 10, maxWidth: '100%' },
  list: { borderRadius: 14, overflow: 'hidden' },
  listRow: { minHeight: minTouch, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  listText: { fontSize: 16, flexShrink: 1 },
  situations: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  situation: { flexBasis: '47%', flexGrow: 1, minHeight: 52, paddingHorizontal: 12, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  situationText: { fontSize: 16, fontWeight: '700', flexShrink: 1 },
  wideButton: { minHeight: 54, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  wideButtonText: { fontSize: 16 },
});
