// 線のアイコン（react-native-svg）。絵文字は使わない。
import Svg, { Circle, Path, Rect } from 'react-native-svg';

type P = { size?: number; color: string; strokeWidth?: number };

const base = (size: number, color: string, sw: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: color,
  strokeWidth: sw,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const SearchIcon = ({ size = 20, color, strokeWidth = 2.2 }: P) => (
  <Svg {...base(size, color, strokeWidth)}>
    <Circle cx="11" cy="11" r="7" />
    <Path d="M20 20l-3.5-3.5" />
  </Svg>
);
export const BackIcon = ({ size = 22, color, strokeWidth = 2.4 }: P) => (
  <Svg {...base(size, color, strokeWidth)}>
    <Path d="M15 5l-7 7 7 7" />
  </Svg>
);
export const ChevronIcon = ({ size = 14, color, strokeWidth = 2.6 }: P) => (
  <Svg {...base(size, color, strokeWidth)}>
    <Path d="M9 6l6 6-6 6" />
  </Svg>
);
export const CloseIcon = ({ size = 18, color, strokeWidth = 2.4 }: P) => (
  <Svg {...base(size, color, strokeWidth)}>
    <Path d="M6 6l12 12M18 6L6 18" />
  </Svg>
);
export const PhoneIcon = ({ size = 20, color, strokeWidth = 2 }: P) => (
  <Svg {...base(size, color, strokeWidth)}>
    <Path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
  </Svg>
);
export const BookIcon = ({ size = 20, color, strokeWidth = 2 }: P) => (
  <Svg {...base(size, color, strokeWidth)}>
    <Path d="M5 4h10l4 4v12H5z" />
    <Path d="M9 12h6M9 16h6" />
  </Svg>
);
export const MoonIcon = ({ size = 20, color, strokeWidth = 2 }: P) => (
  <Svg {...base(size, color, strokeWidth)}>
    <Path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z" />
  </Svg>
);
export const SunIcon = ({ size = 20, color, strokeWidth = 2 }: P) => (
  <Svg {...base(size, color, strokeWidth)}>
    <Circle cx="12" cy="12" r="4" />
    <Path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" />
  </Svg>
);
export const ClockIcon = ({ size = 18, color, strokeWidth = 2 }: P) => (
  <Svg {...base(size, color, strokeWidth)}>
    <Circle cx="12" cy="12" r="9" />
    <Path d="M12 7v5l3 2" />
  </Svg>
);
export const SparkIcon = ({ size = 16, color, strokeWidth = 2 }: P) => (
  <Svg {...base(size, color, strokeWidth)}>
    <Path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" />
  </Svg>
);
export const PinIcon = ({ size = 20, color, strokeWidth = 2 }: P) => (
  <Svg {...base(size, color, strokeWidth)}>
    <Path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z" />
    <Circle cx="12" cy="9.5" r="2.5" />
  </Svg>
);
export const CopyIcon = ({ size = 18, color, strokeWidth = 2 }: P) => (
  <Svg {...base(size, color, strokeWidth)}>
    <Rect x="8" y="8" width="12" height="12" rx="2" />
    <Path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
  </Svg>
);
export const CheckIcon = ({ size = 18, color, strokeWidth = 2.4 }: P) => (
  <Svg {...base(size, color, strokeWidth)}>
    <Path d="M5 12l5 5L20 7" />
  </Svg>
);

// 状況ボタン用
export const CompassIcon = ({ size = 20, color, strokeWidth = 2 }: P) => (
  <Svg {...base(size, color, strokeWidth)}>
    <Circle cx="12" cy="12" r="9" />
    <Path d="M15.5 8.5l-2 5-5 2 2-5z" />
  </Svg>
);
export const ThermoIcon = ({ size = 20, color, strokeWidth = 2 }: P) => (
  <Svg {...base(size, color, strokeWidth)}>
    <Path d="M10 13.5V5a2 2 0 1 1 4 0v8.5a4 4 0 1 1-4 0z" />
  </Svg>
);
export const NoSignalIcon = ({ size = 20, color, strokeWidth = 2 }: P) => (
  <Svg {...base(size, color, strokeWidth)}>
    <Path d="M4 20h2M9 20v-4M14 20v-8M19 20V8" />
    <Path d="M3 4l18 14" />
  </Svg>
);
export const CrossIcon = ({ size = 20, color, strokeWidth = 2 }: P) => (
  <Svg {...base(size, color, strokeWidth)}>
    <Path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5z" />
  </Svg>
);
export const CloudIcon = ({ size = 20, color, strokeWidth = 2 }: P) => (
  <Svg {...base(size, color, strokeWidth)}>
    <Path d="M7 16a4 4 0 0 1 0-8 6 6 0 0 1 11 2 3 3 0 0 1 0 6z" />
    <Path d="M11 18l-1 3M15 18l-1 3" />
  </Svg>
);
export const BearIcon = ({ size = 20, color, strokeWidth = 2 }: P) => (
  <Svg {...base(size, color, strokeWidth)}>
    <Circle cx="12" cy="13" r="6" />
    <Circle cx="7" cy="6" r="2" />
    <Circle cx="17" cy="6" r="2" />
  </Svg>
);
export const BatteryIcon = ({ size = 20, color, strokeWidth = 2 }: P) => (
  <Svg {...base(size, color, strokeWidth)}>
    <Rect x="3" y="7" width="16" height="10" rx="2" />
    <Path d="M21 11v2" />
  </Svg>
);
