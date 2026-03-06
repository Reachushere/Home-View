import { useState, useEffect, useCallback, useRef } from "react";
import { useRoute } from "wouter";
import { Document, Page, pdfjs } from "react-pdf";
import { ChevronLeft, ChevronRight, Search, X, ArrowLeft } from "lucide-react";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";

pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

export default function PDFViewerPage() {
  const [, params] = useRoute("/pdf-viewer/:filePath*");
  const filePath = params?.filePath ? decodeURIComponent(params.filePath) : null;

  const [numPages, setNumPages] = useState<number>(0);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageInput, setPageInput] = useState<string>("1");
  const [scale, setScale] = useState<number>(1.2);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ page: number; text: string }[]>([]);
  const [currentSearchIndex, setCurrentSearchIndex] = useState(0);
  const [pdfText, setPdfText] = useState<Map<number, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pageInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const pdfUrl = filePath ? (filePath.startsWith("http") ? filePath : `/objects/${filePath}`) : null;

  const onDocumentLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setLoading(false);
  }, []);

  const onDocumentLoadError = useCallback((err: Error) => {
    setError(err.message);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!pdfUrl || numPages === 0) return;
    const extractText = async () => {
      try {
        const pdf = await pdfjs.getDocument(pdfUrl).promise;
        const textMap = new Map<number, string>();
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const text = content.items.map((item: any) => item.str).join(" ");
          textMap.set(i, text);
        }
        setPdfText(textMap);
      } catch (e) {
        console.error("Text extraction failed:", e);
      }
    };
    extractText();
  }, [pdfUrl, numPages]);

  const goToPage = useCallback((page: number) => {
    const p = Math.max(1, Math.min(page, numPages));
    setCurrentPage(p);
    setPageInput(String(p));
  }, [numPages]);

  const handlePageInputSubmit = useCallback(() => {
    const p = parseInt(pageInput);
    if (!isNaN(p)) goToPage(p);
    else setPageInput(String(currentPage));
  }, [pageInput, currentPage, goToPage]);

  const handleSearch = useCallback(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    const query = searchQuery.toLowerCase();
    const results: { page: number; text: string }[] = [];
    pdfText.forEach((text, page) => {
      if (text.toLowerCase().includes(query)) {
        const idx = text.toLowerCase().indexOf(query);
        const start = Math.max(0, idx - 40);
        const end = Math.min(text.length, idx + query.length + 40);
        const snippet = (start > 0 ? "..." : "") + text.slice(start, end) + (end < text.length ? "..." : "");
        results.push({ page, text: snippet });
      }
    });
    results.sort((a, b) => a.page - b.page);
    setSearchResults(results);
    setCurrentSearchIndex(0);
    if (results.length > 0) goToPage(results[0].page);
  }, [searchQuery, pdfText, goToPage]);

  const navigateSearchResult = useCallback((direction: 1 | -1) => {
    if (searchResults.length === 0) return;
    const next = (currentSearchIndex + direction + searchResults.length) % searchResults.length;
    setCurrentSearchIndex(next);
    goToPage(searchResults[next].page);
  }, [searchResults, currentSearchIndex, goToPage]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target === searchInputRef.current || e.target === pageInputRef.current) {
        if (e.key === "Enter") {
          if (e.target === searchInputRef.current) handleSearch();
          if (e.target === pageInputRef.current) handlePageInputSubmit();
        }
        if (e.key === "Escape") {
          setSearchOpen(false);
          setSearchResults([]);
        }
        return;
      }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        goToPage(currentPage - 1);
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === " ") {
        e.preventDefault();
        goToPage(currentPage + 1);
      } else if ((e.ctrlKey || e.metaKey) && e.key === "f") {
        e.preventDefault();
        setSearchOpen(true);
        setTimeout(() => searchInputRef.current?.focus(), 100);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentPage, goToPage, handleSearch, handlePageInputSubmit]);

  useEffect(() => {
    if (searchOpen) setTimeout(() => searchInputRef.current?.focus(), 100);
  }, [searchOpen]);

  if (!filePath) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#1a1a2e", color: "white" }}>
        No file specified
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", background: "#2d2d2d", color: "white", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", background: "#1a1a1a", borderBottom: "1px solid #444", flexShrink: 0, minHeight: "40px" }}>
        <button
          onClick={() => window.history.back()}
          style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center" }}
          title="Go back"
          data-testid="btn-back"
        >
          <ArrowLeft size={18} />
        </button>

        <div style={{ width: "1px", height: "20px", background: "#555" }} />

        <button
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          style={{ background: "none", border: "none", color: currentPage <= 1 ? "#555" : "#ccc", cursor: currentPage <= 1 ? "default" : "pointer", padding: "4px", display: "flex", alignItems: "center" }}
          title="Previous page"
          data-testid="btn-prev-page"
        >
          <ChevronLeft size={20} />
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px" }}>
          <input
            ref={pageInputRef}
            type="text"
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            onBlur={handlePageInputSubmit}
            onKeyDown={(e) => { if (e.key === "Enter") handlePageInputSubmit(); }}
            style={{ width: "40px", textAlign: "center", background: "#333", border: "1px solid #555", borderRadius: "3px", color: "white", padding: "2px 4px", fontSize: "13px" }}
            data-testid="input-page-number"
          />
          <span style={{ color: "#999" }}>of {numPages}</span>
        </div>

        <button
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= numPages}
          style={{ background: "none", border: "none", color: currentPage >= numPages ? "#555" : "#ccc", cursor: currentPage >= numPages ? "default" : "pointer", padding: "4px", display: "flex", alignItems: "center" }}
          title="Next page"
          data-testid="btn-next-page"
        >
          <ChevronRight size={20} />
        </button>

        <div style={{ width: "1px", height: "20px", background: "#555" }} />

        <button
          onClick={() => { setSearchOpen(!searchOpen); if (!searchOpen) setTimeout(() => searchInputRef.current?.focus(), 100); }}
          style={{ background: searchOpen ? "#444" : "none", border: "none", color: "#ccc", cursor: "pointer", padding: "4px 6px", borderRadius: "3px", display: "flex", alignItems: "center" }}
          title="Search (Ctrl+F)"
          data-testid="btn-search-toggle"
        >
          <Search size={16} />
        </button>

        {searchOpen && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px", flex: 1, maxWidth: "400px" }}>
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  if (e.shiftKey) navigateSearchResult(-1);
                  else if (searchResults.length > 0 && searchQuery === searchQuery) navigateSearchResult(1);
                  else handleSearch();
                }
              }}
              placeholder="Search in document..."
              style={{ flex: 1, background: "#333", border: "1px solid #555", borderRadius: "3px", color: "white", padding: "3px 8px", fontSize: "13px" }}
              data-testid="input-search"
            />
            <button
              onClick={handleSearch}
              style={{ background: "#4a90d9", border: "none", color: "white", cursor: "pointer", padding: "3px 10px", borderRadius: "3px", fontSize: "12px" }}
              data-testid="btn-search-submit"
            >
              Find
            </button>
            {searchResults.length > 0 && (
              <>
                <span style={{ fontSize: "12px", color: "#999", whiteSpace: "nowrap" }}>{currentSearchIndex + 1}/{searchResults.length}</span>
                <button onClick={() => navigateSearchResult(-1)} style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer", padding: "2px" }} data-testid="btn-search-prev"><ChevronLeft size={14} /></button>
                <button onClick={() => navigateSearchResult(1)} style={{ background: "none", border: "none", color: "#ccc", cursor: "pointer", padding: "2px" }} data-testid="btn-search-next"><ChevronRight size={14} /></button>
              </>
            )}
            {searchResults.length === 0 && searchQuery && pdfText.size > 0 && (
              <span style={{ fontSize: "12px", color: "#f87171" }}>No results</span>
            )}
            <button
              onClick={() => { setSearchOpen(false); setSearchQuery(""); setSearchResults([]); }}
              style={{ background: "none", border: "none", color: "#999", cursor: "pointer", padding: "2px" }}
              data-testid="btn-search-close"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <div style={{ flex: 1 }} />

        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px" }}>
          <button onClick={() => setScale(s => Math.max(0.5, s - 0.2))} style={{ background: "#333", border: "1px solid #555", borderRadius: "3px", color: "#ccc", cursor: "pointer", padding: "2px 8px", fontSize: "14px" }} data-testid="btn-zoom-out">−</button>
          <span style={{ color: "#999", minWidth: "40px", textAlign: "center" }}>{Math.round(scale * 100)}%</span>
          <button onClick={() => setScale(s => Math.min(3, s + 0.2))} style={{ background: "#333", border: "1px solid #555", borderRadius: "3px", color: "#ccc", cursor: "pointer", padding: "2px 8px", fontSize: "14px" }} data-testid="btn-zoom-in">+</button>
        </div>
      </div>

      {searchResults.length > 0 && (
        <div style={{ background: "#2a2a3a", borderBottom: "1px solid #444", padding: "4px 12px", maxHeight: "100px", overflowY: "auto", flexShrink: 0 }}>
          {searchResults.map((r, i) => (
            <div
              key={i}
              onClick={() => { setCurrentSearchIndex(i); goToPage(r.page); }}
              style={{
                padding: "3px 8px",
                fontSize: "11px",
                cursor: "pointer",
                borderRadius: "3px",
                background: i === currentSearchIndex ? "#4a90d9" : "transparent",
                color: i === currentSearchIndex ? "white" : "#aaa",
              }}
              data-testid={`search-result-${i}`}
            >
              <strong>Page {r.page}:</strong> {r.text}
            </div>
          ))}
        </div>
      )}

      <div ref={containerRef} style={{ flex: 1, overflow: "auto", display: "flex", justifyContent: "center", padding: "20px 0" }}>
        {loading && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <div style={{ color: "#999", fontSize: "16px" }}>Loading PDF...</div>
          </div>
        )}
        {error && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%" }}>
            <div style={{ color: "#f87171", fontSize: "14px", textAlign: "center", padding: "20px" }}>
              Failed to load PDF<br /><span style={{ fontSize: "12px", color: "#999" }}>{error}</span>
            </div>
          </div>
        )}
        {pdfUrl && (
          <Document
            file={pdfUrl}
            onLoadSuccess={onDocumentLoadSuccess}
            onLoadError={onDocumentLoadError}
            loading=""
          >
            <div style={{ position: "relative" }}>
              <div style={{
                position: "absolute", top: "8px", right: "8px", background: "rgba(0,0,0,0.6)",
                color: "white", padding: "2px 8px", borderRadius: "4px", fontSize: "11px", zIndex: 10
              }}>
                Page {currentPage} of {numPages}
              </div>
              <Page
                pageNumber={currentPage}
                scale={scale}
                renderTextLayer={true}
                renderAnnotationLayer={true}
              />
            </div>
          </Document>
        )}
      </div>
    </div>
  );
}
