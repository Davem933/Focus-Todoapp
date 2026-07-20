import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import CodeMirror from "@uiw/react-codemirror";
import type { EditorView } from "@codemirror/view";
import { createNoteLiveEditorExtensions } from "./noteLiveEditorExtensions";
import type { NoteLiveEditorConfig } from "./noteLiveEditorExtensions";
import type { MentionItem, Note } from "./noteTypes";

type NoteLiveEditorProps = {
  content: string;
  noteId: string;
  notesInTeam: Note[];
  mentionItems: MentionItem[];
  onContentChange: (content: string) => void;
  onOpenNoteByTitle: (title: string) => void;
  onCreateNoteWithTitle: (title: string) => void;
  onOpenTask: (taskId: string) => void;
  onOpenProject: (projectId: string) => void;
};

const BASIC_SETUP = {
  autocompletion: false,
  closeBrackets: false,
  foldGutter: false,
  highlightActiveLine: false,
  highlightActiveLineGutter: false,
  lineNumbers: false,
};

function buildConfig(props: NoteLiveEditorProps): NoteLiveEditorConfig {
  return {
    getMentionItems: () => props.mentionItems,
    getNoteTitles: () => props.notesInTeam.map((note) => note.title),
    noteExists: (title: string) =>
      props.notesInTeam.some(
        (note) => note.title.trim().toLowerCase() === title.trim().toLowerCase(),
      ),
    onCreateNoteWithTitle: props.onCreateNoteWithTitle,
    onOpenNoteByTitle: props.onOpenNoteByTitle,
    onOpenProject: props.onOpenProject,
    onOpenTask: props.onOpenTask,
  };
}

export function NoteLiveEditor(props: NoteLiveEditorProps) {
  const configRef = useRef<NoteLiveEditorConfig>(buildConfig(props));
  configRef.current = buildConfig(props);

  const notesInTeamRef = useRef(props.notesInTeam);
  notesInTeamRef.current = props.notesInTeam;

  // CodeMirror owns the document after mount; feeding `content` back in on
  // every keystroke (a fully "controlled" value) makes @uiw/react-codemirror
  // periodically re-sync via a full document replace, which silently kills
  // any in-progress autocomplete session. So the doc is only set here once
  // (initial mount) and swapped imperatively below when the note changes.
  const [initialContent] = useState(props.content);

  const viewRef = useRef<EditorView | null>(null);
  const noteIdRef = useRef(props.noteId);

  useEffect(() => {
    if (noteIdRef.current === props.noteId) {
      return;
    }

    noteIdRef.current = props.noteId;
    const view = viewRef.current;

    if (!view) {
      return;
    }

    // `props.content` (the "draft") lags one render behind `noteId` — it's
    // synced by a separate effect upstream — so read the persisted note's
    // content directly rather than the stale draft.
    const targetNote = notesInTeamRef.current.find((note) => note.id === props.noteId);
    const nextContent = targetNote?.content ?? props.content;

    view.dispatch({
      changes: { from: 0, insert: nextContent, to: view.state.doc.length },
      selection: { anchor: 0 },
    });
  }, [props.noteId]);

  // `onChange`/`basicSetup` sit in @uiw/react-codemirror's reconfigure-effect
  // dependency array; an unstable reference on either forces a live
  // `reconfigure` transaction on every re-render, which also wipes any
  // in-progress completion session. Keep them referentially stable.
  const onContentChangeRef = useRef(props.onContentChange);
  onContentChangeRef.current = props.onContentChange;
  const handleChange = useCallback((value: string) => onContentChangeRef.current(value), []);

  const extensions = useMemo(() => createNoteLiveEditorExtensions(configRef), []);

  return (
    <div className="min-h-64 flex-1 overflow-y-auto rounded-md border border-nt-border bg-nt-bg px-3 py-2">
      <CodeMirror
        aria-label="Obsah poznámky (markdown)"
        basicSetup={BASIC_SETUP}
        extensions={extensions}
        placeholder="Piš markdown… použij [[Název poznámky]] pro odkaz na jinou poznámku a @ pro zmínku úkolu/nástěnky."
        theme="none"
        value={initialContent}
        onChange={handleChange}
        onCreateEditor={(view) => {
          viewRef.current = view;
        }}
      />
    </div>
  );
}
