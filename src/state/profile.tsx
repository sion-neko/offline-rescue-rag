// わたしの情報：登山前に入れておき、通報のときに読み上げる。端末の中だけに保存する。
// アプリ全体で共有し、保存したらホームや救助画面にすぐ反映する。
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type Profile = {
  name: string;
  age: string;
  medical: string;
  contactName: string;
  contactPhone: string;
  route: string;
  returnTime: string;
};

export const emptyProfile: Profile = {
  name: '',
  age: '',
  medical: '',
  contactName: '',
  contactPhone: '',
  route: '',
  returnTime: '',
};

export const profileFields: {
  key: keyof Profile;
  label: string;
  placeholder: string;
  keyboard?: 'phone-pad' | 'number-pad';
}[] = [
  { key: 'name', label: '名前', placeholder: '山田 花子' },
  { key: 'age', label: '年齢', placeholder: '34', keyboard: 'number-pad' },
  { key: 'medical', label: '持病・アレルギー・飲んでいる薬', placeholder: 'なし' },
  { key: 'contactName', label: '緊急連絡先（名前・続柄）', placeholder: '山田 太郎（夫）' },
  { key: 'contactPhone', label: '緊急連絡先の電話番号', placeholder: '090-0000-0000', keyboard: 'phone-pad' },
  { key: 'route', label: '今日の山とルート', placeholder: '高尾山　稲荷山コースで登り、6号路で下山' },
  { key: 'returnTime', label: '下山の予定時刻', placeholder: '16:00' },
];

const KEY = 'profile';

type Ctx = { profile: Profile; save: (p: Profile) => Promise<void>; loaded: boolean; filled: boolean };
const ProfileCtx = createContext<Ctx | null>(null);

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((v) => v && setProfile({ ...emptyProfile, ...JSON.parse(v) }))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  const save = useCallback(async (p: Profile) => {
    setProfile(p);
    try {
      await AsyncStorage.setItem(KEY, JSON.stringify(p));
    } catch {
      // 保存できなくても、アプリを閉じるまでは使える
    }
  }, []);

  const filled = Object.values(profile).some((v) => v.trim() !== '');
  const value = useMemo(() => ({ profile, save, loaded, filled }), [profile, save, loaded, filled]);
  return <ProfileCtx.Provider value={value}>{children}</ProfileCtx.Provider>;
}

export function useProfile() {
  const v = useContext(ProfileCtx);
  if (!v) throw new Error('ProfileProvider の外です');
  return v;
}
