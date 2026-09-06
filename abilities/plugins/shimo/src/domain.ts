import { Type, type Static } from "@sinclair/typebox";

export const DocumentKindSchema = Type.Union([
  Type.Literal("pdf"),
  Type.Literal("markdown"),
  Type.Literal("text")
]);

export const ReadingCategorySchema = Type.Union([
  Type.Literal("poetry"),
  Type.Literal("book"),
  Type.Literal("article")
]);

export const RecordKindSchema = Type.Union([
  Type.Literal("highlight"),
  Type.Literal("note"),
  Type.Literal("reflection"),
  Type.Literal("question"),
  Type.Literal("answer"),
  Type.Literal("pinyin")
]);

const PointSchema = Type.Object({
  x: Type.Number({ minimum: 0, maximum: 1 }),
  y: Type.Number({ minimum: 0, maximum: 1 })
}, { additionalProperties: false });

const PdfRectSchema = Type.Object({
  x: Type.Number({ minimum: 0, maximum: 1 }),
  y: Type.Number({ minimum: 0, maximum: 1 }),
  width: Type.Number({ minimum: 0, maximum: 1 }),
  height: Type.Number({ minimum: 0, maximum: 1 })
}, { additionalProperties: false });

export const TextAnchorSchema = Type.Object({
  type: Type.Literal("text"),
  start: Type.Integer({ minimum: 0 }),
  end: Type.Integer({ minimum: 0 }),
  quote: Type.String(),
  prefix: Type.String(),
  suffix: Type.String()
}, { additionalProperties: false });

export const PdfAnchorSchema = Type.Object({
  type: Type.Literal("pdf"),
  page: Type.Integer({ minimum: 1 }),
  quote: Type.String(),
  rects: Type.Array(PdfRectSchema)
}, { additionalProperties: false });

export const ReadingAnchorSchema = Type.Union([TextAnchorSchema, PdfAnchorSchema]);

const LibraryEntryProperties = {
  id: Type.String({ minLength: 1 }),
  title: Type.String({ minLength: 1 }),
  kind: DocumentKindSchema,
  category: ReadingCategorySchema,
  sourceName: Type.String({ minLength: 1 }),
  sourceBlobId: Type.String({ minLength: 1 }),
  mimeType: Type.String({ minLength: 1 }),
  sizeBytes: Type.Integer({ minimum: 0 }),
  createdAt: Type.String({ minLength: 1 }),
  updatedAt: Type.String({ minLength: 1 }),
  status: Type.Union([Type.Literal("active"), Type.Literal("trashed")])
};

export const LibraryEntrySchema = Type.Object(LibraryEntryProperties, { additionalProperties: false });

export const MaterialManifestSchema = Type.Object({
  ...LibraryEntryProperties,
  schemaVersion: Type.Literal(1),
  contentSha256: Type.Optional(Type.String({ minLength: 1 })),
  language: Type.Optional(Type.Union([Type.Literal("zh"), Type.Literal("en"), Type.Literal("mixed")])),
  pageCount: Type.Optional(Type.Integer({ minimum: 1 })),
  classification: Type.Optional(Type.Object({
    source: Type.Union([Type.Literal("heuristic"), Type.Literal("ai"), Type.Literal("user")]),
    updatedAt: Type.String({ minLength: 1 })
  }, { additionalProperties: false }))
}, { additionalProperties: false });

export const ReadingPreferencesSchema = Type.Object({
  schemaVersion: Type.Literal(1),
  pinyin: Type.Union([Type.Literal("hidden"), Type.Literal("on-demand"), Type.Literal("visible")]),
  scannedPdfOcr: Type.Union([Type.Literal("never"), Type.Literal("on-demand"), Type.Literal("visible-pages")]),
  rememberPosition: Type.Boolean(),
  position: Type.Optional(Type.Object({
    page: Type.Optional(Type.Integer({ minimum: 1 })),
    offset: Type.Optional(Type.Integer({ minimum: 0 }))
  }, { additionalProperties: false })),
  ocrProviderOverride: Type.Optional(Type.String({ minLength: 1 }))
}, { additionalProperties: false });

export const PinyinTokensSchema = Type.Array(Type.Object({
  text: Type.String(),
  pinyin: Type.String()
}, { additionalProperties: false }));

export const ReadingRecordSchema = Type.Object({
  schemaVersion: Type.Literal(1),
  id: Type.String({ minLength: 1 }),
  materialId: Type.String({ minLength: 1 }),
  kind: RecordKindSchema,
  quote: Type.String(),
  body: Type.Optional(Type.String()),
  actionId: Type.Optional(Type.String({ minLength: 1 })),
  anchor: ReadingAnchorSchema,
  createdAt: Type.String({ minLength: 1 }),
  updatedAt: Type.String({ minLength: 1 }),
  revision: Type.Integer({ minimum: 1 }),
  relatedRecordId: Type.Optional(Type.String({ minLength: 1 })),
  pinyin: Type.Optional(PinyinTokensSchema)
}, { additionalProperties: false });

export const LibraryCatalogSchema = Type.Object({
  schemaVersion: Type.Literal(1),
  entries: Type.Array(LibraryEntrySchema)
}, { additionalProperties: false });

const OcrBlockSchema = Type.Object({
  text: Type.String(),
  confidence: Type.Optional(Type.Number({ minimum: 0, maximum: 1 })),
  polygon: Type.Optional(Type.Array(PointSchema, { minItems: 3 }))
}, { additionalProperties: false });

export const OcrPageCacheSchema = Type.Object({
  schemaVersion: Type.Literal(1),
  page: Type.Integer({ minimum: 1 }),
  text: Type.String(),
  blocks: Type.Optional(Type.Array(OcrBlockSchema)),
  providerId: Type.String({ minLength: 1 }),
  createdAt: Type.String({ minLength: 1 })
}, { additionalProperties: false });

export const ExportDocumentSchema = Type.Object({
  schemaVersion: Type.Literal(1),
  exportedAt: Type.String({ minLength: 1 }),
  material: MaterialManifestSchema,
  preferences: ReadingPreferencesSchema,
  records: Type.Array(ReadingRecordSchema)
}, { additionalProperties: false });

export type DocumentKind = Static<typeof DocumentKindSchema>;
export type ReadingCategory = Static<typeof ReadingCategorySchema>;
export type RecordKind = Static<typeof RecordKindSchema>;
export type TextAnchor = Static<typeof TextAnchorSchema>;
export type PdfAnchor = Static<typeof PdfAnchorSchema>;
export type ReadingAnchor = Static<typeof ReadingAnchorSchema>;
export type LibraryEntry = Static<typeof LibraryEntrySchema>;
export type MaterialManifest = Static<typeof MaterialManifestSchema>;
export type ReadingPreferences = Static<typeof ReadingPreferencesSchema>;
export type ReadingRecord = Static<typeof ReadingRecordSchema>;
export type LibraryCatalog = Static<typeof LibraryCatalogSchema>;
export type ExportDocument = Static<typeof ExportDocumentSchema>;
export type OcrPageCache = Static<typeof OcrPageCacheSchema>;

export const DEFAULT_PREFERENCES: ReadingPreferences = {
  schemaVersion: 1,
  pinyin: "on-demand",
  scannedPdfOcr: "on-demand",
  rememberPosition: true
};
