// わたしの情報：登山前に入れておき、通報のときに読み上げる。端末の中だけに保存する。
import { useCallback, useEffect, useState } from 'react';
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

export const profileFields: { key: keyof Profile; label: string; placeholder: string; keyboard?: 'phone-pad' | 'number-pad' }[] = [
  { key: 'name', label: '名前', placeholder: '山田 花子' },
  { key: 'age', label: '年齢', placeholder: '34', keyboard: 'number-pad' },
  { key: 'medical', label: '持病・アレルギー・飲んでいる薬', placeholder: 'なし' },
  { key: 'contactName', label: '緊急連絡先（名前・続柄）', placeholder: '山田 太郎（夫）' },
  { key: 'contactPhone', label: '緊急連絡先の電話番号', placeholder: '090-0000-0000', keyboard: 'phone-pad' },
  { key: 'route', label: '今日の山とルート', placeholder: '高尾山　稲荷山コースで登り、6号路で下山' },
  { key: 'returnTime', label: '下山の予定時刻', placeholder: '16:00' },
];

const KEY = 'profile';

export function useProfile() {
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
      // 保存できなくても、この画面の間は使える
    }
  }, []);

  const filled = Object.values(profile).some((v) => v.trim() !== '');
  return { profile, save, loaded, filled };
}
