import React, { useContext, useState } from "react";
import "./Landing.css";
import { v4 as uuidv4 } from "uuid";
import { PasswordContext, RoomContext } from "../Context/ContextProvider";
import { useNavigate } from "react-router";

function Landing() {
  const { setRoom } = useContext(RoomContext);
  const { setPassword } = useContext(PasswordContext);
  const [text, setText] = useState("");
  const [textPass, setPass] = useState("");
  const navigate = useNavigate();

  const handleRoomChange = (e) => {
    setText(e.target.value);
  };
  const handleCreateRoom = () => {
    const tempRoom = uuidv4();
    setRoom(tempRoom);
    setPassword(textPass);
    localStorage.setItem("room", tempRoom);
    localStorage.setItem("passsword", textPass);
    navigate("/text");
  };
  const handleJoinRoom = (e) => {
    e.preventDefault();
    setRoom(text);
    setPassword(textPass);
    localStorage.setItem("room", text);
    localStorage.setItem("password", textPass);
    navigate("/text");
  };
  const handlePasswordChange = (e) => {
    setPass(e.target.value);
  };

  return (
    <div className="h-screen flex justify-center items-center roboto-regular">
      <div>
        <p className="text-center text-[22px] lg:text-[44px]">
          Colaborative Editor
        </p>
        <div
          className="flex flex-col items-center justify-center gap-y-3
        lg:justify-between lg:gap-y-0 lg:flex-row"
        >
          <div
            className="flex justify-between items-center bg-[#1A73E8] text-white h-[40px] cursor-pointer select-none
          px-[10px] py-[5px] rounded-[10px] mr-[20px]"
            onClick={handleCreateRoom}
          >
            <img src="./img/edit.png" alt="" className="h-3/4 " />
            <p>New Text Area</p>
          </div>
          <form
            className="flex flex-col gap-y-3 lg:flex-row lg:gap-x-[10px] lg:gap-y-0"
            onSubmit={handleJoinRoom}
          >
            <div
              className="flex justify-between items-center border h-[40px] w-[180px] cursor-pointer select-none
          px-[10px] py-[5px] rounded-[10px]"
            >
              <img
                src="./img/keyboard.png"
                alt=""
                className="h-3/4 mr-[10px]"
              />

              <input
                type="text"
                value={text}
                onChange={handleRoomChange}
                className="flex-grow w-full focus:outline-none"
                placeholder="RoomID"
              />
            </div>
            <div className="flex w-full justify-center items-center lg:w-auto">
              <button
                className={`${
                  text.trim() === ""
                    ? "text-[#3C4043] text-opacity-50"
                    : "text-[#1A73E8] hover:bg-[#9ddfe4] hover:bg-opacity-10 transition-all"
                } flex justify-center items-center w-[50px] rounded-[6px]`}
                disabled={text.trim() === ""}
              >
                Join
              </button>
            </div>

            <div
              className="flex justify-between items-center border h-[40px] w-[180px] cursor-pointer select-none
          px-[10px] py-[5px] rounded-[10px]"
            >
              <img
                src="./img/keyboard.png"
                alt=""
                className="h-3/4 mr-[10px]"
              />

              <input
                type="text"
                value={textPass}
                onChange={handlePasswordChange}
                className="flex-grow w-full focus:outline-none"
                placeholder="Password"
              />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Landing;
