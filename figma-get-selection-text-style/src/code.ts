figma.showUI(__html__, { width: 480, height: 480 });

function checkNodeIsText(node: SceneNode): node is TextNode {
  try {
    return node.type === "TEXT" && !!node.textStyleId;
  } catch {
    return false;
  }
}
function recursiveFindText(node: SceneNode): TextNode | null {
  if (checkNodeIsText(node)) return node;
  if ("children" in node) {
    for (const child of node.children) {
      const textNode = recursiveFindText(child);
      if (textNode) return textNode;
    }
  }
  return null;
}

function getTextNodeStyleId(
  selection: readonly SceneNode[],
  type: "textStyleId" | "fillStyleId" = "textStyleId"
) {
  const currentNode = selection.find((node) =>
    checkNodeIsText(node)
  ) as TextNode;
  if (currentNode) return String(currentNode[type]);
  const textNode = recursiveFindText(selection[0]);
  if (!textNode) return "";
  return String(textNode[type]);
}

async function getSelectionStyle() {
  const selection = figma.currentPage.selection;
  const textStyleId = getTextNodeStyleId(selection);
  const fillStyleId = getTextNodeStyleId(selection, "fillStyleId");
  const textStyle = textStyleId
    ? await figma.getStyleByIdAsync(textStyleId)
    : "";
  const fillStyle = fillStyleId
    ? await figma.getStyleByIdAsync(fillStyleId)
    : "";
  const textStyleCode = textStyle ? textStyle.name : "";
  const colorStyleCode = fillStyle ? fillStyle.name : "";

  return {
    textStyle,
    fillStyle,
    code: `...getTextStyles("${colorStyleCode}", "${textStyleCode}")`,
  };
}
async function main() {
  const data = await getSelectionStyle();
  figma.ui.postMessage({
    type: "styles",
    text: data.code,
  });
}
main();
figma.ui.onmessage = (msg) => {
  if (msg.type === "cancel") {
    figma.closePlugin();
  }
};
