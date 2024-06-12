import React from "react";
import { createContext, useState } from "react";

export const RoomContext = createContext(null);
export const PasswordContext = createContext(null);

function ContextProvider({ children }) {
  const [room, setRoom] = useState(localStorage.getItem("room") || "");
  const [password, setPassword] = useState(
    localStorage.getItem("password") || ""
  );
  return (
    <PasswordContext.Provider
      value={{
        password,
        setPassword,
      }}
    >
      <RoomContext.Provider
        value={{
          room,
          setRoom,
        }}
      >
        {children}
      </RoomContext.Provider>
    </PasswordContext.Provider>
  );
}

export default ContextProvider;
