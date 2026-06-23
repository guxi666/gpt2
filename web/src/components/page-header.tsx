"use client";

import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  eyebrow = "Console",
  actions,
}: {
  title: string;
  description?: string;
  eyebrow?: string;
  actions?: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="flex flex-col gap-1.5">
        <div className="text-[11px] font-semibold tracking-[0.14em] text-stone-400 uppercase">
          {eyebrow}
        </div>
        <h1 className="text-[2rem] leading-[1.08] font-semibold tracking-tight text-stone-950 sm:text-[2.35rem]">
          {title}
        </h1>
        {description ? (
          <p className="max-w-3xl text-sm leading-6 text-stone-500">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </section>
  );
}
