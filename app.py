import re
import tkinter as tk
from tkinter import messagebox
from tkinter import ttk
from pathlib import Path
from typing import Any, Dict, List, Tuple, Set, Optional
import threading
import time
import functools
from queue import Queue

# Token counting function: Uses tiktoken if available; otherwise falls back to a regex-based method.
try:
    import tiktoken
    
    # Cache for token counts to avoid recounting the same text
    token_cache = {}
    
    def count_tokens(text: str) -> int:
        """
        Returns the token count of the given text using the "cl100k_base" encoding,
        which is appropriate for LLM contexts. Uses caching for performance.
        """
        # Use hash of text as key to avoid storing large strings in memory
        text_hash = hash(text)
        if text_hash in token_cache:
            return token_cache[text_hash]
            
        encoding = tiktoken.get_encoding("cl100k_base")
        tokens = encoding.encode(text)
        count = len(tokens)
        token_cache[text_hash] = count
        return count
except ImportError:
    # Simple LRU cache for token counts
    token_cache = {}
    MAX_CACHE_SIZE = 100
    
    def count_tokens(text: str) -> int:
        """
        Fallback method for token counting using regex when tiktoken is not available.
        Uses caching for performance.
        """
        # Use hash of text as key to avoid storing large strings in memory
        text_hash = hash(text)
        if text_hash in token_cache:
            return token_cache[text_hash]
            
        tokens = re.findall(r"\w+|[^\w\s]", text, re.UNICODE)
        count = len(tokens)
        
        # Manage cache size
        if len(token_cache) >= MAX_CACHE_SIZE:
            # Remove a random item (simple approach)
            token_cache.pop(next(iter(token_cache)))
        
        token_cache[text_hash] = count
        return count


def threaded(fn):
    """Decorator to run a function in a separate thread"""
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        thread = threading.Thread(target=fn, args=args, kwargs=kwargs)
        thread.daemon = True
        thread.start()
        return thread
    return wrapper


class FileExplorer:
    def __init__(self, master: tk.Tk) -> None:
        """Initialize the File & Folder Viewer with LLM context token counter."""
        self.master: tk.Tk = master
        self.master.title("File & Folder Viewer - LLM Context Token Counter")
        self.master.geometry("1000x700")
        
        # Base directory: using pathlib to get the directory where this file is located.
        self.base_path: Path = Path(__file__).resolve().parent
        self.current_path: Path = self.base_path
        
        # Threading and task management
        self.task_queue = Queue()
        self.is_processing = False
        self.cancel_processing = False
        
        # Cache for directory listings and file contents
        self.dir_cache: Dict[Path, List[Path]] = {}
        self.file_content_cache: Dict[Path, str] = {}
        self.max_cache_size = 50  # Maximum number of files to cache
        
        # Language translations
        self.translations: Dict[str, Dict[str, str]] = {
            "EN": {
                "title": "File & Folder Viewer - LLM Context Token Counter",
                "directory_content": "Directory Content",
                "up_directory": "Up Directory",
                "current_dir": "Current Directory: ",
                "select_all": "Select All",
                "clear_selection": "Clear Selection",
                "source_code": "Source Code (Markdown)",
                "save": "Save (llm.txt)",
                "total_tokens": "Total Token Count: ",
                "folder": "Folder",
                "file_read_error": "File could not be read: ",
                "folder_read_error": "Error: Folder could not be read: ",
                "root_dir_info": "Already in root directory.",
                "root_dir_error": "Cannot go outside root directory.",
                "save_success": "'llm.txt' file saved:\n",
                "save_error": "File could not be saved: ",
                "list_error": "Directory content could not be listed: ",
                "processing": "Processing...",
                "cancel": "Cancel"
            },
            "TR": {
                "title": "Dosya & Klasör Görüntüleyici - LLM Context Token Sayacı",
                "directory_content": "Dizin İçeriği",
                "up_directory": "Üst Dizin",
                "current_dir": "Mevcut Dizin: ",
                "select_all": "Tümünü Seç",
                "clear_selection": "Seçimi Temizle",
                "source_code": "Kaynak Kod (Markdown)",
                "save": "Kaydet (llm.txt)",
                "total_tokens": "Toplam Token Sayısı: ",
                "folder": "Klasör",
                "file_read_error": "Dosya okunamadı: ",
                "folder_read_error": "Hata: Klasör okunamadı: ",
                "root_dir_info": "Zaten kök dizindesiniz.",
                "root_dir_error": "Kök dizinin dışına çıkamazsınız.",
                "save_success": "'llm.txt' dosyası kaydedildi:\n",
                "save_error": "Dosya kaydedilemedi: ",
                "list_error": "Dizin içeriği listelenemedi: ",
                "processing": "İşleniyor...",
                "cancel": "İptal"
            },
            "RU": {
                "title": "Просмотрщик файлов и папок - Счетчик токенов LLM Context",
                "directory_content": "Содержимое каталога",
                "up_directory": "Вверх",
                "current_dir": "Текущий каталог: ",
                "select_all": "Выбрать все",
                "clear_selection": "Очистить выбор",
                "source_code": "Исходный код (Markdown)",
                "save": "Сохранить (llm.txt)",
                "total_tokens": "Общее количество токенов: ",
                "folder": "Папка",
                "file_read_error": "Не удалось прочитать файл: ",
                "folder_read_error": "Ошибка: Не удалось прочитать папку: ",
                "root_dir_info": "Уже в корневом каталоге.",
                "root_dir_error": "Нельзя выйти за пределы корневого каталога.",
                "save_success": "Файл 'llm.txt' сохранен:\n",
                "save_error": "Не удалось сохранить файл: ",
                "list_error": "Не удалось получить содержимое каталога: ",
                "processing": "Обработка...",
                "cancel": "Отмена"
            }
        }
        
        self.setup_ui()
        self.populate_listbox()
        
        # Listen for language changes
        self.language_var.trace_add("write", self.on_language_change)
        
        # Start the task processing thread
        self.process_tasks_thread = threading.Thread(target=self.process_tasks, daemon=True)
        self.process_tasks_thread.start()
    
    def setup_ui(self) -> None:
        """Setup the user interface."""
        # Configure style
        style = ttk.Style()
        style.configure("TFrame", background="#f0f0f0")
        style.configure("TButton", padding=5, font=("Arial", 9))
        style.configure("TLabel", background="#f0f0f0", font=("Arial", 10))
        style.configure("Header.TLabel", font=("Arial", 12, "bold"))
        style.configure("Directory.TLabel", font=("Arial", 10, "italic"))
        
        # Create main panels using PanedWindow (left: list, right: content)
        self.paned: ttk.PanedWindow = ttk.PanedWindow(self.master, orient=tk.HORIZONTAL)
        self.paned.pack(fill=tk.BOTH, expand=True, padx=5, pady=5)
        
        # LEFT PANEL: Area listing directory contents and navigation buttons
        self.left_frame: ttk.Frame = ttk.Frame(self.paned, padding=10, style="TFrame")
        self.paned.add(self.left_frame, weight=1)
        
        header_frame: ttk.Frame = ttk.Frame(self.left_frame, style="TFrame")
        header_frame.pack(fill=tk.X)
        
        self.left_label: ttk.Label = ttk.Label(
            header_frame, text=self.translations["EN"]["directory_content"], style="Header.TLabel"
        )
        self.left_label.pack(side=tk.LEFT, anchor="w")
        
        self.up_button: ttk.Button = ttk.Button(
            header_frame, text=self.translations["EN"]["up_directory"], command=self.go_up_directory
        )
        self.up_button.pack(side=tk.RIGHT)
        
        self.current_path_label: ttk.Label = ttk.Label(
            self.left_frame, text="", style="Directory.TLabel"
        )
        self.current_path_label.pack(anchor="w", pady=(5, 5))
        
        # Search entry
        search_frame = ttk.Frame(self.left_frame, style="TFrame")
        search_frame.pack(fill=tk.X, pady=(0, 5))
        
        self.search_var = tk.StringVar()
        self.search_var.trace_add("write", self.on_search_change)
        
        search_entry = ttk.Entry(search_frame, textvariable=self.search_var)
        search_entry.pack(fill=tk.X)
        
        # Directory listing with custom visualization
        self.list_frame: ttk.Frame = ttk.Frame(self.left_frame, style="TFrame")
        self.list_frame.pack(fill=tk.BOTH, expand=True)
        
        # Use Treeview instead of Listbox for better visualization
        self.tree = ttk.Treeview(self.list_frame, columns=("type", "size"), show="tree headings", selectmode="extended")
        self.tree.heading("#0", text="Name")
        self.tree.heading("type", text="Type")
        self.tree.heading("size", text="Size")
        self.tree.column("#0", width=200, stretch=True)
        self.tree.column("type", width=80, stretch=False)
        self.tree.column("size", width=80, anchor="e", stretch=False)
        
        self.tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        self.list_scrollbar: ttk.Scrollbar = ttk.Scrollbar(self.list_frame, orient=tk.VERTICAL, command=self.tree.yview)
        self.list_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.tree.config(yscrollcommand=self.list_scrollbar.set)
        
        # Bind selection and double-click events to the tree
        self.tree.bind("<<TreeviewSelect>>", self.on_select)
        self.tree.bind("<Double-1>", self.on_item_double_click)
        
        # Additional selection control buttons
        self.left_button_frame: ttk.Frame = ttk.Frame(self.left_frame, style="TFrame")
        self.left_button_frame.pack(fill=tk.X, pady=(5, 0))
        
        self.select_all_button: ttk.Button = ttk.Button(
            self.left_button_frame, text=self.translations["EN"]["select_all"], command=self.select_all
        )
        self.select_all_button.pack(side=tk.LEFT, padx=(0, 5))
        
        self.clear_selection_button: ttk.Button = ttk.Button(
            self.left_button_frame, text=self.translations["EN"]["clear_selection"], command=self.clear_selection
        )
        self.clear_selection_button.pack(side=tk.LEFT)
        
        # RIGHT PANEL: Displays the source code in Markdown format and the LLM context token count
        self.right_frame: ttk.Frame = ttk.Frame(self.paned, padding=10, style="TFrame")
        self.paned.add(self.right_frame, weight=3)
        
        # Top section: Layout for the header area of the right panel using grid
        top_right_frame: ttk.Frame = ttk.Frame(self.right_frame, style="TFrame")
        top_right_frame.pack(fill=tk.X)
        
        self.right_label: ttk.Label = ttk.Label(
            top_right_frame, text=self.translations["EN"]["source_code"], style="Header.TLabel"
        )
        self.right_label.grid(row=0, column=0, sticky="w")
        
        # Progress indicator and cancel button for long operations
        self.progress_frame = ttk.Frame(top_right_frame, style="TFrame")
        self.progress_frame.grid(row=0, column=1, sticky="e")
        
        self.progress_label = ttk.Label(self.progress_frame, text="", style="TLabel")
        self.progress_label.pack(side=tk.LEFT, padx=(0, 5))
        
        self.cancel_button = ttk.Button(
            self.progress_frame, text=self.translations["EN"]["cancel"], 
            command=self.cancel_current_task, state=tk.DISABLED
        )
        self.cancel_button.pack(side=tk.LEFT)
        
        # Hide progress frame initially
        self.progress_frame.grid_remove()
        
        # Language mode select box in the top right corner (default "EN", options: EN, TR, RU)
        self.language_var: tk.StringVar = tk.StringVar(value="EN")
        language_combobox: ttk.Combobox = ttk.Combobox(
            top_right_frame, values=["EN", "TR", "RU"], state="readonly", width=5, textvariable=self.language_var
        )
        language_combobox.grid(row=0, column=3, sticky="e", padx=(0, 5))
        
        self.save_button: ttk.Button = ttk.Button(
            top_right_frame, text=self.translations["EN"]["save"], command=self.save_to_file
        )
        self.save_button.grid(row=0, column=2, sticky="e", padx=(5, 5))
        
        top_right_frame.columnconfigure(1, weight=1)
        
        # Text widget with syntax highlighting for Markdown source code
        self.text_frame = ttk.Frame(self.right_frame, style="TFrame")
        self.text_frame.pack(fill=tk.BOTH, expand=True)
        
        self.text: tk.Text = tk.Text(
            self.text_frame, wrap=tk.NONE, font=("Consolas", 10), 
            bg="#ffffff", fg="#000000", insertbackground="#000000",
            selectbackground="#c0c0c0", selectforeground="#000000"
        )
        self.text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        self.text_scrollbar_y: ttk.Scrollbar = ttk.Scrollbar(
            self.text_frame, orient=tk.VERTICAL, command=self.text.yview
        )
        self.text_scrollbar_y.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.text_scrollbar_x: ttk.Scrollbar = ttk.Scrollbar(
            self.right_frame, orient=tk.HORIZONTAL, command=self.text.xview
        )
        self.text_scrollbar_x.pack(side=tk.BOTTOM, fill=tk.X)
        
        self.text.config(
            yscrollcommand=self.text_scrollbar_y.set,
            xscrollcommand=self.text_scrollbar_x.set
        )
        
        # Configure text tags for syntax highlighting
        self.text.tag_configure("header", foreground="#0000ff", font=("Consolas", 12, "bold"))
        self.text.tag_configure("code_block", foreground="#008000")
        self.text.tag_configure("code_marker", foreground="#800080")
        
        # Bottom frame for token count label so it is not hidden by the text widget
        self.bottom_frame: tk.Frame = tk.Frame(self.right_frame, bg="#222222")
        self.bottom_frame.pack(side=tk.BOTTOM, fill=tk.X)
        
        # Use tk.Label here (instead of ttk) to allow custom background and foreground colors.
        self.token_count_label: tk.Label = tk.Label(
            self.bottom_frame,
            text=self.translations["EN"]["total_tokens"] + "0",
            font=("Arial", 10, "bold"),
            bg="#222222",
            fg="#FFFFFF"
        )
        self.token_count_label.pack(side=tk.RIGHT, padx=5, pady=5)
        
        # Bind the <<Modified>> virtual event to update token count when the text content changes
        self.text.bind("<<Modified>>", self.on_text_modified)
    
    def on_language_change(self, *args: Any) -> None:
        """Update the UI elements when the language selection changes."""
        lang: str = self.language_var.get()
        self.master.title(self.translations[lang]["title"])
        self.left_label.config(text=self.translations[lang]["directory_content"])
        self.up_button.config(text=self.translations[lang]["up_directory"])
        self.select_all_button.config(text=self.translations[lang]["select_all"])
        self.clear_selection_button.config(text=self.translations[lang]["clear_selection"])
        self.right_label.config(text=self.translations[lang]["source_code"])
        self.save_button.config(text=self.translations[lang]["save"])
        self.cancel_button.config(text=self.translations[lang]["cancel"])
        self.token_count_label.config(
            text=self.translations[lang]["total_tokens"] + str(count_tokens(self.text.get("1.0", tk.END)))
        )
        self.populate_listbox()  # Update the current directory label
    
    def on_search_change(self, *args: Any) -> None:
        """Filter the listbox content based on search term"""
        self.populate_listbox()
    
    def get_file_size_str(self, size_bytes: int) -> str:
        """Convert file size in bytes to a human-readable string"""
        for unit in ['B', 'KB', 'MB', 'GB']:
            if size_bytes < 1024.0 or unit == 'GB':
                return f"{size_bytes:.1f} {unit}" if unit != 'B' else f"{size_bytes} {unit}"
            size_bytes /= 1024.0
        return f"{size_bytes:.1f} GB"
    
    def populate_listbox(self) -> None:
        """
        List files and folders in the current directory in alphabetical order.
        Implements search filtering and caching for better performance.
        """
        try:
            # Clear the tree
            for item in self.tree.get_children():
                self.tree.delete(item)
                
            # Get items from cache or directory
            if self.current_path in self.dir_cache:
                items = self.dir_cache[self.current_path]
            else:
                items = list(self.current_path.iterdir())
                self.dir_cache[self.current_path] = items
                
            # Sort items (folders first, then files)
            folders = sorted([p for p in items if p.is_dir()], key=lambda p: p.name.lower())
            files = sorted([p for p in items if p.is_file()], key=lambda p: p.name.lower())
            
            # Filter by search term if provided
            search_term = self.search_var.get().lower()
            if search_term:
                folders = [f for f in folders if search_term in f.name.lower()]
                files = [f for f in files if search_term in f.name.lower()]
            
            # Add folders to tree
            for folder in folders:
                folder_size = sum(f.stat().st_size for f in folder.glob('**/*') if f.is_file())
                self.tree.insert("", "end", iid=str(folder), text=folder.name, 
                                values=("Folder", self.get_file_size_str(folder_size)))
                
            # Add files to tree
            for file in files:
                try:
                    size = file.stat().st_size
                    # Determine file type based on extension
                    ext = file.suffix.lower()
                    file_type = ext[1:].upper() if ext else "File"
                    self.tree.insert("", "end", iid=str(file), text=file.name, 
                                    values=(file_type, self.get_file_size_str(size)))
                except Exception:
                    self.tree.insert("", "end", iid=str(file), text=file.name, 
                                    values=("Error", "Unknown"))
            
            # Get the relative current path with respect to the base directory
            try:
                rel_current = str(self.current_path.relative_to(self.base_path))
            except ValueError:
                rel_current = str(self.current_path)
            if rel_current == ".":
                rel_current = self.base_path.name
            lang: str = self.language_var.get()
            self.current_path_label.config(text=f"{self.translations[lang]['current_dir']}{rel_current}")
            if self.current_path == self.base_path:
                self.up_button.state(["disabled"])
            else:
                self.up_button.state(["!disabled"])
        except Exception as e:
            lang = self.language_var.get()
            messagebox.showerror("Error", f"{self.translations[lang]['list_error']}{e}")
    
    def read_file_content(self, path: Path) -> str:
        """Read file content with caching for better performance"""
        if path in self.file_content_cache:
            return self.file_content_cache[path]
        
        try:
            content = path.read_text(encoding="utf-8")
            
            # Cache the content (with size management)
            if len(self.file_content_cache) >= self.max_cache_size:
                # Remove the first item (least recently added)
                self.file_content_cache.pop(next(iter(self.file_content_cache)))
            self.file_content_cache[path] = content
            
            return content
        except Exception as e:
            lang = self.language_var.get()
            return f"{self.translations[lang]['file_read_error']}{e}"
    
    def process_tasks(self) -> None:
        """Process tasks from the queue in a background thread"""
        while True:
            try:
                task = self.task_queue.get()
                if task:
                    func, args, callback = task
                    self.is_processing = True
                    self.cancel_processing = False
                    
                    # Execute task
                    result = func(*args)
                    
                    # Check if processing was cancelled
                    if not self.cancel_processing and callback:
                        # Schedule callback to run in the main thread
                        self.master.after(0, lambda: callback(result))
                    
                    self.is_processing = False
                    self.task_queue.task_done()
                    
                    # Hide progress indicator when all tasks are done
                    if self.task_queue.empty():
                        self.master.after(0, self.hide_progress)
            except Exception as e:
                print(f"Error in task processing: {e}")
            
            # Small delay to prevent CPU hogging
            time.sleep(0.01)
    
    def show_progress(self) -> None:
        """Show progress indicator for long operations"""
        lang = self.language_var.get()
        self.progress_label.config(text=self.translations[lang]["processing"])
        self.progress_frame.grid()
        self.cancel_button.config(state=tk.NORMAL)
    
    def hide_progress(self) -> None:
        """Hide progress indicator when operation completes"""
        self.progress_frame.grid_remove()
        self.cancel_button.config(state=tk.DISABLED)
    
    def cancel_current_task(self) -> None:
        """Cancel the currently running task"""
        self.cancel_processing = True
    
    def get_markdown_for_path(self, path: Path, max_depth: int = 3, current_depth: int = 0) -> str:
        """
        Generate Markdown content for the given file or folder path.
        - File: Uses the relative path as a header and includes its content inside a code block.
        - Folder: Uses the folder name as a header and recursively includes all files/folders inside.
        
        Implements depth limiting to prevent excessive recursion for large directories.
        """
        # Check for cancellation request
        if self.cancel_processing:
            return "Operation cancelled"
            
        try:
            rel_path = path.relative_to(self.base_path)
        except ValueError:
            rel_path = path
        display_path: str = f"{self.base_path.name}/{rel_path.as_posix()}"
        lang: str = self.language_var.get()
        
        if path.is_file():
            content = self.read_file_content(path)
            # Get file extension
            ext = path.suffix.lower()[1:] if path.suffix else "text"
            markdown_str: str = f"## {display_path}\n\n```{ext}\n{content}\n```\n\n"
            return markdown_str
        elif path.is_dir():
            markdown_str: str = f"## {display_path} ({self.translations[lang]['folder']})\n\n"
            
            # Stop recursion if we've reached the maximum depth
            if current_depth >= max_depth:
                markdown_str += f"*Directory content not shown due to depth limit ({max_depth})*\n\n"
                return markdown_str
                
            try:
                # Get directory items from cache if available
                if path in self.dir_cache:
                    items = self.dir_cache[path]
                else:
                    items = list(path.iterdir())
                    self.dir_cache[path] = items
                
                # Process folders first, then files
                folders = sorted([p for p in items if p.is_dir()], key=lambda p: p.name.lower())
                files = sorted([p for p in items if p.is_file()], key=lambda p: p.name.lower())
                
                # Process folders
                for item in folders:
                    markdown_str += self.get_markdown_for_path(item, max_depth, current_depth + 1)
                
                # Process files
                for item in files:
                    markdown_str += self.get_markdown_for_path(item, max_depth, current_depth + 1)
                    
            except Exception as e:
                markdown_str += f"{self.translations[lang]['folder_read_error']}{e}\n\n"
            return markdown_str
        else:
            return ""
    
    def process_selection(self, selections: List[str]) -> None:
        """Process the selected items and update the text widget with markdown content"""
        # Show progress indicator
        self.show_progress()
        
        def generate_markdown(selections):
            full_markdown = ""
            for item_id in selections:
                full_path = Path(item_id)
                markdown = self.get_markdown_for_path(full_path)
                if self.cancel_processing:
                    return "Operation cancelled."
                full_markdown += markdown
            return full_markdown
        
        def update_text(markdown):
            self.text.delete("1.0", tk.END)
            if markdown:
                self.text.insert(tk.END, markdown)
                self.highlight_markdown()
            self.update_token_count()
        
        # Add the task to the queue
        self.task_queue.put((generate_markdown, (selections,), update_text))
    
    def highlight_markdown(self) -> None:
        """Apply syntax highlighting to the markdown text"""
        content = self.text.get("1.0", tk.END)
        
        # Clear existing tags
        for tag in ["header", "code_block", "code_marker"]:
            self.text.tag_remove(tag, "1.0", tk.END)
        
        # Highlight headers (## text)
        pos = "1.0"
        while True:
            header_start = self.text.search("^## ", pos, tk.END, regexp=True)
            if not header_start:
                break
            header_end = self.text.search("\n", header_start, tk.END)
            if not header_end:
                header_end = tk.END
            self.text.tag_add("header", header_start, header_end)
            pos = header_end
        
        # Highlight code blocks
        pos = "1.0"
        in_code_block = False
        start_pos = None
        
        while True:
            marker_pos = self.text.search("```", pos, tk.END)
            if not marker_pos:
                break
                
            marker_end = f"{marker_pos}+3c"
            
            # Add tag for the code marker itself
            self.text.tag_add("code_marker", marker_pos, marker_end)
            
            if not in_code_block:
                # Start of code block
                start_pos = marker_end
                in_code_block = True
            else:
                # End of code block
                self.text.tag_add("code_block", start_pos, marker_pos)
                in_code_block = False
                
            pos = marker_end
    
    def on_select(self, event: Any) -> None:
        """
        When an item is selected in the tree, insert the Markdown content 
        of the selected file(s) or folder(s) into the Text widget.
        Uses threading to prevent UI freezing for large files/folders.
        """
        selections = self.tree.selection()
        if not selections:
            self.text.delete("1.0", tk.END)
            self.update_token_count()
            return
            
        self.process_selection(selections)
    
    def on_item_double_click(self, event: Any) -> None:
        """
        If a folder is double-clicked in the tree, navigate into that folder.
        """
        selection = self.tree.selection()
        if not selection:
            return
        item_id = selection[0]
        full_path = Path(item_id)
        if full_path.is_dir():
            self.current_path = full_path
            self.populate_listbox()
            self.text.delete("1.0", tk.END)
            self.update_token_count()
    
    def go_up_directory(self) -> None:
        """
        Navigate to the parent directory (preventing navigation outside the base directory).
        """
        lang: str = self.language_var.get()
        if self.current_path == self.base_path:
            messagebox.showinfo("Info", self.translations[lang]["root_dir_info"])
            return
        new_path: Path = self.current_path.parent
        try:
            new_path.relative_to(self.base_path)
        except ValueError:
            messagebox.showerror("Error", self.translations[lang]["root_dir_error"])
            return
        self.current_path = new_path
        self.populate_listbox()
        self.text.delete("1.0", tk.END)
        self.update_token_count()
    
    def select_all(self) -> None:
        """Select all items in the tree."""
        for item in self.tree.get_children():
            self.tree.selection_add(item)
        self.on_select(None)
    
    def clear_selection(self) -> None:
        """Clear the selection in the tree and clear the Text widget."""
        self.tree.selection_remove(self.tree.selection())
        self.text.delete("1.0", tk.END)
        self.update_token_count()
    
    def save_to_file(self) -> None:
        """Save the Markdown content from the Text widget to 'llm.txt' in the base directory."""
        content: str = self.text.get("1.0", tk.END)
        file_path: Path = self.base_path / "llm.txt"
        lang: str = self.language_var.get()
        try:
            file_path.write_text(content, encoding="utf-8")
            messagebox.showinfo("Success", f"{self.translations[lang]['save_success']}{str(file_path)}")
        except Exception as e:
            messagebox.showerror("Error", f"{self.translations[lang]['save_error']}{e}")
    
    def update_token_count(self) -> None:
        """Calculate the token count of the text and update the token count label."""
        content: str = self.text.get("1.0", tk.END)
        
        # Use a background thread for token counting of large texts
        def count_in_background(text):
            return count_tokens(text)
            
        def update_label(count):
            lang: str = self.language_var.get()
            self.token_count_label.config(text=f"{self.translations[lang]['total_tokens']}{count}")
            
        # For very small texts, count directly to avoid the overhead of creating a thread
        if len(content) < 10000:
            update_label(count_tokens(content))
        else:
            self.task_queue.put((count_in_background, (content,), update_label))
    
    def on_text_modified(self, event: Any) -> None:
        """
        Triggered when the <<Modified>> event occurs in the Text widget;
        updates the token count after text changes.
        Note: The event may trigger twice in some cases, so the modified flag is reset.
        """
        self.update_token_count()
        self.text.edit_modified(False)


def main() -> None:
    """Main function to run the File Explorer application."""
    root: tk.Tk = tk.Tk()
    # Set the overall window transparency to 97%
    root.attributes("-alpha", 0.97)
    
    # Configure ttk style
    style: ttk.Style = ttk.Style(root)
    style.theme_use("clam")
    
    # Configure colors
    style.configure(".", background="#f0f0f0", foreground="#000000")
    style.configure("Treeview", background="#ffffff", fieldbackground="#ffffff", foreground="#000000")
    style.map("Treeview", background=[("selected", "#4a6984")], foreground=[("selected", "#ffffff")])
    
    app = FileExplorer(root)
    root.mainloop()


if __name__ == "__main__":
    main()
