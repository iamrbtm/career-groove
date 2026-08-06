import { Suspense } from "react";
import { DocumentStudio } from "@/components/document-studio";

export default function DocumentsPage() {
  return (
    <Suspense fallback={null}>
      <DocumentStudio />
    </Suspense>
  );
}
