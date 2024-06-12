import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import * as Y from "yjs";
import { Textarea } from "./TextArea";

const SYNC_INTERVAL_MS = 1000;
let syncInterval = setInterval(() => {}, 1000);

const useUserAwareness = (awareness, editorSet) => {
  const [userStates, setUserStates] = useState([]);

  useEffect(() => {
    if (!awareness) return;

    const updateUserStates = () => {
      setUserStates(
        [...awareness.getStates()].map(([id, state]) => {
          if (state.user.edited) {
            editorSet.current.add(state.user.clientName);
          }
          return {
            ...state.user,
            cursor: state.cursor,
            id,
            current: awareness.clientID === id,
          };
        })
      );
    };

    updateUserStates();
    awareness.on("change", updateUserStates);

    return () => {
      awareness.off("change", updateUserStates);
    };
  }, [awareness, editorSet]);

  return { userStates, editorSet: editorSet.current };
};

const getRelativePosition = (absolutePos, yText) => {
  return absolutePos != null && yText
    ? Y.createRelativePositionFromTypeIndex(yText, absolutePos)
    : null;
};

const getAbsolutePosition = (relativePos, yDoc) => {
  return relativePos && yDoc
    ? Y.createAbsolutePositionFromRelativePosition(relativePos, yDoc).index ??
        -1
    : -1;
};

export const YjsTextarea = (props) => {
  const { yText, awareness, db, setRef } = props;
  const editorSet = useRef(new Set());
  const { userStates } = useUserAwareness(awareness, editorSet);
  const textAreaRef = useRef(null);
  const helperDivRef = useRef(null);
  const cursorsDivRef = useRef(null);
  const [initialText, setInitialText] = useState("");

  const undoManager = useMemo(() => {
    return yText
      ? new Y.UndoManager(yText, { captureTimeout: 200 })
      : undefined;
  }, [yText]);

  const saveToIndexedDB = useCallback(async () => {
    if (editorSet.current && editorSet.current.size > 0) {
      const transaction = db.transaction("version", "readwrite");
      const currentText = yText.toString();
      await Promise.all([
        transaction.store.put(
          {
            editor: editorSet.current,
            originText: initialText,
            newText: currentText,
          },
          new Date().toLocaleString()
        ),
        transaction.done,
      ]);
      editorSet.current = new Set();
      if (awareness.getLocalState()) {
        awareness.setLocalStateField("user", {
          ...awareness.getLocalState().user,
          edited: false,
        });
      } else {
        awareness.setLocalStateField("user", { edited: false });
      }
      window.dispatchEvent(new CustomEvent("versionStoreUpdated"));
      setInitialText(currentText);
      clearInterval(syncInterval);
    }
  }, [db, yText, initialText, awareness]);

  const updateLocalCursorState = useCallback(() => {
    if (textAreaRef.current && awareness && yText) {
      const start = textAreaRef.current.selectionStart;
      const end = textAreaRef.current.selectionEnd;
      awareness.setLocalStateField("cursor", {
        anchor: getRelativePosition(start, yText),
        focus: getRelativePosition(end, yText),
      });
    }
  }, [yText, awareness]);

  const handleTextChange = useCallback(
    (delta) => {
      const textArea = textAreaRef.current;
      if (yText && undoManager && textArea) {
        if (delta === "undo") {
          undoManager.undo();
        } else if (delta === "redo") {
          undoManager.redo();
        } else {
          yText.applyDelta(delta);
        }
        textArea.value = yText.toString();
        clearInterval(syncInterval);
        const newText = textArea.value;
        syncInterval = setInterval(() => {
          saveToIndexedDB(initialText, newText);
        }, SYNC_INTERVAL_MS);
        awareness.setLocalStateField("user", {
          ...awareness.getLocalState().user,
          edited: true,
        });
      }
      updateLocalCursorState();
    },
    [
      undoManager,
      yText,
      initialText,
      awareness,
      updateLocalCursorState,
      saveToIndexedDB,
    ]
  );

  useEffect(() => {
    if (yText && yText.doc && textAreaRef.current && awareness) {
      const yDoc = yText.doc;
      const textArea = textAreaRef.current;
      const syncTextFromDoc = (_, origin) => {
        if (
          (origin !== undoManager && origin != null) ||
          textArea.value !== yText.toString()
        ) {
          clearInterval(syncInterval);
          syncInterval = setInterval(saveToIndexedDB, SYNC_INTERVAL_MS);
          textArea.value = yText.toString();
          const cursor = awareness.getLocalState()?.cursor;
          const newSelection = [
            getAbsolutePosition(cursor?.anchor, yDoc),
            getAbsolutePosition(cursor?.focus, yDoc),
          ];
          textArea.setSelectionRange(newSelection[0], newSelection[1]);
          updateLocalCursorState();
        }
      };

      syncTextFromDoc();
      yDoc.on("update", syncTextFromDoc);

      return () => {
        yDoc.off("update", syncTextFromDoc);
      };
    }
  }, [yText, undoManager, updateLocalCursorState, awareness, saveToIndexedDB]);

  const renderCursorIndicators = useCallback(
    (userState) => {
      const yDoc = yText?.doc;
      const text = yText?.toString() ?? "";
      const overlayRect = helperDivRef.current?.getBoundingClientRect();
      if (!yDoc || !userState.cursor || !overlayRect || userState.current) {
        return [];
      }
      const { anchor, focus } = userState.cursor;

      const [start, end] = [
        getAbsolutePosition(anchor, yDoc),
        getAbsolutePosition(focus, yDoc),
      ];
      let rects = getClientRects(start, end);

      return rects.map((rect, idx) => (
        <div
          key={userState.id + "_" + idx}
          className="user-indicator"
          style={{
            "--user-color": userState.color,
            left: rect.left - overlayRect.left,
            top: rect.top - overlayRect.top,
            width: rect.width,
            height: rect.height,
          }}
        >
          {idx === rects.length - 1 && (
            <div className="user-cursor">
              <div className="user-cursor-label">{userState.clientName}</div>
            </div>
          )}
          <div className="user-cursor-selection" />
        </div>
      ));

      function getClientRects(start, end) {
        if (!helperDivRef.current || start === -1 || end === -1) {
          return [];
        }
        helperDivRef.current.textContent = text + "\n";
        if (helperDivRef.current.firstChild == null) {
          return [];
        }
        const textNode = helperDivRef.current.firstChild;
        const range = document.createRange();
        range.setStart(textNode, start);
        range.setEnd(textNode, end);

        return Array.from(range.getClientRects());
      }
    },
    [yText]
  );

  useEffect(() => {
    if (textAreaRef.current && cursorsDivRef.current && helperDivRef.current) {
      const textArea = textAreaRef.current;
      const cursorsDiv = cursorsDivRef.current;
      const helperDiv = helperDivRef.current;
      const syncScroll = () => {
        cursorsDiv.scrollLeft = textArea.scrollLeft;
        cursorsDiv.scrollTop = textArea.scrollTop;
        helperDiv.scrollLeft = textArea.scrollLeft;
        helperDiv.scrollTop = textArea.scrollTop;
      };
      textArea.addEventListener("scroll", syncScroll, { passive: true });
      return () => {
        textArea.removeEventListener("scroll", syncScroll);
      };
    }
  }, []);

  useEffect(() => {
    setRef(textAreaRef);
  }, [textAreaRef, setRef]);

  return (
    <div className="relative w-[calc(100%-16px)] flex-grow border border-black rounded-lg bg-white flex flex-col">
      <Textarea
        className="inline-block text-2xl w-full h-full whitespace-pre-wrap resize-none border-none p-3 bg-transparent break-words m-0 flex-grow focus:outline-none"
        ref={textAreaRef}
        onSelectionChange={updateLocalCursorState}
        onTextChange={handleTextChange}
      />
      <div className="input overlay selection-helper-container hidden">
        <div className="selection-helper" ref={helperDivRef} />
      </div>
      <div className="overlay cursors-container" ref={cursorsDivRef}>
        <div className="cursors-wrapper">
          {userStates.flatMap(renderCursorIndicators)}
        </div>
      </div>
    </div>
  );
};
