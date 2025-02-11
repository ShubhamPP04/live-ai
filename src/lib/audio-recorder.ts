/**
 * Copyright 2024 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { EventEmitter } from "events";

export class AudioRecorder extends EventEmitter {
  private stream: MediaStream | undefined;
  private audioContext: AudioContext | undefined;
  private source: MediaStreamAudioSourceNode | undefined;
  private processor: ScriptProcessorNode | undefined;
  private analyser: AnalyserNode | undefined;
  private recording: boolean = false;
  private starting: Promise<void> | null = null;
  private volumeCheckId: number | undefined;

  constructor(public sampleRate = 16000) {
    super();
  }

  async start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error("Could not request user media");
    }

    if (this.starting) {
      await this.starting;
      return;
    }

    if (this.recording) {
      return;
    }

    this.starting = new Promise(async (resolve, reject) => {
      try {
        // Request microphone access
        this.stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true
          } 
        });
        
        // Create and initialize audio context
        this.audioContext = new AudioContext({
          sampleRate: this.sampleRate,
          latencyHint: 'interactive'
        });

        await this.audioContext.resume();

        // Create source node
        this.source = this.audioContext.createMediaStreamSource(this.stream);

        // Create analyzer node for volume detection
        this.analyser = this.audioContext.createAnalyser();
        this.analyser.fftSize = 1024;
        this.source.connect(this.analyser);

        // Set up volume monitoring
        const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
        const checkVolume = () => {
          if (this.recording && this.analyser) {
            this.analyser.getByteFrequencyData(dataArray);
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              sum += dataArray[i];
            }
            const average = sum / dataArray.length;
            const volume = average / 128.0; // Normalize to 0-1
            this.emit('volume', volume);
            this.volumeCheckId = requestAnimationFrame(checkVolume);
          }
        };

        // Create ScriptProcessor for audio processing
        const bufferSize = 4096;
        this.processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);
        
        this.processor.onaudioprocess = (e) => {
          if (!this.recording) return;
          
          try {
            const inputData = e.inputBuffer.getChannelData(0);
            const output = new Int16Array(inputData.length);
            
            // Convert Float32 to Int16
            for (let i = 0; i < inputData.length; i++) {
              const s = Math.max(-1, Math.min(1, inputData[i]));
              output[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
            }
            
            // Convert to base64 and emit
            const buffer = new ArrayBuffer(output.length * 2);
            new Int16Array(buffer).set(output);
            const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
            this.emit('data', base64);
          } catch (error) {
            console.error('Error processing audio:', error);
          }
        };

        this.source.connect(this.processor);
        this.processor.connect(this.audioContext.destination);

        this.recording = true;
        checkVolume();
        resolve();
      } catch (error) {
        console.error('Error starting audio recording:', error);
        await this.cleanup();
        reject(error);
      } finally {
        this.starting = null;
      }
    });

    await this.starting;
  }

  private async cleanup() {
    this.recording = false;

    if (this.volumeCheckId) {
      cancelAnimationFrame(this.volumeCheckId);
      this.volumeCheckId = undefined;
    }
    
    if (this.processor) {
      this.processor.disconnect();
      this.processor.onaudioprocess = null;
      this.processor = undefined;
    }

    if (this.analyser) {
      this.analyser.disconnect();
      this.analyser = undefined;
    }
    
    if (this.source) {
      this.source.disconnect();
      this.source = undefined;
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => {
        track.stop();
      });
      this.stream = undefined;
    }
    
    if (this.audioContext) {
      try {
        await this.audioContext.close();
      } catch (error) {
        console.error('Error closing audio context:', error);
      }
      this.audioContext = undefined;
    }
  }

  async stop() {
    await this.cleanup();
  }
}
