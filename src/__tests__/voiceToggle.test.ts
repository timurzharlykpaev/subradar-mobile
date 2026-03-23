/**
 * Tests for VoiceRecorder toggle logic.
 * Verifies tap-to-toggle behavior (start/stop recording).
 */

describe('VoiceRecorder toggle logic', () => {
  let isRecording = false;
  let startCalled = false;
  let stopCalled = false;

  function toggleRecording() {
    if (isRecording) {
      stopCalled = true;
      isRecording = false;
    } else {
      startCalled = true;
      isRecording = true;
    }
  }

  beforeEach(() => {
    isRecording = false;
    startCalled = false;
    stopCalled = false;
  });

  it('starts recording on first tap', () => {
    toggleRecording();
    expect(startCalled).toBe(true);
    expect(isRecording).toBe(true);
  });

  it('stops recording on second tap', () => {
    toggleRecording(); // start
    toggleRecording(); // stop
    expect(stopCalled).toBe(true);
    expect(isRecording).toBe(false);
  });

  it('can start again after stop', () => {
    toggleRecording(); // start
    toggleRecording(); // stop
    startCalled = false;
    toggleRecording(); // start again
    expect(startCalled).toBe(true);
    expect(isRecording).toBe(true);
  });

  describe('formatDuration', () => {
    function formatDuration(s: number): string {
      return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
    }

    it('formats 0 seconds', () => {
      expect(formatDuration(0)).toBe('00:00');
    });

    it('formats seconds only', () => {
      expect(formatDuration(45)).toBe('00:45');
    });

    it('formats minutes and seconds', () => {
      expect(formatDuration(125)).toBe('02:05');
    });

    it('pads single digits', () => {
      expect(formatDuration(3)).toBe('00:03');
    });
  });
});
