import { useEffect } from "react";

const SITE_URL = "https://kite-trivia-quest.emergent.host";

function setMeta(property, content) {
  let el = document.querySelector(`meta[property="${property}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute("property", property);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

// Sets the canonical link and og:url for the current route.
export function useCanonical(path) {
  useEffect(() => {
    const url = `${SITE_URL}${path}`;

    let link = document.querySelector('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.setAttribute("rel", "canonical");
      document.head.appendChild(link);
    }
    link.setAttribute("href", url);

    setMeta("og:url", url);
  }, [path]);
}
