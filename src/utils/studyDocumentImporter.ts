export type StudyTextFileType = 'md' | 'txt';

export interface ImportedStudyDocument {
  content: string;
  fileName: string;
  fileType: StudyTextFileType;
  sourceFileName?: string;
}

const MAX_FILE_SIZE = 25 * 1024 * 1024;
const MAX_PDF_PAGES = 500;

export async function importStudyDocument(file: File): Promise<ImportedStudyDocument> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`${file.name} is larger than the 25 MB import limit.`);
  }

  const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  const fileType: StudyTextFileType = extension === '.txt' ? 'txt' : 'md';
  const isDocumentImport = extension === '.pdf' || extension === '.docx';
  let content: string;

  if (extension === '.pdf') {
    const [{ getDocument, GlobalWorkerOptions }, worker] = await Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.min.mjs?url'),
    ]);
    GlobalWorkerOptions.workerSrc = worker.default;
    const document = await getDocument({ data: await file.arrayBuffer() }).promise;
    try {
      if (document.numPages > MAX_PDF_PAGES) {
        throw new Error(`${file.name} has more than ${MAX_PDF_PAGES} pages and cannot be imported.`);
      }

      const pages: string[] = [];
      for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
        const page = await document.getPage(pageNumber);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map(item => 'str' in item ? item.str : '')
          .filter(Boolean)
          .join(' ');
        if (pageText.trim()) pages.push(pageText.trim());
      }
      content = pages.join('\n\n');
      if (!content) {
        throw new Error(`${file.name} has no selectable text. Scanned PDFs need OCR before import.`);
      }
    } finally {
      await document.destroy();
    }
  } else if (extension === '.docx') {
    const { extractRawText } = await import('mammoth');
    const result = await extractRawText({ arrayBuffer: await file.arrayBuffer() });
    content = result.value.trim();
    if (!content) throw new Error(`${file.name} does not contain readable text.`);
  } else if (extension === '.md' || extension === '.markdown' || extension === '.txt') {
    content = await file.text();
  } else {
    throw new Error(`Unsupported file type: ${file.name}. Choose Markdown, text, PDF, or DOCX.`);
  }

  const baseName = file.name.replace(/\.[^/.]+$/, '');
  return {
    content,
    fileName: isDocumentImport ? `${baseName}.md` : file.name,
    fileType,
    ...(isDocumentImport ? { sourceFileName: file.name } : {}),
  };
}
