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

import { useState, useEffect } from "react";
import { UseMediaStreamResult } from "./use-media-stream-mux";

export function useWebcam(): UseMediaStreamResult & { switchCamera?: () => Promise<MediaStream>; facingMode?: string } {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [facingMode, setFacingMode] = useState<string>("user");
  const [hasMultipleCameras, setHasMultipleCameras] = useState<boolean>(false);

  // Check for multiple cameras
  useEffect(() => {
    async function checkDevices() {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        setHasMultipleCameras(videoDevices.length > 1);
      } catch (error) {
        console.error('Error checking for cameras:', error);
        setHasMultipleCameras(false);
      }
    }
    checkDevices();
  }, []);

  useEffect(() => {
    const handleStreamEnded = () => {
      setIsStreaming(false);
      setStream(null);
    };

    const handleTrackError = () => {
      console.error('Track error occurred');
      handleStreamEnded();
    };

    if (stream) {
      stream.getTracks().forEach((track) => {
        track.addEventListener("ended", handleStreamEnded);
        track.addEventListener("error", handleTrackError);
      });
      return () => {
        stream.getTracks().forEach((track) => {
          track.removeEventListener("ended", handleStreamEnded);
          track.removeEventListener("error", handleTrackError);
        });
      };
    }
  }, [stream]);

  const start = async () => {
    try {
      const constraints = {
        video: { 
          facingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      };
      const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
      setStream(mediaStream);
      setIsStreaming(true);
      return mediaStream;
    } catch (error) {
      console.error('Error starting camera:', error);
      setIsStreaming(false);
      setStream(null);
      throw error;
    }
  };

  const stop = () => {
    if (stream) {
      stream.getTracks().forEach((track) => {
        track.stop();
      });
      setStream(null);
      setIsStreaming(false);
    }
  };

  const switchCamera = hasMultipleCameras ? async () => {
    try {
      // Stop current stream
      stop();
      // Toggle facing mode
      const newFacingMode = facingMode === "user" ? "environment" : "user";
      setFacingMode(newFacingMode);
      // Start new stream with updated facing mode
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { 
          facingMode: newFacingMode,
          width: { ideal: 1280 },
          height: { ideal: 720 }
        }
      });
      setStream(mediaStream);
      setIsStreaming(true);
      return mediaStream;
    } catch (error) {
      console.error('Error switching camera:', error);
      // Try to revert to the previous camera if switching fails
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode }
        });
        setStream(mediaStream);
        setIsStreaming(true);
        return mediaStream;
      } catch (fallbackError) {
        console.error('Error reverting to previous camera:', fallbackError);
        setIsStreaming(false);
        setStream(null);
        throw fallbackError;
      }
    }
  } : undefined;

  const result: UseMediaStreamResult & { switchCamera?: () => Promise<MediaStream>; facingMode?: string } = {
    type: "webcam" as const,
    start,
    stop,
    isStreaming,
    stream,
    switchCamera,
    facingMode,
  };

  return result;
}
