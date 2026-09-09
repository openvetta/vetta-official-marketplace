import { definePlugin, type PluginContext } from "@vetta-org/plugin-sdk";
import { lazy, Suspense, type ComponentType, type ReactElement } from "react";
import { ShimoRepository } from "./repository";
import type { ShimoRuntime, ShimoRuntimeEvent } from "./runtime";
import "./style.css";

const WORKSPACE_VIEW_ID = "reader";

function createRuntime(context: PluginContext): ShimoRuntime {
  let selectedMaterialId: string | null = null;
  const listeners = new Set<(event: ShimoRuntimeEvent) => void>();
  const emit = (event: ShimoRuntimeEvent): void => {
    for (const listener of listeners) listener(event);
  };
  return {
    context,
    repository: new ShimoRepository(context.storage),
    getSelectedId: () => selectedMaterialId,
    setSelectedId: (id) => {
      selectedMaterialId = id;
      emit({ type: "material-selected", materialId: id });
    },
    notifyRecordsChanged: (materialId) => emit({ type: "records-changed", materialId }),
    subscribe: (listener) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    }
  };
}

function lazySurface<P extends object>(load: () => Promise<{ default: ComponentType<P> }>): (props: P) => ReactElement {
  const Lazy = lazy(load);
  return function LazyPluginSurface(props: P): ReactElement {
    return <Suspense fallback={null}><Lazy {...props} /></Suspense>;
  };
}

const ReaderView = lazySurface(async () => ({ default: (await import("./reader/components/ReaderView")).ReaderView }));
const ActivityPanel = lazySurface(async () => ({ default: (await import("./activity-panel")).ActivityPanel }));

function workspaceComponent(runtime: ShimoRuntime): () => ReactElement {
  return () => <ReaderView runtime={runtime} />;
}

function activityComponent(runtime: ShimoRuntime): () => ReactElement {
  return () => <ActivityPanel runtime={runtime} />;
}

export default definePlugin({
  activate(context) {
    const runtime = createRuntime(context);
    const workspaceView = context.ui.registerWorkspaceView({
      id: WORKSPACE_VIEW_ID,
      label: "%name%",
      description: "%description%",
      component: workspaceComponent(runtime),
      sidebar: true
    });
    const activityTab = context.ui.registerActivityTab({
      id: "reader-context",
      label: "%name%",
      component: activityComponent(runtime),
      scope_use: ["project", "conversation"],
      initiallyVisible: false,
      retention: "warm"
    });
    const openAction = context.fileExplorer.registerContextMenuAction({
      id: "open-shimo-reader",
      label: "%action.open%",
      order: 60,
      when: { resourceType: "file", extensions: ["pdf", "md", "markdown", "txt"] },
      run: () => context.ui.openWorkspaceView(WORKSPACE_VIEW_ID)
    });

    return () => {
      openAction.dispose();
      activityTab.dispose();
      workspaceView.dispose();
    };
  }
});
