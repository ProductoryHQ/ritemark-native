/**
 * Type declarations for pdf-parse (no @types package available)
 */
declare module 'pdf-parse' {
	interface PDFInfo {
		Title?: string;
		Author?: string;
		Subject?: string;
		Creator?: string;
		Producer?: string;
		CreationDate?: string;
		ModDate?: string;
		[key: string]: string | undefined;
	}

	interface PDFData {
		numpages: number;
		numrender: number;
		info: PDFInfo;
		metadata: unknown;
		text: string;
		version: string;
	}

	function pdfParse(buffer: Buffer): Promise<PDFData>;

	export = pdfParse;
}
