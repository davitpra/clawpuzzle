"use client";

import { useState } from "react";
import Image from "next/image";
import { CanvasEdgeOverlay } from "@/entities/product/ui/CanvasEdgeOverlay";
import { SetLighting } from "@/entities/product/ui/SetLighting";
import { setArtworkFilter } from "@/entities/product/lib/setLighting";

interface PbnCanvasMockupProps {
  src: string;
}

export function PbnCanvasMockup({ src }: PbnCanvasMockupProps) {
  const [aspectRatio, setAspectRatio] = useState(4 / 5);

  const portrait = aspectRatio < 1;

  return (
    <div className="relative isolate aspect-[4/3] min-h-64 overflow-hidden rounded-2xl bg-[#e9dfd0] shadow-inner sm:min-h-80 lg:h-full lg:min-h-112 lg:aspect-auto">
      <Image
        src="/set/Set3.png"
        alt=""
        fill
        sizes="(max-width: 1024px) 100vw, 55vw"
        className="object-cover object-center"
        aria-hidden
      />
      <div className="absolute inset-0 bg-linear-to-t from-[#4d3820]/14 via-transparent to-white/5" />

      <div className="absolute inset-0 flex items-center justify-center px-[15%] pb-[7%] pt-[5%] [perspective:1000px]">
        <SetLighting
          className="overflow-hidden bg-white transition-[width] duration-300 [transform:rotateY(-7deg)_rotateX(1deg)_rotateZ(-0.4deg)]"
          style={{
            aspectRatio,
            width: portrait ? "39%" : "62%",
            maxHeight: "70%",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt="Your paint-by-numbers shown on canvas"
            decoding="async"
            onLoad={(event) => {
              const image = event.currentTarget;
              if (image.naturalWidth && image.naturalHeight) {
                setAspectRatio(image.naturalWidth / image.naturalHeight);
              }
            }}
            className="block h-full w-full object-cover"
            style={setArtworkFilter}
          />
          <CanvasEdgeOverlay />
        </SetLighting>
      </div>

      <div className="absolute bottom-3 left-3 rounded-full bg-white/88 px-3 py-1.5 font-body text-[11px] font-bold text-slate-dark shadow-sm backdrop-blur-sm sm:bottom-4 sm:left-4 sm:text-xs">
        Preview with your design
      </div>
    </div>
  );
}
