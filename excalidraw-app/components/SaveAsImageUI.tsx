import React from "react";
import { Card } from "../../packages/excalidraw/components/Card";
import { ToolButton } from "../../packages/excalidraw/components/ToolButton";
import { useI18n } from "../../packages/excalidraw/i18n";
import { ExportImageIcon } from "../../packages/excalidraw/components/icons";

export const SaveAsImageUI: React.FC<{
  onSuccess: () => void;
}> = ({ onSuccess }) => {
  const { t } = useI18n();
  return (
    <Card color="primary">
      <div className="Card-icon">
        {React.cloneElement(ExportImageIcon as React.ReactElement, {
          style: {
            width: "2.8rem",
            height: "2.8rem",
          },
        })}
      </div>
      <h2>{t("buttons.exportImage")}</h2>
      <div className="Card-details">
        Save your canvas to a file in PNG, SVG or WebP format.
      </div>
      <ToolButton
        className="Card-button"
        type="button"
        title={t("buttons.exportImage")}
        aria-label={t("buttons.exportImage")}
        showAriaLabel={true}
        onClick={onSuccess}
      />
    </Card>
  );
};
