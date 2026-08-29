import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MarkdownMessage } from "./MarkdownMessage";

describe("MarkdownMessage", () => {
  it("renders Markdown emphasis instead of showing the marker characters", () => {
    render(<MarkdownMessage content="Đây là **nội dung quan trọng**." />);

    expect(screen.getByText("nội dung quan trọng").tagName).toBe("STRONG");
    expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument();
  });
});
