"use client";

import { CSSProperties, ReactNode, isValidElement } from "react";
import Zoom from "react-medium-image-zoom";
import type { UncontrolledProps } from "react-medium-image-zoom";
import "react-medium-image-zoom/dist/styles.css";
import { PuzzlePieceOverlay } from "@/entities/product/ui/PuzzlePieceOverlay";

/** Presentation applied to the product image. Mirrors ProductGallery's FrameStyle. */
type FrameStyle = "puzzle" | "art" | "credits";

interface ImageZoomProps {
  children: ReactNode;
  /** Full-resolution source used only while zoomed in. */
  zoomSrc?: string;
  alt?: string;
  className?: string;
  style?: CSSProperties;
  /** Frame effect to also apply to the zoomed (modal) image. */
  frameStyle?: FrameStyle;
}

const dialogClassName = [
  "[&_[data-rmiz-modal-overlay]]:bg-[#f0eee9]/95",
  "[&_[data-rmiz-modal-overlay]]:backdrop-blur-sm",
  "[&_[data-rmiz-btn-unzoom]]:bg-white",
  "[&_[data-rmiz-btn-unzoom]]:text-[#448da6]",
  "[&_[data-rmiz-btn-unzoom]]:shadow-[0_8px_20px_-8px_rgba(16,54,66,0.45)]",
].join(" ");

// Renders the zoomed (modal) image with the same puzzle framing as the inline
// image. The library absolutely-positions the modal <img> via an inline style
// (top/left/width/height/transform) and animates `transform 0.3s`, so the
// piece overlay copies that positioning to track the image while it zooms.
function makeZoomContent(
  frameStyle: FrameStyle,
): UncontrolledProps["ZoomContent"] {
  return function ZoomContentFrame({ img, buttonUnzoom }) {
    if (!isValidElement(img)) {
      return <>{buttonUnzoom}</>;
    }

    const imgStyle = (img.props as { style?: CSSProperties }).style ?? {};

    return (
      <>
        {img}
        {frameStyle === "puzzle" && (
          <div
            aria-hidden
            style={{
              ...imgStyle,
              position: "absolute",
              transformOrigin: "top left",
              transition: "transform 0.3s",
              pointerEvents: "none",
            }}
          >
            <PuzzlePieceOverlay />
          </div>
        )}
        {buttonUnzoom}
      </>
    );
  };
}

export function ImageZoom({
  children,
  zoomSrc,
  alt,
  className = "",
  style,
  frameStyle = "art",
}: ImageZoomProps) {
  return (
    // [data-rmiz] is the wrapper the library injects; it is inline-flex by
    // default and would collapse a percentage-width child.
    <div className={`w-full [&>[data-rmiz]]:w-full ${className}`} style={style}>
      <Zoom
        zoomMargin={32}
        classDialog={dialogClassName}
        zoomImg={zoomSrc ? { src: zoomSrc, alt: alt ?? "" } : undefined}
        a11yNameButtonZoom="Zoom image"
        a11yNameButtonUnzoom="Close zoomed image"
        ZoomContent={
          frameStyle === "puzzle" ? makeZoomContent(frameStyle) : undefined
        }
      >
        {children}
      </Zoom>
    </div>
  );
}

export default ImageZoom;
