function recursiveFindFillNode(node: SceneNode): InstanceNode {
  if (
    node.type !== "TEXT" &&
    ("backgroundStyleId" in node || "fillStyleId" in node)
  ) {
    return node as InstanceNode;
  }
  if ("children" in node) {
    for (const child of (node as unknown as InstanceNode).children) {
      const fillNode = recursiveFindFillNode(child);
      if (fillNode) return fillNode;
    }
  }
  return null;
}
function getStyleId(selection: readonly SceneNode[]) {
  const currentNode = selection.find(
    (node) => node.type !== "TEXT"
  ) as InstanceNode;
  if (
    currentNode &&
    (currentNode["backgroundStyleId"] || currentNode["fillStyleId"])
  ) {
    return String(
      currentNode["backgroundStyleId"] ?? currentNode["fillStyleId"]
    );
  }
  const findNode = recursiveFindFillNode(selection[0]);
  if (!findNode) return "";
  return String(findNode["backgroundStyleId"] ?? findNode["fillStyleId"]);
}

figma.showUI(__html__, { width: 480, height: 480 });
async function getSelectionStyle() {
  const selection = figma.currentPage.selection;
  const fillStyleId = getStyleId(selection);
  const fillStyle = fillStyleId
    ? await figma.getStyleByIdAsync(fillStyleId)
    : "";
  const colorStyleCode = fillStyle ? fillStyle.name : "";
  return {
    fillStyle,
    code: `...getBgColor("${colorStyleCode}")`,
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
