import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import * as Y from "yjs";
import { IndexeddbPersistence } from "y-indexeddb";
import { WebrtcProvider } from "y-webrtc";
import { YjsTextarea } from "../YjsTextArea";
import History from "../Components/History";
import { PasswordContext, RoomContext } from "../Context/ContextProvider";
import { openDB } from "idb";
import { ADJECTIVES, ANIMALS } from "../Name/cursorNames";
import { COLOR } from "../Name/cssColors";
import { diffString } from "../util/CompareDiff";
import DOMPurify from "dompurify";

const myColor = getRandomElement(COLOR);

function getRandomElement(array) {
  return array[Math.floor(Math.random() * array.length)];
}
function capitalizeFirstLetter(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

function TextPage() {
  const { room } = useContext(RoomContext);
  const { password } = useContext(PasswordContext);
  const [yText, setYText] = useState();
  const [awareness, setAwareness] = useState();
  const db = useRef();
  const roomValue = useRef("");
  const [wrtcProvider, setWrtcProvider] = useState();
  const [name, setName] = useState();
  const [version, setVersion] = useState([]);
  const [ref, setRef] = useState();
  const [historyText, setHistoryText] = useState();
  const [isInternetAvailable, setInternetAvailable] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const checkInternetConnection = useCallback(() => {
    const url = "https://www.google.com/favicon.ico";
    const interval = 5000;

    const checkConnection = () => {
      fetch(url, { method: "HEAD", cache: "no-cache", mode: "no-cors" })
        .then((response) => {
          if (response.ok && !isInternetAvailable) {
            setInternetAvailable(false);
          } else if (!response.ok && isInternetAvailable) {
            setInternetAvailable(true);
          }
        })
        .catch((error) => {
          setInternetAvailable(false);
        });
    };

    checkConnection();
    setInterval(checkConnection, interval);
  }, [isInternetAvailable]);

  useEffect(() => {
    handleSideBarClose();
  }, []);

  useEffect(() => {
    checkInternetConnection();
  }, [checkInternetConnection]);

  useEffect(() => {
    const yDoc = new Y.Doc();
    const roomName = room + (password === "" ? "" : "-" + password);
    roomValue.current = roomName + "-version";
    const persistence = new IndexeddbPersistence(roomName, yDoc);
    const provider = new WebrtcProvider(room, yDoc, {
      signaling: [
        "wss://signal-server-yjs.glitch.me",
        "wss://signal-server-yjs-2.glitch.me",
        "wss://signal-server-yjs-3.glitch.me",
      ],
      password: password,
      maxConns: 65 + Math.floor(Math.random() * 70),
    });

    const initDB = async () => {
      db.current = await openDB(`${roomName}-version`, 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains("version")) {
            db.createObjectStore("version", {
              autoIncrement: true,
            });
          }
        },
      });
      const tx = await db.current.transaction("version", "readonly");
      let cursor = await tx.store.openCursor();
      const versions = [];
      while (cursor) {
        versions.push({ key: cursor.key, value: cursor.value });
        cursor = await cursor.continue();
      }
      setVersion(versions);
    };

    initDB();

    const handleVersionUpdate = async () => {
      const tx = await db.current.transaction("version", "readonly");
      let cursor = await tx.store.openCursor();
      const versions = [];
      while (cursor) {
        versions.push({ key: cursor.key, value: cursor.value });
        cursor = await cursor.continue();
      }
      setVersion(versions);
    };

    window.addEventListener("versionStoreUpdated", handleVersionUpdate);

    const initialName = `${capitalizeFirstLetter(
      getRandomElement(ADJECTIVES)
    )} ${getRandomElement(ANIMALS)}`;

    provider.awareness.setLocalStateField("user", {
      color: myColor,
      clientName: initialName,
      edited: false,
    });

    persistence.once("synced", () => {
      const yText = yDoc.getText("text");
      setYText(yText);
      setAwareness(provider.awareness);
      setWrtcProvider(provider);
    });

    return () => {
      yDoc.destroy();
      persistence.destroy();
      provider.destroy();
      setYText(undefined);
      setAwareness(undefined);
      setWrtcProvider(undefined);
      window.removeEventListener("versionStoreUpdated", handleVersionUpdate);
    };
  }, [password, room]);

  const handleChangeName = (name) => {
    if (wrtcProvider && name) {
      wrtcProvider.awareness.setLocalStateField("user", {
        ...wrtcProvider.awareness.getLocalState().user,
        color: myColor,
        clientName: name,
      });
    }
  };
  const handleSideBarClose = () => {
    const sidebar = document.querySelector(".sidebar");
    sidebar.style.display = "none";
  };
  const handleSideBarOpen = () => {
    const sidebar = document.querySelector(".sidebar");
    sidebar.style.display = "flex";
  };
  const handleRestoreClicked = () => {
    const input$ = ref.current;
    const textAreaLength = input$.value.length;
    yText.delete(0, textAreaLength);
    yText.insert(0, historyText.renderedText);
    setHistoryText(undefined);
  };
  const handleClickHistory = (text, oldText) => {
    setHistoryText({ renderedText: text, diff: diffString(oldText, text) });
    handleSideBarClose();
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };
  const downloadTextFile = () => {
    const input$ = ref.current;
    const blob = new Blob([input$.value], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "textarea-content.txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(room);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen lg:h-screen bg-gray-700">
      {!isInternetAvailable ? (
        <div className="text-white">Trying to restore connection...</div>
      ) : (
        ""
      )}
      <div className="flex w-full items-center px-[10px] flex-col gap-y-3 lg:flex-row lg:gap-y-0">
        <div className="flex items-center mt-[10px] lg:mt-0">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your name"
            className="focus:outline-none rounded-md mr-[10px]"
          />
          <div
            className="w-auto px-[10px] h-[30px] rounded-lg bg-[#322C2B] text-white flex items-center justify-center cursor-pointer"
            onClick={() => handleChangeName(name)}
          >
            Change Name
          </div>
        </div>
        <div className="flex flex-col justify-center items-center lg:flex-row lg:flex-grow ">
          <div className="flex items-center justify-center mr-[20px] gap-x-[5px]">
            <div className="mb-[10px] text-white flex items-center justify-center">
              Room ID: {room}
            </div>
            <img
              src="img/copy.png"
              alt=""
              className="h-[25px] w-auto cursor-pointer"
              onClick={handleCopy}
            />
          </div>

          <div className="mb-[10px] text-white mr-[10px] flex">
            Password: {showPassword ? password : "•••••"}
            <div
              onClick={togglePasswordVisibility}
              className=" ml-[10px] w-auto px-[10px] h-[30px] rounded-lg bg-[#322C2B] text-white flex items-center justify-center cursor-pointer"
            >
              {showPassword ? "Hide" : "Show"}
            </div>
          </div>
        </div>
        <div className="flex-grow">
          <div
            className="w-[100px] px-[10px] h-[30px] rounded-lg bg-[#322C2B] text-white flex items-center justify-center cursor-pointer"
            onClick={downloadTextFile}
          >
            Download
          </div>
        </div>

        <div
          className="w-auto px-[10px] h-[30px] rounded-lg bg-[#322C2B] text-white flex items-center justify-center cursor-pointer"
          onClick={handleSideBarOpen}
        >
          Text History
        </div>
      </div>
      <div className="w-[300px] bg-[#322C2B] fixed top-0 right-0 h-full z-10 backdrop-blur-sm bg-opacity-90 shadow overflow-y-auto flex flex-col gap-y-[15px] sidebar">
        <div className="relative">
          <img
            src="/img/close.png"
            alt=""
            className="absolute w-[30px] h-[30px] left-[10px] top-[17px] cursor-pointer"
            onClick={handleSideBarClose}
          />
          <p className="text-white text-center mt-[15px] text-[20px]">
            Text History
          </p>
        </div>

        {version.map((version, index) =>
          version.value.editor && version.value.editor.size > 0 ? (
            <History
              key={index}
              time={version.key}
              text={version.value.newText}
              editor={version.value.editor}
              oldText={version.value.originText}
              handleClick={handleClickHistory}
            />
          ) : (
            ""
          )
        )}
      </div>
      <div className="w-full flex-grow flex flex-col lg:flex-row">
        <div className="min-h-[400px] h-full lg:h-full flex-grow flex flex-col justify-center items-center">
          <YjsTextarea
            yText={yText}
            awareness={awareness}
            db={db.current}
            setRef={setRef}
          />
        </div>
        {historyText ? (
          <div className="h-1/2 w-full lg:h-auto lg:w-1/2 flex flex-col lg:flex-row px-[8px] gap-y-2 lg:gap-y-0">
            <div
              className="flex-grow px-[12px] py-[16px] text-[24px] lg:mr-[8px] border border-black bg-white rounded-md break-all"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(historyText.diff),
              }}
            />
            <div className="flex flex-col items-center justify-center gap-y-[15px]">
              <div
                className="w-[70px] h-[30px] rounded-md bg-[#322C2B] text-white flex items-center justify-center cursor-pointer"
                onClick={handleRestoreClicked}
              >
                Restore
              </div>
              <div
                className="w-[70px] h-[30px] rounded-md bg-white text-[#322C2B] flex items-center justify-center cursor-pointer"
                onClick={() => {
                  setHistoryText(undefined);
                }}
              >
                Cancel
              </div>
            </div>
          </div>
        ) : (
          <div></div>
        )}
      </div>
    </div>
  );
}

export default TextPage;
