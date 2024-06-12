import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import * as Y from "yjs";
import { Textarea } from "./TextArea";

const UPDATE_INTERVAL_TIME = 1000;
let updateInterval = setInterval(() => {}, 1000);

const useAwarenessUserInfos = (awareness, editor) => {
  const [userInfos, setUserInfos] = useState([]);

  useEffect(() => {
    if (!awareness) return;

    const updateUserInfos = () => {
      setUserInfos(
        [...awareness.getStates()].map(([id, info]) => {
          if (info.user.edited) {
            editor.current.add(info.user.clientName);
          }
          return {
            ...info.user,
            cursor: info.cursor,
            id,
            current: awareness.clientID === id,
          };
        })
      );
      //console.log(awareness.getStates());
    };

    updateUserInfos();
    awareness.on("change", updateUserInfos);

    return () => {
      awareness.off("change", updateUserInfos);
    };
  }, [awareness, editor]);

  return { userInfo: userInfos, editor: editor.current };
};

const toRelative = (yPosAbs, yText) => {
  return yPosAbs != null && yText
    ? Y.createRelativePositionFromTypeIndex(yText, yPosAbs)
    : null;
};

const toAbsolute = (yPosRel, yDoc) => {
  return yPosRel && yDoc
    ? Y.createAbsolutePositionFromRelativePosition(yPosRel, yDoc).index ?? -1
    : -1;
};

export const YjsTextarea = (props) => {
  const { yText, awareness, db, setRef } = props;
  const editor = useRef(new Set());
  const userInfos = useAwarenessUserInfos(awareness, editor);
  const ref = useRef(null);
  const helperRef = useRef(null);
  const cursorsRef = useRef(null);
  const [originalText, setOriginalText] = useState("");

  const undoManager = useMemo(() => {
    return yText
      ? new Y.UndoManager(yText, { captureTimeout: 200 })
      : undefined;
  }, [yText]);

  const uploadToIndexeddb = useCallback(async () => {
    if (editor.current && editor.current.size > 0) {
      const tx = db.transaction("version", "readwrite");
      const textareaString = yText.toString();
      await Promise.all([
        tx.store.put(
          {
            editor: editor.current,
            originText: originalText,
            newText: textareaString,
          },
          new Date().toLocaleString()
        ),
        tx.done,
      ]);
      editor.current = new Set();
      if (awareness.getLocalState()) {
        awareness.setLocalStateField("user", {
          ...awareness.getLocalState().user,
          edited: false,
        });
      } else {
        awareness.setLocalStateField("user", { edited: false });
      }
      window.dispatchEvent(new CustomEvent("versionStoreUpdated"));
      setOriginalText(textareaString);
      clearInterval(updateInterval);
    }
  }, [db, yText, originalText, awareness]);

  const resetLocalAwarenessCursors = useCallback(() => {
    if (ref.current && awareness && yText) {
      const s = ref.current.selectionStart;
      const e = ref.current.selectionEnd;
      awareness.setLocalStateField("cursor", {
        anchor: toRelative(s, yText),
        focus: toRelative(e, yText),
      });
    }
  }, [yText, awareness]);

  const handleLocalTextChange = useCallback(
    (delta) => {
      const input$ = ref.current;
      if (yText && undoManager && input$) {
        if (delta === "undo") {
          undoManager.undo();
        } else if (delta === "redo") {
          undoManager.redo();
        } else {
          yText.applyDelta(delta);
        }
        input$.value = yText.toString();
        clearInterval(updateInterval);
        const newText = input$.value;
        updateInterval = setInterval(() => {
          uploadToIndexeddb(originalText, newText);
        }, UPDATE_INTERVAL_TIME);
        awareness.setLocalStateField("user", {
          ...awareness.getLocalState().user,
          edited: true,
        });
      }
      resetLocalAwarenessCursors();
    },
    [
      undoManager,
      yText,
      originalText,
      awareness,
      resetLocalAwarenessCursors,
      uploadToIndexeddb,
    ]
  );

  useEffect(() => {
    if (yText && yText.doc && ref.current && awareness) {
      const yDoc = yText.doc;
      const input$ = ref.current;
      const syncFromYDoc = (_, origin) => {
        if (
          (origin !== undoManager && origin != null) ||
          input$.value !== yText.toString()
        ) {
          clearInterval(updateInterval);
          updateInterval = setInterval(uploadToIndexeddb, UPDATE_INTERVAL_TIME);
          input$.value = yText.toString();
          const cursor = awareness.getLocalState()?.cursor;
          const newRange = [
            toAbsolute(cursor?.anchor, yDoc),
            toAbsolute(cursor?.focus, yDoc),
          ];
          input$.setSelectionRange(newRange[0], newRange[1]);
          resetLocalAwarenessCursors();
        }
      };

      syncFromYDoc();
      yDoc.on("update", syncFromYDoc);

      return () => {
        yDoc.off("update", syncFromYDoc);
      };
    }
  }, [
    yText,
    undoManager,
    resetLocalAwarenessCursors,
    awareness,
    uploadToIndexeddb,
  ]);

  const renderUserIndicator = useCallback(
    (userInfo) => {
      const yDoc = yText?.doc;
      const text = yText?.toString() ?? "";
      const overlayRect = helperRef.current?.getBoundingClientRect();
      if (!yDoc || !userInfo.cursor || !overlayRect || userInfo.current) {
        return [];
      }
      const { anchor, focus } = userInfo.cursor;

      const [start, end] = [toAbsolute(anchor, yDoc), toAbsolute(focus, yDoc)];
      let rects = getClientRects(start, end);

      return rects.map((rect, idx) => {
        return (
          <div
            key={userInfo.id + "_" + idx}
            className="user-indicator"
            style={{
              "--user-color": userInfo.color,
              left: rect.left - overlayRect.left,
              top: rect.top - overlayRect.top,
              width: rect.width,
              height: rect.height,
            }}
          >
            {idx === rects.length - 1 && (
              <div className="user-cursor">
                <div className="user-cursor-label">{userInfo.clientName}</div>
              </div>
            )}
            <div className="user-cursor-selection" />
          </div>
        );
      });

      function getClientRects(start, end) {
        if (!helperRef.current || start === -1 || end === -1) {
          return [];
        }
        helperRef.current.textContent = text + "\n";
        if (helperRef.current.firstChild == null) {
          return [];
        }
        const textNode = helperRef.current.firstChild;
        const range = document.createRange();
        range.setStart(textNode, start);
        range.setEnd(textNode, end);

        return Array.from(range.getClientRects());
      }
    },
    [yText]
  );

  useEffect(() => {
    if (ref.current && cursorsRef.current && helperRef.current) {
      const input$ = ref.current;
      const cursors$ = cursorsRef.current;
      const helper$ = helperRef.current;
      const handleScroll = () => {
        cursors$.scrollLeft = input$.scrollLeft;
        cursors$.scrollTop = input$.scrollTop;
        helper$.scrollLeft = input$.scrollLeft;
        helper$.scrollTop = input$.scrollTop;
      };
      input$.addEventListener("scroll", handleScroll, { passive: true });
      return () => {
        input$.removeEventListener("scroll", handleScroll);
      };
    }
  }, []);

  useEffect(() => {
    setRef(ref);
  }, [ref, setRef]);

  return (
    <div className="relative w-[calc(100%-16px)] flex-grow border border-black rounded-lg bg-white flex flex-col">
      <Textarea
        className="inline-block text-2xl w-full h-full whitespace-pre-wrap resize-none border-none p-3 bg-transparent break-words m-0 flex-grow focus:outline-none"
        ref={ref}
        onSelectionChange={resetLocalAwarenessCursors}
        onTextChange={handleLocalTextChange}
      />
      <div className="input overlay selection-helper-container hidden">
        <div className="selection-helper" ref={helperRef} />
      </div>
      <div className="overlay cursors-container" ref={cursorsRef}>
        <div className="cursors-wrapper">
          {userInfos.userInfo.flatMap(renderUserIndicator)}
        </div>
      </div>
    </div>
  );
};
