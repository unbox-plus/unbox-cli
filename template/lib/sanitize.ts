// Sanitização de HTML rico vindo do backend (product.description / additionalInformation)
// antes de injetar via dangerouslySetInnerHTML — proteção contra XSS (doc 02/08).
import "server-only";
import sanitizeHtml from "sanitize-html";

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    "p", "br", "b", "strong", "i", "em", "u", "s", "ul", "ol", "li",
    "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "a", "span", "div",
    "table", "thead", "tbody", "tr", "th", "td", "img", "hr",
  ],
  allowedAttributes: {
    a: ["href", "title", "target", "rel"],
    img: ["src", "alt", "width", "height"],
    span: ["style"],
    div: ["style"],
    "*": ["class"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  // força rel seguro em links externos
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "nofollow noopener noreferrer" }),
  },
  allowedStyles: {
    "*": {
      "text-align": [/^left$|^right$|^center$|^justify$/],
      "font-weight": [/^bold$|^\d{3}$/],
      color: [/^#[0-9a-fA-F]{3,6}$/],
    },
  },
};

export function sanitize(html: string | null | undefined): string {
  if (!html) return "";
  return sanitizeHtml(html, OPTIONS);
}
