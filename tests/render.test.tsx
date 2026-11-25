import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthoringApp } from "../src/authoring/AuthoringApp";

describe("AuthoringApp", () => {
  it("renders the default v2 bundle without touching IndexedDB", () => {
    const html = renderToStaticMarkup(<AuthoringApp />);
    expect(html).toContain("Trime Theme Editor");
    expect(html).toContain("Keyboard preview");
    expect(html).toContain("26 键");
  });
});
