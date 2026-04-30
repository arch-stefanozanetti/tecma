import React from "react";

interface Column<T> {
  key: string;
  title: string;
  render: (row: T) => React.ReactNode;
}

interface DataTableProps<T> {
  title: string;
  searchText: string;
  onSearchTextChange: (value: string) => void;
  columns: Column<T>[];
  rows: T[];
  total: number;
  isLoading: boolean;
  error: string | null;
}

export const DataTable = <T,>({ title, searchText, onSearchTextChange, columns, rows, total, isLoading, error }: DataTableProps<T>) => {
  return (
    <div className="generic-table">
      <div className="generic-table-toolbar">
        <h2 className="generic-table-title">{title}</h2>
        <input
          className="generic-table-search-box"
          value={searchText}
          onChange={(e) => onSearchTextChange(e.target.value)}
          placeholder="Cerca..."
        />
      </div>

      {isLoading && <p className="generic-table-feedback">Caricamento...</p>}
      {error && <p className="generic-table-feedback error">{error}</p>}

      <table>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {!isLoading && rows.length === 0 && (
            <tr>
              <td colSpan={columns.length}>Nessun risultato</td>
            </tr>
          )}
          {rows.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td key={column.key}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>

      <div className="table-footer">Totale: {total}</div>
    </div>
  );
};
