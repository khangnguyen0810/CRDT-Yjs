import { useEffect, useRef, forwardRef } from "react";
import Delta from "quill-delta";

function bindingTextarea(textarea, opts) {
  const recoverSetter = hackValueSetter();

  const { onTextChange, onSelectionChange } = opts;

  let isComposing = false;
  let range = [-1, -1];
  let value = textarea.value;

  handleSelectionChange();

  textarea.addEventListener("input", handleInput);
  document.addEventListener("compositionstart", handleCompositionStart);
  document.addEventListener("compositionend", handleCompositionEnd);
  document.addEventListener("selectionchange", handleSelectionChange);

  return () => {
    recoverSetter();

    textarea.removeEventListener("input", handleInput);
    document.removeEventListener("compositionstart", handleCompositionStart);
    document.removeEventListener("compositionend", handleCompositionEnd);
    document.removeEventListener("selectionchange", handleSelectionChange);
  };

  function handleSelectionChange() {
    if (!textarea || isComposing) {
      return;
    }
    const { selectionStart, selectionEnd } = textarea;
    if (range[0] !== selectionStart || range[1] !== selectionEnd) {
      onSelectionChange?.(selectionStart, selectionEnd);
      range = [textarea.selectionStart, textarea.selectionEnd];
    }
  }

  function handleInput(e) {
    if (e.isComposing) {
      return;
    }
    const oldRange = range;
    const oldValue = value;
    const newValue = textarea.value;
    const newRange = [textarea.selectionStart, textarea.selectionEnd];

    if (e.inputType.startsWith("history")) {
      onTextChange?.(e.inputType.endsWith("Undo") ? "undo" : "redo");
    } else {
      const delta = new Delta();
      if (e.inputType.startsWith("insert")) {
        delta.retain(oldRange[0]);
        if (oldRange[0] !== oldRange[1]) {
          delta.delete(oldRange[1] - oldRange[0]);
        }
        delta.insert(newValue.substring(oldRange[0], newRange[0]));
      } else if (e.inputType.startsWith("delete")) {
        delta.retain(newRange[0]).delete(oldValue.length - newValue.length);
      } else {
        throw new Error("Unknown inputType: " + e.inputType);
      }
      onTextChange?.(delta.ops);
      handleSelectionChange();
    }
  }

  function handleCompositionStart() {
    isComposing = true;
  }

  function handleCompositionEnd() {
    isComposing = false;
    handleInput({
      inputType: "insertText",
      isComposing: false
    });
  }

  function hackValueSetter() {
    const { set, ...rest } = Reflect.getOwnPropertyDescriptor(textarea, "value");
    Reflect.defineProperty(textarea, "value", {
      ...rest,
      set(newValue) {
        value = newValue;
        set.call(textarea, newValue);
      }
    });

    return () => {
      Reflect.defineProperty(textarea, "value", {
        ...rest,
        set
      });
    };
  }
}

export const Textarea = forwardRef((props, ref) => {
  const { onTextChange, onSelectionChange, ...rest } = props;
  const innerRef = useRef();

  useEffect(() => {
    const textarea = innerRef.current;
    if (!textarea) return;

    const cleanup = bindingTextarea(textarea, {
      onTextChange,
      onSelectionChange
    });

    return cleanup;
  }, [onTextChange, onSelectionChange]);

  return (
    <textarea
      ref={textarea$ => {
        if (!textarea$) return;

        if (typeof ref === "function") {
          ref(textarea$);
        } else if (ref) {
          ref.current = textarea$;
        }
        innerRef.current = textarea$;
      }}
      {...rest}
    />
  );
});
