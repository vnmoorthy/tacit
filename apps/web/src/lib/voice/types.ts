export type VoiceState = "idle" | "listening" | "thinking" | "speaking" | "off";

export interface VoiceEvents {
  onState(state: VoiceState): void;
  onLevel(level: number): void;
  onError(message: string): void;
}
