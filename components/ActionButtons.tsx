"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

type Props = {
  useExistingType: boolean;
  disabledExisting: boolean;
  disabledNew: boolean;
  onDownloadExisting: () => void | Promise<void>;
  onSaveAndDownloadNew: () => void | Promise<void>;
  signing: boolean;
  autoSigning: boolean;
};

export function ActionButtons({
  useExistingType,
  disabledExisting,
  disabledNew,
  onDownloadExisting,
  onSaveAndDownloadNew,
  signing,
  autoSigning,
}: Props) {
  return (
    <div className="mt-4 flex gap-2">
      {useExistingType ? (
        <Button onClick={onDownloadExisting} disabled={disabledExisting}>
          {autoSigning ? "Downloading..." : "Download Document"}
        </Button>
      ) : (
        <Button onClick={onSaveAndDownloadNew} disabled={disabledNew}>
          {signing ? "Saving..." : "Save and Download Document"}
        </Button>
      )}
    </div>
  );
}
