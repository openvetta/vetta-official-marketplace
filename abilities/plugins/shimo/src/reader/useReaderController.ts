import { useTranslation, type PluginTranslate } from "@vetta-org/plugin-sdk";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { ReadingAiModel } from "../ai";
import { ACTIONS, type SelectionAction } from "../classification";
import {
  DEFAULT_PREFERENCES,
  type LibraryEntry,
  type MaterialManifest,
  type ReadingPreferences,
  type ReadingRecord
} from "../domain";
import { buildAnnotatedPdf, buildExportDocument, exportRecords, sanitizeExportBaseName } from "../export";
import { resolvePinyin } from "../pinyin";
import { createRecord } from "../repository";
import type { ShimoRuntime } from "../runtime";
import { buildQuestionPrompt, buildQuickActionPrompt } from "./prompts";
import { readSelection } from "./selection";
import { answerReadingSelection } from "./readingAiRecords";
import { localeFrom, type Locale, type PendingNote, type PendingQuestion, type ReaderNotice, type ReadingSelection } from "./types";
import { useMaterialClassification } from "./useMaterialClassification";
import { useReadingAiModel } from "./useReadingAiModel";

export interface ReaderController {
  locale: Locale;
  t: PluginTranslate;
  entries: LibraryEntry[];
  manifest: MaterialManifest | null;
  sourceUrl: string;
  content: string;
  records: ReadingRecord[];
  pinyinRecords: ReadingRecord[];
  preferences: ReadingPreferences;
  selection: ReadingSelection | null;
  pendingNote: PendingNote | null;
  pendingQuestion: PendingQuestion | null;
  notice: ReaderNotice | null;
  streamingAnswerId: string | null;
  aiModels: ReadingAiModel[];
  aiModelKey: string | null;
  defaultAiModelKey: string | null;
  aiModelsLoading: boolean;
  aiModelsError: string | null;
  loading: boolean;
  page: number;
  pageCount: number;
  libraryOpen: boolean;
  recordsOpen: boolean;
  preferencesOpen: boolean;
  chromeQuiet: boolean;
  pdfRoot: RefObject<HTMLDivElement | null>;
  textRoot: RefObject<HTMLDivElement | null>;
  refreshLibrary(): Promise<void>;
  selectMaterial(id: string): Promise<void>;
  clearSelection(): void;
  importFiles(files: FileList | File[]): Promise<void>;
  captureSelection(): void;
  runAction(action: SelectionAction): Promise<void>;
  cancelNote(): void;
  saveNote(body: string): Promise<void>;
  cancelQuestion(): void;
  askQuestion(question: string): Promise<void>;
  changePreferences(patch: Partial<ReadingPreferences>): Promise<void>;
  changeAiModel(modelKey: string): Promise<void>;
  refreshAiModels(): Promise<void>;
  exportFormat(format: "json" | "markdown" | "html"): Promise<void>;
  exportPdf(): Promise<void>;
  setPage(page: number): void;
  setPageCount(count: number): void;
  setLibraryOpen(open: boolean): void;
  setRecordsOpen(open: boolean): void;
  setPreferencesOpen(open: boolean): void;
  handleReaderScroll(): void;
  restoreChrome(): void;
}

export function useReaderController(runtime: ShimoRuntime): ReaderController {
  const { locale: hostLocale, t } = useTranslation();
  const locale = localeFrom(hostLocale);
  const [entries, setEntries] = useState<LibraryEntry[]>([]);
  const [manifest, setManifest] = useState<MaterialManifest | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [content, setContent] = useState("");
  const [records, setRecords] = useState<ReadingRecord[]>([]);
  const [preferences, setPreferences] = useState<ReadingPreferences>(DEFAULT_PREFERENCES);
  const [selection, setSelection] = useState<ReadingSelection | null>(null);
  const [pendingNote, setPendingNote] = useState<PendingNote | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<PendingQuestion | null>(null);
  const [notice, setNotice] = useState<ReaderNotice | null>(null);
  const [streamingAnswerId, setStreamingAnswerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [recordsOpen, setRecordsOpen] = useState(false);
  const [preferencesOpen, setPreferencesOpen] = useState(false);
  const [chromeQuiet, setChromeQuiet] = useState(false);
  const noticeSequence = useRef(0);
  const loadSequence = useRef(0);
  const quietTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answerAbortController = useRef<AbortController | null>(null);
  const textRoot = useRef<HTMLDivElement>(null);
  const pdfRoot = useRef<HTMLDivElement>(null);
  const manifestRef = useRef<MaterialManifest | null>(null);
  const preferencesRef = useRef<ReadingPreferences>(preferences);
  manifestRef.current = manifest;
  preferencesRef.current = preferences;
  const aiModel = useReadingAiModel(runtime);

  const showNotice = useCallback((tone: ReaderNotice["tone"], message: string): void => {
    const id = ++noticeSequence.current;
    setNotice({ id, tone, message });
    if (tone !== "info") {
      window.setTimeout(() => setNotice((current) => current?.id === id ? null : current), tone === "error" ? 6000 : 2800);
    }
  }, []);

  const handleClassified = useCallback((next: MaterialManifest): void => setManifest(next), []);
  const handleClassificationStatus = useCallback((message: string | null): void => {
    if (message) showNotice("info", message);
    else setNotice((current) => current?.tone === "info" ? null : current);
  }, [showNotice]);
  useMaterialClassification(
    runtime,
    manifest,
    content,
    aiModel.modelKey,
    t,
    handleClassified,
    handleClassificationStatus
  );

  const loadMaterial = useCallback(async (id: string): Promise<void> => {
    answerAbortController.current?.abort();
    const requestId = ++loadSequence.current;
    const nextManifest = await runtime.repository.getManifest(id);
    if (!nextManifest || requestId !== loadSequence.current) return;
    runtime.setSelectedId(nextManifest.id);
    const [nextRecords, nextPreferences, nextUrl, nextContent] = await Promise.all([
      runtime.repository.listRecords(nextManifest.id),
      runtime.repository.getPreferences(nextManifest.id),
      runtime.repository.getSourceUrl(nextManifest.id),
      nextManifest.kind === "pdf" ? Promise.resolve("") : runtime.repository.readSourceText(nextManifest.id)
    ]);
    if (requestId !== loadSequence.current) return;
    setManifest(nextManifest);
    setRecords(nextRecords);
    preferencesRef.current = nextPreferences;
    setPreferences(nextPreferences);
    setSourceUrl(nextUrl);
    setContent(nextContent);
    setPage(nextPreferences.position?.page ?? 1);
    setPageCount(0);
    setSelection(null);
    setPendingNote(null);
    setPendingQuestion(null);
  }, [runtime]);

  const refreshLibrary = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const nextEntries = await runtime.repository.listMaterials();
      setEntries(nextEntries);
      const rememberedId = runtime.getSelectedId();
      const selectedId = nextEntries.some((entry) => entry.id === rememberedId)
        ? rememberedId
        : nextEntries[0]?.id;
      if (selectedId) await loadMaterial(selectedId);
      else {
        setManifest(null);
        setSourceUrl("");
        setContent("");
        setRecords([]);
      }
    } catch (error) {
      showNotice("error", `${t("status.error")}: ${errorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  }, [loadMaterial, runtime, showNotice, t]);

  useEffect(() => {
    void refreshLibrary();
  }, [refreshLibrary]);

  useEffect(() => () => {
    if (quietTimer.current) clearTimeout(quietTimer.current);
    answerAbortController.current?.abort();
  }, []);

  const selectMaterial = async (id: string): Promise<void> => {
    setLoading(true);
    try {
      await loadMaterial(id);
    } catch (error) {
      showNotice("error", `${t("status.error")}: ${errorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const clearSelection = useCallback((): void => {
    answerAbortController.current?.abort();
    runtime.setSelectedId(null);
    setManifest(null);
    setSourceUrl("");
    setContent("");
    setRecords([]);
    setSelection(null);
    setPendingNote(null);
    setPendingQuestion(null);
  }, [runtime]);

  const importFiles = async (files: FileList | File[]): Promise<void> => {
    setLoading(true);
    try {
      let selectedId: string | undefined;
      for (const file of Array.from(files)) {
        selectedId = (await runtime.repository.importFile(file)).id;
      }
      setEntries(await runtime.repository.listMaterials());
      if (selectedId) await loadMaterial(selectedId);
      showNotice("success", t("status.imported"));
    } catch (error) {
      showNotice("error", `${t("status.error")}: ${errorMessage(error)}`);
    } finally {
      setLoading(false);
    }
  };

  const captureSelection = (): void => {
    if (!manifest) return;
    setSelection(readSelection(
      manifest,
      content,
      page,
      pdfRoot.current,
      window.getSelection(),
      { width: window.innerWidth, height: window.innerHeight }
    ));
  };

  const saveLocalRecord = async (
    kind: "highlight" | "pinyin",
    action: SelectionAction,
    selected: ReadingSelection
  ): Promise<void> => {
    if (!manifest) return;
    const pinyin = kind === "pinyin"
      ? await resolvePinyin(selected.quote, runtime.repository, runtime.context.ai, requireAiModel(aiModel.modelKey, t))
      : undefined;
    const record = createRecord(manifest.id, kind, selected.quote, selected.anchor, { pinyin, actionId: action.id });
    await runtime.repository.saveRecord(record);
    runtime.notifyRecordsChanged(record.materialId);
    setRecords((current) => [...current, record]);
    setSelection(null);
    showNotice("success", t("status.saved"));
  };

  const saveReadingAiAnswer = async (
    action: SelectionAction,
    selected: ReadingSelection,
    question: string,
    prompt: string
  ): Promise<void> => {
    if (!manifest) return;
    const modelKey = requireAiModel(aiModel.modelKey, t);
    answerAbortController.current?.abort();
    const controller = new AbortController();
    answerAbortController.current = controller;
    let answerDraftId: string | null = null;
    setRecordsOpen(true);
    setPreferencesOpen(false);
    showNotice("info", t("status.answering"));
    try {
      const { answer } = await answerReadingSelection({
        ai: runtime.context.ai,
        repository: runtime.repository,
        modelKey,
        manifest,
        selection: selected,
        action,
        question,
        prompt,
        locale,
        signal: controller.signal,
        onQuestionSaved: (questionRecord) => {
          runtime.notifyRecordsChanged(questionRecord.materialId);
          if (runtime.getSelectedId() === questionRecord.materialId) {
            setRecords((current) => [...current, questionRecord]);
          }
        },
        onAnswerChanged: (answerRecord) => {
          answerDraftId = answerRecord.id;
          setStreamingAnswerId(answerRecord.id);
          if (runtime.getSelectedId() === answerRecord.materialId) {
            setRecords((current) => upsertRecord(current, answerRecord));
          }
        }
      });
      runtime.notifyRecordsChanged(answer.materialId);
      showNotice("success", t("status.answered"));
    } catch (error) {
      if (answerDraftId) {
        setRecords((current) => current.filter((record) => record.id !== answerDraftId));
      }
      if (controller.signal.aborted) {
        setNotice((current) => current?.tone === "info" ? null : current);
        throw abortError();
      }
      throw error;
    } finally {
      if (answerAbortController.current === controller) {
        answerAbortController.current = null;
        setStreamingAnswerId(null);
      }
    }
  };

  const runAction = async (action: SelectionAction): Promise<void> => {
    if (!manifest || !selection) return;
    const selected = selection;
    try {
      if (action.local === "note" || action.local === "reflection") {
        setPendingNote({ kind: action.local, action, selection: selected });
        setSelection(null);
        return;
      }
      if (action.local === "highlight" || action.local === "pinyin") {
        await saveLocalRecord(action.local, action, selected);
        return;
      }
      if (action.id === "ask") {
        setPendingQuestion({ action, selection: selected });
        setSelection(null);
        return;
      }
      setSelection(null);
      const question = locale === "zh" ? (action.promptZh ?? action.zh) : (action.promptEn ?? action.en);
      await saveReadingAiAnswer(action, selected, question, buildQuickActionPrompt(manifest, selected, action, locale));
    } catch (error) {
      if (isAbortError(error)) return;
      showNotice("error", `${t("status.error")}: ${errorMessage(error)}`);
    }
  };

  const askQuestion = async (question: string): Promise<void> => {
    if (!manifest || !pendingQuestion) return;
    const submittedMaterialId = manifest.id;
    const submittedQuestion = pendingQuestion;
    setPendingQuestion(null);
    try {
      await saveReadingAiAnswer(
        submittedQuestion.action,
        submittedQuestion.selection,
        question,
        buildQuestionPrompt(manifest, submittedQuestion.selection, question, locale)
      );
    } catch (error) {
      if (isAbortError(error)) return;
      if (runtime.getSelectedId() === submittedMaterialId) setPendingQuestion(submittedQuestion);
      showNotice("error", `${t("status.error")}: ${errorMessage(error)}`);
    }
  };

  const saveNote = async (body: string): Promise<void> => {
    if (!manifest || !pendingNote) return;
    try {
      const record = createRecord(manifest.id, pendingNote.kind, pendingNote.selection.quote, pendingNote.selection.anchor, {
        body,
        actionId: pendingNote.action.id
      });
      await runtime.repository.saveRecord(record);
      runtime.notifyRecordsChanged(record.materialId);
      setRecords((current) => [...current, record]);
      setPendingNote(null);
      showNotice("success", t("status.saved"));
    } catch (error) {
      showNotice("error", `${t("status.error")}: ${errorMessage(error)}`);
      throw error;
    }
  };

  const changePreferences = async (patch: Partial<ReadingPreferences>): Promise<void> => {
    if (!manifest) return;
    const next = { ...preferences, ...patch };
    preferencesRef.current = next;
    setPreferences(next);
    try {
      await runtime.repository.savePreferences(manifest.id, next);
    } catch (error) {
      preferencesRef.current = preferences;
      setPreferences(preferences);
      showNotice("error", `${t("status.error")}: ${errorMessage(error)}`);
    }
  };

  const changeAiModel = async (modelKey: string): Promise<void> => {
    try {
      await aiModel.select(modelKey);
      showNotice("success", t("ai.modelSaved"));
    } catch (error) {
      showNotice("error", `${t("status.error")}: ${errorMessage(error)}`);
    }
  };

  const exportFormat = async (format: "json" | "markdown" | "html"): Promise<void> => {
    if (!manifest) return;
    try {
      const output = await exportRecords(runtime.context.fs, buildExportDocument(manifest, preferences, records), format, locale);
      if (output) showNotice("success", t("status.exported"));
    } catch (error) {
      showNotice("error", `${t("status.error")}: ${errorMessage(error)}`);
    }
  };

  const exportPdf = async (): Promise<void> => {
    if (!manifest || manifest.kind !== "pdf") return;
    try {
      const response = await fetch(sourceUrl);
      const base64 = await buildAnnotatedPdf(await response.arrayBuffer(), records);
      const base = sanitizeExportBaseName(manifest.title, locale === "zh" ? "资料" : "Material");
      const suffix = locale === "zh" ? "批注版" : "Annotated";
      const output = await runtime.context.fs.saveAs(`${base}-${suffix}.pdf`, base64, "base64", {
        filters: [{ name: "PDF", extensions: ["pdf"] }]
      });
      if (output) showNotice("success", t("status.exported"));
    } catch (error) {
      showNotice("error", `${t("status.error")}: ${errorMessage(error)}`);
    }
  };

  const handleReaderScroll = (): void => {
    setChromeQuiet(true);
    if (quietTimer.current) clearTimeout(quietTimer.current);
    quietTimer.current = setTimeout(() => setChromeQuiet(false), 1200);
  };

  const restoreChrome = (): void => {
    if (quietTimer.current) clearTimeout(quietTimer.current);
    setChromeQuiet(false);
  };

  const changePage = useCallback((nextPage: number): void => {
    setPage(nextPage);
    const currentManifest = manifestRef.current;
    const currentPreferences = preferencesRef.current;
    if (!currentManifest || !currentPreferences.rememberPosition) return;
    const nextPreferences = { ...currentPreferences, position: { ...currentPreferences.position, page: nextPage } };
    preferencesRef.current = nextPreferences;
    setPreferences(nextPreferences);
    void runtime.repository.savePreferences(currentManifest.id, nextPreferences).catch((error: unknown) => {
      showNotice("error", `${t("status.error")}: ${errorMessage(error)}`);
    });
  }, [runtime.repository, showNotice, t]);

  return {
    locale,
    t,
    entries,
    manifest,
    sourceUrl,
    content,
    records,
    pinyinRecords: preferences.pinyin === "hidden"
      ? []
      : records.filter((record) => record.kind === "pinyin" && record.pinyin),
    preferences,
    selection,
    pendingNote,
    pendingQuestion,
    notice,
    streamingAnswerId,
    aiModels: aiModel.models,
    aiModelKey: aiModel.modelKey,
    defaultAiModelKey: aiModel.defaultModelKey,
    aiModelsLoading: aiModel.loading,
    aiModelsError: aiModel.error,
    loading,
    page,
    pageCount,
    libraryOpen,
    recordsOpen,
    preferencesOpen,
    chromeQuiet,
    pdfRoot,
    textRoot,
    refreshLibrary,
    selectMaterial,
    clearSelection,
    importFiles,
    captureSelection,
    runAction,
    cancelNote: () => setPendingNote(null),
    saveNote,
    cancelQuestion: () => setPendingQuestion(null),
    askQuestion,
    changePreferences,
    changeAiModel,
    refreshAiModels: aiModel.refresh,
    exportFormat,
    exportPdf,
    setPage: changePage,
    setPageCount,
    setLibraryOpen,
    setRecordsOpen,
    setPreferencesOpen,
    handleReaderScroll,
    restoreChrome
  };
}

export function actionsFor(controller: Pick<ReaderController, "manifest">): SelectionAction[] {
  return controller.manifest ? ACTIONS[controller.manifest.category] : [];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function requireAiModel(modelKey: string | null, t: PluginTranslate): string {
  if (!modelKey) throw new Error(t("ai.modelRequired"));
  return modelKey;
}

function upsertRecord(records: ReadingRecord[], next: ReadingRecord): ReadingRecord[] {
  const index = records.findIndex((record) => record.id === next.id);
  if (index < 0) return [...records, next];
  return records.map((record, currentIndex) => currentIndex === index ? next : record);
}

function abortError(): Error {
  const error = new Error("AI answer generation was aborted");
  error.name = "AbortError";
  return error;
}

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}
