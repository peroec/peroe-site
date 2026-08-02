import { useEffect, useState } from "react";
import { List } from "lucide-react";

export interface ArticleHeading {
  id: string;
  text: string;
  level: number;
}

function collectHeadings(): ArticleHeading[] {
  return Array.from(document.querySelectorAll<HTMLElement>("article h2, article h3"))
    .filter((element) => element.id)
    .map((element) => ({
      id: element.id,
      text: element.textContent || "",
      level: element.tagName === "H3" ? 3 : 2,
    }));
}

interface ArticleTableOfContentsProps {
  headings?: ArticleHeading[];
}

export function extractArticleHeadings(html: string): ArticleHeading[] {
  return Array.from(html.matchAll(/<h([23])\s+[^>]*id="([^"]+)"[^>]*>(.*?)<\/h[23]>/g)).map((match) => ({
    level: Number(match[1]),
    id: match[2],
    text: match[3].replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">"),
  }));
}

export function ArticleTableOfContents({ headings: initialHeadings = [] }: ArticleTableOfContentsProps) {
  const [headings, setHeadings] = useState<ArticleHeading[]>(initialHeadings);
  const [activeId, setActiveId] = useState("");

  useEffect(() => {
    const updateHeadings = () => setHeadings(collectHeadings());
    updateHeadings();

    const updateActive = () => {
      const visible = headings
        .map((heading) => ({
          ...heading,
          top: document.getElementById(heading.id)?.getBoundingClientRect().top ?? Infinity,
        }))
        .filter((heading) => heading.top <= 120)
        .sort((a, b) => b.top - a.top)[0];

      if (visible) setActiveId(visible.id);
    };

    window.addEventListener("scroll", updateActive, { passive: true });
    return () => window.removeEventListener("scroll", updateActive);
  }, [headings]);

  const goTo = (id: string) => {
    const element = document.getElementById(id);
    if (!element) return;
    history.replaceState(null, "", `#${id}`);
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (headings.length === 0) return null;

  const items = (
    <nav aria-label="文章目录" className="space-y-1">
      {headings.map((heading) => (
        <button
          key={heading.id}
          type="button"
          onClick={() => goTo(heading.id)}
          className={`block w-full border-l-2 py-1 text-left text-sm transition-colors ${
            heading.level === 3 ? "pl-5" : "pl-3"
          } ${
            activeId === heading.id
              ? "border-accent text-foreground"
              : "border-transparent text-muted hover:border-border hover:text-foreground"
          }`}
        >
          {heading.text}
        </button>
      ))}
    </nav>
  );

  return (
    <>
      <div className="hidden lg:block">
        <aside className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto border-l border-border pl-5">
          <h2 className="mb-4 text-sm font-semibold text-foreground">本页目录</h2>
          {items}
        </aside>
      </div>

      <details className="fixed bottom-5 right-5 z-30 lg:hidden">
        <summary className="flex h-11 w-11 cursor-pointer list-none items-center justify-center border border-border bg-card text-foreground shadow-lg">
          <List className="h-5 w-5" aria-label="打开文章目录" />
        </summary>
        <div className="absolute bottom-14 right-0 max-h-[60vh] w-72 overflow-y-auto border border-border bg-background p-4 shadow-xl">
          <h2 className="mb-3 text-sm font-semibold">本页目录</h2>
          {items}
        </div>
      </details>
    </>
  );
}
