import {
  DiagramToCodePlugin,
  exportToBlob,
  getTextFromElements,
  MIME_TYPES,
  TTDDialog,
} from "@excalidraw/excalidraw";
import { getDataURL } from "@excalidraw/excalidraw/data/blob";
import { safelyParseJSON } from "@excalidraw/common";

import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";

import { useMagicSettings } from "../hooks/useMagicSettings";

const DIAGRAM_TO_CODE_SYSTEM_PROMPT = `You are a skilled front-end developer who builds interactive prototypes from wireframes, and is an expert at CSS Grid and Flex design.
Your role is to transform low-fidelity wireframes into working front-end HTML code.

YOU MUST FOLLOW FOLLOWING RULES:

- Use HTML, CSS, JavaScript to build a responsive, accessible, polished prototype
- Leverage Tailwind for styling and layout (import as script <script src="https://cdn.tailwindcss.com"></script>)
- Inline JavaScript when needed
- Fetch dependencies from CDNs when needed (using unpkg or skypack)
- Source images from Unsplash or create applicable placeholders
- Interpret annotations as intended vs literal UI
- Fill gaps using your expertise in UX and business logic
- generate primarily for desktop UI, but make it responsive.
- Use grid and flexbox wherever applicable.
- Convert the wireframe in its entirety, don't omit elements if possible.

If the wireframes, diagrams, or text is unclear or unreadable, refer to provided text for clarification.

Your goal is a production-ready prototype that brings the wireframes to life.

Please output JUST THE HTML file containing your best attempt at implementing the provided wireframes.`;

const TTD_SYSTEM_PROMPT = `Purpose and Objectives:
* Understand the structure and logical relationships of the document provided by the user.
* Accurately convert the document's content and relationships into diagram code that conforms to Mermaid syntax.
* Ensure that the diagram includes all key elements from the document and their connections.

Behavior and Rules:
1. Document Analysis:
a) Carefully read and analyze the content of the document provided by the user.
b) Identify different elements in the document (such as concepts, entities, steps, processes, etc.).
c) Understand the various relationships between these elements (such as hierarchy, inclusion, process, causality, etc.).
d) Recognize the logical structure and flow implied in the document.
2. Diagram Generation:
a) Based on the analysis, select the most appropriate Mermaid diagram type to represent the document structure (such as flowchart, sequence diagram, state diagram, Gantt chart, etc.).
b) Use correct Mermaid syntax to create the diagram code, fully referencing the following notes on Mermaid special characters:
* Mermaid's core special characters are mainly used to define diagram structure and relationships.
* To display these special characters or include spaces in node IDs or labels, the most common method is to wrap them in double quotes "".
* To display HTML special characters (<, >, &) or # in label text (inside quotes), use HTML entity encoding.
* To insert a line break in a label, use the <br> tag.
* Use %% for comments.
c) Ensure the diagram is clear, easy to understand, and accurately reflects the content and logic of the document.

3. Details Handling:
a) Avoid omitting any important details or relationships from the document.
b) If there is ambiguity or unclear content in the document, you may ask the user for clarification.
c) The generated diagram code should be directly copy-pasteable into tools or platforms that support Mermaid syntax.

Overall Tone:
* Maintain a professional and rigorous attitude.
* Express the diagram content clearly and accurately.
* When necessary, you may provide brief explanations or suggestions.`;

const buildOpenAIPayload = (input: string, modelName: string) => {
  return {
    model: modelName,
    messages: [
      {
        role: "system",
        content: TTD_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: input,
      },
    ],
  };
};

export const AIComponents = ({
  excalidrawAPI,
}: {
  excalidrawAPI: ExcalidrawImperativeAPI;
}) => {
  const magicSettings = useMagicSettings(excalidrawAPI);
  return (
    <>
      <DiagramToCodePlugin
        generate={async ({ frame, children }) => {
          const { openAIKey } = magicSettings;
          if (!openAIKey && !import.meta.env.VITE_APP_OPENAI_API_KEY) {
            excalidrawAPI.updateScene({
              appState: {
                openDialog: {
                  name: "settings",
                },
              },
            });
            return {
              html: `<html><body style="display: flex; align-items: center; justify-content: center; height: 100vh;">You need to configure your OpenAI API key in the settings.</body></html>`,
            };
          }

          const appState = excalidrawAPI.getAppState();

          const blob = await exportToBlob({
            elements: children,
            appState: {
              ...appState,
              exportBackground: true,
              viewBackgroundColor: appState.viewBackgroundColor,
            },
            exportingFrame: frame,
            files: excalidrawAPI.getFiles(),
            mimeType: MIME_TYPES.jpg,
          });

          const dataURL = await getDataURL(blob);

          const textFromFrameChildren = getTextFromElements(children);

          const apiKey =
            openAIKey || import.meta.env.VITE_APP_OPENAI_API_KEY || "";
          const apiURL =
            magicSettings.openAIBaseURL ||
            import.meta.env.VITE_APP_OPENAI_API_URL ||
            "https://api.openai.com/v1";

          const modelName =
            magicSettings.openAIModelName || "gpt-4-vision-preview";

          const body = {
            model: modelName,
            max_tokens: 4096,
            temperature: 0.1,
            messages: [
              {
                role: "system",
                content: DIAGRAM_TO_CODE_SYSTEM_PROMPT,
              },
              {
                role: "user",
                content: [
                  {
                    type: "image_url",
                    image_url: {
                      url: dataURL,
                      detail: "high",
                    },
                  },
                  {
                    type: "text",
                    text: `Above is the reference wireframe. Please make a new website based on these and return just the HTML file. Also, please make it for the ${appState.theme} theme. What follows are the wireframe's text annotations (if any)...`,
                  },
                  {
                    type: "text",
                    text: textFromFrameChildren,
                  },
                ],
              },
            ],
          };

          const url = `${apiURL}/chat/completions`;
          const isRelativePath = url.startsWith("/");
          const response = await fetch(url, {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              Authorization: `Bearer ${
                isRelativePath
                  ? localStorage.getItem("token") || apiKey
                  : apiKey
              }`,
            },
            body: JSON.stringify(body),
          });

          if (!response.ok) {
            const text = await response.text();
            const errorJSON = safelyParseJSON(text);

            if (!errorJSON) {
              throw new Error(text);
            }

            if (errorJSON.statusCode === 429) {
              return {
                html: `<html>
                <body style="margin: 0; text-align: center">
                <div style="display: flex; align-items: center; justify-content: center; flex-direction: column; height: 100vh; padding: 0 60px">
                  <div style="color:red">Too many requests today,</br>please try again tomorrow!</div>
                  </br>
                  </br>
                  <div>You can also try <a href="${
                    import.meta.env.VITE_APP_PLUS_LP
                  }/plus?utm_source=excalidraw&utm_medium=app&utm_content=d2c" target="_blank" rel="noopener">Excalidraw+</a> to get more requests.</div>
                </div>
                </body>
                </html>`,
              };
            }

            throw new Error(errorJSON.message || text);
          }

          try {
            const json = await response.json();
            const message = json.choices?.[0]?.message?.content;
            if (!message) {
              throw new Error("Generation failed (invalid response)");
            }
            const html = message.slice(
              message.indexOf("<!DOCTYPE html>"),
              message.indexOf("</html>") + "</html>".length,
            );

            return {
              html,
            };
          } catch (error: any) {
            throw new Error("Generation failed (invalid response)");
          }
        }}
      />

      <TTDDialog
        onTextSubmit={async (input) => {
          try {
            const apiKey =
              magicSettings.openAIKey ||
              import.meta.env.VITE_APP_OPENAI_API_KEY ||
              "";
            const apiUrl =
              magicSettings.openAIBaseURL ||
              import.meta.env.VITE_APP_OPENAI_API_URL ||
              "/api/ai/v1";
            const modelName =
              magicSettings.openAIModelName ||
              import.meta.env.VITE_APP_OPENAI_MODEL ||
              "gpt-4o-mini";
            const payload = buildOpenAIPayload(input, modelName);
            const url = `${apiUrl}/chat/completions`;
            const isRelativePath = url.startsWith("/");
            const response = await fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${
                  isRelativePath
                    ? localStorage.getItem("token") || apiKey
                    : apiKey
                }`,
              },
              body: JSON.stringify(payload),
            });

            const rateLimit = response.headers.has("x-ratelimit-limit-requests")
              ? parseInt(
                  response.headers.get("x-ratelimit-limit-requests") || "0",
                  10,
                )
              : undefined;

            const rateLimitRemaining = response.headers.has(
              "x-ratelimit-remaining-requests",
            )
              ? parseInt(
                  response.headers.get("x-ratelimit-remaining-requests") || "0",
                  10,
                )
              : undefined;

            if (!response.ok) {
              if (response.status === 429) {
                return {
                  rateLimit,
                  rateLimitRemaining,
                  error: new Error(
                    "Too many requests today, please try again tomorrow!",
                  ),
                };
              }
              const errorData = await response.json();
              throw new Error(
                errorData.error.message || "OpenAI API request failed",
              );
            }

            const data = await response.json();
            const mermaidCode = data.choices[0]?.message?.content;

            if (!mermaidCode) {
              throw new Error("Failed to generate Mermaid code from OpenAI.");
            }

            return {
              generatedResponse: mermaidCode,
              rateLimit,
              rateLimitRemaining,
            };
          } catch (err: any) {
            throw new Error("Request failed");
          }
        }}
      />
    </>
  );
};
