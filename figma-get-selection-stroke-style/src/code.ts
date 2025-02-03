function recursiveFindStrokeNode(node: SceneNode): InstanceNode | null {
  if (node.type !== "TEXT" && "strokeStyleId" in node) {
    return node as InstanceNode;
  }
  if ("children" in node) {
    for (const child of node.children) {
      const strokeNode = recursiveFindStrokeNode(child);
      if (strokeNode) return strokeNode;
    }
  }
  return null;
}

function getStyleId(selection: readonly SceneNode[]) {
  const currentNode = selection.find(
    (node) => node.type !== "TEXT"
  ) as InstanceNode;
  if (currentNode && currentNode["strokeStyleId"]) {
    return {
      id: String(currentNode["strokeStyleId"]),
      cornerRadius: Number(currentNode.cornerRadius ?? 0),
      strokeWeight: Number(currentNode.strokeWeight ?? 0),
    };
  }
  const findNode = recursiveFindStrokeNode(selection[0]);
  if (!findNode) return { id: "", cornerRadius: 0, strokeWeight: 0 };
  const frameNode = findNode as unknown as FrameNode;
  const strokeWeight = frameNode.strokeWeight;
  return {
    id: String(findNode["strokeStyleId"]),
    cornerRadius: Number(findNode.cornerRadius ?? 0),
    strokeWeight: Number(strokeWeight ?? 0),
  };
}

figma.showUI(__html__, { width: 480, height: 480 });
async function getSelectionStyle() {
  const selection = figma.currentPage.selection;
  const fillStyleItem = getStyleId(selection);
  const fillStyle = fillStyleItem.id
    ? await figma.getStyleByIdAsync(fillStyleItem.id)
    : "";
  const colorStyleCode = fillStyle ? fillStyle.name : "";
  return {
    fillStyle,
    radius: fillStyleItem.cornerRadius,
    code: `getBorder(${fillStyleItem.strokeWeight}, "${colorStyleCode}", ${fillStyleItem.cornerRadius})`,
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
