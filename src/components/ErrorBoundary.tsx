import { Component, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type Props = { children: ReactNode };
type State = { error?: Error };

/**
 * Last-resort error screen. Prevents a render crash from leaving the user
 * with a silent black page; the message also tells them how to reset bad data.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = {};

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error("[trime-theme-editor] render failed", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="grid min-h-screen place-items-center bg-background p-page text-foreground">
        <div className="w-full max-w-xl rounded-xl border border-border bg-card p-panel">
          <h1 className="text-sm font-semibold">编辑器启动失败</h1>
          <p className="mt-1 text-caption text-muted-foreground">
            页面没有正常渲染。先尝试重新加载；如果仍然失败，可能是浏览器里的旧项目数据导致的。
          </p>
          <pre className="mt-3 max-h-64 overflow-auto whitespace-pre-wrap rounded border border-border bg-background p-2 text-2xs text-destructive">
            {this.state.error.name}: {this.state.error.message}
          </pre>
          <p className="mt-3 text-2xs text-muted-foreground">
            重置数据：DevTools → Application → IndexedDB → 删除 <code>trime-authoring</code>，然后刷新。
            这只会删除本机的项目草稿与快照。
          </p>
          <div className="mt-3 flex gap-stack">
            <Button type="button" size="sm" variant="outline" onClick={() => window.location.reload()}>
              重新加载
            </Button>
            <Button type="button" size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={() => {
              const request = indexedDB.deleteDatabase("trime-authoring");
              request.onsuccess = () => window.location.reload();
              request.onerror = () => window.location.reload();
            }}>
              删除本地数据并重载
            </Button>
          </div>
        </div>
      </div>
    );
  }
}
