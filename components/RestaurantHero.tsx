"use client";

import { useEffect, useState } from "react";
import { IconChevronLeft, IconChevronRight } from "@/components/Icons";

const BANNERS = ["1.png", "2.png", "3.png"].map((file) => ({
  src: `/images/hero/${file}`,
  alt: "Woodfarm Kebab & Pizza promotion",
}));

/** Marquee-style promo banner: 3 rotating hero images with controls. */
export default function RestaurantHero() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % BANNERS.length);
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  const go = (n: number) =>
    setIndex(((n % BANNERS.length) + BANNERS.length) % BANNERS.length);

  return (
    <section className="relative border-b border-grey-light bg-white">
      <div className="relative overflow-hidden">
        <div
          className="flex transition-transform duration-500 ease-out"
          style={{ transform: `translateX(-${index * 100}%)` }}
        >
          {BANNERS.map((b) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              key={b.src}
              src={b.src}
              alt={b.alt}
              width={1600}
              height={600}
              className="h-[340px] w-full shrink-0 object-cover sm:h-[480px] lg:h-[560px]"
            />
          ))}
        </div>

        {BANNERS.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(index - 1)}
              aria-label="Previous banner"
              className="absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-grey-darkest shadow-raised transition hover:bg-white"
            >
              <IconChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={() => go(index + 1)}
              aria-label="Next banner"
              className="absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-grey-darkest shadow-raised transition hover:bg-white"
            >
              <IconChevronRight className="h-5 w-5" />
            </button>

            <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5">
              {BANNERS.map((b, i) => (
                <button
                  key={b.src}
                  type="button"
                  onClick={() => go(i)}
                  aria-label={`Go to banner ${i + 1}`}
                  className={`h-2 rounded-full transition-all ${
                    i === index ? "w-5 bg-white" : "w-2 bg-white/60 hover:bg-white/90"
                  }`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}