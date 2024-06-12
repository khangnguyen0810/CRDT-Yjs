function escapeHTML(input) {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function diffArrays(oldArray, newArray) {
  const oldMap = {};
  const newMap = {};

  for (let i = 0; i < newArray.length; i++) {
    if (!newMap[newArray[i]])
      newMap[newArray[i]] = { rows: [], oldIndex: null };
    newMap[newArray[i]].rows.push(i);
  }

  for (let i = 0; i < oldArray.length; i++) {
    if (!oldMap[oldArray[i]])
      oldMap[oldArray[i]] = { rows: [], newIndex: null };
    oldMap[oldArray[i]].rows.push(i);
  }

  for (let key in newMap) {
    if (
      newMap[key].rows.length === 1 &&
      oldMap[key] &&
      oldMap[key].rows.length === 1
    ) {
      newArray[newMap[key].rows[0]] = {
        text: newArray[newMap[key].rows[0]],
        row: oldMap[key].rows[0],
      };
      oldArray[oldMap[key].rows[0]] = {
        text: oldArray[oldMap[key].rows[0]],
        row: newMap[key].rows[0],
      };
    }
  }

  for (let i = 0; i < newArray.length - 1; i++) {
    if (
      newArray[i].text &&
      !newArray[i + 1].text &&
      newArray[i].row + 1 < oldArray.length &&
      !oldArray[newArray[i].row + 1].text &&
      newArray[i + 1] === oldArray[newArray[i].row + 1]
    ) {
      newArray[i + 1] = { text: newArray[i + 1], row: newArray[i].row + 1 };
      oldArray[newArray[i].row + 1] = {
        text: oldArray[newArray[i].row + 1],
        row: i + 1,
      };
    }
  }

  for (let i = newArray.length - 1; i > 0; i--) {
    if (
      newArray[i].text &&
      !newArray[i - 1].text &&
      newArray[i].row > 0 &&
      !oldArray[newArray[i].row - 1].text &&
      newArray[i - 1] === oldArray[newArray[i].row - 1]
    ) {
      newArray[i - 1] = { text: newArray[i - 1], row: newArray[i].row - 1 };
      oldArray[newArray[i].row - 1] = {
        text: oldArray[newArray[i - 1]],
        row: i - 1,
      };
    }
  }

  return { oldArray, newArray };
}

export function diffString(original, modified) {
  original = original.trim();
  modified = modified.trim();

  const result = diffArrays(
    original === "" ? [] : original.split(/\s+/),
    modified === "" ? [] : modified.split(/\s+/)
  );

  const oldSpaces = original.match(/\s+/g) || ["\n"];
  oldSpaces.push("\n");
  const newSpaces = modified.match(/\s+/g) || ["\n"];
  newSpaces.push("\n");

  let diffOutput = "";

  if (result.newArray.length === 0) {
    for (let i = 0; i < result.oldArray.length; i++) {
      diffOutput += `<del>${escapeHTML(result.oldArray[i])}${
        oldSpaces[i]
      }</del>`;
    }
  } else {
    let i = 0;
    if (!result.newArray[0].text) {
      for (
        let i = 0;
        i < result.oldArray.length && !result.oldArray[i].text;
        i++
      ) {
        diffOutput += `<del>${escapeHTML(result.oldArray[i])}${
          oldSpaces[i]
        }</del>`;
      }
    }

    for (i = 0; i < result.newArray.length; i++) {
      if (!result.newArray[i].text) {
        diffOutput += `<ins>${escapeHTML(result.newArray[i])}${
          newSpaces[i]
        }</ins>`;
      } else {
        let precedingDeletions = "";
        for (
          let j = result.newArray[i].row + 1;
          j < result.oldArray.length && !result.oldArray[j].text;
          j++
        ) {
          precedingDeletions += `<del>${escapeHTML(result.oldArray[j])}${
            oldSpaces[j]
          }</del>`;
        }
        diffOutput += ` ${result.newArray[i].text}${newSpaces[i]}${precedingDeletions}`;
      }
    }
  }

  return diffOutput;
}

// Example usage:
// console.log(diffString("abcd efghi", "abcd ghijkl"));
