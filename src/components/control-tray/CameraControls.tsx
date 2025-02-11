import React from "react";
import { UseMediaStreamResult } from "../../hooks/use-media-stream-mux";

interface CameraControlsProps {
  videoStream: UseMediaStreamResult & { switchCamera?: () => Promise<void>; facingMode?: string };
}

export const CameraControls: React.FC<CameraControlsProps> = ({ videoStream }) => {
  if (videoStream.type !== "webcam" || !videoStream.switchCamera) {
    return null;
  }

  return (
    <button
      className="camera-switch-btn"
      onClick={videoStream.switchCamera}
      title={`Switch to ${videoStream.facingMode === "user" ? "rear" : "front"} camera`}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M20 9v11a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9" />
        <path d="M9 21h6" />
        <path d="M6.2 3h11.6a2 2 0 0 1 1.8 2.8L18 9H6l-1.6-3.2A2 2 0 0 1 6.2 3Z" />
        <path d="m12 8 1-1v3" />
      </svg>
    </button>
  );
};