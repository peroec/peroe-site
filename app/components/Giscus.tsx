import { useEffect, useRef } from "react";

const GISCUS_ORIGIN = "https://giscus.app";

const GISCUS_ATTRS: Record<string, string> = {
  "data-repo": "afoim/af_comments-data",
  "data-repo-id": "R_kgDOOi8quw",
  "data-category": "Announcements",
  "data-category-id": "DIC_kwDOOi8qu84CprDV",
  "data-mapping": "pathname",
  "data-strict": "0",
  "data-reactions-enabled": "1",
  "data-emit-metadata": "0",
  "data-input-position": "top",
  "data-lang": "zh-CN",
  "data-loading": "lazy",
  "data-theme": "dark",
};

export function Giscus() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || ref.current.querySelector("script")) return;

    const script = document.createElement("script");
    script.src = `${GISCUS_ORIGIN}/client.js`;
    script.async = true;
    script.crossOrigin = "anonymous";
    for (const [name, value] of Object.entries(GISCUS_ATTRS)) {
      script.setAttribute(name, value);
    }
    ref.current.appendChild(script);
  }, []);

  return <div ref={ref} className="giscus min-h-16" />;
}
