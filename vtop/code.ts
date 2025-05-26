/* eslint-disable @typescript-eslint/no-explicit-any */
// console.clear();

async function exportToJSON() {
  const collections = await figma.variables.getLocalVariableCollectionsAsync();
  const files = [];
  for (const collection of collections) {
    files.push(...(await processCollection(collection)));
  }
  const themeJson = files.reduce(
    (acc: Record<string, any>, file: { fileName: string; body: any }) => {
      acc[file.fileName] = file.body;
      return acc;
    },
    {} as Record<string, any>
  );
  console.log("themeJson", themeJson);

  const fixJson = {
    tokens: themeJson.tokens,
    semanticTokens: Object.assign({}, themeJson.semanticTokens, {
      typo: themeJson.typo,
    }),
  };
  figma.ui.postMessage({ type: "EXPORT_RESULT", themeJson: fixJson });
}

async function processCollection(collection: VariableCollection) {
  console.log("processing collection", collection);
  const { name, modes, variableIds } = collection;
  const files = [];
  for (const mode of modes) {
    const file = { fileName: name, body: {} };
    for (const variableId of variableIds) {
      const { name, resolvedType, valuesByMode } =
        (await figma.variables.getVariableByIdAsync(variableId)) as Variable;
      const value = valuesByMode[mode.modeId] as any;
      if (value !== undefined && ["COLOR", "FLOAT"].includes(resolvedType)) {
        let obj = file.body as Record<string, any>;
        name.split("/").forEach((groupName: string) => {
          obj[groupName] = obj[groupName] || {};
          obj = obj[groupName];
        });
        if (value.type === "VARIABLE_ALIAS") {
          const currentVar = await figma.variables.getVariableByIdAsync(
            value.id
          );
          obj.value = `{${currentVar!.name.replace(/\//g, ".")}}`;
        } else {
          obj.value = resolvedType === "COLOR" ? rgbToHex(value) : value;

          if (name.startsWith("lineHeights")) {
            obj.value += "px";
          }
        }
      }
    }
    files.push(file);
  }
  console.log("files", files);
  return files;
}

figma.ui.onmessage = async (e) => {
  console.log("code received message", e);
  if (e.type === "EXPORT") {
    await exportToJSON();
  }
};
figma.showUI(__uiFiles__["export"], {
  width: 500,
  height: 500,
  themeColors: true,
});

function rgbToHex({
  r,
  g,
  b,
  a,
}: {
  r: number;
  g: number;
  b: number;
  a: number;
}) {
  if (a !== 1) {
    return `rgba(${[r, g, b]
      .map((n) => Math.round(n * 255))
      .join(", ")}, ${a.toFixed(4)})`;
  }
  const toHex = (value: number) => {
    const hex = Math.round(value * 255).toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  };

  const hex = [toHex(r), toHex(g), toHex(b)].join("");
  return `#${hex}`;
}
