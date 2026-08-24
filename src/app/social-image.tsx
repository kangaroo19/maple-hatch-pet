import { ImageResponse } from "next/og";

export const SOCIAL_IMAGE_ALT = "Maple Hatch Pet — Create your Codex Pet";
export const SOCIAL_IMAGE_SIZE = {
  width: 1200,
  height: 630,
} as const;
export const SOCIAL_IMAGE_CONTENT_TYPE = "image/png";

export function createSocialImage(): ImageResponse {
  return new ImageResponse(
    <div
      style={{
        position: "relative",
        display: "flex",
        width: "100%",
        height: "100%",
        alignItems: "center",
        justifyContent: "space-between",
        overflow: "hidden",
        background: "#070c14",
        color: "#eef7ff",
        fontFamily: "monospace",
        padding: "76px 84px",
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 34,
          display: "flex",
          border: "6px solid #b78844",
          boxShadow: "inset 0 0 0 4px #4d321e",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 58,
          left: 58,
          width: 18,
          height: 18,
          display: "flex",
          background: "#f4c66a",
          boxShadow: "1024px 0 #f4c66a, 0 478px #f4c66a, 1024px 478px #f4c66a",
        }}
      />
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: 660,
        }}
      >
        <div
          style={{
            display: "flex",
            color: "#f4c66a",
            fontSize: 28,
            fontWeight: 700,
            letterSpacing: 8,
            marginBottom: 38,
          }}
        >
          MAPLE HATCH PET
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            fontSize: 76,
            fontWeight: 900,
            lineHeight: 1.02,
            letterSpacing: -4,
          }}
        >
          <span>CREATE YOUR</span>
          <span style={{ color: "#8fd7ff" }}>CODEX PET</span>
        </div>
      </div>
      <div
        style={{
          position: "relative",
          display: "flex",
          width: 310,
          height: 310,
          alignItems: "center",
          justifyContent: "center",
          border: "8px solid #294761",
          background: "#101a27",
          boxShadow: "16px 16px 0 #03070c",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 24,
            left: 24,
            display: "flex",
            gap: 10,
          }}
        >
          <span style={{ width: 14, height: 14, background: "#f4c66a" }} />
          <span style={{ width: 14, height: 14, background: "#8fd7ff" }} />
          <span style={{ width: 14, height: 14, background: "#6fbf73" }} />
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            color: "#f4c66a",
            fontSize: 104,
            fontWeight: 900,
            letterSpacing: -16,
            marginLeft: -16,
          }}
        >
          &gt;_
        </div>
        <div
          style={{
            position: "absolute",
            right: 24,
            bottom: 24,
            display: "flex",
            width: 30,
            height: 30,
            background: "#8fd7ff",
            boxShadow: "-42px 0 #294761, 0 -42px #294761",
          }}
        />
      </div>
    </div>,
    SOCIAL_IMAGE_SIZE,
  );
}
