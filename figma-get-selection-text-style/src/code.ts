figma.showUI(__html__, { width: 480, height: 480 });

function getTextNodeStyleId(
  selection: readonly SceneNode[],
  type: "textStyleId" | "fillStyleId" = "textStyleId"
) {
  const currentNode = selection.find(
    (node) => node.type === "TEXT"
  ) as TextNode;
  if (currentNode) return String(currentNode[type]);
  const children = (selection[0] as FrameNode).children;
  if (!children || children.length === 0) return "";
  const textNode = children.find(
    (node) => node.type === "TEXT" && node.textStyleId
  ) as TextNode;
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
