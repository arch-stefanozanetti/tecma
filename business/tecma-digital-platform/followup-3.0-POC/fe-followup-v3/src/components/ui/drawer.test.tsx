import { describe, it, expect, render, screen, userEvent } from "../../test-utils";
import {
  Drawer,
  DrawerTrigger,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerSubtitle,
  DrawerBody,
  DrawerFooter,
  DrawerClose,
  DrawerCloseButton,
  DrawerDelete,
  DrawerBackButton,
} from "./drawer";

describe("Drawer", () => {
  it("rende trigger e apre il pannello al click", async () => {
    const user = userEvent.setup();
    render(
      <Drawer>
        <DrawerTrigger asChild>
          <button type="button">Apri</button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Titolo</DrawerTitle>
          </DrawerHeader>
          <DrawerBody>Contenuto</DrawerBody>
          <DrawerFooter>Footer</DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
    expect(screen.getByRole("button", { name: /apri/i })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /apri/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent("Titolo");
    expect(screen.getByRole("dialog")).toHaveTextContent("Contenuto");
    expect(screen.getByRole("dialog")).toHaveTextContent("Footer");
  });

  it("con defaultOpen mostra subito il dialog", () => {
    render(
      <Drawer defaultOpen>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>Già aperto</DrawerTitle>
          </DrawerHeader>
          <DrawerBody>Body</DrawerBody>
          <DrawerFooter>Footer</DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toHaveTextContent("Già aperto");
    expect(screen.getByRole("dialog")).toHaveTextContent("Body");
  });

  it("DrawerHeader mostra titolo, sottotitolo e actions", () => {
    render(
      <Drawer defaultOpen>
        <DrawerContent>
          <DrawerHeader
            actions={
              <button type="button" aria-label="Chiudi">
                X
              </button>
            }
          >
            <DrawerTitle>Titolo drawer</DrawerTitle>
            <DrawerSubtitle>Sottotitolo opzionale</DrawerSubtitle>
          </DrawerHeader>
          <DrawerBody />
          <DrawerFooter />
        </DrawerContent>
      </Drawer>
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("Titolo drawer");
    expect(screen.getByRole("dialog")).toHaveTextContent("Sottotitolo opzionale");
    expect(screen.getByRole("button", { name: /chiudi/i })).toBeInTheDocument();
  });

  it("DrawerDelete mostra testo e icona", () => {
    const onDelete = vi.fn();
    render(
      <Drawer defaultOpen>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>T</DrawerTitle>
          </DrawerHeader>
          <DrawerBody />
          <DrawerFooter>
            <DrawerDelete onClick={onDelete}>Elimina</DrawerDelete>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
    const deleteBtn = screen.getByRole("button", { name: /elimina/i });
    expect(deleteBtn).toBeInTheDocument();
    expect(deleteBtn).toHaveTextContent("Elimina");
  });

  it("DrawerClose chiude il drawer quando usato come wrapper", async () => {
    const user = userEvent.setup();
    render(
      <Drawer defaultOpen>
        <DrawerContent>
          <DrawerHeader>
            <DrawerTitle>T</DrawerTitle>
          </DrawerHeader>
          <DrawerBody />
          <DrawerFooter>
            <DrawerClose asChild>
              <button type="button">Annulla</button>
            </DrawerClose>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /annulla/i }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("DrawerContent side=left applica pannello sinistro", () => {
    render(
      <Drawer defaultOpen>
        <DrawerContent side="left">
          <DrawerHeader>
            <DrawerTitle>Left</DrawerTitle>
          </DrawerHeader>
          <DrawerBody />
          <DrawerFooter />
        </DrawerContent>
      </Drawer>
    );
    expect(screen.getByRole("dialog")).toHaveTextContent("Left");
  });

  it("DrawerCloseButton e DrawerBackButton sono presenti quando usati", () => {
    render(
      <Drawer defaultOpen>
        <DrawerContent>
          <DrawerHeader
            actions={<DrawerCloseButton />}
          >
            <DrawerTitle>T</DrawerTitle>
          </DrawerHeader>
          <DrawerBody>
            <DrawerBackButton onClick={() => {}}>Indietro</DrawerBackButton>
          </DrawerBody>
          <DrawerFooter />
        </DrawerContent>
      </Drawer>
    );
    expect(screen.getByRole("button", { name: /chiudi/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /indietro/i })).toBeInTheDocument();
  });
});
