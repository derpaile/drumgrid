/*
 * Low-latency drum transient detector for the Web Audio render thread.
 *
 * Messages accepted on `port`:
 *   { type: "configure", config: { refractoryMs: 45, ... } }
 *   { type: "reset" }
 *
 * Onsets are posted as:
 *   { type: "onset", contextTime, strength, confidence, noiseFloor, threshold }
 */

const DEFAULT_CONFIG = Object.freeze({
  enabled: true,
  highpassHz: 35,
  envelopeAttackMs: 0.6,
  envelopeReleaseMs: 10,
  baselineAttackMs: 28,
  baselineReleaseMs: 140,
  noiseRiseMs: 1000,
  noiseFallMs: 120,
  warmupMs: 120,
  minThreshold: 0.004,
  noiseMultiplier: 1.8,
  hysteresis: 0.35,
  peakSearchMs: 10,
  refractoryMs: 40,
});

const CONFIG_LIMITS = Object.freeze({
  highpassHz: [5, 500],
  envelopeAttackMs: [0.05, 20],
  envelopeReleaseMs: [1, 250],
  baselineAttackMs: [2, 500],
  baselineReleaseMs: [5, 2000],
  noiseRiseMs: [20, 10000],
  noiseFallMs: [10, 5000],
  warmupMs: [0, 2000],
  minThreshold: [0.000001, 1],
  noiseMultiplier: [0, 20],
  hysteresis: [0.05, 0.95],
  peakSearchMs: [1, 30],
  refractoryMs: [10, 250],
});

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function smoothingCoefficient(milliseconds) {
  if (milliseconds <= 0) return 0;
  return Math.exp(-1 / (sampleRate * milliseconds * 0.001));
}

class AudioOnsetProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();

    this.config = { ...DEFAULT_CONFIG };
    const initialConfig = options?.processorOptions?.config;
    if (initialConfig && typeof initialConfig === "object") {
      this.applyConfig(initialConfig, false);
    } else {
      this.updateDerivedValues();
    }
    this.resetState();

    this.port.onmessage = (event) => {
      const message = event.data;
      if (!message || typeof message !== "object") return;

      if (message.type === "reset") {
        this.resetState();
        this.port.postMessage({ type: "reset-complete" });
        return;
      }

      if (message.type === "configure" || message.type === "config") {
        const patch =
          message.config && typeof message.config === "object"
            ? message.config
            : message;
        this.applyConfig(patch, true);
      }
    };

    this.port.postMessage({
      type: "ready",
      sampleRate,
      config: { ...this.config },
    });
  }

  applyConfig(patch, acknowledge) {
    if (typeof patch.enabled === "boolean") {
      this.config.enabled = patch.enabled;
    }

    for (const [key, limits] of Object.entries(CONFIG_LIMITS)) {
      const value = patch[key];
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      this.config[key] = clamp(value, limits[0], limits[1]);
    }

    this.updateDerivedValues();

    if (acknowledge) {
      this.port.postMessage({ type: "configured", config: { ...this.config } });
    }
  }

  updateDerivedValues() {
    this.dcCoefficient = Math.exp(
      (-2 * Math.PI * this.config.highpassHz) / sampleRate,
    );
    this.envelopeAttackCoefficient = smoothingCoefficient(
      this.config.envelopeAttackMs,
    );
    this.envelopeReleaseCoefficient = smoothingCoefficient(
      this.config.envelopeReleaseMs,
    );
    this.baselineAttackCoefficient = smoothingCoefficient(
      this.config.baselineAttackMs,
    );
    this.baselineReleaseCoefficient = smoothingCoefficient(
      this.config.baselineReleaseMs,
    );
    this.noiseRiseCoefficient = smoothingCoefficient(this.config.noiseRiseMs);
    this.noiseFallCoefficient = smoothingCoefficient(this.config.noiseFallMs);
    this.warmupNoiseCoefficient = smoothingCoefficient(15);
    this.warmupFrames = Math.round(
      sampleRate * this.config.warmupMs * 0.001,
    );
    this.peakSearchFrames = Math.max(
      1,
      Math.round(sampleRate * this.config.peakSearchMs * 0.001),
    );
    this.refractoryFrames = Math.max(
      1,
      Math.round(sampleRate * this.config.refractoryMs * 0.001),
    );
  }

  resetState() {
    this.previousInputs = [];
    this.previousHighpass = [];
    this.envelope = 0;
    this.baseline = 0;
    this.noiseFloor = this.config.minThreshold * 0.25;
    this.candidate = null;
    this.refractoryUntilFrame = -Infinity;
    this.armed = true;
    this.processedFrames = 0;
  }

  resizeChannelState(channelCount) {
    while (this.previousInputs.length < channelCount) {
      this.previousInputs.push(0);
      this.previousHighpass.push(0);
    }
    if (this.previousInputs.length > channelCount) {
      this.previousInputs.length = channelCount;
      this.previousHighpass.length = channelCount;
    }
  }

  updateEnvelope(sampleMagnitude) {
    const coefficient =
      sampleMagnitude > this.envelope
        ? this.envelopeAttackCoefficient
        : this.envelopeReleaseCoefficient;
    this.envelope =
      coefficient * this.envelope + (1 - coefficient) * sampleMagnitude;

    const baselineCoefficient =
      this.envelope > this.baseline
        ? this.baselineAttackCoefficient
        : this.baselineReleaseCoefficient;
    this.baseline =
      baselineCoefficient * this.baseline +
      (1 - baselineCoefficient) * this.envelope;

    return Math.max(0, this.envelope - this.baseline);
  }

  updateNoiseFloor(inWarmup, transientActive) {
    if (transientActive && !inWarmup) return;

    let coefficient;
    if (inWarmup) {
      coefficient = this.warmupNoiseCoefficient;
    } else {
      coefficient =
        this.envelope > this.noiseFloor
          ? this.noiseRiseCoefficient
          : this.noiseFallCoefficient;
    }

    this.noiseFloor = Math.max(
      1e-7,
      coefficient * this.noiseFloor + (1 - coefficient) * this.envelope,
    );
  }

  beginCandidate(frame, novelty, threshold) {
    this.candidate = {
      startFrame: frame,
      peakFrame: frame,
      peakStrength: novelty,
      peakThreshold: threshold,
      noiseFloor: this.noiseFloor,
    };
    this.armed = false;
  }

  finishCandidate() {
    const candidate = this.candidate;
    if (!candidate) return;

    const confidence = candidate.peakStrength / Math.max(1e-7, candidate.peakThreshold);
    this.port.postMessage({
      type: "onset",
      contextTime: candidate.peakFrame / sampleRate,
      strength: candidate.peakStrength,
      confidence,
      noiseFloor: candidate.noiseFloor,
      threshold: candidate.peakThreshold,
    });

    this.refractoryUntilFrame = candidate.peakFrame + this.refractoryFrames;
    this.candidate = null;
  }

  detectOnset(frame, novelty, threshold, inWarmup) {
    if (inWarmup || !this.config.enabled) {
      this.candidate = null;
      this.armed = novelty <= threshold * this.config.hysteresis;
      return;
    }

    if (this.candidate) {
      if (novelty > this.candidate.peakStrength) {
        this.candidate.peakFrame = frame;
        this.candidate.peakStrength = novelty;
        this.candidate.peakThreshold = threshold;
        this.candidate.noiseFloor = this.noiseFloor;
      }

      const searchComplete =
        frame - this.candidate.startFrame >= this.peakSearchFrames;
      const fellFromPeak =
        novelty <= this.candidate.peakStrength * this.config.hysteresis;
      if (searchComplete || fellFromPeak) this.finishCandidate();
      return;
    }

    if (frame < this.refractoryUntilFrame) return;

    if (!this.armed) {
      if (novelty <= threshold * this.config.hysteresis) this.armed = true;
      return;
    }

    if (novelty >= threshold) this.beginCandidate(frame, novelty, threshold);
  }

  process(inputs) {
    const input = inputs[0];
    if (!input || input.length === 0 || input[0].length === 0) return true;

    const channelCount = input.length;
    const frameCount = input[0].length;
    const blockStartFrame = currentFrame;
    this.resizeChannelState(channelCount);

    for (let index = 0; index < frameCount; index += 1) {
      let magnitudeSum = 0;

      for (let channelIndex = 0; channelIndex < channelCount; channelIndex += 1) {
        const currentInput = input[channelIndex][index] || 0;
        const highpass =
          currentInput -
          this.previousInputs[channelIndex] +
          this.dcCoefficient * this.previousHighpass[channelIndex];
        this.previousInputs[channelIndex] = currentInput;
        this.previousHighpass[channelIndex] = highpass;
        magnitudeSum += Math.abs(highpass);
      }

      const frame = blockStartFrame + index;
      const novelty = this.updateEnvelope(magnitudeSum / channelCount);
      const threshold =
        this.config.minThreshold +
        this.config.noiseMultiplier * this.noiseFloor;
      const inWarmup = this.processedFrames < this.warmupFrames;
      const transientActive =
        this.candidate !== null ||
        frame < this.refractoryUntilFrame ||
        novelty >= threshold;

      this.detectOnset(frame, novelty, threshold, inWarmup);
      this.updateNoiseFloor(inWarmup, transientActive);
      this.processedFrames += 1;
    }

    return true;
  }
}

registerProcessor("audio-onset-processor", AudioOnsetProcessor);
