/* eslint-disable @typescript-eslint/no-explicit-any */
// console.clear();

async function getVariable(key: string, alias: VariableAlias | undefined) {
  if (!alias) {
    return null;
  }
  return {
    name: key,
    value: await figma.variables.getVariableByIdAsync(alias.id),
  };
}

async function getEffectStyles() {
  const effectStyles = await figma.getLocalEffectStylesAsync();
  console.log(effectStyles);

  const shadowStyles: Record<string, { value: string }> = {};

  for (const effectStyle of effectStyles) {
    const shadows: string[] = [];

    for (const effect of effectStyle.effects) {
      if (effect.type === "DROP_SHADOW" || effect.type === "INNER_SHADOW") {
        const {
          offset,
          radius,
          spread = 0,
          color,
        } = effect as DropShadowEffect | InnerShadowEffect;

        // CSS box-shadow 형식으로 변환
        const inset = effect.type === "INNER_SHADOW" ? "inset " : "";
        const x = `${offset.x}px`;
        const y = `${offset.y}px`;
        const blur = `${radius}px`;
        const spreadValue = `${spread}px`;
        const cssColor = rgbToHex({
          r: color.r,
          g: color.g,
          b: color.b,
          a: color.a,
        });

        shadows.push(`${inset}${x} ${y} ${blur} ${spreadValue} ${cssColor}`);
      }
    }

    if (shadows.length > 0) {
      shadowStyles[effectStyle.name] = {
        value: shadows.join(", "),
      };
    }
  }

  return shadowStyles;
}

async function getLocalTextStyles() {
  const textStyles: TextStyle[] = await figma.getLocalTextStylesAsync();
  const styles: Record<
    string,
    {
      value: {
        [key: string]: string;
      };
    }
  > = {};
  for (const textStyle of textStyles) {
    const boundVariables = textStyle.boundVariables;
    if (boundVariables) {
      const values = await Promise.all(
        Object.keys(boundVariables)
          .map((key) => {
            if (key === "fontFamily") return null;
            const variable = boundVariables[key as keyof typeof boundVariables];
            return getVariable(key, variable);
          })
          .filter(Boolean)
      );
      const textStyleValues = values
        .map((v) => {
          if (v && v.value) {
            return {
              name: v.name,
              value: v.value && v.value.name,
            };
          }
          return null;
        })
        .filter(Boolean)
        .reduce((acc, v) => {
          if (v) {
            acc[v.name] = `{typo.${v.value.replace(/\//g, ".")}}`;
          }
          return acc;
        }, {} as Record<string, string>);
      styles[textStyle.name] = {
        value: textStyleValues,
      };
    }
  }
  return styles;
}
async function exportToJSON() {
  const textStyles = await getLocalTextStyles();
  const shadowStyles = await getEffectStyles();
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

  const fixJson = {
    tokens: Object.assign({}, themeJson.tokens, {
      shadow: shadowStyles,
    }),
    semanticTokens: Object.assign({}, themeJson.semanticTokens, {
      typo: themeJson.typo,
      shadow: Object.keys(shadowStyles).reduce((acc, shadowName) => {
        acc[shadowName] = {
          value: `{shadow.${shadowName}}`,
        };
        return acc;
      }, {} as Record<string, { value: string }>),
    }),
    textStyles,
  };
  figma.ui.postMessage({
    type: "EXPORT_RESULT",
    themeJson: fixJson,
    textStyles,
    shadowStyles,
  });
}

async function processCollection(collection: VariableCollection) {
  const { name, modes, variableIds } = collection;
  const files = [];
  for (const mode of modes) {
    const file = { fileName: name, body: {} };
    for (const variableId of variableIds) {
      const { name, resolvedType, valuesByMode } =
        (await figma.variables.getVariableByIdAsync(variableId)) as Variable;
      const value = valuesByMode[mode.modeId] as any;
      if (
        value !== undefined &&
        ["COLOR", "FLOAT", "STRING"].includes(resolvedType)
      ) {
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
          const pxIncludes = ["lineHeights", "fontSizes", "letterSpacings"];
          if (pxIncludes.some((pxInclude) => name.startsWith(pxInclude))) {
            obj.value += "px";
          }
        }
      }
    }
    files.push(file);
  }
  return files;
}

figma.ui.onmessage = async (e) => {
  console.log("code received message", e);
  if (e.type === "EXPORT") {
    await exportToJSON();
  }
  if (e.type === "TEXT_STYLES") {
    await exportToJSON();
  }
};
if (figma.command === "text-styles") {
  figma.showUI(__uiFiles__["text-styles"], {
    width: 500,
    height: 500,
    themeColors: true,
  });
} else if (figma.command === "export") {
  figma.showUI(__uiFiles__["export"], {
    width: 500,
    height: 500,
    themeColors: true,
  });
}

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
