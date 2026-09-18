let sharedContext: AudioContext | null = null;

const WORKLET_MODULES = ['/worklets/recorder-tap-processor.js'];

export async function getSharedAudioContext(): Promise<AudioContext> {
  if (sharedContext && sharedContext.state !== 'closed') {
    if (sharedContext.state === 'suspended') await sharedContext.resume();
    return sharedContext;
  }
  sharedContext = new AudioContext();
  await sharedContext.resume();
  await Promise.all(WORKLET_MODULES.map((url) => sharedContext!.audioWorklet.addModule(url)));
  return sharedContext;
}
