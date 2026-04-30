import { describe, it, expect, vi, render, screen, userEvent } from "../../test-utils";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  ModalHeader,
} from "./dialog";

describe("Dialog", () => {
  it("apre al click sul trigger e mostra contenuto", async () => {
    const user = userEvent.setup();
    render(
      <Dialog>
        <DialogTrigger asChild>
          <button type="button">Apri</button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Titolo modal</DialogTitle>
            <DialogDescription>Desc</DialogDescription>
          </DialogHeader>
          <p>Contenuto</p>
        </DialogContent>
      </Dialog>
    );
    await user.click(screen.getByRole("button", { name: /apri/i }));
    expect(screen.getByRole("dialog")).toHaveTextContent("Titolo modal");
    expect(screen.getByRole("dialog")).toHaveTextContent("Desc");
    expect(screen.getByRole("dialog")).toHaveTextContent("Contenuto");
  });

  it("con defaultOpen mostra subito", () => {
    render(
      <Dialog defaultOpen>
        <DialogContent>
          <DialogTitle>Titolo</DialogTitle>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("Titolo");
  });

  it("DialogContent size large rende il modal", () => {
    render(
      <Dialog defaultOpen>
        <DialogContent size="large">Contenuto large</DialogContent>
      </Dialog>
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("Contenuto large");
  });

  it("hideDefaultClose nasconde il pulsante close", () => {
    render(
      <Dialog defaultOpen>
        <DialogContent hideDefaultClose>
          <DialogTitle>T</DialogTitle>
        </DialogContent>
      </Dialog>
    );
    expect(screen.queryByRole("button", { name: /close/i })).not.toBeInTheDocument();
  });
});

describe("ModalHeader", () => {
  it("rende title e subtitle", () => {
    render(
      <Dialog defaultOpen>
        <DialogContent hideDefaultClose>
          <ModalHeader title="Titolo" subtitle="Sottotitolo" />
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByText("Titolo")).toBeInTheDocument();
    expect(screen.getByText("Sottotitolo")).toBeInTheDocument();
  });

  it("chiama onClose al click su close", async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(
      <Dialog defaultOpen>
        <DialogContent hideDefaultClose>
          <ModalHeader title="T" onClose={onClose} />
        </DialogContent>
      </Dialog>
    );
    await user.click(screen.getByRole("button", { name: /chiudi/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it("rende senza errore con variant colour", () => {
    render(
      <Dialog defaultOpen>
        <DialogContent hideDefaultClose>
          <ModalHeader title="Titolo" variant="colour" />
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByText("Titolo")).toBeInTheDocument();
  });

  it("applica size small, large e mobile", () => {
    const { unmount } = render(
      <Dialog defaultOpen>
        <DialogContent hideDefaultClose>
          <ModalHeader title="S" size="small" />
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByText("S")).toBeInTheDocument();
    unmount();
    render(
      <Dialog defaultOpen>
        <DialogContent hideDefaultClose>
          <ModalHeader title="L" size="large" />
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByText("L")).toBeInTheDocument();
    unmount();
    render(
      <Dialog defaultOpen>
        <DialogContent hideDefaultClose>
          <ModalHeader title="M" size="mobile" />
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByText("M")).toBeInTheDocument();
  });
});
