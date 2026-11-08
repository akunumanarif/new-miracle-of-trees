import type { Animal } from "./animals";

export class AnimalAudio {
  private current: HTMLAudioElement | null = null;
  private ambient: HTMLAudioElement | null = null;
  private generation = 0;

  stop() {
    this.generation++;
    if (this.current) {
      this.current.onended = null;
      this.current.pause();
      this.current.currentTime = 0;
      this.current = null;
    }
    if (this.ambient) this.ambient.volume = .12;
  }

  async play(animal: Animal) {
    this.stop();
    const generation = this.generation;
    // Every animal requires its own sourced recording. Broken or missing audio
    // is reported by the caller, never replaced with synthetic tones.
    const recording = new Audio(`/dunia-hewan/audio/${animal.audio}.mp3`);
    recording.volume = .8;
    this.current = recording;
    if (this.ambient) this.ambient.volume = .025;
    recording.onended = () => {
      if (this.current === recording) {
        this.current = null;
        if (this.ambient) this.ambient.volume = .12;
      }
    };
    try {
      // Prepared clips finish naturally; there is no shared 7.5-second cutoff.
      await recording.play();
    } catch (error) {
      // Rapid selections may abort a previous play request. That is not a
      // failure of the newly selected animal's recording.
      if (generation !== this.generation) return;
      this.stop();
      throw error;
    }
  }

  async ambience(enabled: boolean) {
    if (!enabled) { this.ambient?.pause(); return; }
    this.ambient ??= new Audio("/dunia-hewan/audio/ambience-forest-49.mp3");
    this.ambient.loop = true;
    this.ambient.volume = this.current ? .025 : .12;
    await this.ambient.play();
  }

  dispose() { this.stop(); this.ambient?.pause(); }
}
