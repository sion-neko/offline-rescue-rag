// 色と文字の大きさ。ライト／ダーク（夜・節電）を切り替えられる。
// ダークは有機EL画面で電池を節約できるよう、背景を真っ黒にしている。

export type Theme = {
  dark: boolean;
  bg: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textSub: string;
  textMuted: string;
  accent: string;
  accentText: string;
  accentSoft: string;
  danger: string;
  dangerText: string;
  dangerSoft: string;
  mark: string;
  overlay: string;
};

export const light: Theme = {
  dark: false,
  bg: '#ffffff',
  surface: '#ffffff',
  surfaceAlt: '#f2f2f5',
  border: '#dedee3',
  text: '#1c1c1e',
  textSub: '#3a3a3c',
  textMuted: '#636366',
  accent: '#1f5e4b',
  accentText: '#ffffff',
  accentSoft: '#e4efe9',
  danger: '#b42318',
  dangerText: '#ffffff',
  dangerSoft: '#fdecea',
  mark: '#fbe7a1',
  overlay: 'rgba(0,0,0,0.4)',
};

export const dark: Theme = {
  dark: true,
  bg: '#000000',
  surface: '#0d0d0f',
  surfaceAlt: '#1c1c1e',
  border: '#2c2c2e',
  text: '#f2f2f7',
  textSub: '#d1d1d6',
  textMuted: '#a1a1a6',
  accent: '#7fd1ad',
  accentText: '#00140c',
  accentSoft: '#17332a',
  danger: '#ff453a',
  dangerText: '#000000',
  dangerSoft: '#3a1512',
  mark: '#5c4a12',
  overlay: 'rgba(0,0,0,0.6)',
};

export const font = {
  title: 26,
  heading: 19,
  body: 17,
  small: 15,
  caption: 14,
};

/** 押しやすさの最小サイズ（Apple のガイドラインは 44pt。緊急時を考えて少し大きめ） */
export const minTouch = 48;
