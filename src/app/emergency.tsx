// 救助を呼ぶ：110／119 への発信と、電話で言うことを番号つきで（場所 → 何があったか → …）。
// 場所には GPS の緯度経度、名前・持病には「わたしの情報」を、その場に出す。
// 伝える内容と順番は、県警の山岳遭難の案内（場所と座標・何があったか・氏名や持病・電池残量）をもとにしている。
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Linking, Platform, Pressable, ScrollView, StyleSheet, Text, View, type ScrollViewInstance } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import * as Clipboard from 'expo-clipboard';
import * as Battery from 'expo-battery';
import { router } from 'expo-router';
import { useApp } from '../state/app';
import { useProfile } from '../state/profile';
import { BatteryIcon, CheckIcon, CopyIcon, PhoneIcon } from '../ui/icons';
import { PressableCard, SectionLabel, TopBar } from '../ui/parts';
import type { Theme } from '../ui/theme';
import { formatFix, toDms, type Fix } from '../util/geo';

type LocState =
  | { kind: 'idle' }
  | { kind: 'locating'; last?: Fix }
  | { kind: 'ok'; fix: Fix }
  | { kind: 'denied' }
  | { kind: 'error'; message: string };

/** 電池残量（0〜1、分からなければ -1）。web など取れない環境でも落ちないようにする。 */
function useBattery() {
  const [level, setLevel] = useState(-1);
  useEffect(() => {
    let sub: { remove: () => void } | null = null;
    Battery.getBatteryLevelAsync()
      .then(setLevel)
      .catch(() => setLevel(-1));
    if (Platform.OS !== 'web') {
      try {
        sub = Battery.addBatteryLevelListener(({ batteryLevel }) => setLevel(batteryLevel));
      } catch {
        sub = null;
      }
    }
    return () => sub?.remove();
  }, []);
  return level;
}

export default function Emergency() {
  const { theme: t } = useApp();
  const { profile } = useProfile();
  const battery = useBattery();
  const [loc, setLoc] = useState<LocState>({ kind: 'idle' });
  const [checked, setChecked] = useState<boolean[]>([false, false, false, false, false, false]);
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<ScrollViewInstance>(null);
  const offlineY = useRef(0);

  const locate = useCallback(async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (perm.status !== 'granted') {
        setLoc({ kind: 'denied' });
        return;
      }
      const last = await Location.getLastKnownPositionAsync().catch(() => null);
      const toFix = (p: Location.LocationObject): Fix => ({
        lat: p.coords.latitude,
        lon: p.coords.longitude,
        accuracy: p.coords.accuracy ?? null,
        time: p.timestamp,
      });
      setLoc({ kind: 'locating', last: last ? toFix(last) : undefined });
      const cur = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setLoc({ kind: 'ok', fix: toFix(cur) });
    } catch (e) {
      setLoc({ kind: 'error', message: e instanceof Error ? e.message : String(e) });
    }
  }, []);

  // 画面を開いたらすぐに測り始める（locate の中の setState は await のあとなので、同期的な連鎖は起きない）
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    locate();
  }, [locate]);

  const call = (n: string) => Linking.openURL(`tel:${n}`);
  const fix = loc.kind === 'ok' ? loc.fix : loc.kind === 'locating' ? loc.last : undefined;
  const batteryPct = battery >= 0 ? Math.round(battery * 100) : null;
  const toggle = (i: number) => setChecked((prev) => prev.map((v, j) => (j === i ? !v : v)));

  const locationText = (f: Fix) =>
    [
      `現在地 ${formatFix(f)}`,
      `（${toDms(f.lat)} ${toDms(f.lon)}${f.accuracy ? `、誤差 約${Math.round(f.accuracy)}m` : ''}）`,
      profile.route ? `ルート ${profile.route}` : '',
      batteryPct != null ? `電話の電池 ${batteryPct}%` : '',
    ]
      .filter(Boolean)
      .join('\n');

  const copy = async () => {
    if (!fix) return;
    await Clipboard.setStringAsync(locationText(fix));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 家族などに、本文入りの SMS を開く（通話がつながらなくても届くことがある）
  const sms = () => {
    const body = `山で動けなくなっています。${fix ? `\n${locationText(fix)}` : ''}`;
    const to = profile.contactPhone.replace(/[^\d+]/g, '');
    const sep = Platform.OS === 'ios' ? '&' : '?';
    Linking.openURL(`sms:${to}${sep}body=${encodeURIComponent(body)}`);
  };

  const whoText = [profile.name, profile.age && `${profile.age}歳`].filter(Boolean).join('、');

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: t.bg }]} edges={['top', 'left', 'right']}>
      <TopBar title="救助を呼ぶ" hideEmergency />
      <ScrollView ref={scrollRef} contentContainerStyle={styles.content}>
        <View style={styles.calls}>
          <PressableCard
            onPress={() => call('110')}
            accessibilityLabel="110番に電話する（警察・山岳遭難）"
            testID="call-110"
            style={[styles.call, { backgroundColor: t.danger }]}
          >
            <PhoneIcon size={24} color={t.dangerText} />
            <View>
              <Text style={[styles.callNumber, { color: t.dangerText }]}>110</Text>
              <Text style={[styles.callLabel, { color: t.dangerText }]}>警察・山岳遭難</Text>
            </View>
          </PressableCard>
          <PressableCard
            onPress={() => call('119')}
            accessibilityLabel="119番に電話する（消防・救急）"
            testID="call-119"
            style={[styles.call, { backgroundColor: t.surface, borderColor: t.danger, borderWidth: 2 }]}
          >
            <PhoneIcon size={24} color={t.danger} />
            <View>
              <Text style={[styles.callNumber, { color: t.danger }]}>119</Text>
              <Text style={[styles.callLabel, { color: t.danger }]}>消防・救急</Text>
            </View>
          </PressableCard>
        </View>
        <Text style={[styles.note, { color: t.text }]}>
          山で動けないときは110番が基本。つながったら、その場を動かず、電話を切らない。
        </Text>
        <Pressable
          onPress={() => scrollRef.current?.scrollTo({ y: offlineY.current, animated: true })}
          accessibilityRole="button"
          style={({ pressed }) => [styles.linkRow, { opacity: pressed ? 0.5 : 1 }]}
        >
          <Text style={[styles.link, { color: t.accent }]}>電話がつながらないとき ↓</Text>
        </Pressable>

        <View style={styles.block}>
          <SectionLabel>電話で言うこと（この順に）</SectionLabel>
          <View style={[styles.list, { backgroundColor: t.surfaceAlt }]} testID="call-script">
            <Step n={1} title="いる場所" checked={checked[0]} onToggle={() => toggle(0)} t={t} first>
              {fix ? (
                <>
                  {formatFix(fix)
                    .split(' ')
                    .map((part) => (
                      <Text key={part} style={[styles.coord, { color: t.text }]} selectable>
                        {part}
                      </Text>
                    ))}
                  <Text style={[styles.value, { color: t.textSub }]} selectable>
                    {toDms(fix.lat)}　{toDms(fix.lon)}
                  </Text>
                  <Text style={[styles.hint, { color: t.textSub }]}>
                    {fix.accuracy ? `誤差 約${Math.round(fix.accuracy)}m・` : ''}
                    {new Date(fix.time).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })} に測定
                    {loc.kind === 'locating' ? '（更新中…）' : ''}
                  </Text>
                  <View style={styles.buttons}>
                    <SmallButton onPress={copy} label={copied ? 'コピーした' : 'コピー'} t={t}>
                      {copied ? <CheckIcon color={t.accent} /> : <CopyIcon color={t.text} />}
                    </SmallButton>
                    <SmallButton onPress={locate} label="もう一度測る" t={t} />
                  </View>
                </>
              ) : loc.kind === 'denied' ? (
                <>
                  <Text style={[styles.hint, { color: t.textSub }]}>
                    位置情報が許可されていません。設定で許可するか、iPhoneの「コンパス」アプリで北緯・東経を確認できます。
                  </Text>
                  <View style={styles.buttons}>
                    <SmallButton onPress={() => Linking.openSettings()} label="設定を開く" t={t} />
                  </View>
                </>
              ) : loc.kind === 'error' ? (
                <>
                  <Text style={[styles.hint, { color: t.textSub }]}>
                    現在地を測れませんでした。空が開けた場所で測り直すか、「コンパス」アプリで確認できます。
                  </Text>
                  <View style={styles.buttons}>
                    <SmallButton onPress={locate} label="もう一度測る" t={t} />
                  </View>
                </>
              ) : (
                <Text style={[styles.hint, { color: t.textSub }]}>GPSで測っています。圏外でも測れます…</Text>
              )}
              <Text style={[styles.hint, { color: t.textSub }]}>
                {profile.route ? `ルート：${profile.route}` : '山の名前、登山口、最後に通った場所も'}
              </Text>
            </Step>
            <Step n={2} title="何があったか、けがの有無" checked={checked[1]} onToggle={() => toggle(1)} t={t} />
            <Step n={3} title="人数" checked={checked[2]} onToggle={() => toggle(2)} t={t} />
            <Step n={4} title="名前・年齢・持病" checked={checked[3]} onToggle={() => toggle(3)} t={t}>
              {whoText || profile.medical ? (
                <>
                  {!!whoText && <Text style={[styles.value, { color: t.text }]}>{whoText}</Text>}
                  {!!profile.medical && <Text style={[styles.value, { color: t.text }]}>持病など：{profile.medical}</Text>}
                </>
              ) : (
                <Pressable onPress={() => router.push('/profile')} accessibilityRole="button" style={styles.linkRow}>
                  <Text style={[styles.link, { color: t.accent }]}>わたしの情報を入力</Text>
                </Pressable>
              )}
            </Step>
            <Step n={5} title="持っているもの" checked={checked[4]} onToggle={() => toggle(4)} t={t}>
              <Text style={[styles.hint, { color: t.textSub }]}>水・食べ物・ライト・防寒着</Text>
            </Step>
            <Step n={6} title="電話の電池" checked={checked[5]} onToggle={() => toggle(5)} t={t}>
              {batteryPct != null && <Text style={[styles.value, { color: t.text }]}>いま {batteryPct}%</Text>}
            </Step>
          </View>
        </View>

        <View style={styles.block}>
          <View style={styles.rowBetween}>
            <SectionLabel>家族への連絡</SectionLabel>
            <Pressable onPress={() => router.push('/profile')} accessibilityRole="button" style={styles.linkRow}>
              <Text style={[styles.link, { color: t.accent }]}>わたしの情報を編集</Text>
            </Pressable>
          </View>
          <View style={[styles.card, { backgroundColor: t.surfaceAlt }]} testID="profile-card">
            {profile.contactName || profile.contactPhone ? (
              <Text style={[styles.value, { color: t.text }]}>
                {[profile.contactName, profile.contactPhone].filter(Boolean).join('　')}
              </Text>
            ) : (
              <Text style={[styles.hint, { color: t.textSub }]}>緊急連絡先を入れておくと、ここから連絡できます。</Text>
            )}
            {!!profile.returnTime && (
              <Text style={[styles.hint, { color: t.textSub }]}>下山の予定時刻：{profile.returnTime}</Text>
            )}
            <View style={styles.buttons}>
              {!!profile.contactPhone && (
                <SmallButton onPress={() => call(profile.contactPhone.replace(/[^\d+]/g, ''))} label="電話する" t={t}>
                  <PhoneIcon size={18} color={t.text} />
                </SmallButton>
              )}
              <SmallButton onPress={sms} label={profile.contactPhone ? 'SMSで現在地を送る' : 'SMSで現在地を送る（宛先を選ぶ）'} t={t} />
            </View>
          </View>
        </View>

        <View style={styles.block} onLayout={(e) => (offlineY.current = e.nativeEvent.layout.y)}>
          <SectionLabel>電話がつながらないとき</SectionLabel>
          <View style={[styles.card, { backgroundColor: t.surfaceAlt }]}>
            <Text style={[styles.hint, { color: t.text }]}>
              ・iPhone 14以降は、圏外で110番に発信すると「衛星経由の緊急SOS」に切り替えられることがある。空が開けた場所で、画面の指示に従う。
            </Text>
            <Text style={[styles.hint, { color: t.text }]}>
              ・通話がつながらなくても、SMSは届くことがある。上の「SMSで現在地を送る」で家族や知人に知らせる。
            </Text>
            <Text style={[styles.hint, { color: t.text }]}>・道が分からないまま、電波を探して歩き回らない。</Text>
          </View>
        </View>

        {batteryPct != null && batteryPct <= 30 && (
          <View style={styles.row}>
            <BatteryIcon color={t.danger} />
            <Text style={[styles.hint, { color: t.danger }]}>電池 {batteryPct}%。画面を暗くして、必要なときだけ使う</Text>
          </View>
        )}
        {Platform.OS === 'web' && (
          <Text style={[styles.hint, { color: t.textSub }]}>（web版の確認用表示です。発信はスマホで行ってください）</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Step({
  n,
  title,
  checked,
  onToggle,
  t,
  first,
  children,
}: {
  n: number;
  title: string;
  checked: boolean;
  onToggle: () => void;
  t: Theme;
  first?: boolean;
  children?: ReactNode;
}) {
  return (
    <View style={[styles.step, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.border }]}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel={`${n}. ${title}`}
        style={({ pressed }) => [styles.stepHead, { opacity: pressed ? 0.6 : 1 }]}
      >
        <View
          style={[
            styles.num,
            { backgroundColor: checked ? t.accent : 'transparent', borderColor: checked ? t.accent : t.textSub },
          ]}
        >
          {checked ? (
            <CheckIcon size={16} color={t.accentText} strokeWidth={3} />
          ) : (
            <Text style={[styles.numText, { color: t.text }]}>{n}</Text>
          )}
        </View>
        <Text style={[styles.stepTitle, { color: checked ? t.textSub : t.text }]}>{title}</Text>
      </Pressable>
      {children ? <View style={styles.stepBody}>{children}</View> : null}
    </View>
  );
}

function SmallButton({ onPress, label, t, children }: { onPress: () => void; label: string; t: Theme; children?: ReactNode }) {
  return (
    <PressableCard onPress={onPress} accessibilityLabel={label} style={[styles.smallButton, { backgroundColor: t.surface }]}>
      {children}
      <Text style={[styles.smallButtonText, { color: t.text }]}>{label}</Text>
    </PressableCard>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  content: { padding: 20, gap: 16, paddingBottom: 48, maxWidth: 640, width: '100%', alignSelf: 'center' },
  calls: { flexDirection: 'row', gap: 12 },
  call: { flex: 1, minHeight: 88, borderRadius: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  callNumber: { fontSize: 30, fontWeight: '800', lineHeight: 34 },
  callLabel: { fontSize: 14, fontWeight: '700' },
  note: { fontSize: 16, lineHeight: 24 },
  linkRow: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center' },
  link: { fontSize: 16, fontWeight: '700' },
  block: { gap: 8 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  list: { borderRadius: 16, overflow: 'hidden' },
  step: { paddingHorizontal: 16, paddingVertical: 12, gap: 6 },
  stepHead: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 36 },
  num: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  numText: { fontSize: 16, fontWeight: '800' },
  stepTitle: { fontSize: 18, fontWeight: '700', flexShrink: 1 },
  stepBody: { paddingLeft: 42, gap: 4 },
  coord: { fontSize: 20, fontWeight: '700', fontVariant: ['tabular-nums'] },
  value: { fontSize: 17, lineHeight: 25, fontWeight: '600' },
  hint: { fontSize: 15, lineHeight: 23 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  card: { borderRadius: 16, padding: 16, gap: 8 },
  smallButton: { minHeight: 44, paddingHorizontal: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  smallButtonText: { fontSize: 16, fontWeight: '600' },
});
