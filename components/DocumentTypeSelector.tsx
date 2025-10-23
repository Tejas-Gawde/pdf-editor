"use client";

import * as React from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";

type Props = {
  useExistingType: boolean;
  setUseExistingType: (v: boolean) => void;
  documentTypes: string[];
  loadingTypes: boolean;
  documentType: string;
  setDocumentType: (v: string) => void;
};

export function DocumentTypeSelector({
  useExistingType,
  setUseExistingType,
  documentTypes,
  loadingTypes,
  documentType,
  setDocumentType,
}: Props) {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">Document type</label>
      <div className="flex items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <Checkbox
            checked={useExistingType}
            onCheckedChange={() => {
              setUseExistingType(true);
              if (documentTypes.length > 0) {
                setDocumentType(documentTypes[0]);
              }
            }}
            aria-label="Use existing type"
          />
          Use existing
        </label>
        <label className="flex items-center gap-2">
          <Checkbox
            checked={!useExistingType}
            onCheckedChange={() => {
              setUseExistingType(false);
              setDocumentType("");
            }}
            aria-label="Add new type"
          />
          Add new
        </label>
      </div>
      {useExistingType ? (
        <div className="flex flex-col gap-2">
          <Select
            value={documentType}
            onValueChange={(v) => setDocumentType(v)}
            disabled={loadingTypes || documentTypes.length === 0}
          >
            <SelectTrigger className="w-full">
              <SelectValue
                placeholder={
                  loadingTypes
                    ? "Loading..."
                    : documentTypes.length === 0
                    ? "No types found"
                    : "Select a type"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {documentTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <Input
          placeholder="e.g., Offer Letter, NDA, Contract"
          value={documentType}
          onChange={(e) => setDocumentType(e.target.value)}
          aria-invalid={false}
        />
      )}
    </div>
  );
}
