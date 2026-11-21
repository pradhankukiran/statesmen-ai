import { ImageResponse } from "next/og";

// Home-screen icon for iOS. Same portico as app/icon.svg, with padding so it
// survives the rounded mask iOS applies.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1d70b8",
        }}
      >
        <svg width="120" height="120" viewBox="0 0 32 32" fill="#ffffff">
          <polygon points="16,5 27,11 5,11" />
          <rect x="7" y="13" width="4" height="9" />
          <rect x="14" y="13" width="4" height="9" />
          <rect x="21" y="13" width="4" height="9" />
          <rect x="5" y="23" width="22" height="4" />
        </svg>
      </div>
    ),
    size,
  );
}
