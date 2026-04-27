import type { Song } from '../types';

export const SAMPLE_SONGS: Song[] = [
  {
    id: 'sample-twinkle',
    title: 'Twinkle, Twinkle, Little Star',
    composer: 'Traditional',
    scale: 'C',
    tempo: 100,
    createdAt: Date.now(),
    abc: `X:1
T:Twinkle, Twinkle, Little Star
C:Traditional
M:4/4
L:1/4
Q:1/4=100
K:C
CC GG | AA G2 | FF EE | DD C2 |
GG FF | EE D2 | GG FF | EE D2 |
CC GG | AA G2 | FF EE | DD C2 |`,
  },
  {
    id: 'sample-ode',
    title: 'Ode to Joy',
    composer: 'Beethoven',
    scale: 'C',
    tempo: 110,
    createdAt: Date.now(),
    abc: `X:1
T:Ode to Joy
C:Ludwig van Beethoven
M:4/4
L:1/4
Q:1/4=110
K:C
EE FG | GF ED | CC DE | E3/2D/2 D2 |
EE FG | GF ED | CC DE | D3/2C/2 C2 |`,
  },
  {
    id: 'sample-fulko-aankhama',
    title: 'Fulko Aankhama',
    composer: 'Traditional (Nepali)',
    scale: 'C',
    tempo: 100,
    createdAt: Date.now(),
    abc: `X:1
T:Fulko Aankhama
C:Traditional (Nepali)
M:4/4
L:1/8
Q:1/4=100
K:C
% Intro — "1st Part Music" (repeat 4x)
|: c2 A2 G2 z2 | E2 C2 D2 z2 :|
% "Music End" (repeat 2x)
|: E2 D E C2 z2 | A,2 C,2 C,2 z2 :|
% Verse — "1st part song" (repeat 2x)
|: C2 C A, C2 D2 | E2 z2 z2 z2 | D2 E2 F2 E2 | D2 z2 z2 z2 |
 D2 z2 C2 C A, | C2 D2 E2 D C | D2 D C D E D C | C2 z2 z2 z2 :|
% Verse 2
G2 G2 E2 G2 | A2 z2 A2 G2 | G2 A G F2 E2 | D2 z2 z2 z2 |
D2 z2 C2 C A, | C2 D2 E2 D C | D2 D C D E D C | C2 z2 z2 z2 |]`,
  },
  {
    id: 'sample-chromatic-3oct',
    title: 'All Chromatic Notes (3 octaves)',
    composer: 'Exercise',
    scale: 'C',
    tempo: 120,
    createdAt: Date.now(),
    abc: `X:1
T:All Chromatic Notes (3 octaves)
C:Exercise
M:4/4
L:1/4
Q:1/4=120
K:C
C, ^C, D, ^D, | E, F, ^F, G, | ^G, A, ^A, B, |
C ^C D ^D | E F ^F G | ^G A ^A B |
c ^c d ^d | e f ^f g | ^g a ^a b |
c'4 |`,
  },
  {
    id: 'sample-cmajor',
    title: 'C Major Scale',
    composer: 'Exercise',
    scale: 'C',
    tempo: 90,
    createdAt: Date.now(),
    abc: `X:1
T:C Major Scale
M:4/4
L:1/4
Q:1/4=90
K:C
CDEF GABc | cBAG FEDC |`,
  },
];
