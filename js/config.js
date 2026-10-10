// Gzowo Tennis constants: court geometry, ball, players and feel tuning.
export const COURT = {
  halfLen: 11.885,
  halfW: 4.115,
  dblHalfW: 5.485,
  serviceLen: 6.4,
  netHalfW: 6.4,
};

export function netHeight(x) {
  const t = Math.min(1, Math.abs(x) / COURT.netHalfW);
  return 0.914 + 0.156 * t * t;
}

export const BALL_R = 0.034;
export const G = 9.81;
export const DRAG = 0.011;
export const MAGNUS = 3.2;

export const PLAYERS = [
  { name: 'Czerwony', color: '#ff5a4e', side: 1 },
  { name: 'Niebieski', color: '#3d8bff', side: -1 },
];

export const ASSIST = [
  { id: 'high', label: 'Dużo pomocy', move: 0.8, reach: 0.38 },
  { id: 'mid', label: 'Trochę', move: 0.5, reach: 0.32 },
  { id: 'off', label: 'Bez pomocy', move: 0, reach: 0.26 },
];

export const ROOM_SCALE = 3.0;
export const ARM_SCALE = 1.3;
export const GRIP_HEIGHT = 1.15;
export const HEAD_OFFSET = 0.36;
export const TIEBREAK_TO = 7;
