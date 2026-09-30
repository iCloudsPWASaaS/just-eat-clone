"use client";

import { useState } from "react";
import { IconChevronDown } from "@/components/Icons";
import type { Faq } from "@/lib/types";

export default function FaqSection({ faqs }: { faqs: Faq[] }) {
  const [openId, setOpenId] = useState<string | null>(faqs[0]?.id ?? null);

  if (faqs.length === 0) return null;

  return (
    <section id="faq" className="scroll-mt-24">
      <h2 className="text-2xl font-extrabold text-grey-darkest">
        Frequently asked questions
      </h2>

      <ul className="mt-4 divide-y divide-grey-light overflow-hidden rounded-card border border-grey-light bg-white">
        {faqs.map((f) => {
          const open = openId === f.id;
          return (
            <li key={f.id}>
              <h3>
                <button
                  type="button"
                  onClick={() => setOpenId(open ? null : f.id)}
                  aria-expanded={open}
                  className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left hover:bg-grey-lighter"
                >
                  <span className="text-sm font-semibold text-grey-darkest">
                    {f.question}
                  </span>
                  <IconChevronDown
                    className={`h-4 w-4 shrink-0 text-grey-midDark transition-transform ${
                      open ? "rotate-180" : ""
                    }`}
                  />
                </button>
              </h3>
              {open && (
                <div className="px-4 pb-4">
                  <p className="text-sm leading-relaxed text-grey-dark">{f.answer}</p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
