import { fireEvent, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import type { LibraryDocument } from "../types/document";
import { DocumentActions } from "./LibraryView";

const privateDocument: LibraryDocument = {
  id: "doc-id",
  title: "Private notes",
  description: "",
  subjectId: "subject-id",
  subject: "Algorithms",
  categoryId: "category-id",
  category: "Notes",
  tags: [],
  visibility: "PRIVATE",
  fileName: "notes.pdf",
  fileType: "PDF",
  fileSize: 1024,
  pages: 1,
  uploadedAt: "2026-08-06T00:00:00.000Z",
  indexStatus: "PROCESSING",
};

const text = (_vi: string, en: string) => en;

function renderActions(document: LibraryDocument, onPublish = vi.fn()) {
  render(
    <DocumentActions
      document={document}
      text={text}
      isRetrying={false}
      isPublishing={false}
      onPreview={vi.fn()}
      onDownload={vi.fn()}
      onRetry={vi.fn()}
      onPublish={onPublish}
      onDelete={vi.fn()}
    />,
  );
}

describe("Library document actions", () => {
  it("shows Publish for a private owned document and invokes the action", () => {
    const onPublish = vi.fn();
    renderActions(privateDocument, onPublish);

    fireEvent.click(
      screen.getByRole("button", { name: "Make Private notes public" }),
    );

    expect(onPublish).toHaveBeenCalledOnce();
  });

  it("does not show Publish after the document is public", () => {
    renderActions({ ...privateDocument, visibility: "PUBLIC" });

    expect(
      screen.queryByRole("button", { name: "Make Private notes public" }),
    ).not.toBeInTheDocument();
  });
});
