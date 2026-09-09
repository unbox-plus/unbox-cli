"use client";

// PILLS de categorias — chips com thumb, quebram em várias linhas pra exibir todas.
import Link from "next/link";
import Image from "next/image";
import { collImageSrc } from "@/components/catalog/catalog-client";
import type { SectionComponentProps } from "./registry";

export function CategoryPillsSection({ data }: SectionComponentProps) {
  if (data.categories.length === 0) return null;
  return (
    <div className="mx-auto max-w-[var(--container-max,1240px)] px-4 pt-[18px] sm:px-6">
      <div className="flex flex-wrap gap-2.5">
        {data.categories.map((c) => (
          <Link
            key={c.slug}
            href={`/categoria/${encodeURIComponent(c.slug)}`}
            className="flex flex-none items-center gap-[11px] rounded-full border-[1.5px] border-[var(--store-line)] bg-white py-[7px] pl-2 pr-5 no-underline transition-all hover:border-[var(--store-primary,#18181B)] hover:shadow-[var(--store-shadow-soft)]"
          >
            <Image src={collImageSrc(c.name)} alt="" width={44} height={44} className="h-11 w-11 flex-none object-contain" />
            <span className="font-display whitespace-nowrap text-[14px] font-semibold not-italic text-[var(--store-ink)]">{c.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
