import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileSpreadsheet, FileDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { parseImportFile, validateRequiredColumns, type ImportRow } from "@/lib/import-file";
import { downloadTemplate, type TemplateDefinition } from "@/lib/import-templates";

interface ImportFileButtonProps {
  template: TemplateDefinition;
  requiredColumns: string[];
  onParsed: (rows: ImportRow[]) => void;
  disabled?: boolean;
  testIdPrefix?: string;
}

const PREVIEW_LIMIT = 10;

export function ImportFileButton({
  template,
  requiredColumns,
  onParsed,
  disabled,
  testIdPrefix = "import-file",
}: ImportFileButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [previewRows, setPreviewRows] = useState<ImportRow[] | null>(null);
  const [previewFileName, setPreviewFileName] = useState("");
  const { toast } = useToast();

  const headers = previewRows && previewRows.length > 0 ? Object.keys(previewRows[0]) : [];

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsParsing(true);
    try {
      const rows = await parseImportFile(file);
      if (rows.length === 0) {
        toast({
          title: "Empty file",
          description: "The selected file does not contain any rows.",
          variant: "destructive",
        });
        return;
      }
      const validation = validateRequiredColumns(rows, requiredColumns);
      if (!validation.ok) {
        toast({
          title: "Missing required columns",
          description: `The file is missing: ${validation.missing.join(", ")}`,
          variant: "destructive",
        });
        return;
      }
      setPreviewFileName(file.name);
      setPreviewRows(rows);
    } catch (error: any) {
      toast({
        title: "Failed to read file",
        description: error?.message || "The file could not be parsed.",
        variant: "destructive",
      });
    } finally {
      setIsParsing(false);
    }
  };

  const handleConfirm = () => {
    if (!previewRows) return;
    onParsed(previewRows);
    setPreviewRows(null);
    setPreviewFileName("");
  };

  const handleCancel = () => {
    setPreviewRows(null);
    setPreviewFileName("");
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={handleFile}
          data-testid={`${testIdPrefix}-input`}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || isParsing}
          data-testid={`${testIdPrefix}-button`}
        >
          <FileSpreadsheet className="h-4 w-4 mr-1" />
          <span className="hidden sm:inline">{isParsing ? "Reading..." : "Upload Excel/CSV"}</span>
          <span className="sm:hidden">{isParsing ? "..." : "Upload"}</span>
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => downloadTemplate(template)}
          data-testid={`${testIdPrefix}-template`}
        >
          <FileDown className="h-4 w-4 mr-1" />
          Template
        </Button>
      </div>

      <Dialog open={previewRows !== null} onOpenChange={(open) => !open && handleCancel()}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Preview Import</DialogTitle>
            <DialogDescription>
              {previewFileName && <span className="font-medium">{previewFileName}</span>}
              {previewRows && (
                <>
                  {previewFileName ? " — " : ""}
                  {previewRows.length} row{previewRows.length !== 1 ? "s" : ""} will be imported.
                  {previewRows.length > PREVIEW_LIMIT && ` Showing first ${PREVIEW_LIMIT}.`}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {previewRows && previewRows.length > 0 && (
            <ScrollArea className="max-h-[60vh] border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    {headers.map((h) => (
                      <TableHead key={h}>{h}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewRows.slice(0, PREVIEW_LIMIT).map((row, i) => (
                    <TableRow key={i} data-testid={`${testIdPrefix}-preview-row-${i}`}>
                      {headers.map((h) => (
                        <TableCell key={h} className="text-sm">
                          {row[h] || "—"}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              data-testid={`${testIdPrefix}-cancel`}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={disabled}
              data-testid={`${testIdPrefix}-confirm`}
            >
              Confirm Import ({previewRows?.length ?? 0})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
