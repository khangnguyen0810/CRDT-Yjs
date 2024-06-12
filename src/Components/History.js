import React from "react";

function History(props) {
  const { text, time, handleClick, editor, oldText } = props;

  const getDay = (date) => {
    const formattedDate = new Date(date).toLocaleDateString("en-US", {
      month: "long",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    return formattedDate;
  };

  return (
    <div className="flex flex-col px-[10px]">
      <div className="flex items-center justify-center text-white">
        {getDay(time)}
      </div>
      <div className="flex items-center justify-center text-white">
        Editor: {editor}
      </div>
      <textarea
        value={text}
        readOnly
        className="w-full h-[150px] text-[12px] cursor-pointer resize-none rounded-md"
        onClick={() => {
          handleClick(text, oldText);
        }}
      />
    </div>
  );
}

export default History;
