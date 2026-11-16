// ホームの「いまの状況」ボタン。押すとその文で検索する。
import type { ComponentType } from 'react';
import {
  BearIcon,
  CloudIcon,
  CompassIcon,
  CrossIcon,
  MoonIcon,
  NoSignalIcon,
  SunIcon,
  ThermoIcon,
} from '../ui/icons';

export type Situation = {
  label: string;
  query: string;
  Icon: ComponentType<{ size?: number; color: string }>;
};

export const situations: Situation[] = [
  { label: '道に迷った', query: '道に迷った', Icon: CompassIcon },
  { label: 'もうすぐ暗い', query: 'もうすぐ暗くなる', Icon: MoonIcon },
  { label: '寒い・震え', query: '寒くて震えが止まらない', Icon: ThermoIcon },
  { label: '電波がない', query: '電波がなくて助けを呼べない', Icon: NoSignalIcon },
  { label: 'けが人', query: 'けが人がいる', Icon: CrossIcon },
  { label: '天気が悪い', query: '雷や大雨で天気が崩れた', Icon: CloudIcon },
  { label: '暑い・めまい', query: '暑くてめまいがする', Icon: SunIcon },
  { label: 'クマ', query: 'クマに出会った', Icon: BearIcon },
];
