// All sequences using sounds available in dirt-samples
// Using basic sample names: bd, sd, hh, cp, etc. (from dirt-samples)
// And synth sounds: sawtooth, square, triangle, sine

export const sequences = [
  // Simple test patterns for multi-track testing
  {
    id: 'test-kicks',
    name: 'TEST: Kicks Only',
    color: '#FF0000',
    bpm: 120,
    description: 'Just kicks - for testing multi-track',
    code: `s("bd*4").gain(0.9)`
  },
  {
    id: 'test-hats',
    name: 'TEST: Hats Only',
    color: '#00FF00',
    bpm: 120,
    description: 'Just hi-hats - for testing multi-track',
    code: `s("hh*8").gain(0.6)`
  },
  {
    id: 'deep-house',
    name: 'Deep House',
    color: '#8B5CF6',
    bpm: 130,
    description: 'Warm rolling bass, classic house stabs',
    code: `
stack(
  // Four-on-the-floor kick and hats
  s("bd*4, ~ cp ~ cp, [~ hh]*4")
    .gain("1 0.8 0.9 0.8"),

  // Rolling deep bass
  note("<a1 [a1 a1] a1 [g1 a1]>")
    .s("sawtooth")
    .cutoff(sine.range(200, 600).slow(8))
    .resonance(8)
    .decay(0.15)
    .sustain(0)
    .gain(0.6),

  // Classic house chord stab
  note("<[a3,c4,e4] ~ ~ ~, ~ ~ [g3,b3,d4] ~>")
    .s("sawtooth")
    .cutoff(2000)
    .attack(0.01)
    .decay(0.2)
    .sustain(0)
    .delay(0.3)
    .delaytime(0.375)
    .gain(0.3)
)
.room(0.2)
`
  },
  {
    id: 'drum-and-bass',
    name: 'Drum & Bass',
    color: '#EF4444',
    bpm: 170,
    description: 'Fast breaks, heavy sub bass, amen energy',
    code: `
stack(
  // Fast drum pattern
  s("bd [~ bd] ~ bd, ~ ~ cp ~, hh*8")
    .gain("1 0.7 0.9 0.8")
    .sometimes(x => x.speed(2)),

  // Heavy reese bass
  note("<a1!7 [g1 a1]>")
    .s("sawtooth")
    .cutoff(perlin.range(150, 800).slow(4))
    .resonance(5)
    .gain(0.5),

  // Stab hits
  note("<~ ~ [e4,a4,c5] ~>!2")
    .s("square")
    .cutoff(3000)
    .decay(0.05)
    .sustain(0)
    .room(0.4)
    .gain(0.25)
)
.fast(2)
`
  },
  {
    id: 'experimental',
    name: 'Experimental',
    color: '#10B981',
    bpm: 96,
    description: 'Broken rhythms, algorithmic chaos',
    code: `
stack(
  // Euclidean rhythm chaos
  s("bd sd hh cp")
    .euclid("3 5 7 11", 16)
    .speed(perlin.range(0.8, 1.5))
    .pan(rand)
    .gain(0.6),

  // Microtonal wandering
  note(sine.range(40, 70).segment(16))
    .s("triangle")
    .cutoff(rand.range(300, 2000))
    .decay(0.08)
    .gain(0.3)
    .delay(0.5)
    .delayfeedback(0.6),

  // Glitchy hits
  s("hh*16")
    .gain(rand.range(0, 0.4))
    .pan(rand)
    .speed("<1 2 0.5 1.5>")
)
.slow(2)
`
  },
  {
    id: 'uk-garage',
    name: 'UK Garage',
    color: '#F59E0B',
    bpm: 132,
    description: 'Skippy drums, wobbly bass',
    code: `
stack(
  // Classic 2-step pattern
  s("[bd ~] [~ bd] [~ bd] [bd ~]")
    .gain(0.9),

  // Shuffled snare/clap
  s("~ [cp@3 ~] ~ cp")
    .gain(0.7),

  // Skippy hi-hats
  s("[hh hh] [~ hh] [hh ~] [hh hh hh]")
    .gain("0.4 0.25 0.35 0.4 0.25 0.5 0.35")
    .pan(sine.range(0.3, 0.7).fast(2)),

  // Wobbly UKG bass
  note("<d2 [d2 ~] f2 [~ g2]>")
    .s("sawtooth")
    .cutoff(sine.range(300, 1200).fast(4))
    .resonance(12)
    .decay(0.2)
    .sustain(0.1)
    .gain(0.5),

  // Organ stabs
  note("<[d4,f4,a4] ~ ~ [c4,e4,g4], ~ ~ [d4,f4,a4]@2 ~>")
    .s("triangle")
    .cutoff(2500)
    .decay(0.15)
    .room(0.3)
    .gain(0.2)
)
`
  },
  {
    id: 'hypnotic',
    name: 'Hypnotic Techno',
    color: '#06B6D4',
    bpm: 138,
    description: 'Relentless, minimal, trance-inducing',
    code: `
stack(
  // Pounding kick
  s("bd*4")
    .shape(0.3)
    .gain(0.9),

  // Evolving hi-hats
  s("[~ hh]*4")
    .gain(sine.range(0.15, 0.4).slow(16))
    .pan(sine.slow(8)),

  // Hypnotic acid line
  note("<a2 a2 [a2 c3] a2 a2 [g2 a2] a2 [a2 d3]>")
    .s("sawtooth")
    .cutoff(sine.range(200, 2500).slow(8))
    .resonance(15)
    .decay(0.1)
    .sustain(0)
    .gain(0.4),

  // Droning pad
  note("[a3,e4]")
    .s("triangle")
    .cutoff(sine.range(400, 1200).slow(32))
    .attack(1)
    .release(1)
    .room(0.6)
    .gain(0.12),

  // Clap on 2 and 4
  s("~ cp ~ cp")
    .room(0.3)
    .gain(0.5)
)
.slow(2)
`
  }
];
