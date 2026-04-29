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
  {
    id: 'sample-happy-birthday',
    title: 'Happy Birthday to You',
    composer: 'Patty & Mildred Hill (1893)',
    scale: 'G',
    tempo: 80,
    createdAt: Date.now(),
    abc: `X:1
T:Happy Birthday to You
C:Patty & Mildred Hill (1893)
M:3/4
L:1/8
Q:1/4=80
K:G
D D | E2 D2 G2 | F6 | D D | E2 D2 A2 | G6 |
D D | d2 B2 G2 | F2 E2 c2 | c c B2 G2 | A2 G6 |]`,
  },
  {
    id: 'sample-jingle-bells',
    title: 'Jingle Bells',
    composer: 'James Lord Pierpont (1857)',
    scale: 'G',
    tempo: 120,
    createdAt: Date.now(),
    abc: `X:1
T:Jingle Bells (chorus)
C:James Lord Pierpont (1857)
M:4/4
L:1/8
Q:1/4=120
K:G
B2 B2 B4 | B2 B2 B4 | B2 B2 G2 A2 | B8 |
c2 c2 c2 c2 | c2 B2 B2 B2 | B2 A2 A2 B2 | A4 D4 |
B2 B2 B4 | B2 B2 B4 | B2 B2 G2 A2 | B8 |
c2 c2 c2 c2 | c2 B2 B2 B2 | d2 d2 c2 A2 | G8 |]`,
  },
  {
    id: 'sample-mary-lamb',
    title: 'Mary Had a Little Lamb',
    composer: 'Traditional (Sarah Josepha Hale, 1830)',
    scale: 'C',
    tempo: 100,
    createdAt: Date.now(),
    abc: `X:1
T:Mary Had a Little Lamb
C:Traditional / Sarah Josepha Hale (1830)
M:4/4
L:1/4
Q:1/4=100
K:C
E D C D | E E E2 | D D D2 | E G G2 |
E D C D | E E E E | D D E D | C4 |]`,
  },
  {
    id: 'sample-amazing-grace',
    title: 'Amazing Grace',
    composer: 'John Newton (1779)',
    scale: 'G',
    tempo: 80,
    createdAt: Date.now(),
    abc: `X:1
T:Amazing Grace
C:John Newton (1779)
M:3/4
L:1/8
Q:1/4=80
K:G
D2 | G3 B G2 | B3 A G2 | E6 | D6 |
G3 B G2 | B3 A B2 | d6 | d4 z2 |
e3 d B2 | d3 B G2 | E6 | D6 |
G3 B G2 | B3 A G2 | G6 | G4 z2 |]`,
  },
  {
    id: 'sample-greensleeves',
    title: 'Greensleeves',
    composer: 'Traditional (English, 16th c.)',
    scale: 'Am',
    tempo: 80,
    createdAt: Date.now(),
    abc: `X:1
T:Greensleeves
C:Traditional (English, 16th c.)
M:6/8
L:1/8
Q:3/8=80
K:Am
A | c2 d e2 ^f | e2 d B2 G | A2 B c2 A | A2 ^G E2 A |
c2 d e2 ^f | e2 d B2 G | A2 ^G F2 E | E3 A3 |
g3 g2 ^f | e2 d B2 G | A2 B c2 A | A2 ^G E2 A |
g3 g2 ^f | e2 d B2 G | A2 ^G F2 E | E3 A3 |]`,
  },
  {
    id: 'sample-when-saints',
    title: 'When the Saints Go Marching In',
    composer: 'Traditional (American Spiritual)',
    scale: 'F',
    tempo: 120,
    createdAt: Date.now(),
    abc: `X:1
T:When the Saints Go Marching In
C:Traditional (American Spiritual)
M:4/4
L:1/4
Q:1/4=120
K:F
F A | c2 z F | A c B A | c4 |
z F A c | B A G F | E G A2 | F4 |
c c c B | A2 z F | A c B A | c2 z2 |
A G F G | A G F E | F4 | F4 |]`,
  },
  {
    id: 'sample-auld-lang-syne',
    title: 'Auld Lang Syne',
    composer: 'Robert Burns (1788)',
    scale: 'F',
    tempo: 90,
    createdAt: Date.now(),
    abc: `X:1
T:Auld Lang Syne
C:Robert Burns (1788) / Trad. Scottish
M:4/4
L:1/8
Q:1/4=90
K:F
C2 | F4 F2 A2 | A4 G2 c2 | d4 c2 A2 | A4 F2 G2 |
A4 G2 A2 | F4 D2 D2 | C4 D2 F2 | F6 A2 |
c4 A2 F2 | F4 G2 A2 | c4 A2 F2 | F4 G2 A2 |
G4 D2 F2 | F4 D2 G2 | F4 D2 D2 | C6 |]`,
  },
  {
    id: 'sample-frere-jacques',
    title: 'Frère Jacques',
    composer: 'Traditional (French)',
    scale: 'C',
    tempo: 120,
    createdAt: Date.now(),
    abc: `X:1
T:Frère Jacques
C:Traditional (French)
M:4/4
L:1/4
Q:1/4=120
K:C
C D E C | C D E C | E F G2 | E F G2 |
G/2A/2 G/2F/2 E C | G/2A/2 G/2F/2 E C | C G, C2 | C G, C2 |]`,
  },
  {
    id: 'sample-yankee-doodle',
    title: 'Yankee Doodle',
    composer: 'Traditional (American, 18th c.)',
    scale: 'G',
    tempo: 120,
    createdAt: Date.now(),
    abc: `X:1
T:Yankee Doodle
C:Traditional (American, 18th c.)
M:2/4
L:1/8
Q:1/4=120
K:G
G2 G A | B2 c2 | B A G B | A4 |
G2 G A | B2 c B | A G F G | A2 D2 |
G2 G A | B2 c2 | B A G B | A2 G2 |
D2 E2 | F2 G2 | A2 D2 | G4 |]`,
  },
  {
    id: 'sample-resham-firiri',
    title: 'Resham Firiri',
    composer: 'Buddhi Pariyar / Trad. Nepali (1969)',
    scale: 'C',
    tempo: 110,
    createdAt: Date.now(),
    abc: `X:1
T:Resham Firiri
T:रेशम फिरिरी
C:Buddhi Pariyar / Trad. Nepali (1969)
M:4/4
L:1/8
Q:1/4=110
K:C
% "Re-sham fi-ri-ri" — phrase 1
C D E G E D C2 |
% "re-sham fi-ri-ri" — phrase 2
C D E G E D C2 |
% "u-de-ra jau-n ki"
G A B c B A G2 |
% "da-da ma bhan-jyang"
G E D E D C C2 |
% "re-sham fi-ri-ri" — closing
C D E G E D C4 |]`,
  },
  {
    id: 'sample-fur-elise',
    title: 'Für Elise (theme)',
    composer: 'Ludwig van Beethoven (1810)',
    scale: 'Am',
    tempo: 60,
    createdAt: Date.now(),
    abc: `X:1
T:Für Elise (theme)
C:Ludwig van Beethoven (1810)
M:3/8
L:1/16
Q:1/8=120
K:Am
e ^d | e ^d e B d c | A3 z C E | A3 z B,2 | E3 z ^G B |
c3 z B e | e ^d e ^d e B | d c A3 z | C E A3 z |
B2 E3 c | B3 z A2 |]`,
  },
  {
    id: 'sample-tum-hi-ho',
    title: 'Tum Hi Ho (Aashiqui 2 theme)',
    composer: 'Mithoon',
    scale: 'A',
    tempo: 80,
    createdAt: Date.now(),
    abc: `X:1
T:Tum Hi Ho (Aashiqui 2 theme)
C:Mithoon
M:4/4
L:1/8
Q:1/4=80
K:A
% Prelude (x4):  ,D S G G M S R ,N
|: F A c c d A B G :|
% Verse line 1
c2 f e e d d c B A B d c2 |
% Verse line 2
B B A B B A G F E F E F |
% Verse line 3 (Tujh se juda...)
c c f e e d d c B A B e d c2 |
% Verse line 4
A B B B A B B A G F E F E F |
% Hook "tum hi ho" 1
A B c A B A B c A B |
% Hook tail (zindagi...)
G B A G F G E F G A B |
% Chain bhi
c A B A B c A B |
% Meri aashiqui
G G G B A G F G E F4 |
% Interlude (melodica): F G A B  B c B A G  B c B A G  A B A G F G F
F G A B | B c B A G | B c B A G | A B A G F G F |
% Antara 1
c f e e d d c B A B d c2 |
B B A B B B A G F E F E F |
c f e e d d c B A B d c2 |
B B B A B B A G F E F E F |
E F G G G G G d d c B c B |
c f e f e c c B B A B A G A G |
% Antara 2
f f e e f f g g e e |
c c d d f f g g e e |
d d c d c d c B A A d c |
d d c d c e d c B A A d c |
E F G G F G G d d c c B c B c |
c f e f f c c B B A B A G A G |
% Conclude (modulated hook)
c e f c e c e f c e |
B e d c B c A B c d e |
f c e c e f c e |
G G G B A G F G E F4 |]`,
  },
  {
    id: 'sample-krishna-govind',
    title: 'Shri Krishna Govind Hare Murari',
    composer: 'Traditional bhajan (popular setting: Ravindra Jain, 1993)',
    scale: 'C',
    tempo: 90,
    createdAt: Date.now(),
    abc: `X:1
T:Shri Krishna Govind Hare Murari
C:Traditional bhajan
M:4/4
L:1/8
Q:1/4=90
K:C
% Sthayi (refrain) — Sa = C; original scale F#, Kaherva 8-beat
% ,P S S S S S  G R G R S ,N ,N
G, C C C C C  E D E D C B, B, |
% ,N R R G M G  R G R S S S
B, D D E F E  D E D C C C2 |
% Antara
% G G P P P P P P  D P M G R
E E G G G G G G  A G F E D2 |
% P P S' S' S' P P P P  D P M G R
G G c c c G G G G  A G F E D2 |
% Return to sthayi
G, C C C C C  E D E D C B, B, |
B, D D E F E  D E D C C C2 |]`,
  },
  {
    id: 'sample-user-melody-1',
    title: 'Custom Melody',
    composer: 'User',
    scale: 'C',
    tempo: 100,
    createdAt: Date.now(),
    abc: `X:1
T:Custom Melody
M:none
L:1/8
Q:1/4=100
K:C
A D C B2 A G F E | D E F E D C D A | A D C B2 A G F E | D E F E D C D A |
B2 G F E D C D C | D G A B2 C D E D | C B2 A A G F E D | C C D A B2 C D E |
D C C D F E D A | D C B2 A d e A D | C B2 A d e f e D | C B2 A G f e D C D |
D C B2 A d e D C | B2 A d e f e D C | B2 A G f e D C D |
a c d f d c a g | f e d c B2 A G F E D | a c d f d c a g | f e d c B2 A G F E D |
D E F G A B2 c b2 a g f e D | D E F G A B2 c b2 a g f e D |
A D C B2 A G F E | D E F E D C D A | A D C B2 A G F E | D E F E D C D A |
A D C B2 A G F E | D E F E D C D A | A D C B2 A G F E | D E F E D C D A |
G F E D C B2 A C | B2 A G F E D D E | F G A B2 c A G F | E D C B2 A G F E | D C B2 A |
A D C B2 A d e A | D C B2 A d e f e | D C B2 A G f e D C D |
D C B2 A d e D C | B2 A d e f e D C | B2 A G f e D C D |
a c d f d c a g | f e d c B2 A G F E D | a c d f d c a g | f e d c B2 A G F E D |
D E F G A B2 c b2 a g f e D | D E F G A B2 c b2 a g f e D |
A D C B2 A G F E | D E F E D C D A | A D C B2 A G F E | D E F E D C D A |
G F E D C B2 A C | B2 A G F E D |
A D C B2 A G F E | D E F E D C D A | G F E D C B2 A C | B2 A G F E D |
D E F G A B2 c A | G F E D C B2 A | A B2 C D C B2 A |
A D C B2 A d e A | D C B2 A d e f e | D C B2 A G f e D C D |
D C B2 A d e D C | B2 A d e f e D C | B2 A G f e D C D |
a d c b2 a d e a | d c b2 a d e f e | d c b2 a g f e d c d |
d c b2 a d e d c | b2 a d e f e d c | b2 a g f e d c d |]`,
  },
  {
    id: 'sample-fulko-ankhama-v2',
    title: 'Fulko Aankhama (variant)',
    composer: 'Traditional (Nepali)',
    scale: 'C',
    tempo: 100,
    createdAt: Date.now(),
    abc: `X:1
T:Fulko Aankhama (variant)
C:Traditional (Nepali)
M:4/4
L:1/16
Q:1/4=100
K:C
c2 c A c2 d2 e8 | e d e2 f2 e2 d8 | d4 c2 A2 c2 d2 e4 | d2 d c d e d2 c8 |
g2 g2 e2 g2 a4 a4 | g2 g2 f2 e2 d8 | d4 c2 A2 c2 d2 e4 | d2 d c d e d2 c8 |
c2 c A c2 d2 e8 | e d e2 f2 e2 d8 | d4 c2 A2 c2 d2 e4 | d2 d c d e d2 c8 |
d2 d c d e d2 c8 |
c2 c A c2 d2 e8 | e d e2 f2 e2 d8 | d4 c2 A2 c2 d2 e4 | d2 d c d e d2 c8 |]`,
  },
];
