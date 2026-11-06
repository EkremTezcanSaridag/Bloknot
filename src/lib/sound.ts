let audioContext: AudioContext | null = null

type SoundName = 'check' | 'uncheck' | 'create'

const NOTES: Record<SoundName, { from: number; to: number; duration: number }> = {
  check: { from: 620, to: 940, duration: 0.16 },
  uncheck: { from: 440, to: 300, duration: 0.12 },
  create: { from: 520, to: 780, duration: 0.12 },
}

/** Küçük, rahatsız etmeyen arayüz sesleri. */
export function playSound(name: SoundName = 'check'): void {
  try {
    const AudioCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AudioCtor) return

    audioContext ??= new AudioCtor()

    if (audioContext.state === 'suspended') {
      void audioContext.resume()
    }

    const now = audioContext.currentTime
    const config = NOTES[name]

    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()

    oscillator.type = 'sine'
    oscillator.frequency.setValueAtTime(config.from, now)
    oscillator.frequency.exponentialRampToValueAtTime(config.to, now + config.duration)

    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.055, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + config.duration)

    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.start(now)
    oscillator.stop(now + config.duration + 0.02)
  } catch {
    // Ses çalınamazsa uygulamayı bozmaya değmez.
  }
}
