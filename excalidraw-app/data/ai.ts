import { NonDeletedExcalidrawElement } from "../../packages/excalidraw/element/types";
import { BinaryFiles } from "../../packages/excalidraw/types";

// NOTE: This type is an ad-hoc implementation of the one in
// `@excalidraw/mermaid-to-excalidraw`. We are defining it here to avoid
// dependency issues.
export interface MermaidToExcalidrawResult {
  code: string;
  title: string;
  theme: string;
  elements: readonly NonDeletedExcalidrawElement[];
  files: BinaryFiles;
  errors: any[];
  isFirstSuccessfulImport: boolean;
}

const systemPrompt = `目的和目标：
* 理解用户提供的文档的结构和逻辑关系。
* 准确地将文档内容和关系转化为符合mermaid语法的图表代码。
* 确保图表中包含文档的所有关键元素和它们之间的联系。

行为和规则：
1. 分析文档：
a) 仔细阅读和分析用户提供的文档内容。
b) 识别文档中的不同元素（如概念、实体、步骤、流程等）。
c) 理解这些元素之间的各种关系（如从属、包含、流程、因果等）。
d) 识别文档中蕴含的逻辑结构和流程。
2. 图表生成：
a) 根据分析结果，选择最适合表达文档结构的mermaid图表类型（如流程图、时序图、状态图、甘特图等）。
b) 使用正确的mermaid语法创建图表代码，充分参考下面的Mermaid 语法特殊字符说明："
* Mermaid 的核心特殊字符主要用于**定义图表结构和关系**。
* 要在节点 ID 或标签中**显示**这些特殊字符或包含**空格**，最常用方法是用**双引号 ""** 包裹。
* 在标签文本（引号内）中显示 HTML 特殊字符 (<, >, &) 或 # 等，应使用 **HTML 实体编码**。
* 要在标签内**换行**，使用 <br> 标签。
* 使用 %% 进行**注释**。
"
c) 确保图表清晰、易于理解，准确反映文档的内容和逻辑。

3. 细节处理：
a) 避免遗漏文档中的任何重要细节或关系。
b) 如果文档中存在不明确或多义性的内容，可以向用户提问以获取更清晰的信息。
c) 生成的图表代码应可以直接复制并粘贴到支持mermaid语法的工具或平台中使用。
整体语气：
* 保持专业和严谨的态度。
* 清晰、准确地表达图表的内容。
* 在需要时，可以提供简短的解释或建议。`;

const buildOpenAIPayload = (input: string, modelName: string) => {
  return {
    model: modelName,
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: input,
      },
    ],
  };
};

export const generateMermaidCode = async (
  input: string,
  apiKey: string,
  apiUrl: string,
  modelName: string,
): Promise<MermaidToExcalidrawResult> => {
  const payload = buildOpenAIPayload(input, modelName);
  const url = `${apiUrl}/chat/completions`;
  const isRelativePath = url.startsWith("/");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${
        isRelativePath ? localStorage.getItem("token") || apiKey : apiKey
      }`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error.message || "OpenAI API request failed");
  }

  const data = await response.json();
  const mermaidCode = data.choices[0]?.message?.content;

  if (!mermaidCode) {
    throw new Error("Failed to generate Mermaid code from OpenAI.");
  }

  // NOTE: a bit of a hack. The result of this function is what the TTD dialog
  // expects. We are returning the mermaid code as if it were the result of
  // a mermaid-to-excalidraw conversion, so the dialog can render it.
  return {
    code: mermaidCode,
    title: "AI Generated Diagram",
    theme: "light",
    elements: [],
    files: {},
    errors: [],
    isFirstSuccessfulImport: true,
  };
};
