import { Notice, FuzzySuggestModal, App } from 'obsidian';

interface Book {
  text: string;
  value: string;
}

export default class FuzzySuggest extends FuzzySuggestModal<Book> {
  books: Book[];
  onChoose: (book: Book, evt: MouseEvent | KeyboardEvent) => void;
  constructor(app: App, books: Book[], onChoose: (book: Book, evt: MouseEvent | KeyboardEvent) => void) {
    super(app);
    this.books = books;
    this.onChoose = onChoose;
  }
  getItems(): Book[] {
    return this.books;
  }

  getItemText(book: Book): string {
    return book.value;
  }

  onChooseItem(book: Book, evt: MouseEvent | KeyboardEvent) {
    this.onChoose(book, evt);
  }
}
