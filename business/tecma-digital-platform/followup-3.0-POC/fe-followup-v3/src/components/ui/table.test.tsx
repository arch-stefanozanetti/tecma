import { describe, it, expect, render, screen } from "../../test-utils";
import {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
} from "./table";

describe("Table", () => {
  it("rende tabella con header, body, footer", () => {
    render(
      <Table>
        <TableCaption>Didascalia</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Col1</TableHead>
            <TableHead>Col2</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>A1</TableCell>
            <TableCell>B1</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Totale</TableCell>
          </TableRow>
        </TableFooter>
      </Table>
    );
    expect(screen.getByText("Didascalia")).toBeInTheDocument();
    expect(screen.getByText("Col1")).toBeInTheDocument();
    expect(screen.getByText("A1")).toBeInTheDocument();
    expect(screen.getByText("Totale")).toBeInTheDocument();
    expect(screen.getByTestId("table")).toBeInTheDocument();
  });
});
